import { test, expect } from '@playwright/test';

test('all management screens remain usable on narrow and desktop viewports with blocked theme storage', async ({ page, request }) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
  });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 844 }); await page.goto('/');
  await page.getByRole('button', { name: /Jefe Admin/ }).click(); await page.getByLabel('PIN de acceso').fill('246810');
  const login = page.waitForResponse(r => r.url().endsWith('/api/login')); await page.getByRole('button', { name: 'Acceder' }).click();
  const headers = { Authorization: `Bearer ${(await (await login).json()).token}` };
  await request.post('http://127.0.0.1:3101/api/cierres', { headers, data: { fecha: '2026-09-20', local: 'Principal', efectivo: 999999.99, tarjeta: 999999.99, invitaciones: 40 } }).then(r => expect(r.status()).toBe(201));
  for (const width of [320,1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ['Inicio','Relevo y rutinas','Tareas','Agenda','Inventario','Pedidos','Proveedores','Escáner de facturas','Documentos','Personal y turnos','Buzón','Notas','Cierres de caja','Gastos','Evolución económica','Informe mensual','Ajustes']) {
      await test.step(`${width}px ${name}`, async () => {
        if (width < 1024) { await page.getByRole('button', { name: 'Abrir navegación', exact: true }).click(); await page.getByRole('dialog', { name: 'Navegación', exact: true }).getByRole('button', { name, exact: true }).click(); }
        else if (name === 'Ajustes') await page.getByRole('button', { name: 'Ajustes', exact: true }).last().click();
        else await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name, exact: true }).click();
        await expect(page.getByRole('main').getByRole('heading').first()).toBeVisible();
        await expect(page.getByRole('main')).not.toContainText('Cargando pantalla...');
        await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
        expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} at ${width}`).toBe(true);
      });
    }
  }
  await page.getByRole('button', { name: 'Modo Oscuro', exact: true }).click(); await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('link', { name: 'Saltar al contenido' }).focus(); await page.keyboard.press('Enter'); await expect(page.getByRole('main')).toBeFocused();
  expect(errors).toEqual([]);
});

test('employee screens remain isolated and navigable on mobile', async ({ page }) => {
  await page.setViewportSize({width:390,height:844}); await page.goto('/');
  await page.getByRole('button',{name:/María García/}).click(); await page.getByLabel('PIN de acceso').fill('246810'); await page.getByRole('button',{name:'Acceder'}).click();
  for (const name of ['Inicio','Relevo y rutinas','Mis turnos','Fichar','Buzón','Solicitudes','Ajustes']) {
    await page.getByRole('button',{name:'Abrir navegación',exact:true}).click(); const menu=page.getByRole('dialog',{name:'Navegación',exact:true});
    await expect(menu.getByRole('button',{name:'Documentos',exact:true})).toHaveCount(0);
    await menu.getByRole('button',{name,exact:true}).click(); await expect(page.getByRole('main').getByRole('heading').first()).toBeVisible();
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
  }
});
