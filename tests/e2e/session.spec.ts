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

test('legacy PIN renewal confirms the value, blocks pending edits and revokes the old session before reopening the ERP', async ({ page, request }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: /Cuenta Antigua/ }).click();
  await page.getByLabel('PIN de acceso').fill('0000');
  const login = page.waitForResponse(response => response.url().endsWith('/api/login'));
  await page.getByRole('button', { name: 'Acceder' }).click();
  const { token } = await (await login).json();
  await expect(page.getByRole('heading', { name: 'Renueva tu PIN' })).toBeVisible();
  await expect(page.getByText('Panel Personal')).toHaveCount(0);
  await page.getByLabel('PIN actual').fill('0000');
  await page.getByLabel('PIN nuevo', { exact: true }).fill('135790');
  await page.getByLabel('Confirmar PIN nuevo').fill('135791');
  let writes = 0; let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/auth/pin', async route => { writes++; await gate; await route.continue(); });
  await page.getByRole('button', { name: 'Cambiar PIN y salir' }).click();
  await expect(page.getByRole('alert')).toContainText('no coincide'); expect(writes).toBe(0);
  await page.getByLabel('Confirmar PIN nuevo').fill('135790');
  await page.screenshot({ path: testInfo.outputPath('pin-renewal-mobile.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Cambiar PIN y salir' }).click();
  try { await expect(page.getByLabel('PIN actual')).toBeDisabled(); await expect(page.getByLabel('Confirmar PIN nuevo')).toBeDisabled(); await expect(page.getByRole('button', { name: 'Cancelar y salir' })).toBeDisabled(); }
  finally { release(); }
  await expect(page.getByText('Selecciona tu perfil')).toBeVisible();
  expect(writes).toBe(1);
  expect((await request.get('http://127.0.0.1:3101/api/turnos', { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(401);
  await page.getByRole('button', { name: /Cuenta Antigua/ }).click();
  await page.getByLabel('PIN de acceso').fill('0000'); await page.getByRole('button', { name: 'Acceder' }).click();
  await expect(page.getByText('PIN incorrecto', { exact: true })).toBeVisible();
  await page.getByLabel('PIN de acceso').fill('135790');
  await page.getByRole('button', { name: 'Acceder' }).click();
  await expect(page.getByText('Hola, Cuenta')).toBeVisible();
});
