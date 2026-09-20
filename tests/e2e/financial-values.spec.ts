import { test, expect } from '@playwright/test';

test('financial screens and printable report agree on cents and civil dates in western and eastern timezones', async ({ browser, request }, testInfo) => {
  // All records are synthetic and the server uses its disposable in-memory database.
  const login = await request.post('http://127.0.0.1:3101/api/login', { data: { usuario_id: 1, pin: '246810' } });
  const { token } = await login.json();
  const headers = { Authorization: `Bearer ${token}` };
  for (const data of [
    { fecha: '2024-02-29', local: 'Principal', efectivo: '0.10', tarjeta: '0.20', invitaciones: '2.50', descuadre: '-0.01' },
    { fecha: '2024-02-29', local: 'Segundo Local', efectivo: '0.30', tarjeta: '0.40', invitaciones: '0', descuadre: '-0.02' }
  ]) {
    const result = await request.post('http://127.0.0.1:3101/api/cierres', { headers, data });
    if (result.status() === 409) {
      const rows = await (await request.get('http://127.0.0.1:3101/api/cierres', { headers })).json();
      expect(rows.find((row: { fecha: string; local: string }) => row.fecha === data.fecha && row.local === data.local)).toMatchObject({ ...data, efectivo: Number(data.efectivo), tarjeta: Number(data.tarjeta), invitaciones: Number(data.invitaciones), descuadre: Number(data.descuadre) });
    } else expect(result.ok()).toBe(true);
  }
  for (const [index, data] of [
    { fecha: '2024-02-29', local: 'Principal', total: '0.15', proveedor_nombre: 'Proveedor fecha civil', concepto: 'Febrero' },
    { fecha: '2024-03-01', local: 'Segundo Local', total: '0.05', proveedor_nombre: 'Solo gasto sin cierre', concepto: 'Marzo' }
  ].entries()) expect((await request.post('http://127.0.0.1:3101/api/gastos', { headers: { ...headers, 'Idempotency-Key': `10000000-0000-4000-8000-00000000000${index + 1}` }, data })).ok()).toBe(true);

  const gastos = await (await request.get('http://127.0.0.1:3101/api/gastos', { headers })).json();
  const principalExpenseCents = gastos.filter((row: { local: string }) => row.local === 'Principal').reduce((sum: number, row: { total: number }) => sum + Math.round(row.total * 100), 0);
  const expectedPrincipalExpenses = (principalExpenseCents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  for (const timezoneId of ['America/Los_Angeles', 'Pacific/Kiritimati']) {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5174', timezoneId, viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => { window.print = () => {}; }); // Inspect print HTML; do not open the OS print dialog.
    const page = await context.newPage();
    try {
      // Keep the business day in February in both browser time zones; timers still run normally.
      await page.clock.setFixedTime(new Date(timezoneId === 'America/Los_Angeles' ? '2024-02-29T12:00:00-08:00' : '2024-02-29T12:00:00+14:00'));
      await page.goto('/');
      await page.getByRole('button', { name: /Jefe Admin/ }).click();
      await page.getByLabel('PIN de acceso').fill('246810');
      await page.getByRole('button', { name: 'Acceder' }).click();
      await expect(page.getByText('Presencia registrada')).toBeVisible();
      const dashboard = page.getByRole('region', { name: 'Resumen financiero mensual' });
      await expect(dashboard).toContainText('1,00 €');
      await expect(dashboard).toContainText('0,85 €');
      await expect(dashboard).toContainText('0,70 € · 29/02/2024 · Salmón');
      await page.screenshot({ path: testInfo.outputPath(`dashboard-${timezoneId.split('/')[1]}.png`), fullPage: true, animations: 'disabled' });
      await page.getByRole('link', { name: 'Registrar cierre', exact: true }).click();
      await expect(page.getByLabel('Fecha del Cierre')).toHaveValue('2024-02-29');
      await page.getByLabel('Total Efectivo').fill('0.10');
      await page.getByLabel('Total Tarjeta').fill('0.20');
      await page.getByLabel('Invitaciones (Valor)').fill('2.50');
      await page.getByLabel('Descuadre de Caja').fill('-0.01');
      await expect(page.getByLabel('Total previsto del cierre')).toHaveText('0,30 €');
      await page.getByRole('button', { name: 'Guardar Cierre' }).evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.screenshot({ path: testInfo.outputPath(`closing-editor-${timezoneId.split('/')[1]}.png`), animations: 'disabled' });
      // Duplicate fixture: the real API must reject it and the complete form stays available.
      await page.getByRole('button', { name: 'Guardar Cierre' }).click();
      await expect(page.getByRole('alert')).toContainText('Ya existe un cierre');
      await expect(page.getByLabel('Total Efectivo')).toHaveValue('0.10');
      await expect(page.getByLabel('Invitaciones (Valor)')).toHaveValue('2.50');
      await expect(page.getByLabel('Descuadre de Caja')).toHaveValue('-0.01');
      await page.getByRole('button', { name: 'Historial', exact: true }).click();
      await page.getByRole('button', { name: 'Aguacate', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Aguacate', exact: true })).toHaveAttribute('aria-pressed', 'true');
      const history = page.getByRole('article', { name: 'Cierre 29/02/2024 · Aguacate' });
      await expect(history).toContainText('0,30 €');
      await expect(history).toContainText('Descuadre: -0,01 €');
      await expect(history).toContainText('0,10 €');
      await expect(history).toContainText('2,50 €');
      await page.screenshot({ path: testInfo.outputPath(`closing-history-${timezoneId.split('/')[1]}.png`), fullPage: true, animations: 'disabled' });
      await page.getByRole('button', { name: 'Inicio', exact: true }).click();
      await page.getByRole('link', { name: 'Informe mensual', exact: true }).click();
      await expect(page.getByRole('button', { name: /Exportar Informe/ })).toBeVisible();
      await page.getByLabel('Año del informe').selectOption('2024');
      await page.getByLabel('Mes del informe').selectOption('1');
      await page.getByRole('button', { name: 'Aguacate', exact: true }).click();
      await expect(page.getByText('0,30 €', { exact: true })).toBeVisible();
      await expect(page.getByText('0,15 €', { exact: true })).toHaveCount(2); // Expense and balance.
      const popupEvent = page.waitForEvent('popup');
      await page.getByRole('button', { name: /Exportar Informe/ }).click();
      const popup = await popupEvent;
      await expect(popup.getByText('Informe Mensual de Gestión · Aguacate', { exact: true })).toBeVisible();
      await expect(popup.getByText(/Invitaciones registradas:/)).toContainText('no es un cobro');
      await expect(popup.locator('body')).toContainText('29/02/2024');
      await expect(popup.locator('body')).not.toContainText('28/02/2024');
      await expect(popup.locator('body')).toContainText('-0,01');
      await expect(popup.getByRole('row').filter({ hasText: 'Proveedor fecha civil' })).toContainText('0,15');
      await popup.close();
      await page.getByRole('button', { name: 'Inicio', exact: true }).click();
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.getByRole('button', { name: 'Evolución económica' }).click();
      await page.getByRole('button', { name: 'Aguacate', exact: true }).click();
      await expect(page.getByText('Ingresos Brutos').locator('..')).toContainText('0,30');
      await expect(page.getByText('Gastos registrados', { exact: true }).locator('..')).toContainText(expectedPrincipalExpenses);
      await expect(page.getByText('Descuadre Total').locator('..')).toContainText('-0,01');
      await expect(page.locator('.recharts-xAxis').first()).toContainText('29/02/2024');
      const point = page.locator('.recharts-line-dots .recharts-dot').first();
      await point.scrollIntoViewIfNeeded();
      const box = await point.boundingBox();
      expect(box).not.toBeNull();
      // Lines may overlap; move the real pointer to the shared date rather than require one circle to be on top.
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await expect(page.locator('.recharts-tooltip-wrapper').first()).toContainText('0,30');
      await page.getByRole('button', { name: 'Salmón', exact: true }).click();
      await expect(page.getByText('Ingresos Brutos').locator('..')).toContainText('0,70');
      await expect(page.locator('.recharts-xAxis').first()).toContainText('01/03/2024');
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator('.recharts-line-curve')).toHaveCount(3);
      await page.screenshot({ path: testInfo.outputPath(`analytics-${timezoneId.split('/')[1]}.png`), fullPage: true });
    } finally { await context.close(); }
  }
});
