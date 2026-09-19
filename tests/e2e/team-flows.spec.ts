import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, name: string) {
  await page.goto('/');
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.getByLabel('PIN de acceso').fill('246810');
  await page.getByRole('button', { name: 'Acceder' }).click();
  await expect(page.getByText('Selecciona tu perfil')).toHaveCount(0);
}

async function logout(page: Page) {
  const response = page.waitForResponse(r => r.url().endsWith('/api/logout'));
  await page.getByRole('button', { name: 'Cerrar Sesión', exact: true }).first().click();
  expect((await response).status()).toBe(204);
  await expect(page.getByText('Selecciona tu perfil')).toBeVisible();
}

test('employee request is reviewed by a manager and the employee sees the decision', async ({ page }) => {
  await login(page, 'María García');
  await page.getByRole('button', { name: 'Solicitudes', exact: true }).click();
  await page.getByLabel('Desde').fill('2026-10-02');
  await page.getByLabel('Hasta').fill('2026-10-04');
  await page.getByLabel('Comentarios (Opcional)').fill('Solicitud integrada de vacaciones');
  await page.getByRole('button', { name: 'Enviar Petición' }).click();
  await expect(page.getByText('Petición enviada correctamente. El encargado la revisará.')).toBeVisible();
  await expect(page.getByText('Pendiente', { exact: true })).toBeVisible();
  await logout(page);

  await login(page, 'Encargado Principal');
  await page.getByRole('button', { name: 'Recursos Humanos', exact: true }).click();
  await page.getByRole('button', { name: /Peticiones de Personal/ }).click();
  await expect(page.getByText('"Solicitud integrada de vacaciones"')).toBeVisible();
  await page.getByRole('button', { name: 'Aprobar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Aprobar', exact: true })).toHaveCount(0);
  await logout(page);

  await login(page, 'María García');
  await page.getByRole('button', { name: 'Solicitudes', exact: true }).click();
  await expect(page.getByText('Aprobado', { exact: true })).toBeVisible();
});

test('an internal message reaches the selected recipient with the correct sender', async ({ page }) => {
  await login(page, 'María García');
  await page.getByRole('button', { name: 'Buzón Interno', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo mensaje' }).click();
  await page.getByLabel('Destinatario').selectOption('1');
  await page.getByLabel('Asunto', { exact: true }).fill('Consulta integrada del turno');
  await page.getByLabel('Mensaje', { exact: true }).fill('¿Confirmamos el turno del viernes?');
  await page.getByRole('button', { name: 'Enviar Mensaje' }).click();
  await expect(page.getByRole('button', { name: 'Enviar Mensaje' })).toHaveCount(0);
  await logout(page);

  await login(page, 'Jefe Admin');
  await page.getByRole('button', { name: 'Buzón de Mensajes', exact: true }).click();
  await expect(page.getByText('Consulta integrada del turno', { exact: true })).toBeVisible();
  await expect(page.getByText('¿Confirmamos el turno del viernes?', { exact: true })).toBeVisible();
  await expect(page.getByText('María García', { exact: true })).toBeVisible();
});
