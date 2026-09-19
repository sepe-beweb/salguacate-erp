import { test, expect } from '@playwright/test';

test('order history keeps civil dates and recorded lines in western and eastern mobile time zones', async ({ browser, request }, testInfo) => {
  for (const timezoneId of ['America/Los_Angeles', 'Pacific/Kiritimati']) {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5174', timezoneId, viewport: { width: 390, height: 844 } });
    try {
      const page = await context.newPage();
      await page.goto('/'); await page.getByRole('button', { name: /Jefe Admin/ }).click();
      await page.getByLabel('PIN de acceso').fill('246810');
      const login = page.waitForResponse(r => r.url().endsWith('/api/login'));
      await page.getByRole('button', { name: 'Acceder' }).click();
      const { token } = await (await login).json(); const headers = { Authorization: `Bearer ${token}` };
      await expect(page.getByText('Presencia registrada')).toBeVisible();
      const name = `Agua ${timezoneId}`;
      const created = await request.post('http://127.0.0.1:3101/api/inventario', { headers, data: { producto: name, stock_actual: 2, stock_minimo: 5, local: 'Segundo Local', categoria: 'Bebida' } });
      expect(created.ok()).toBe(true); const productId = (await created.json()).id;
      const lines = [{ producto_id: productId, nombre: name, cantidad: 3 }];
      const orderResponse = await request.post('http://127.0.0.1:3101/api/pedidos', { headers, data: { fecha: '2024-02-29', local: 'Segundo Local', proveedor_nombre: timezoneId, productos: lines } });
      expect(orderResponse.ok()).toBe(true); const orderId = (await orderResponse.json()).id;
      await page.getByRole('button', { name: 'Abrir navegación' }).click();
      await page.getByRole('dialog', { name: 'Navegación' }).getByRole('button', { name: 'Pedidos de Reposición' }).click();
      await page.getByRole('button', { name: 'Historial', exact: true }).click();
      const card = page.getByText(timezoneId, { exact: true }).locator('../../..');
      await expect(card).toContainText('Segundo Local · 29/02/2024');
      await expect(card).toContainText(`${name} ×3`);
      await card.getByRole('button', { name: '✓ Recibir', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Recibir sin cambiar stock' }).click();
      await expect(card).toContainText('✓ Recibido');
      await expect(card).toContainText('29/02/2024');
      const orders = await (await request.get('http://127.0.0.1:3101/api/pedidos', { headers })).json();
      const stored = orders.find((item: { id: number }) => item.id === orderId);
      expect(stored.fecha).toBe('2024-02-29'); expect(JSON.parse(stored.productos)).toEqual(lines);
      const stock = await (await request.get('http://127.0.0.1:3101/api/inventario', { headers })).json();
      expect(stock.find((item: { id: number }) => item.id === productId).stock_actual).toBe(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`orders-${timezoneId.split('/')[1]}.png`), fullPage: true });
    } finally { await context.close(); }
  }
});
