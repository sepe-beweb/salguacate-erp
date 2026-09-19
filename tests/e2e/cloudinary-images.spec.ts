import { test, expect } from '@playwright/test';

test('mobile catalogue loads the configured CDN reference and blocks a different account (CDN mocked)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const url = 'https://res.cloudinary.com/e2e-synthetic/image/upload/v123/salguacate/inventory/12345678-1234-4123-8123-123456789abc.png';
  let allowed = true;
  const requested: string[] = [];
  // No traffic to the provider: verify the browser path independently from
  // the still-pending authenticated upload/download integration.
  await page.route('https://res.cloudinary.com/**', async route => {
    requested.push(route.request().url());
    await route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64') });
  });
  await page.route('http://127.0.0.1:3101/api/inventario', route => route.fulfill({ json: [{
    id: 999, producto: 'Foto CDN sintética', stock_actual: 1, stock_minimo: 2, local: 'Principal', categoria: 'Bebida',
    proveedor_id: null, proveedor_nombre: null, proveedor_telefono: null, imagen_url: allowed ? url : url.replace('e2e-synthetic', 'other-account'),
  }] }));
  async function openCatalogue() {
    await page.goto('/');
    await page.getByRole('button', { name: /Jefe Admin/ }).click(); await page.getByLabel('PIN de acceso').fill('246810');
    await page.getByRole('button', { name: 'Acceder' }).click();
    await page.getByRole('button', { name: 'Abrir navegación' }).click();
    await page.getByRole('dialog', { name: 'Navegación' }).getByRole('button', { name: 'Almacén y Stock' }).click();
  }
  await openCatalogue();
  const image = page.getByRole('img', { name: 'Foto CDN sintética' });
  await expect(image).toHaveAttribute('src', url); await expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth === 1)).toBe(true);
  expect(requested).toEqual([url]);
  allowed = false; await openCatalogue();
  await expect(page.getByRole('alert')).toContainText('ruta de imagen inválida');
  await expect(image).toHaveCount(0); expect(requested).toEqual([url]);
});
