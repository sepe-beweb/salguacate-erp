import { test, expect } from '@playwright/test';

test('planning dialogs own keyboard focus, retain drafts and block Escape during a real pending request', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await page.getByRole('button', { name: /Jefe Admin/ }).click();
  await page.getByLabel('PIN de acceso').fill('246810'); await page.getByRole('button', { name: 'Acceder' }).click();
  await page.getByRole('link', { name: 'Tareas', exact: true }).click();
  const open = page.getByRole('button', { name: 'Nueva', exact: true }); await open.click();
  await expect(page.getByRole('dialog', { name: 'Nueva Tarea' })).toBeVisible();
  await expect(page.getByLabel('Tarea', { exact: true })).toBeFocused();
  await page.getByLabel('Tarea', { exact: true }).fill('Borrador móvil');
  await page.getByLabel('Fecha', { exact: true }).fill('2024-02-29');
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(open).toBeFocused();
  await open.click(); await expect(page.getByLabel('Tarea', { exact: true })).toHaveValue('Borrador móvil');
  await expect(page.getByLabel('Fecha', { exact: true })).toHaveValue('2024-02-29');
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => ({ tag: document.activeElement?.tagName, inside: !!document.activeElement?.closest('dialog'), id: document.activeElement?.id }));
    // Chrome may move focus to browser chrome (activeElement becomes BODY), never to the inert page controls.
    expect(focused.inside || focused.tag === 'BODY', `Tab ${index + 1}: ${JSON.stringify(focused)}`).toBe(true);
  }
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  await open.evaluate(element => element.focus()); await expect(open).not.toBeFocused();
  // Delays transport only; the real API rejects the oversized title and writes nothing.
  await page.getByLabel('Tarea', { exact: true }).fill('x'.repeat(161));
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/tareas', async route => { if (route.request().method() === 'POST') await gate; await route.continue(); });
  await page.getByRole('button', { name: 'Crear Tarea', exact: true }).click();
  try {
    await expect(page.getByLabel('Tarea', { exact: true })).toBeDisabled();
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toBeVisible();
  } finally { release(); }
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('inválidos');
  await expect(page.getByLabel('Tarea', { exact: true })).toHaveValue('x'.repeat(161));
  await page.getByLabel('Tarea', { exact: true }).fill('Borrador móvil');
  await page.screenshot({ path: testInfo.outputPath('task-dialog-mobile.png'), animations: 'disabled' });
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await page.getByRole('link', { name: 'Agenda', exact: true }).click();
  const newEvent = page.getByRole('button', { name: 'Nuevo', exact: true }); await newEvent.click();
  await expect(page.getByLabel('Título', { exact: true })).toBeFocused();
  await page.getByLabel('Título', { exact: true }).fill('Borrador de evento');
  await page.getByLabel('Hora', { exact: true }).fill('23:30');
  await page.keyboard.press('Escape'); await expect(newEvent).toBeFocused();
  await page.getByRole('button', { name: 'Retomar borrador de evento' }).click();
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Borrador de evento');
  await expect(page.getByLabel('Hora', { exact: true })).toHaveValue('23:30');
  page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: 'Descartar borrador' }).click();
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Borrador de evento');
  await page.screenshot({ path: testInfo.outputPath('event-dialog-mobile.png'), animations: 'disabled' });
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Descartar borrador' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
