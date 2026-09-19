import { test, expect, type Page } from '@playwright/test';

async function enter(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Jefe Admin/ }).click();
  await page.getByLabel('PIN de acceso').fill('246810');
  const response = page.waitForResponse(r => r.url().endsWith('/api/login'));
  await page.getByRole('button', { name: 'Acceder' }).click();
  const { token } = await (await response).json();
  await expect(page.getByText('Presencia registrada')).toBeVisible();
  return token as string;
}

test('receiving from the screen updates stock once on the API', async ({ page, request }) => {
  const token = await enter(page);
  const headers = { Authorization: `Bearer ${token}` };
  const product = await request.post('http://127.0.0.1:3101/api/inventario', {
    headers, data: { producto: 'Agua integración', stock_actual: 2, stock_minimo: 5, local: 'Principal', categoria: 'Bebida' }
  });
  expect(product.ok()).toBe(true);
  const { id } = await product.json();
  const order = await request.post('http://127.0.0.1:3101/api/pedidos', {
    headers, data: { fecha: '2026-09-19', local: 'Principal', proveedor_nombre: 'Proveedor integración', productos: [{ producto_id: id, nombre: 'Agua integración', cantidad: 4 }] }
  });
  expect(order.ok()).toBe(true);
  const orderId = (await order.json()).id;
  await page.getByRole('button', { name: 'Pedidos de Reposición' }).click();
  await page.getByRole('button', { name: 'Historial' }).click();
  await page.getByRole('button', { name: '✓ Recibir', exact: true }).click();
  await page.getByRole('button', { name: 'Recibir y sumar stock', exact: true }).click();
  await expect(page.getByText('Pedido recibido y stock actualizado.', { exact: true })).toBeVisible();
  const inventory = await (await request.get('http://127.0.0.1:3101/api/inventario', { headers })).json();
  expect(inventory.find((item: { id: number }) => item.id === id).stock_actual).toBe(6);
  const retry = await request.patch(`http://127.0.0.1:3101/api/pedidos/${orderId}/recibido`, { headers, data: { sumar_stock: true } });
  expect(retry.status()).toBe(409);
});

test('scanner creates a real local PDF without contacting AI', async ({ page }) => {
  await enter(page);
  const aiRequests: string[] = [];
  page.on('request', req => { if (req.url().includes('/api/ai/')) aiRequests.push(req.url()); });
  await page.getByRole('button', { name: 'Escáner de Facturas' }).click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 10; canvas.height = 10;
    canvas.getContext('2d')!.fillRect(0, 0, 10, 10);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type=file]').setInputFiles({
    name: 'fixture.png', mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64')
  });
  await page.getByRole('button', { name: 'Guardar como PDF' }).click();
  await expect(page.getByText('Documentos Recientes')).toBeVisible();
  const href = await page.locator('a[download$=".pdf"]').getAttribute('href');
  expect(href).toContain('application/pdf');
  expect(Buffer.from(href!.split('base64,')[1], 'base64').subarray(0, 5).toString()).toBe('%PDF-');
  expect(aiRequests).toEqual([]);
});
