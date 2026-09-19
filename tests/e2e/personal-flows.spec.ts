import { test, expect, type Page } from '@playwright/test';

async function enter(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Jefe Admin/ }).click();
  await page.getByLabel('PIN de acceso').fill('246810');
  const login = page.waitForResponse(r => r.url().endsWith('/api/login'));
  await page.getByRole('button', { name: 'Acceder' }).click();
  const { token } = await (await login).json();
  await expect(page.getByText('Presencia en Tiempo Real')).toBeVisible();
  return { Authorization: `Bearer ${token}` };
}

test('notes: native focus, Escape, mobile draft, create, pin and confirmed deletion reach the real API', async ({ page, request }, testInfo) => {
  const headers = await enter(page);
  await page.getByRole('button', { name: 'Muro de Notas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Notas', exact: true })).toBeVisible();
  const newButton = page.getByRole('button', { name: 'Nueva', exact: true });
  await newButton.click();
  const dialog = page.getByRole('dialog', { name: 'Nueva Nota' });
  const content = page.getByLabel('Contenido de la nota');
  await expect(content).toBeFocused();
  await expect(page.getByRole('button', { name: 'Dictar por voz' })).toBeDisabled();
  await content.fill('Nota integración teclado');
  await page.getByRole('button', { name: 'Color blue' }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(newButton).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await newButton.click();
  await expect(content).toHaveValue('Nota integración teclado');
  await expect(page.getByRole('button', { name: 'Color blue' })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: testInfo.outputPath('notes-mobile.png'), fullPage: true });
  const created = page.waitForResponse(r => r.url().endsWith('/api/notas') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Guardar Nota' }).click();
  const id = (await (await created).json()).id;
  await expect(dialog).not.toBeVisible();
  const card = page.getByText('Nota integración teclado', { exact: true }).locator('..');
  await card.getByRole('button', { name: 'Fijar arriba' }).click();
  await expect(card.getByRole('button', { name: 'Desfijar' })).toBeEnabled();
  const notes = async () => (await (await request.get('http://127.0.0.1:3101/api/notas', { headers })).json()) as { id: number; fijada: number; color: string }[];
  expect((await notes()).find(n => n.id === id)).toMatchObject({ fijada: 1, color: 'blue' });
  page.once('dialog', d => d.dismiss());
  await card.getByRole('button', { name: 'Eliminar', exact: true }).click();
  expect((await notes()).some(n => n.id === id)).toBe(true);
  page.once('dialog', d => d.accept());
  await card.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect(card).toHaveCount(0);
  expect((await notes()).some(n => n.id === id)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('scanner keyboard selection and consent reach disabled local AI without external traffic', async ({ page }, testInfo) => {
  await enter(page);
  const external: string[] = [];
  page.on('request', req => {
    const url = new URL(req.url());
    if (['http:', 'https:'].includes(url.protocol) && !['127.0.0.1', 'localhost'].includes(url.hostname)) external.push(req.url());
  });
  await page.getByRole('button', { name: 'Escáner de Facturas' }).click();
  await expect(page.getByRole('heading', { name: 'Escáner', exact: true })).toBeVisible();
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 10; canvas.height = 10;
    canvas.getContext('2d')!.fillRect(0, 0, 10, 10);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Escanear Documento/ }).focus();
  await page.keyboard.press('Enter');
  await (await chooser).setFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.getByRole('button', { name: 'Factura IA', exact: true }).click();
  const analyze = page.getByRole('button', { name: 'Analizar con Gemini' });
  await expect(analyze).toBeDisabled();
  await page.getByRole('checkbox', { name: /Autorizo enviar/ }).check();
  const rejected = page.waitForResponse(r => r.url().endsWith('/api/ai/vision'));
  await analyze.click();
  expect((await rejected).status()).toBe(503);
  await expect(page.getByRole('alert')).toContainText('IA está desactivada');
  await expect(page.getByAltText('Vista previa')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Registrar Gasto Directamente' })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('scanner-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Solo PDF' }).click();
  await page.getByRole('button', { name: 'Guardar como PDF' }).click();
  await expect(page.getByText('Documentos Recientes')).toBeVisible();
  expect(external).toEqual([]);
});
