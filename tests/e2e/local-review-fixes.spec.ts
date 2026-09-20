import { test, expect, type Page } from '@playwright/test';

async function signIn(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /Jefe Admin/ }).click();
  await page.getByLabel('PIN de acceso').fill('246810');
  const login = page.waitForResponse(response => response.url().endsWith('/api/login'));
  await page.getByRole('button', { name: 'Acceder' }).click();
  const { token } = await (await login).json();
  await expect(page.getByText('Presencia registrada')).toBeVisible();
  return { Authorization: `Bearer ${token}` };
}

test('old pending orders remain reachable and receiving adds stock only once', async ({ page, request }, info) => {
  const headers = await signIn(page);
  const productResponse = await request.post('http://127.0.0.1:3101/api/inventario', { headers, data: { producto: `Recepción histórica ${info.retry}`, local: 'Principal', stock_actual: 2, stock_minimo: 5 } });
  expect(productResponse.ok()).toBe(true);
  const productId = (await productResponse.json()).id;
  let oldestId = 0;
  for (let index = 1; index <= 21; index++) {
    const response = await request.post('http://127.0.0.1:3101/api/pedidos', { headers, data: { fecha: `2024-01-${String(index).padStart(2, '0')}`, local: 'Principal', proveedor_nombre: `Proveedor histórico ${index}`, productos: [{ producto_id: productId, nombre: 'Agua', cantidad: 3 }] } });
    expect(response.ok()).toBe(true);
    const { id } = await response.json(); if (index === 1) oldestId = id;
  }
  await page.getByRole('link', { name: 'Revisar pedidos', exact: true }).click();
  await page.getByRole('button', { name: 'Historial', exact: true }).click();
  const oldest = page.getByRole('group', { name: `Pedido ${oldestId} de Proveedor histórico 1`, exact: true });
  await expect(oldest).toHaveCount(0);
  // Retries retain this file's isolated fixture data; all pages must remain reachable.
  while (await page.getByRole('button', { name: 'Mostrar más pedidos' }).count()) {
    await page.getByRole('button', { name: 'Mostrar más pedidos' }).click();
  }
  await oldest.getByRole('button', { name: '✓ Recibir' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Recibir y sumar stock' }).click();
  await expect(oldest).toContainText('✓ Recibido');
  const duplicate = await request.patch(`http://127.0.0.1:3101/api/pedidos/${oldestId}/recibido`, { headers, data: { sumar_stock: true } });
  expect(duplicate.status()).toBe(409);
  const products = await (await request.get('http://127.0.0.1:3101/api/inventario', { headers })).json();
  expect(products.find((row: { id: number }) => row.id === productId).stock_actual).toBe(5);
});

test('task form and server reject a cross-local employee assignment without losing the draft', async ({ page, request }) => {
  const headers = await signIn(page);
  await page.getByRole('link', { name: 'Organizar tareas', exact: true }).click();
  await page.getByRole('button', { name: 'Nueva', exact: true }).click();
  await page.getByLabel('Tarea', { exact: true }).fill('Preparar sala del local');
  await page.getByLabel('Asignar a', { exact: true }).selectOption('3');
  await page.getByLabel('Local', { exact: true }).selectOption('Segundo Local');
  await expect(page.getByRole('alert')).toContainText('no pertenece al local');
  await expect(page.getByRole('button', { name: 'Crear Tarea' })).toBeDisabled();
  await expect(page.getByLabel('Asignar a', { exact: true })).toHaveValue('3');
  const rejection = await request.post('http://127.0.0.1:3101/api/tareas', { headers, data: { titulo: 'Asignación incompatible', asignado_a: 3, local: 'Segundo Local', fecha: '2024-01-01' } });
  expect(rejection.status()).toBe(400);
  await page.getByLabel('Local', { exact: true }).selectOption('Principal');
  await expect(page.getByRole('button', { name: 'Crear Tarea' })).toBeEnabled();
  await expect(page.getByLabel('Tarea', { exact: true })).toHaveValue('Preparar sala del local');
  await page.getByRole('button', { name: 'Crear Tarea' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Preparar sala del local', { exact: true })).toBeVisible();
});

test('assistant supports keyboard focus and catalogue labels remain readable on narrow screens', async ({ page, request }, info) => {
  const headers = await signIn(page);
  const opener = page.getByRole('button', { name: 'Abrir asistente' });
  await opener.click();
  await expect(page.getByRole('textbox', { name: 'Consulta de stock' })).toBeFocused();
  await expect(page.getByRole('dialog', { name: 'Asistente ERP' })).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Cerrar asistente' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Consulta de stock' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(opener).toBeFocused();
  const name = `${'Café de prueba '.repeat(10)}${info.retry}`;
  expect((await request.post('http://127.0.0.1:3101/api/inventario', { headers, data: { producto: name, local: 'Principal', stock_actual: 999999, stock_minimo: 5, categoria: 'Bebida' } })).ok()).toBe(true);
  await page.getByRole('button', { name: 'Inventario', exact: true }).click();
  await page.getByRole('textbox', { name: 'Buscar artículos' }).fill(name);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    const category = page.getByText('Bebida', { exact: true });
    const box = await category.boundingBox();
    expect(box!.height).toBeLessThan(25);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`catalogue-${width}.png`), fullPage: true });
  }
});
