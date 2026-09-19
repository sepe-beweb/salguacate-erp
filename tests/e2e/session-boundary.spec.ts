import { test, expect } from '@playwright/test';
test('a malformed authentication reply cannot open the ERP and a subsequent real reply recovers', async ({ page }) => {
  let corrupt = true;
  // The API performs real authentication; only the client-facing reply is damaged.
  await page.route('**/api/login', async route => {
    const response = await route.fetch();
    if (corrupt && response.ok()) {
      const body = await response.json();
      await route.fulfill({ response, body: JSON.stringify({ ...body, user: { ...body.user, rol: ['owner'] } }) });
    } else await route.fulfill({ response });
  });
  await page.goto('/'); await page.getByRole('button', { name: /María García/ }).click();
  await page.getByLabel('PIN de acceso').fill('246810'); await page.getByRole('button', { name: 'Acceder' }).click();
  await expect(page.getByRole('alert')).toContainText('Respuesta inválida del servidor');
  await expect(page.getByText('Hola, María')).toHaveCount(0); await expect(page.getByRole('button', { name: 'Recursos Humanos', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => ({ local: localStorage.getItem('token'), session: sessionStorage.getItem('token') }))).toEqual({ local: null, session: null });
  corrupt = false; await page.getByLabel('PIN de acceso').fill('246810'); await page.getByRole('button', { name: 'Acceder' }).click();
  await expect(page.getByText('Hola, María')).toBeVisible(); await expect(page.getByRole('button', { name: 'Recursos Humanos', exact: true })).toHaveCount(0);
});
