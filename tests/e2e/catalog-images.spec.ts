import { test, expect } from '@playwright/test';

test('synthetic PNG and JPEG photos persist through the catalogue API and load again after a fresh login', async ({ page, request }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const login = async () => {
    await page.getByRole('button', { name: /Jefe Admin/ }).click(); await page.getByLabel('PIN de acceso').fill('246810');
    const response = page.waitForResponse(r => r.url().endsWith('/api/login')); await page.getByRole('button', { name: 'Acceder' }).click();
    const { token } = await (await response).json(); await expect(page.getByRole('button', { name: 'Abrir navegación' })).toBeVisible(); return token as string;
  };
  const openInventory = async () => {
    await page.getByRole('button', { name: 'Abrir navegación' }).click();
    await page.getByRole('dialog', { name: 'Navegación' }).getByRole('button', { name: 'Almacén y Stock' }).click();
    await expect(page.getByRole('button', { name: 'Nuevo producto' })).toBeVisible();
  };
  await page.goto('/'); const token = await login(); await openInventory();
  const saved: { name: string; url: string }[] = [];
  for (const format of ['png', 'jpeg']) {
    const name = `Foto sintética ${format} ${testInfo.retry}`;
    const encoded = await page.evaluate(mime => {
      const canvas = document.createElement('canvas'); canvas.width = 12; canvas.height = 8;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#058447'; ctx.fillRect(0, 0, 12, 8); ctx.fillStyle = '#ffd131'; ctx.fillRect(2, 2, 4, 4);
      return canvas.toDataURL(`image/${mime}`).split(',')[1];
    }, format);
    const bytes = Buffer.from(encoded, 'base64');
    await page.getByRole('button', { name: 'Nuevo producto' }).click(); const dialog = page.getByRole('dialog', { name: 'Nuevo Producto' });
    await dialog.getByLabel('Nombre del Producto').fill(name); await dialog.getByLabel('Stock Actual').fill('8');
    await dialog.getByLabel('Imagen (Opcional)').setInputFiles({ name: `synthetic.${format}`, mimeType: `image/${format}`, buffer: bytes });
    await expect.poll(() => dialog.getByAltText('Vista previa del producto').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 12)).toBe(true);
    await dialog.getByRole('button', { name: 'Guardar Producto' }).click(); await expect(dialog).toHaveCount(0);
    const rows = await (await request.get('http://127.0.0.1:3101/api/inventario', { headers: { Authorization: `Bearer ${token}` } })).json();
    const matches = rows.filter((row: { producto: string }) => row.producto === name); expect(matches).toHaveLength(1);
    const url: string = matches[0].imagen_url; expect(url).toMatch(new RegExp(`^/uploads/[a-f0-9-]+\\.${format === 'png' ? 'png' : 'jpg'}$`));
    // Public image URL is the current contract: no bearer and no mocked response.
    const image = await request.get(`http://127.0.0.1:3101${url}`);
    expect(image.status()).toBe(200); expect(image.headers()['content-type']).toContain(`image/${format}`); expect(await image.body()).toEqual(bytes);
    const rendered = page.getByRole('img', { name, exact: true }); await expect(rendered).toHaveAttribute('src', `http://127.0.0.1:3101${url}`);
    await expect.poll(() => rendered.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 12 && img.naturalHeight === 8)).toBe(true);
    saved.push({ name, url });
  }
  await page.reload(); await login(); await openInventory();
  for (const item of saved) {
    const rendered = page.getByRole('img', { name: item.name, exact: true });
    await expect(rendered).toHaveAttribute('src', `http://127.0.0.1:3101${item.url}`);
    await expect.poll(() => rendered.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 12 && img.naturalHeight === 8)).toBe(true);
  }
  expect(saved[0].url).not.toBe(saved[1].url); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('catalog-persisted-images-mobile.png'), fullPage: true });
});
