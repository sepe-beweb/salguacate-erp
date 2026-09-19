import { test, expect } from '@playwright/test';
test('mobile navigation remains complete during panel failure, owns focus and closes on navigation or desktop resize', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  // Only this read is unavailable. Other routes still use the real disposable API.
  await page.route('**/api/cierres', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Resumen temporalmente no disponible' }) }));
  await page.goto('/'); await page.getByRole('button', { name: /Encargado Principal/ }).click();
  await page.getByLabel('PIN de acceso').fill('246810'); await page.getByRole('button', { name: 'Acceder' }).click();
  await expect(page.getByRole('alert')).toContainText('Resumen temporalmente no disponible');
  const open = page.getByRole('button', { name: 'Abrir navegación' }); await open.click();
  const dialog = page.getByRole('dialog', { name: 'Navegación', exact: true });
  await expect(dialog.getByRole('button', { name: 'Panel de Control', exact: true })).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Gastos', exact: true })).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: 'Recursos Humanos' })).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: 'Solicitudes', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Modo Oscuro' }).evaluate(button => button.focus()); await expect(page.getByRole('button', { name: 'Modo Oscuro' })).not.toBeFocused();
  await page.keyboard.press('Escape'); await expect(open).toBeFocused(); await expect(dialog).toHaveCount(0);
  await open.click(); await dialog.getByRole('button', { name: 'Recursos Humanos' }).click();
  await expect(dialog).toHaveCount(0); await expect(page.getByRole('heading', { name: 'Recursos Humanos' })).toBeVisible();
  await open.click(); await expect(dialog.getByRole('button', { name: 'Recursos Humanos' })).toHaveAttribute('aria-current', 'page');
  await page.screenshot({ path: testInfo.outputPath('navigation-320.png'), animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 800 }); await expect(dialog).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Lista de Checklists' }).click();
  await expect(page).toHaveURL(/\/tareas$/); await page.setViewportSize({ width: 768, height: 900 }); await open.click();
  await dialog.getByRole('button', { name: 'Informes Mensuales' }).click(); await expect(page).toHaveURL(/\/informes$/); await expect(dialog).toHaveCount(0);
});
test('employee mobile menu offers only personal destinations and settings', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/'); await page.getByRole('button', { name: /María García/ }).click();
  await page.getByLabel('PIN de acceso').fill('246810'); await page.getByRole('button', { name: 'Acceder' }).click();
  await page.getByRole('button', { name: 'Abrir navegación' }).click();
  const dialog = page.getByRole('dialog', { name: 'Navegación', exact: true });
  await expect(dialog.getByRole('navigation').getByRole('button')).toHaveCount(6);
  await expect(dialog.getByRole('button', { name: /Gastos|Recursos Humanos|Informes/ })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('navigation-employee.png'), animations: 'disabled' });
  await dialog.getByRole('button', { name: 'Solicitudes', exact: true }).click(); await expect(page).toHaveURL(/\/peticiones$/); await expect(dialog).toHaveCount(0);
});
