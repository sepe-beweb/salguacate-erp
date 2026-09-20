import { test, expect } from '@playwright/test';

test('named venues keep stable IDs, operational scope survives navigation and resets on logout', async ({ page, request }, info) => {
  const login = await request.post('http://127.0.0.1:3101/api/login', { data: { usuario_id: 1, pin: '246810' } });
  expect(login.ok()).toBe(true);
  const { token } = await login.json();
  const headers = { Authorization: `Bearer ${token}` };
  for (const [id, nombre, rol, local] of [[2, 'Dora', 'manager', 'Principal'], [1, 'Felipe', 'owner', 'Todos']]) {
    expect((await request.put(`http://127.0.0.1:3101/api/usuarios/${id}`, { headers, data: { nombre, rol, local, telefono: '' } })).ok()).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await expect(page.getByRole('button', { name: /Dora/ })).toBeVisible();
  await page.getByRole('button', { name: /Felipe/ }).click();
  await page.getByLabel('PIN de acceso').fill('246810'); await page.getByRole('button', { name: 'Acceder' }).click();
  await expect(page.getByRole('heading', { name: 'Hoy en tus locales' })).toBeVisible();
  await page.getByRole('button', { name: 'Salmón', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hoy en Salmón' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('home-salmon-mobile.png'), fullPage: true });
  await page.getByRole('link', { name: 'Registrar gasto', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Local', exact: true })).toHaveValue('Segundo Local');
  await expect(page.getByRole('combobox', { name: 'Local de consulta' })).toHaveValue('Segundo Local');
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hoy en Salmón' })).toBeVisible();
  await page.getByRole('link', { name: 'Organizar tareas' }).click();
  await expect(page.getByRole('button', { name: 'Salmón', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Nueva', exact: true }).click();
  await expect(page.getByLabel('Local', { exact: true })).toHaveValue('Segundo Local');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('button', { name: 'Abrir navegación' }).click();
  const dialog = page.getByRole('dialog', { name: 'Navegación', exact: true });
  await expect(dialog.getByRole('heading', { name: 'Operativa', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Inicio', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: info.outputPath('home-salmon-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Cerrar Sesión', exact: true }).click();
  await page.getByRole('button', { name: /Dora/ }).click();
  await page.getByLabel('PIN de acceso').fill('246810'); await page.getByRole('button', { name: 'Acceder' }).click();
  await expect(page.getByRole('heading', { name: 'Hoy en Aguacate' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Personal y turnos' })).toBeVisible();
});
