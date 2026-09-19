import { test, expect } from '@playwright/test';

test('mobile order draft keeps its local, focus and quantities and registers same-name suppliers independently', async ({ page, request }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await page.getByRole('button', { name: /Jefe Admin/ }).click();
  await page.getByLabel('PIN de acceso').fill('246810');
  const login = page.waitForResponse(r => r.url().endsWith('/api/login'));
  await page.getByRole('button', { name: 'Acceder' }).click();
  const { token } = await (await login).json(); const headers = { Authorization: `Bearer ${token}` };
  await expect(page.getByText('Presencia registrada')).toBeVisible();
  const providers: { id: number; name: string; productId: number; product: string }[] = [];
  for (const [index, name] of ['Distribuidor homónimo', 'Distribuidor homónimo', '__proto__'].entries()) {
    const supplier = await request.post('http://127.0.0.1:3101/api/proveedores', { headers, data: { nombre: name, telefono: `60000000${index}` } });
    expect(supplier.ok()).toBe(true); const id = (await supplier.json()).id;
    const product = `Producto de proveedor ${index + 1}`;
    const created = await request.post('http://127.0.0.1:3101/api/inventario', { headers, data: { producto: product, stock_actual: 2, stock_minimo: 5, local: 'Principal', categoria: 'Bebida', proveedor_id: id } });
    expect(created.ok()).toBe(true); providers.push({ id, name, product, productId: (await created.json()).id });
  }
  await page.getByRole('button', { name: 'Abrir navegación' }).click();
  await page.getByRole('dialog', { name: 'Navegación' }).getByRole('button', { name: 'Pedidos de Reposición' }).click();
  await page.getByRole('button', { name: 'Seleccionar stock bajo' }).click();
  const generate = page.getByRole('button', { name: /Generar Pedido/ }); await generate.click();
  const dialog = page.getByRole('dialog', { name: 'Pedido de Principal' });
  await expect(dialog.getByRole('button', { name: 'Cerrar pedido' })).toBeFocused();
  await expect(dialog.getByRole('region')).toHaveCount(3);
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement?.closest('dialog'))).toBe(true);
  }
  await dialog.getByRole('button', { name: `Sumar unidades de ${providers[0].product}` }).click();
  const date = await dialog.getByText(/^Fecha del pedido:/).textContent();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(generate).toBeFocused();
  await page.getByRole('button', { name: 'Segundo Local', exact: true }).click();
  await expect(page.getByText('No hay productos en')).toBeVisible();
  await page.getByRole('button', { name: 'Retomar pedido de Principal' }).click();
  await expect(dialog).toBeVisible(); await expect(dialog.getByText(date!, { exact: true })).toBeVisible();
  const first = dialog.getByRole('region', { name: `${providers[0].name} · proveedor ${providers[0].id}`, exact: true });
  await expect(first.getByText('4', { exact: true })).toBeVisible();
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  let held = false;
  await page.route('**/api/pedidos', async route => {
    if (route.request().method() === 'POST' && !held) { held = true; await gate; }
    await route.continue();
  });
  await first.getByRole('button', { name: 'Registrar pedido en historial' }).click();
  await expect.poll(() => held).toBe(true);
  try {
    await page.keyboard.press('Escape'); await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cerrar pedido' })).toBeDisabled();
    await expect(first.getByRole('button', { name: `Sumar unidades de ${providers[0].product}` })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Descartar borrador de pedido' })).toBeDisabled();
  } finally { release(); }
  await expect(first.getByRole('button', { name: 'Pedido registrado' })).toBeDisabled();
  for (const supplier of providers.slice(1)) {
    const group = dialog.getByRole('region', { name: `${supplier.name} · proveedor ${supplier.id}`, exact: true });
    await expect(group.getByRole('button', { name: 'Registrar pedido en historial' })).toBeEnabled();
    await group.getByRole('button', { name: 'Registrar pedido en historial' }).click();
    await expect(group.getByRole('button', { name: 'Pedido registrado' })).toBeDisabled();
  }
  const orders = await (await request.get('http://127.0.0.1:3101/api/pedidos', { headers })).json();
  expect(orders).toHaveLength(3);
  for (const [index, supplier] of providers.entries()) {
    const stored = orders.find((order: { proveedor_id: number }) => order.proveedor_id === supplier.id);
    expect(stored.local).toBe('Principal');
    expect(JSON.parse(stored.productos)).toEqual([{ producto_id: supplier.productId, nombre: supplier.product, cantidad: index === 0 ? 4 : 3 }]);
  }
  await dialog.evaluate(element => { element.scrollTop = 0; });
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('order-draft-mobile.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Cerrar pedido' }).click();
  await page.getByRole('button', { name: 'Retomar pedido de Principal' }).click();
  await expect(dialog.getByRole('button', { name: 'Pedido registrado' })).toHaveCount(3);
});
