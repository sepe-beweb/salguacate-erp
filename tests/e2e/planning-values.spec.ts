import { test, expect } from '@playwright/test';

test('task lifecycle and agenda retain civil dates on mobile in western and eastern time zones', async ({ browser }, testInfo) => {
  for (const timezoneId of ['America/Los_Angeles', 'Pacific/Kiritimati']) {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5174', timezoneId, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    try {
      await page.clock.setFixedTime(new Date(timezoneId === 'America/Los_Angeles' ? '2024-02-29T23:30:00-08:00' : '2024-02-29T00:30:00+14:00'));
      await page.goto('/'); await page.getByRole('button', { name: /Jefe Admin/ }).click();
      await page.getByLabel('PIN de acceso').fill('246810'); await page.getByRole('button', { name: 'Acceder' }).click();
      await page.getByRole('link', { name: 'Tareas', exact: true }).click();
      await page.getByRole('button', { name: 'Nueva', exact: true }).click();
      await expect(page.getByLabel('Fecha', { exact: true })).toHaveValue('2024-02-29');
      const title = `Tarea civil ${timezoneId} ${testInfo.retry}`;
      await page.getByLabel('Tarea', { exact: true }).fill(title);
      await page.getByLabel('Detalles (Opcional)').fill('Borrador completo de prueba');
      await page.getByLabel('Prioridad', { exact: true }).selectOption('alta');
      await page.getByLabel('Local', { exact: true }).selectOption('Principal');
      await page.getByRole('button', { name: 'Crear Tarea', exact: true }).click();
      await expect(page.getByText(title, { exact: true })).toBeVisible();
      await expect(page.getByText('29/02/2024', { exact: true })).toBeVisible();
      await expect(page.getByText(/Atrasada/)).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`tasks-${timezoneId.split('/')[1]}.png`), fullPage: true, animations: 'disabled' });
      page.once('dialog', dialog => dialog.dismiss());
      await page.getByRole('button', { name: `Eliminar tarea: ${title}`, exact: true }).click();
      await expect(page.getByText(title, { exact: true })).toBeVisible();
      await page.getByRole('button', { name: `Completar: ${title}`, exact: true }).click();
      await expect(page.getByText(title, { exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: /Hechas/ }).click();
      await expect(page.getByText(title, { exact: true })).toBeVisible();
      await page.getByRole('button', { name: `Marcar pendiente: ${title}`, exact: true }).click();
      await page.getByRole('button', { name: /Pendientes/ }).click();
      await expect(page.getByText(title, { exact: true })).toBeVisible();
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: `Eliminar tarea: ${title}`, exact: true }).click();
      await expect(page.getByText(title, { exact: true })).toHaveCount(0);

      await page.getByRole('button', { name: 'Inicio', exact: true }).click();
      await page.getByRole('link', { name: 'Agenda', exact: true }).click();
      await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
      await expect(page.getByLabel('Fecha', { exact: true })).toHaveValue('2024-02-29');
      const eventTitle = `Evento civil ${timezoneId} ${testInfo.retry}`;
      await page.getByLabel('Título', { exact: true }).fill(eventTitle);
      await page.getByLabel('Hora', { exact: true }).fill('23:59');
      await page.getByRole('button', { name: 'Guardar Evento', exact: true }).click();
      const eventCard = page.getByRole('heading', { name: eventTitle, exact: true }).locator('../../..');
      await expect(eventCard).toContainText('29/02/2024');
      await eventCard.getByRole('button', { name: 'Editar', exact: true }).click();
      await expect(page.getByLabel('Fecha', { exact: true })).toHaveValue('2024-02-29');
      await page.getByLabel('Fecha', { exact: true }).fill('2024-03-01');
      await page.getByRole('button', { name: 'Guardar Cambios', exact: true }).click();
      await expect(eventCard).toContainText('01/03/2024');
      page.once('dialog', dialog => dialog.accept());
      await eventCard.getByRole('button', { name: 'Eliminar', exact: true }).click();
      await expect(page.getByRole('heading', { name: eventTitle, exact: true })).toHaveCount(0);
    } finally { await context.close(); }
  }
});
