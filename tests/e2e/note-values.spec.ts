import { test, expect } from '@playwright/test';

test('notes recover invalid pin flags, display the recorded UTC instant and preserve another client edit when pinned', async ({ browser, request }, testInfo) => {
  for (const timezoneId of ['America/Los_Angeles', 'Pacific/Kiritimati']) {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5174', timezoneId, viewport: { width: 390, height: 844 } });
    try {
      const page = await context.newPage();
      await page.goto('/'); await page.getByRole('button', { name: /Jefe Admin/ }).click();
      await page.getByLabel('PIN de acceso').fill('246810'); const login = page.waitForResponse(r => r.url().endsWith('/api/login'));
      await page.getByRole('button', { name: 'Acceder' }).click();
      const { token } = await (await login).json(); const headers = { Authorization: `Bearer ${token}` };
      await expect(page.getByText('Presencia registrada')).toBeVisible();
      const content = `Nota ${timezoneId}`;
      const created = await request.post('http://127.0.0.1:3101/api/notas', { headers, data: { contenido: content, color: 'sepia' } });
      expect(created.ok()).toBe(true); const id = (await created.json()).id;
      const readNote = async () => (await (await request.get('http://127.0.0.1:3101/api/notas', { headers })).json()).find((note: { id: number }) => note.id === id);
      const original = await readNote();
      let invalid = true;
      await page.route('**/api/notas', async route => {
        if (route.request().method() !== 'GET') return route.continue();
        const originalResponse = await route.fetch(); const body = await originalResponse.json();
        await route.fulfill({ response: originalResponse, json: invalid ? body.map((note: { id: number }) => ({ ...note, fijada: 'false' })) : body });
      });
      await page.getByRole('button', { name: 'Abrir navegación' }).click();
      await page.getByRole('dialog', { name: 'Navegación' }).getByRole('button', { name: 'Muro de Notas' }).click();
      await expect(page.getByRole('alert')).toContainText('notas inválidas'); await expect(page.getByRole('button', { name: 'Fijar arriba' })).toHaveCount(0);
      invalid = false; await page.getByRole('button', { name: 'Reintentar carga' }).click();
      const card = page.getByText(content, { exact: true }).locator('..');
      await expect(card).toContainText('Color registrado: sepia'); await expect(card).toContainText(original.autor);
      const instant = original.creado_en.replace(' ', 'T') + 'Z';
      const expectedDate = await page.evaluate(value => new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }), instant);
      await expect(card.locator('time')).toHaveText(expectedDate); await expect(card.locator('time')).toHaveAttribute('datetime', new Date(instant).toISOString());
      // A second client changes the note after this screen read it. Pinning must preserve that newer content.
      const edited = `${content} editada en otro cliente`;
      expect((await request.put(`http://127.0.0.1:3101/api/notas/${id}`, { headers, data: { contenido: edited, color: 'blue', fijada: false } })).ok()).toBe(true);
      const pin = page.waitForRequest(r => r.url().endsWith(`/api/notas/${id}/fijada`) && r.method() === 'PATCH');
      await card.getByRole('button', { name: 'Fijar arriba' }).click(); expect((await pin).postDataJSON()).toEqual({ fijada: true });
      const editedCard = page.getByText(edited, { exact: true }).locator('..');
      await expect(editedCard.getByRole('button', { name: 'Desfijar' })).toBeEnabled();
      expect(await readNote()).toMatchObject({ contenido: edited, color: 'blue', fijada: 1, creado_en: original.creado_en, usuario_id: original.usuario_id, autor: original.autor });
      await expect(editedCard.locator('time')).toHaveText(expectedDate);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`notes-${timezoneId.split('/')[1]}.png`), fullPage: true });
    } finally { await context.close(); }
  }
});
