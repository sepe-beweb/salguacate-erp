import { test, expect } from '@playwright/test';

test('mobile catalogue and alerts share quantities, separate supplier identities and locals, and recover invalid reads', async ({ page, request }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await page.getByRole('button', { name: /Jefe Admin/ }).click();
  await page.getByLabel('PIN de acceso').fill('246810'); const login = page.waitForResponse(r => r.url().endsWith('/api/login'));
  await page.getByRole('button', { name: 'Acceder' }).click();
  const { token } = await (await login).json(); const headers = { Authorization: `Bearer ${token}` };
  await expect(page.getByText('Presencia en Tiempo Real')).toBeVisible();
  const ids: number[] = [];
  for (let index = 0; index < 2; index++) {
    const response = await request.post('http://127.0.0.1:3101/api/proveedores', { headers, data: { nombre: '__proto__', telefono: '', email: '' } });
    expect(response.ok()).toBe(true); ids.push((await response.json()).id);
  }
  const products = [
    { producto: 'Agua al mínimo', stock_actual: 5, stock_minimo: 5, local: 'Principal', categoria: 'Bebida', proveedor_id: ids[0] },
    { producto: 'Zumo bajo', stock_actual: 2, stock_minimo: 5, local: 'Principal', categoria: 'Bebida', proveedor_id: ids[1] },
    { producto: 'Pan del segundo local', stock_actual: 0, stock_minimo: 3, local: 'Segundo Local', categoria: 'Comida', proveedor_id: ids[0] }
  ];
  for (const data of products) expect((await request.post('http://127.0.0.1:3101/api/inventario', { headers, data })).ok()).toBe(true);
  let invalid = true;
  await page.route('**/api/inventario', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    const original = await route.fetch(); const body = await original.json();
    await route.fulfill({ response: original, json: invalid ? body.map((row: { id: number }) => ({ ...row, stock_actual: '5' })) : body });
  });
  await page.getByRole('button', { name: 'Abrir navegación' }).click();
  await page.getByRole('dialog', { name: 'Navegación' }).getByRole('button', { name: 'Almacén y Stock' }).click();
  await expect(page.getByRole('alert')).toContainText('stock contiene datos inválidos');
  await expect(page.getByRole('button', { name: 'Nuevo producto' })).toBeDisabled();
  await page.getByRole('button', { name: /Alertas de Stock/ }).click();
  await expect(page.getByText('Todo en orden')).toHaveCount(0);
  invalid = false; await page.getByRole('button', { name: 'Reintentar carga' }).click();
  await expect(page.getByRole('region')).toHaveCount(3);
  const equal = page.getByRole('region', { name: `Alertas de __proto__ · Principal · ${ids[0]}`, exact: true });
  await expect(equal).toContainText('En el mínimo (Min: 5)');
  await expect(page.getByRole('region', { name: `Alertas de __proto__ · Principal · ${ids[1]}`, exact: true })).toContainText('Hasta el mínimo: 3');
  await page.getByRole('button', { name: 'Principal', exact: true }).click();
  await expect(page.getByRole('region')).toHaveCount(2);
  await page.getByRole('button', { name: 'Catálogo', exact: true }).click();
  await page.getByRole('button', { name: 'Sumar stock de Agua al mínimo' }).click();
  await expect(page.getByRole('button', { name: 'Sumar stock de Agua al mínimo' })).toBeEnabled();
  await page.getByRole('button', { name: /Alertas de Stock/ }).click();
  await expect(page.getByRole('region')).toHaveCount(1); await expect(page.getByText('Agua al mínimo', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Segundo Local', exact: true }).click();
  await expect(page.getByRole('region')).toHaveCount(1); await expect(page.getByText('Pan del segundo local', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('catalog-alerts-mobile.png'), fullPage: true });
  const inventory = await (await request.get('http://127.0.0.1:3101/api/inventario', { headers })).json();
  expect(inventory.find((item: { producto: string }) => item.producto === 'Agua al mínimo').stock_actual).toBe(6);
  expect(await (await request.get('http://127.0.0.1:3101/api/pedidos', { headers })).json()).toEqual([]);
});
