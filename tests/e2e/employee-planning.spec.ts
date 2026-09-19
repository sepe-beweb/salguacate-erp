import { test, expect } from '@playwright/test';

test('employee sees all own civil shifts and can complete an assigned task without exposing another employee schedule', async ({ browser, request }, testInfo) => {
  const login = await request.post('http://127.0.0.1:3101/api/login', { data: { usuario_id: 1, pin: '246810' } });
  const { token } = await login.json(); const headers = { Authorization: `Bearer ${token}` };
  // Disposable SQLite only. Reuse identical synthetic shift fixtures when the test is retried.
  const existing = await (await request.get('http://127.0.0.1:3101/api/turnos', { headers })).json();
  for (const data of [
    { usuario_id: 3, fecha: '2024-02-29', hora_inicio: '10:00', hora_fin: '14:00', local: 'Principal', compañeros: 'Equipo civil' },
    { usuario_id: 3, fecha: '2024-02-29', hora_inicio: '22:00', hora_fin: '02:00', local: 'Principal', compañeros: 'Equipo noche' },
    { usuario_id: 3, fecha: '2024-03-01', hora_inicio: '12:00', hora_fin: '16:00', local: 'Principal', compañeros: 'Equipo marzo' },
    { usuario_id: 4, fecha: '2024-02-29', hora_inicio: '05:00', hora_fin: '06:00', local: 'Segundo Local', compañeros: 'Turno de otra persona' }
  ]) {
    if (!existing.some((row: Record<string, unknown>) => Object.entries(data).every(([key, value]) => row[key] === value))) expect((await request.post('http://127.0.0.1:3101/api/turnos', { headers, data })).ok()).toBe(true);
  }
  for (const timezoneId of ['America/Los_Angeles', 'Pacific/Kiritimati']) {
    const taskTitle = `Checklist civil ${timezoneId} ${testInfo.retry}`;
    const created = await request.post('http://127.0.0.1:3101/api/tareas', { headers, data: { titulo: taskTitle, descripcion: 'Prueba local', asignado_a: 3, fecha: '2024-02-29', prioridad: 'normal', local: 'Principal' } });
    expect(created.ok()).toBe(true); const { id } = await created.json();
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5174', timezoneId, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    let verified = false;
    try {
      await page.clock.setFixedTime(new Date(timezoneId === 'America/Los_Angeles' ? '2024-02-29T23:30:00-08:00' : '2024-02-29T00:30:00+14:00'));
      await page.goto('/'); await page.getByRole('button', { name: /María García/ }).click();
      await page.getByLabel('PIN de acceso').fill('246810'); await page.getByRole('button', { name: 'Acceder' }).click();
      await expect(page.getByText('Tus Turnos de Hoy')).toBeVisible();
      await expect(page.getByText('10:00 - 14:00', { exact: true })).toBeVisible();
      await expect(page.getByText('22:00 - 02:00', { exact: true })).toBeVisible();
      await expect(page.getByText('Turno de otra persona')).toHaveCount(0);
      const task = page.getByRole('button', { name: new RegExp(taskTitle) });
      await expect(task).toHaveAttribute('aria-pressed', 'false'); await task.click();
      await expect(task).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: 'Turnos', exact: true }).click();
      await expect(page.getByText('29/02/2024', { exact: true })).toHaveCount(2);
      await expect(page.getByText('01/03/2024', { exact: true })).toBeVisible();
      await expect(page.getByText('05:00 - 06:00', { exact: true })).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`shifts-${timezoneId.split('/')[1]}.png`), fullPage: true, animations: 'disabled' });
      verified = true;
    } finally {
      await context.close();
      // Do not mask the original assertion/timeout with cleanup on a closed request context.
      // Failed fixtures disappear with the disposable server; successful ones are removed here.
      if (verified) expect((await request.delete(`http://127.0.0.1:3101/api/tareas/${id}`, { headers })).ok()).toBe(true);
    }
  }
});
