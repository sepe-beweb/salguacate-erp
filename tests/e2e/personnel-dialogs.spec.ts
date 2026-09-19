import { test, expect } from '@playwright/test';

test('mobile personnel dialogs preserve drafts, clear closed PINs and save a real employee and overnight shift', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await page.getByRole('button', { name: /Jefe Admin/ }).click();
  await page.getByLabel('PIN de acceso').fill('246810'); await page.getByRole('button', { name: 'Acceder' }).click();
  await page.getByRole('link', { name: 'RRHH', exact: true }).click();
  const open = page.getByRole('button', { name: 'Empleado', exact: true }); await open.click();
  await expect(page.getByLabel('Nombre Completo')).toBeFocused();
  const name = `Personal móvil ${testInfo.retry}`;
  await page.getByLabel('Nombre Completo').fill(name); await page.getByLabel('PIN de Acceso', { exact: true }).fill('135790');
  await open.evaluate(element => element.focus()); await expect(open).not.toBeFocused();
  await page.keyboard.press('Escape'); await expect(open).toBeFocused();
  await page.getByRole('button', { name: 'Retomar borrador de empleado' }).click();
  await expect(page.getByLabel('Nombre Completo')).toHaveValue(name); await expect(page.getByLabel('PIN de Acceso', { exact: true })).toHaveValue('');
  await page.getByLabel('PIN de Acceso', { exact: true }).fill('135790');
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/usuarios', async route => { if (route.request().method() === 'POST') await gate; await route.continue(); });
  await page.getByRole('button', { name: 'Añadir Empleado', exact: true }).click();
  try { await expect(page.getByLabel('Nombre Completo')).toBeDisabled(); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toBeVisible(); }
  finally { release(); }
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Crear Cuadrante/ }).click(); await expect(page.getByLabel('Empleado', { exact: true })).toBeFocused();
  await page.getByLabel('Empleado', { exact: true }).selectOption({ label: name }); await page.getByLabel('Fecha', { exact: true }).fill('2024-02-29');
  await page.getByLabel('Compañeros (Opcional)').fill('Equipo de noche');
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: /Crear Cuadrante/ }).click();
  await expect(page.getByLabel('Fecha', { exact: true })).toHaveValue('2024-02-29');
  await expect(page.getByLabel('Hora Fin')).toHaveValue('02:00');
  page.once('dialog', dialog => dialog.dismiss()); await page.getByText('Descartar borrador de turno').click(); await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('personnel-shift-mobile.png'), animations: 'disabled' });
  const saved = page.waitForResponse(response => response.url().endsWith('/api/turnos') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Guardar Turno' }).click(); expect((await saved).ok()).toBe(true); await expect(page.getByRole('dialog')).toHaveCount(0);
  const employee = await page.context().newPage(); await employee.setViewportSize({ width: 390, height: 844 }); await employee.goto('/'); await employee.getByRole('button', { name: new RegExp(name) }).click();
  await employee.getByLabel('PIN de acceso').fill('135790'); await employee.getByRole('button', { name: 'Acceder' }).click();
  await employee.getByRole('button', { name: 'Turnos', exact: true }).click();
  await expect(employee.getByText('29/02/2024', { exact: false })).toBeVisible(); await expect(employee.getByText('18:00 - 02:00', { exact: false })).toBeVisible();
  await employee.close();
});
