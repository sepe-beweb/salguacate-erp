import { test, expect } from '@playwright/test';

test.describe('🔑 Salguacate ERP - Suite de Pruebas E2E Exhaustivas', () => {

  test('Casuística 1: Login de Empleado Exitoso y Dashboard', async ({ page }) => {
    // 1. Navegar a la página de login
    await page.goto('/');

    // 2. Seleccionar a "María García" (usuario 3)
    await page.click('text=María García');

    // 3. Rellenar PIN correcto
    await page.locator('input[type="password"]').fill('0000');
    await page.click('text=Acceder');

    // 4. Debería iniciar sesión y ver su panel personal
    await expect(page.locator('text=Hola, María')).toBeVisible();
    await expect(page.locator('text=Tu Turno de Hoy')).toBeVisible();
    await expect(page.locator('text=Checklist de Hoy')).toBeVisible();
  });

  test('Casuística 2: Rechazo de PIN Incorrecto con Alerta Visual', async ({ page }) => {
    await page.goto('/');

    // Seleccionar a "María García"
    await page.click('text=María García');

    // Rellenar PIN incorrecto
    await page.locator('input[type="password"]').fill('9999');
    await page.click('text=Acceder');

    // Debería ver el mensaje de error "PIN incorrecto" en la pantalla de login
    await expect(page.locator('text=PIN incorrecto')).toBeVisible();
    
    // Debería seguir en la pantalla de login y no haber accedido
    await expect(page.locator('text=Introduce tu PIN')).toBeVisible();
    await expect(page.locator('text=María García')).toBeVisible();
  });

  test('Casuística 3: Flujo de Fichaje (Entrada y Salida) del Empleado', async ({ page }) => {
    await page.goto('/');

    // Login
    await page.click('text=María García');
    await page.locator('input[type="password"]').fill('0000');
    await page.click('text=Acceder');

    // Navegar a la pantalla de Fichar
    await page.click('text=Control Horario');
    await expect(page.locator('text=Fichar Entrada')).toBeVisible();

    // Fichar Entrada
    await page.click('text=Fichar Entrada');

    // Debería cambiar el estado y mostrar "Turno Activo" y botones de "Descanso" y "Finalizar"
    await expect(page.locator('text=Turno Activo')).toBeVisible();
    await expect(page.locator('text=Finalizar')).toBeVisible();

    // Finalizar/Fichar Salida
    await page.click('text=Finalizar');

    // Debería volver a mostrar el botón "Fichar Entrada"
    await expect(page.locator('text=Fichar Entrada')).toBeVisible();
  });

  test('Casuística 4: Login de Propietario (Admin) y Sidebar de Escritorio', async ({ page }) => {
    await page.goto('/');

    // Seleccionar al propietario "Jefe Admin" (usuario ID 1)
    await page.click('text=Jefe Admin');

    // Rellenar PIN correcto
    await page.locator('input[type="password"]').fill('0000');
    await page.click('text=Acceder');

    // Debería iniciar sesión y ver elementos exclusivos del Dashboard de Administrador
    await expect(page.locator('text=Beneficio neto')).toBeVisible();
    await expect(page.locator('text=Módulos')).toBeVisible();

    // Debería mostrar la sección premium del Dashboard: "Presencia en Tiempo Real"
    await expect(page.locator('text=Presencia en Tiempo Real')).toBeVisible();

    // En pantallas de escritorio (la por defecto en Playwright Chromium), el Sidebar lateral premium debe ser visible
    // El sidebar contiene el texto "ERP Restauración" y la etiqueta del rol "Owner"
    await expect(page.locator('text=ERP Restauración')).toBeVisible();
    await expect(page.locator('text=Owner')).toBeVisible();

    // El sidebar debe contener enlaces del dueño como "Almacén y Stock" y "Recursos Humanos"
    await expect(page.locator('text=Almacén y Stock')).toBeVisible();
    await expect(page.locator('text=Recursos Humanos')).toBeVisible();
  });

});
