import { test, expect } from '@playwright/test';

test('logout revokes the bearer token on the real local API', async ({ page, request }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /María García/ }).click();
  await page.getByLabel('PIN de acceso').fill('246810');
  const response = page.waitForResponse(r => r.url().endsWith('/api/login') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Acceder' }).click();
  const { token } = await (await response).json();
  await expect(page.getByText('Hola, María')).toBeVisible();
  const revoked = page.waitForResponse(r => r.url().endsWith('/api/logout'));
  await page.getByRole('button', { name: 'Cerrar Sesión', exact: true }).first().click();
  expect((await revoked).status()).toBe(204);
  await expect(page.getByText('Selecciona tu perfil')).toBeVisible();
  const res = await request.get('http://127.0.0.1:3101/api/inventario', { headers: { Authorization: `Bearer ${token}` } });
  expect(res.status()).toBe(401);
});

test('legacy PIN must be renewed before opening the ERP', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Cuenta Antigua/ }).click();
  await page.getByLabel('PIN de acceso').fill('0000');
  await page.getByRole('button', { name: 'Acceder' }).click();
  await expect(page.getByRole('heading', { name: 'Renueva tu PIN' })).toBeVisible();
  await expect(page.getByText('Panel Personal')).toHaveCount(0);
  await page.getByLabel('PIN actual').fill('0000');
  await page.getByLabel('PIN nuevo').fill('135790');
  await page.getByRole('button', { name: 'Cambiar PIN y salir' }).click();
  await expect(page.getByText('Selecciona tu perfil')).toBeVisible();
  await page.getByRole('button', { name: /Cuenta Antigua/ }).click();
  await page.getByLabel('PIN de acceso').fill('135790');
  await page.getByRole('button', { name: 'Acceder' }).click();
  await expect(page.getByText('Hola, Cuenta')).toBeVisible();
});
