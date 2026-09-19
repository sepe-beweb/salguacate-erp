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

async function loseFirstResponse(page: Page, endpoint: string) {
  const writes: { key: string | undefined; body: string | null }[] = [];
  await page.route(`**${endpoint}`, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    writes.push({ key: route.request().headers()['idempotency-key'], body: route.request().postData() });
    if (writes.length !== 1) return route.continue();
    // Commit against the real disposable API, then drop only its response.
    const saved = await route.fetch();
    expect(saved.ok()).toBe(true);
    await route.abort('failed');
  });
  return writes;
}

test('lost note response is explicitly confirmed with one persisted note', async ({ page, request }, testInfo) => {
  const headers = await enter(page);
  const text = `Nota respuesta perdida ${testInfo.retry}`;
  const writes = await loseFirstResponse(page, '/api/notas');
  await page.getByRole('button', { name: 'Muro de Notas' }).click();
  await expect(page.getByRole('heading', { name: 'Notas', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nueva', exact: true }).click();
  await page.getByLabel('Contenido de la nota').fill(text);
  await page.getByRole('button', { name: 'Color blue' }).click();
  await page.getByRole('button', { name: 'Guardar Nota' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Contenido de la nota')).toBeDisabled();
  const matching = async () => (await (await request.get('http://127.0.0.1:3101/api/notas', { headers })).json()).filter((n: { contenido: string }) => n.contenido === text);
  const before = await matching();
  expect(before).toHaveLength(1);
  expect(writes).toHaveLength(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('pending-note-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Cerrar nota' }).click();
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await expect(page.getByText('Presencia en Tiempo Real')).toBeVisible();
  await page.getByRole('link', { name: 'Revisar nota: por revisar' }).click();
  await page.getByRole('button', { name: 'Recuperar nota pendiente' }).click();
  await expect(page.getByLabel('Contenido de la nota')).toHaveValue(text);
  await expect(page.getByRole('button', { name: 'Color blue' })).toHaveAttribute('aria-pressed', 'true');
  expect(writes).toHaveLength(1);
  await page.getByRole('button', { name: 'Confirmar guardado pendiente' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(text, { exact: true })).toHaveCount(1);
  expect(await matching()).toEqual(before);
  expect(writes).toHaveLength(2);
  expect(writes[0]).toEqual(writes[1]);
  expect(writes[0].key).toMatch(/^[a-f0-9-]{36}$/);
});

test('reviewed expense keeps image and fields after a lost response and confirms one expense', async ({ page, request }, testInfo) => {
  const headers = await enter(page);
  const provider = `Proveedor respuesta perdida ${testInfo.retry}`;
  // Synthetic extraction only; no Gemini request leaves this test.
  await page.route('**/api/ai/vision', route => route.fulfill({ json: { success: true, proveedor: provider, total: 7.25, concepto: 'Prueba aislada', rawText: '' } }));
  const writes = await loseFirstResponse(page, '/api/gastos');
  await page.getByRole('button', { name: 'Escáner de Facturas' }).click();
  await expect(page.getByRole('heading', { name: 'Escáner', exact: true })).toBeVisible();
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 10; canvas.height = 10;
    canvas.getContext('2d')!.fillRect(0, 0, 10, 10);
    return canvas.toDataURL().split(',')[1];
  });
  await page.getByLabel('Seleccionar imagen').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
  await page.getByRole('button', { name: 'Factura IA' }).click();
  await page.getByRole('checkbox', { name: /Autorizo enviar/ }).check();
  await page.getByRole('button', { name: 'Analizar con Gemini' }).click();
  await page.getByLabel('Proveedor', { exact: true }).fill(provider);
  await page.getByRole('button', { name: 'Registrar Gasto Directamente' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Proveedor', { exact: true })).toBeDisabled();
  await expect(page.getByAltText('Vista previa')).toBeVisible();
  const matching = async () => (await (await request.get('http://127.0.0.1:3101/api/gastos', { headers })).json()).filter((g: { proveedor_nombre: string }) => g.proveedor_nombre === provider);
  const before = await matching();
  expect(before).toHaveLength(1);
  expect(writes).toHaveLength(1);
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Descartar imagen y borrador' }).click();
  await expect(page.getByAltText('Vista previa')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Confirmar guardado pendiente' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('pending-expense-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await expect(page.getByText('Presencia en Tiempo Real')).toBeVisible();
  await page.getByRole('link', { name: 'Revisar gasto: por revisar' }).click();
  await expect(page.getByText(/Gasto recuperado de esta sesión/)).toBeVisible();
  await expect(page.getByAltText('Vista previa')).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /Autorizo enviar/ })).toHaveCount(0);
  await expect(page.getByLabel('Proveedor', { exact: true })).toHaveValue(provider);
  await expect(page.getByLabel('Proveedor', { exact: true })).toBeDisabled();
  expect(writes).toHaveLength(1);
  await page.screenshot({ path: testInfo.outputPath('recovered-expense-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Confirmar guardado pendiente' }).click();
  await expect(page.getByRole('status')).toHaveText('Gasto registrado correctamente.');
  await expect(page.getByAltText('Vista previa')).toHaveCount(0);
  expect(await matching()).toEqual(before);
  expect(writes).toHaveLength(2);
  expect(writes[0]).toEqual(writes[1]);
});

test('note success arriving after navigation is consumed on return without a second POST', async ({ page, request }, testInfo) => {
  const headers = await enter(page);
  const text = `Nota respuesta tardía ${testInfo.retry}`;
  let release!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  let stored!: () => void;
  const committed = new Promise<void>(resolve => { stored = resolve; });
  let writes = 0;
  await page.route('**/api/notas', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    writes++;
    const saved = await route.fetch();
    expect(saved.ok()).toBe(true); stored();
    await hold;
    await route.fulfill({ response: saved });
  });
  await page.getByRole('button', { name: 'Muro de Notas' }).click();
  await page.getByRole('button', { name: 'Nueva', exact: true }).click();
  await page.getByLabel('Contenido de la nota').fill(text);
  await page.getByRole('button', { name: 'Guardar Nota' }).click();
  try {
    await committed;
    await page.goBack();
    await expect(page.getByText('Presencia en Tiempo Real')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Revisar nota: guardando' })).toBeVisible();
  } finally { release(); }
  await expect(page.getByRole('link', { name: 'Revisar nota: confirmado' })).toBeVisible();
  await page.getByRole('link', { name: 'Revisar nota: confirmado' }).click();
  await expect(page.getByText(/Nota guardada correctamente/)).toBeVisible();
  await expect(page.getByText(text, { exact: true })).toHaveCount(1);
  expect(writes).toBe(1);
  const notes = await (await request.get('http://127.0.0.1:3101/api/notas', { headers })).json();
  expect(notes.filter((note: { contenido: string }) => note.contenido === text)).toHaveLength(1);
  await expect(page.getByRole('complementary', { name: 'Guardados de esta sesión' })).toHaveCount(0);
});

test('logout cancellation preserves a pending note and confirmed logout clears recovery on next login', async ({ page }, testInfo) => {
  await enter(page);
  const writes = await loseFirstResponse(page, '/api/notas');
  await page.getByRole('button', { name: 'Muro de Notas' }).click();
  await page.getByRole('button', { name: 'Nueva', exact: true }).click();
  await page.getByLabel('Contenido de la nota').fill(`Nota salida ${testInfo.retry}`);
  await page.getByRole('button', { name: 'Guardar Nota' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar nota' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Recuperar nota pendiente' })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page.getByRole('button', { name: /Jefe Admin/ }).click();
  await page.getByLabel('PIN de acceso').fill('246810');
  await page.getByRole('button', { name: 'Acceder' }).click();
  await expect(page.getByRole('heading', { name: 'Notas', exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Guardados de esta sesión' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Recuperar nota pendiente' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Nueva', exact: true }).click();
  await expect(page.getByLabel('Contenido de la nota')).toHaveValue('');
  expect(writes).toHaveLength(1);
  const storage = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(JSON.stringify(storage)).not.toContain('Nota salida');
  expect(JSON.stringify(storage)).not.toContain(writes[0].key);
});
