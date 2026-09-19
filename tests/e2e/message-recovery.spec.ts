import { test, expect, type Page } from '@playwright/test';
async function login(page: Page, name: string) {
  await page.goto('/'); await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.getByLabel('PIN de acceso').fill('246810'); await page.getByRole('button', { name: 'Acceder' }).click();
  await page.getByRole('button', { name: 'Buzón', exact: true }).click();
}
test('mobile inbox preserves the pending message and displays the recorded UTC instant in either time zone', async ({ browser }, testInfo) => {
  for (const timezoneId of ['America/Los_Angeles', 'Pacific/Kiritimati']) {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5174', viewport: { width: 390, height: 844 }, timezoneId });
    try {
      const sender = await context.newPage(); await login(sender, 'María García');
      await sender.getByRole('button', { name: 'Nuevo mensaje' }).click();
      await expect(sender.getByLabel('Destinatario')).toHaveValue('0');
      await sender.getByLabel('Destinatario').selectOption('1');
      const subject = `Mensaje móvil ${timezoneId} ${testInfo.retry}`;
      await sender.getByLabel('Asunto', { exact: true }).fill(subject); await sender.getByLabel('Mensaje', { exact: true }).fill('Turno confirmado\nEquipo de noche');
      await sender.getByRole('button', { name: 'Cancelar mensaje' }).click(); await sender.getByRole('button', { name: 'Nuevo mensaje' }).click();
      await expect(sender.getByLabel('Mensaje', { exact: true })).toHaveValue('Turno confirmado\nEquipo de noche');
      sender.once('dialog', dialog => dialog.dismiss()); await sender.getByRole('button', { name: 'Descartar borrador de mensaje' }).click();
      let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); let posts = 0;
      await sender.route('**/api/mensajes', async route => { if (route.request().method() === 'POST') { posts++; await gate; } await route.continue(); });
      await sender.getByRole('button', { name: 'Enviar Mensaje' }).click();
      try { await expect(sender.getByLabel('Destinatario')).toBeDisabled(); await expect(sender.getByLabel('Mensaje', { exact: true })).toBeDisabled(); await expect(sender.getByRole('button', { name: 'Cancelar mensaje' })).toBeDisabled(); }
      finally { release(); }
      await expect(sender.getByText('Mensaje enviado correctamente.')).toBeVisible(); expect(posts).toBe(1);
      const receiver = await context.newPage();
      const inbox = receiver.waitForResponse(response => response.url().endsWith('/api/mensajes') && response.request().method() === 'GET');
      await login(receiver, 'Jefe Admin');
      const rows = await (await inbox).json(); const row = rows.find((item: { asunto: string }) => item.asunto === subject);
      expect(rows.filter((item: { asunto: string }) => item.asunto === subject)).toHaveLength(1);
      const card = receiver.getByText(subject, { exact: true }).locator('..');
      await expect(card).toContainText('María García'); await expect(card).toContainText('Turno confirmado');
      await expect(card.locator('time')).toHaveAttribute('datetime', row.fecha);
      await expect(card.locator('time')).toHaveText(new Intl.DateTimeFormat('es-ES', { timeZone: timezoneId, year: 'numeric', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(row.fecha)));
      await receiver.screenshot({ path: testInfo.outputPath(`inbox-${timezoneId.split('/')[1]}.png`), fullPage: true, animations: 'disabled' });
    } finally { await context.close(); }
  }
});
