import { test, expect } from '@playwright/test';
test('login retries only the public directory and freezes a real pending PIN attempt on mobile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 }); let reads = 0; let posts = 0; let directoryAvailable = false;
  await page.route('**/api/usuarios/public', async route => {
    reads++;
    if (!directoryAvailable) await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Directorio temporalmente inaccesible' }) });
    else await route.continue();
  });
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/login', async route => { posts++; await gate; await route.continue(); });
  await page.goto('/'); await expect(page.getByRole('alert')).toContainText('Directorio temporalmente inaccesible'); expect(posts).toBe(0);
  const beforeRetry = reads; directoryAvailable = true;
  await page.getByRole('button', { name: 'Reintentar Conexión' }).click(); await page.getByRole('button', { name: /María García/ }).click(); expect(reads).toBe(beforeRetry + 1);
  await page.getByLabel('PIN de acceso').fill('9999'); await page.getByLabel('PIN de acceso').press('Enter');
  try {
    await expect(page.getByLabel('PIN de acceso')).toBeDisabled(); await expect(page.getByRole('button', { name: 'Cambiar usuario' })).toBeDisabled();
    await page.getByRole('form', { name: 'Acceso con PIN' }).evaluate(form => (form as HTMLFormElement).requestSubmit());
    await expect.poll(() => posts).toBe(1);
  } finally { release(); }
  await expect(page.getByRole('alert')).toContainText('PIN incorrecto'); await expect(page.getByLabel('PIN de acceso')).toHaveValue('');
  await page.screenshot({ path: testInfo.outputPath('login-recovered-mobile.png'), animations: 'disabled' });
  await page.getByLabel('PIN de acceso').fill('246810'); await page.getByLabel('PIN de acceso').press('Enter');
  await expect(page.getByText('Hola, María')).toBeVisible(); expect(posts).toBe(2);
});
