import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect, type Page } from '@playwright/test';

function routeAsset(name: string) {
  const manifest = JSON.parse(readFileSync(resolve('dist/erp/.vite/manifest.json'), 'utf8'));
  const item = manifest[`src/pages/${name}.tsx`];
  expect(item?.isDynamicEntry).toBe(true);
  return `/${item.file}`;
}
async function enter(page: Page, user = 'Jefe Admin', path = '/') {
  await page.goto(path);
  await page.getByRole('button', { name: new RegExp(user) }).click();
  await page.getByLabel('PIN de acceso').fill('246810');
  await page.getByRole('button', { name: 'Acceder' }).click();
  await expect(page.getByText(user === 'María García' ? 'Hola, María 👋' : 'Presencia en Tiempo Real', { exact: true })).toBeVisible();
}

test('compiled login defers feature screens and loads each selected route on demand', async ({ page }) => {
  const assets: string[] = [];
  page.on('request', req => { if (req.resourceType() === 'script') assets.push(new URL(req.url()).pathname); });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Jefe Admin/ })).toBeVisible();
  for (const name of ['Dashboard', 'Inventory', 'Analytics', 'Reports', 'employee/EmployeeDashboard']) expect(assets).not.toContain(routeAsset(name));
  await page.getByRole('button', { name: /Jefe Admin/ }).click();
  await page.getByLabel('PIN de acceso').fill('246810');
  await page.getByRole('button', { name: 'Acceder' }).click();
  await expect(page.getByText('Presencia en Tiempo Real')).toBeVisible();
  expect(assets).toContain(routeAsset('Dashboard'));
  expect(assets).not.toContain(routeAsset('Analytics'));
  expect(assets.some(url => url.includes('jspdf'))).toBe(false);
  await page.getByRole('button', { name: 'Analíticas Visuales' }).click();
  await expect(page.getByText('No hay datos suficientes para generar gráficos.', { exact: true })).toBeVisible();
  expect(assets).toContain(routeAsset('Analytics'));
  await page.getByRole('button', { name: 'Cierres de Caja', exact: true }).click();
  await page.getByLabel('Total Efectivo').fill('12.50');
  await page.getByLabel('Total Tarjeta').fill('7.50');
  await page.getByRole('button', { name: 'Guardar Cierre' }).click();
  await expect(page.getByText('Cierre registrado correctamente.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Analíticas Visuales' }).click();
  await expect(page.getByRole('heading', { name: 'Analíticas Financieras' })).toBeVisible();
  await expect(page.locator('.recharts-surface').first()).toBeVisible();
  expect(assets.filter(url => url === routeAsset('Analytics'))).toHaveLength(1);
  await page.getByRole('button', { name: 'Panel de Control' }).click();
  await expect(page.getByText('Presencia en Tiempo Real')).toBeVisible();
  expect(assets.filter(url => url === routeAsset('Dashboard'))).toHaveLength(1);
});

test('a missing compiled chunk leaves navigation usable and reload needs explicit confirmation', async ({ page }, testInfo) => {
  await enter(page);
  const inventory = routeAsset('Inventory');
  let failures = 0;
  const documents: string[] = [];
  const writes: string[] = [];
  page.on('request', req => {
    if (req.resourceType() === 'document') documents.push(req.url());
    if (req.method() !== 'GET' && req.url().includes('/api/')) writes.push(req.url());
  });
  await page.route(`**${inventory}`, route => { failures++; return route.fulfill({ status: 404, contentType: 'text/javascript', body: '' }); });
  await page.getByRole('button', { name: 'Almacén y Stock' }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo mostrar esta pantalla');
  expect(failures).toBe(1);
  expect(documents).toEqual([]);
  expect(writes).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('module-error-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Inicio', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });
  page.once('dialog', dialog => { expect(dialog.message()).toContain('borradores'); return dialog.dismiss(); });
  await page.getByRole('button', { name: 'Recargar aplicación' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(documents).toEqual([]);
  await page.getByRole('button', { name: 'Proveedores', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nuevo proveedor' })).toBeVisible();
  await page.getByRole('button', { name: 'Almacén y Stock' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(failures).toBe(1);
  await page.unroute(`**${inventory}`);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Recargar aplicación' }).click();
  await expect(page.getByRole('button', { name: /Jefe Admin/ })).toBeVisible();
  expect(documents).toHaveLength(1);
  await page.getByRole('button', { name: /Jefe Admin/ }).click();
  await page.getByLabel('PIN de acceso').fill('246810');
  await page.getByRole('button', { name: 'Acceder' }).click();
  await expect(page.getByRole('button', { name: 'Nuevo producto' })).toBeVisible();
});

test('a delayed chunk shows loading while the user can leave and late completion cannot replace the new route', async ({ page }) => {
  await enter(page);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**${routeAsset('Notes')}`, async route => { await pending; await route.continue(); });
  try {
    await page.getByRole('button', { name: 'Muro de Notas' }).click();
    await expect(page.getByRole('status')).toHaveText('Cargando pantalla...');
    await page.getByRole('button', { name: 'Proveedores', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Nuevo proveedor' })).toBeVisible();
    const lateResponse = page.waitForResponse(response => new URL(response.url()).pathname === routeAsset('Notes'));
    release();
    await lateResponse;
    await expect(page.getByRole('button', { name: 'Nuevo proveedor' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Notas', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Muro de Notas' }).click();
    await expect(page.getByRole('heading', { name: 'Notas', exact: true })).toBeVisible();
  } finally { release(); }
});

test('employee direct access to a management URL redirects without downloading management screens', async ({ page }) => {
  const assets: string[] = [];
  page.on('request', req => { if (req.resourceType() === 'script') assets.push(new URL(req.url()).pathname); });
  await enter(page, 'María García', '/inventario');
  await expect(page).toHaveURL('/');
  expect(assets).toContain(routeAsset('employee/EmployeeDashboard'));
  for (const name of ['Inventory', 'Dashboard', 'Analytics', 'HRManagement']) expect(assets).not.toContain(routeAsset(name));
  await page.getByRole('button', { name: 'Turnos Asignados' }).click();
  await expect(page.getByRole('heading', { name: 'Mis Turnos' })).toBeVisible();
  expect(assets).toContain(routeAsset('employee/Calendar'));
});
