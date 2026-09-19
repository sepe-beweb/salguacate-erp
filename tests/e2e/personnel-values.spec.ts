import { test, expect, type Page } from '@playwright/test';

async function enter(page: Page, name: string) {
  await page.goto('/'); await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.getByLabel('PIN de acceso').fill('246810'); await page.getByRole('button', { name: 'Acceder' }).click();
}

test('employee and reviewer agree on civil request dates in both time zones', async ({ browser }, testInfo) => {
  for (const timezoneId of ['America/Los_Angeles', 'Pacific/Kiritimati']) {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5174', timezoneId, viewport: { width: 390, height: 844 } });
    const employee = await context.newPage(); const reviewer = await context.newPage();
    try {
      await enter(employee, 'María García');
      await employee.getByRole('button', { name: 'Solicitudes', exact: true }).click();
      const comment = `Petición civil ${timezoneId} ${testInfo.retry}`;
      await employee.getByLabel('Desde').fill('2024-02-29'); await employee.getByLabel('Hasta').fill('2024-03-01');
      await employee.getByLabel('Comentarios (Opcional)').fill(comment);
      await employee.getByRole('button', { name: 'Enviar Petición' }).click();
      await expect(employee.getByRole('status')).toContainText('Petición enviada correctamente');
      const ownCard = employee.getByText(`"${comment}"`, { exact: true }).locator('../..');
      await expect(ownCard).toContainText('29/02/2024 al 01/03/2024');
      await enter(reviewer, 'Encargado Principal');
      await reviewer.getByRole('link', { name: 'RRHH', exact: true }).click();
      await reviewer.getByRole('button', { name: /Peticiones de Personal/ }).click();
      const reviewCard = reviewer.getByText(`"${comment}"`, { exact: true }).locator('../..');
      await expect(reviewCard).toContainText('29/02/2024'); await expect(reviewCard).toContainText('01/03/2024');
      await reviewCard.getByRole('button', { name: 'Rechazar', exact: true }).click();
      await expect(reviewCard).toContainText('Rechazada');
      await reviewer.screenshot({ path: testInfo.outputPath(`personnel-${timezoneId.split('/')[1]}.png`), fullPage: true, animations: 'disabled' });
      await employee.getByRole('button', { name: 'Inicio', exact: true }).click();
      await employee.getByRole('button', { name: 'Solicitudes', exact: true }).click();
      await expect(ownCard).toContainText('Rechazado'); await expect(ownCard).toContainText('29/02/2024 al 01/03/2024');
    } finally { await context.close(); }
  }
});
