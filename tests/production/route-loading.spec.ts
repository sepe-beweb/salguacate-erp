import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { jsPDF } from 'jspdf';
import { randomUUID } from 'node:crypto';

function routeAsset(name: string) {
  const manifest = JSON.parse(readFileSync(resolve('dist/erp/.vite/manifest.json'), 'utf8'));
  const item = manifest[`src/pages/${name}.tsx`];
  expect(item?.isDynamicEntry).toBe(true);
  return `/${item.file}`;
}
test('compiled private PDF viewer serves its worker locally and renders readable pages', async ({ page, request }) => {
  const login = page.waitForResponse(r => r.url().endsWith('/api/login') && r.request().method() === 'POST');
  await enter(page); const { token } = await (await login).json();
  const pdf = new jsPDF(); pdf.text('PRIVATE COMPILED FIXTURE', 20, 30); pdf.addPage(); pdf.text('SECOND PAGE', 20, 30);
  const res = await request.post('http://127.0.0.1:3101/api/documentos', { headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': randomUUID() }, data: { local: 'Principal', titulo: 'PDF compilado', fecha: '2026-09-20', tipo: 'otro', etiquetas: [], notas: '', proveedor_id: null, archivo: { nombre: 'compiled.pdf', mime: 'application/pdf', base64: Buffer.from(pdf.output('arraybuffer')).toString('base64') } } });
  expect(res.status()).toBe(201);
  await page.getByRole('button', { name: 'Documentos', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir PDF compilado', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Ficha del documento' });
  await expect(dialog.getByText('Página 1 de 2', { exact: true })).toBeVisible();
  await dialog.getByText('Texto de esta página', { exact: true }).click(); await expect(dialog.getByText('PRIVATE COMPILED FIXTURE', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Página siguiente', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Página siguiente', exact: true })).toBeFocused();
  await expect(dialog.getByText('SECOND PAGE', { exact: true })).toBeVisible();
});
async function enter(page: Page, user = 'Jefe Admin', path = '/') {
  await page.goto(path);
  await page.getByRole('button', { name: new RegExp(user) }).click();
  await page.getByLabel('PIN de acceso').fill('246810');
  await page.getByRole('button', { name: 'Acceder' }).click();
  await expect(page.getByText(user === 'María García' ? 'Hola, María 👋' : 'Presencia registrada', { exact: true })).toBeVisible();
}

test('compiled login defers feature screens and loads each selected route on demand', async ({ page }) => {
  const assets: string[] = [];
  page.on('request', req => { if (req.resourceType() === 'script') assets.push(new URL(req.url()).pathname); });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Jefe Admin/ })).toBeVisible();
  for (const name of ['Dashboard', 'Inventory', 'Analytics', 'Reports', 'Expenses', 'Handover', 'Documents', 'employee/EmployeeDashboard']) expect(assets).not.toContain(routeAsset(name));
  await page.getByRole('button', { name: /Jefe Admin/ }).click();
  await page.getByLabel('PIN de acceso').fill('246810');
  await page.getByRole('button', { name: 'Acceder' }).click();
  await expect(page.getByText('Presencia registrada')).toBeVisible();
  expect(assets).toContain(routeAsset('Dashboard'));
  expect(assets).not.toContain(routeAsset('Analytics'));
  expect(assets.some(url => url.includes('jspdf'))).toBe(false);
  await page.getByRole('button', { name: 'Evolución económica' }).click();
  await expect(page.getByText('No hay datos suficientes para generar gráficos.', { exact: true })).toBeVisible();
  expect(assets).toContain(routeAsset('Analytics'));
  await page.getByRole('button', { name: 'Cierres de caja', exact: true }).click();
  await page.getByLabel('Total Efectivo').fill('12.50');
  await page.getByLabel('Total Tarjeta').fill('7.50');
  await page.getByRole('button', { name: 'Guardar Cierre' }).click();
  await expect(page.getByText('Cierre registrado correctamente.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Evolución económica' }).click();
  await expect(page.getByRole('heading', { name: 'Evolución económica' })).toBeVisible();
  await expect(page.locator('.recharts-surface').first()).toBeVisible();
  expect(assets.filter(url => url === routeAsset('Analytics'))).toHaveLength(1);
  expect(assets).not.toContain(routeAsset('Expenses'));
  await page.getByRole('button', { name: 'Gastos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gastos', exact: true })).toBeVisible();
  expect(assets).toContain(routeAsset('Expenses'));
  await page.getByRole('button', { name: 'Inicio' }).click();
  await expect(page.getByText('Presencia registrada')).toBeVisible();
  expect(assets.filter(url => url === routeAsset('Dashboard'))).toHaveLength(1);
  expect(assets).not.toContain(routeAsset('Handover'));
  await page.getByRole('button', { name: 'Relevo y rutinas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Relevo y rutinas', exact: true })).toBeVisible();
  await expect(page.getByText('No hay avisos pendientes para este local.')).toBeVisible();
  expect(assets).toContain(routeAsset('Handover'));
  expect(assets).not.toContain(routeAsset('Documents'));
  await page.getByRole('button', { name: 'Documentos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Documentos', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Resultados del archivo' })).toBeVisible();
  expect(assets).toContain(routeAsset('Documents'));
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
  await page.getByRole('button', { name: 'Inventario' }).click();
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
  await page.getByRole('button', { name: 'Inventario' }).click();
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
    await page.getByRole('button', { name: 'Notas' }).click();
    await expect(page.getByRole('status')).toHaveText('Cargando pantalla...');
    await page.getByRole('button', { name: 'Proveedores', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Nuevo proveedor' })).toBeVisible();
    const lateResponse = page.waitForResponse(response => new URL(response.url()).pathname === routeAsset('Notes'));
    release();
    await lateResponse;
    await expect(page.getByRole('button', { name: 'Nuevo proveedor' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Notas', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Notas' }).click();
    await expect(page.getByRole('heading', { name: 'Notas', exact: true })).toBeVisible();
  } finally { release(); }
});

for (const path of ['/inventario', '/gastos']) test(`employee direct access to ${path} redirects without downloading management screens`, async ({ page }) => {
  const assets: string[] = [];
  page.on('request', req => { if (req.resourceType() === 'script') assets.push(new URL(req.url()).pathname); });
  await enter(page, 'María García', path);
  await expect(page).toHaveURL('/');
  expect(assets).toContain(routeAsset('employee/EmployeeDashboard'));
  for (const name of ['Inventory', 'Dashboard', 'Analytics', 'HRManagement', 'Expenses']) expect(assets).not.toContain(routeAsset(name));
  await page.getByRole('button', { name: 'Mis turnos' }).click();
  await expect(page.getByRole('heading', { name: 'Mis Turnos' })).toBeVisible();
  expect(assets).toContain(routeAsset('employee/Calendar'));
  await page.getByRole('button', { name: 'Relevo y rutinas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Relevo y rutinas', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Preparar tareas del día' })).toHaveCount(0);
  expect(assets).toContain(routeAsset('Handover'));
});
