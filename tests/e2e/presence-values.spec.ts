import { test, expect } from '@playwright/test';

test('recorded presence updates explicitly through a real clock lifecycle and renders UTC dates in both mobile zones', async ({ browser, request }, testInfo) => {
  for (const timezoneId of ['America/Los_Angeles', 'Pacific/Kiritimati']) {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5174', timezoneId, viewport: { width: 390, height: 844 } });
    try {
      const page = await context.newPage();
      await page.goto('/'); await page.getByRole('button', { name: /Jefe Admin/ }).click();
      await page.getByLabel('PIN de acceso').fill('246810'); const login = page.waitForResponse(r => r.url().endsWith('/api/login'));
      await page.getByRole('button', { name: 'Acceder' }).click();
      const { token } = await (await login).json(); const headers = { Authorization: `Bearer ${token}` };
      await expect(page.getByText('Presencia registrada', { exact: true })).toBeVisible();
      const clock = async (tipo: string) => expect((await request.post('http://127.0.0.1:3101/api/fichar', { headers, data: { usuario_id: 3, tipo } })).ok()).toBe(true);
      await clock('entrada');
      const stored = (await (await request.get('http://127.0.0.1:3101/api/fichajes/presencia', { headers })).json()).find((row: { usuario_id: number }) => row.usuario_id === 3);
      let invalid = true;
      await page.route('**/api/fichajes/presencia', async route => {
        const original = await route.fetch(); const body = await original.json();
        await route.fulfill({ response: original, json: invalid ? body.map((row: { usuario_id: number }) => ({ ...row, estado_presencia: 'desconocido' })) : body });
      });
      await page.getByRole('button', { name: 'Actualizar resumen' }).click(); await expect(page.getByRole('alert')).toContainText('presencia contiene datos inválidos');
      await expect(page.getByRole('region', { name: 'Resumen financiero mensual' })).toHaveCount(0);
      await page.getByRole('button', { name: 'Abrir navegación' }).click(); await expect(page.getByRole('dialog', { name: 'Navegación' })).toBeVisible(); await page.keyboard.press('Escape');
      invalid = false; await page.getByRole('button', { name: 'Reintentar carga' }).click();
      const card = page.getByRole('region', { name: 'Presencia registrada' }).getByText('María García', { exact: true }).locator('../../..');
      await expect(card).toContainText('Trabajando');
      const expectedDate = await page.evaluate(value => new Date(value).toLocaleString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }), stored.ultimo_fichaje_entrada);
      await expect(card.locator('time')).toHaveText(expectedDate); await expect(card.locator('time')).toHaveAttribute('datetime', stored.ultimo_fichaje_entrada);
      await clock('descanso'); await expect(card).toContainText('Trabajando');
      await page.getByRole('button', { name: 'Actualizar resumen' }).click(); await expect(card).toContainText('Descanso'); await expect(card.locator('time')).toHaveText(expectedDate);
      await clock('volver'); await page.getByRole('button', { name: 'Actualizar resumen' }).click(); await expect(card).toContainText('Trabajando');
      await clock('salida'); await page.getByRole('button', { name: 'Actualizar resumen' }).click(); await expect(card).toContainText('Fuera'); await expect(card).toContainText('Salida:');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await card.scrollIntoViewIfNeeded(); await page.screenshot({ path: testInfo.outputPath(`presence-${timezoneId.split('/')[1]}.png`), fullPage: true });
    } finally { await context.close(); }
  }
});
