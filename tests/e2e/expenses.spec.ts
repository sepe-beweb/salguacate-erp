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

test('manual expense needs no image or AI, validates input, and appears with exact fields and filters', async ({ page, request }, testInfo) => {
  const headers = await enter(page);
  const provider = `Manual comprobado ${testInfo.retry}`;
  const writes: string[] = [];
  const ai: string[] = [];
  page.on('request', req => {
    if (req.method() === 'POST' && req.url().endsWith('/api/gastos')) writes.push(req.postData()!);
    if (req.url().includes('/api/ai/')) ai.push(req.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('link', { name: 'Gastos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gastos', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Registrar gasto', exact: true }).click();
  expect(writes).toHaveLength(0);
  await page.getByLabel('Proveedor', { exact: true }).fill(provider);
  await page.getByLabel('Importe (€)').fill('0.001');
  await page.getByRole('button', { name: 'Registrar gasto', exact: true }).click();
  expect(writes).toHaveLength(0);
  await page.getByLabel('Importe (€)').fill('0.30');
  await page.getByLabel('Fecha', { exact: true }).fill('2020-01-02');
  await page.getByRole('combobox', { name: 'Local', exact: true }).selectOption('Segundo Local');
  // Concept is optional in the API and in the manual form.
  const created = page.waitForResponse(r => r.url().endsWith('/api/gastos') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Registrar gasto', exact: true }).click();
  const { id } = await (await created).json();
  await expect(page.getByText(`Gasto registrado correctamente (n.º ${id}).`)).toBeVisible();
  await expect(page.getByLabel('Mes de consulta')).toHaveValue('2020-01');
  await page.getByLabel('Buscar proveedor, concepto o número').fill(provider);
  const card = page.getByRole('listitem').filter({ hasText: `Gasto n.º ${id} · ${provider}` });
  await expect(card).toBeVisible();
  await expect(card).toContainText('02/01/2020 · Segundo Local');
  await expect(card).toContainText('0,30');
  await expect(card).toContainText('Sin concepto');
  await page.getByLabel('Local de consulta').selectOption('Principal');
  await expect(page.getByText('No hay gastos que coincidan con los filtros.')).toBeVisible();
  await page.getByLabel('Local de consulta').selectOption('Segundo Local');
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('manual-expense-mobile.png') });
  const rows = await (await request.get('http://127.0.0.1:3101/api/gastos', { headers })).json();
  expect(rows.filter((row: { id: number }) => row.id === id)).toEqual([expect.objectContaining({ fecha: '2020-01-02', local: 'Segundo Local', proveedor_nombre: provider, total: 0.3, concepto: '' })]);
  expect(writes).toHaveLength(1); expect(ai).toHaveLength(0);
});

test('manual lost response shares its protected attempt with scanner and list without duplicate creation', async ({ page, request }, testInfo) => {
  const headers = await enter(page);
  const provider = `Manual respuesta perdida ${testInfo.retry}`;
  const writes: { key?: string; body: string | null }[] = [];
  await page.route('**/api/gastos', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    writes.push({ key: route.request().headers()['idempotency-key'], body: route.request().postData() });
    if (writes.length !== 1) return route.continue();
    const saved = await route.fetch(); expect(saved.ok()).toBe(true);
    await route.abort('failed');
  });
  await page.getByRole('button', { name: 'Gastos', exact: true }).click();
  await page.getByLabel('Proveedor', { exact: true }).fill(provider);
  await page.getByLabel('Importe (€)').fill('15.25');
  await page.getByRole('button', { name: 'Registrar gasto', exact: true }).click();
  await expect(page.getByRole('form', { name: 'Alta de gasto' }).getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Actualizar lista' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`Gasto n.º .*${provider}`) })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Confirmar guardado pendiente' })).toBeEnabled();
  expect(writes).toHaveLength(1); // A matching record is not mistaken for confirmation of the attempt.
  await page.getByRole('link', { name: 'Abrir escáner' }).click();
  await expect(page.getByText(/Gasto recuperado de esta sesión/)).toBeVisible();
  await expect(page.getByLabel('Proveedor', { exact: true })).toHaveValue(provider);
  await expect(page.getByLabel('Proveedor', { exact: true })).toBeDisabled();
  await expect(page.getByAltText('Vista previa')).toHaveCount(0);
  await page.getByRole('link', { name: 'Revisar gasto: por revisar' }).click();
  await expect(page.getByRole('heading', { name: 'Recuperar gasto de esta sesión' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar guardado pendiente' }).click();
  await expect(page.getByText(/Gasto registrado correctamente \(n.º/)).toBeVisible();
  expect(writes).toHaveLength(2); expect(writes[0]).toEqual(writes[1]);
  const rows = await (await request.get('http://127.0.0.1:3101/api/gastos', { headers })).json();
  expect(rows.filter((row: { proveedor_nombre: string }) => row.proveedor_nombre === provider)).toHaveLength(1);
});
