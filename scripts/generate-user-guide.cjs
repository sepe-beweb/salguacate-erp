const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const BASE_URL = process.env.GUIDE_BASE_URL || 'http://127.0.0.1:5173';
const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, 'docs');
const SHOTS_DIR = path.join(DOCS_DIR, 'assets', 'guide', 'screenshots');
const HTML_PATH = path.join(DOCS_DIR, 'guia-salguacate-erp.html');
const PDF_PATH = path.join(DOCS_DIR, 'guia-salguacate-erp.pdf');

fs.rmSync(SHOTS_DIR, { recursive: true, force: true });
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const iso = (date) => date.toISOString().split('T')[0];
const addDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return iso(d);
};

const today = addDays(0);
const yesterday = addDays(-1);
const tomorrow = addDays(1);
const nextWeek = addDays(7);

const users = [
  { id: 1, nombre: 'Jefe Admin', rol: 'owner', local: 'Todos', telefono: '600 111 222', pin: '0000' },
  { id: 2, nombre: 'Encargado Principal', rol: 'manager', local: 'Principal', telefono: '600 222 333', pin: '0000' },
  { id: 3, nombre: 'Maria Garcia', rol: 'employee', local: 'Principal', telefono: '600 333 444', pin: '0000' },
  { id: 4, nombre: 'Juan Perez', rol: 'employee', local: 'Principal', telefono: '600 444 555', pin: '0000' },
  { id: 5, nombre: 'Ana Lopez', rol: 'employee', local: 'Segundo Local', telefono: '600 555 666', pin: '0000' },
];

const providers = [
  { id: 1, nombre: 'Distribuciones Norte', telefono: '+34 600 100 200', email: 'pedidos@norte.example', categoria: 'Bebidas' },
  { id: 2, nombre: 'Huerta Local', telefono: '+34 600 200 300', email: 'ventas@huertalocal.example', categoria: 'Alimentacion' },
  { id: 3, nombre: 'Suministros Bar Pro', telefono: '+34 600 300 400', email: 'info@barpro.example', categoria: 'Suministros' },
];

const inventory = [
  { id: 1, producto: 'Cerveza Lager 33cl', stock_actual: 4, stock_minimo: 24, local: 'Principal', categoria: 'Bebida', proveedor_id: 1, proveedor_nombre: 'Distribuciones Norte', proveedor_telefono: '+34 600 100 200' },
  { id: 2, producto: 'Ginebra Tanqueray 70cl', stock_actual: 2, stock_minimo: 6, local: 'Principal', categoria: 'Bebida', proveedor_id: 1, proveedor_nombre: 'Distribuciones Norte', proveedor_telefono: '+34 600 100 200' },
  { id: 3, producto: 'Nachos maiz bolsa 1kg', stock_actual: 10, stock_minimo: 8, local: 'Principal', categoria: 'Comida', proveedor_id: 2, proveedor_nombre: 'Huerta Local', proveedor_telefono: '+34 600 200 300' },
  { id: 4, producto: 'Vino blanco casa', stock_actual: 12, stock_minimo: 10, local: 'Segundo Local', categoria: 'Bebida', proveedor_id: 1, proveedor_nombre: 'Distribuciones Norte', proveedor_telefono: '+34 600 100 200' },
  { id: 5, producto: 'Aguacate maduro caja', stock_actual: 1, stock_minimo: 5, local: 'Segundo Local', categoria: 'Comida', proveedor_id: 2, proveedor_nombre: 'Huerta Local', proveedor_telefono: '+34 600 200 300' },
];

const cierres = [
  { id: 1, fecha: today, local: 'Principal', efectivo: 420.5, tarjeta: 780.75, invitaciones: 28, descuadre: -4.5, total: 1201.25 },
  { id: 2, fecha: yesterday, local: 'Principal', efectivo: 360, tarjeta: 610.4, invitaciones: 18, descuadre: 2, total: 970.4 },
  { id: 3, fecha: addDays(-2), local: 'Segundo Local', efectivo: 190.2, tarjeta: 320.8, invitaciones: 12, descuadre: 0, total: 511 },
  { id: 4, fecha: addDays(-7), local: 'Principal', efectivo: 500, tarjeta: 890, invitaciones: 35, descuadre: -8, total: 1390 },
];

const gastos = [
  { id: 1, fecha: today, proveedor_nombre: 'Distribuciones Norte', total: 312.45, concepto: 'Albaran bebidas semanal', local: 'Principal' },
  { id: 2, fecha: yesterday, proveedor_nombre: 'Huerta Local', total: 146.8, concepto: 'Verdura y producto fresco', local: 'Principal' },
  { id: 3, fecha: addDays(-3), proveedor_nombre: 'Suministros Bar Pro', total: 89.3, concepto: 'Servilletas y limpieza', local: 'Segundo Local' },
];

const tasks = [
  { id: 1, titulo: 'Limpiar cafetera y molinillo', descripcion: 'Usar producto especifico al final del turno.', asignado_a: 3, asignado_nombre: 'Maria Garcia', fecha: today, prioridad: 'alta', completada: 0, local: 'Principal' },
  { id: 2, titulo: 'Revisar camara frigorifica', descripcion: 'Comprobar temperaturas y rotacion FIFO.', asignado_a: null, asignado_nombre: null, fecha: today, prioridad: 'normal', completada: 0, local: 'Ambos' },
  { id: 3, titulo: 'Preparar pedido de hielo', descripcion: 'Confirmar entrega antes de las 18:00.', asignado_a: 5, asignado_nombre: 'Ana Lopez', fecha: tomorrow, prioridad: 'baja', completada: 0, local: 'Segundo Local' },
  { id: 4, titulo: 'Cierre de terraza', descripcion: 'Guardar cojines y revisar sombrillas.', asignado_a: 4, asignado_nombre: 'Juan Perez', fecha: yesterday, prioridad: 'normal', completada: 1, local: 'Principal' },
];

const eventos = [
  { id: 1, titulo: 'Pinchada Tropical con DJ Lua', fecha: tomorrow, hora: '22:30', descripcion: 'Sesion especial de vinilos, entrada libre.', tipo: 'Pinchada' },
  { id: 2, titulo: 'Cita proveedor cerveza', fecha: nextWeek, hora: '11:00', descripcion: 'Negociar nuevo precio por barril.', tipo: 'Proveedor' },
  { id: 3, titulo: 'Concierto acustico', fecha: addDays(10), hora: '21:30', descripcion: 'Formato trio, reservar mesa de sonido.', tipo: 'Concierto' },
  { id: 4, titulo: 'Revision extractor cocina', fecha: yesterday, hora: '09:00', descripcion: 'Mantenimiento ya realizado.', tipo: 'Mantenimiento' },
];

const notes = [
  { id: 1, usuario_id: 1, contenido: 'Pedir cambio para TPV del Segundo Local antes del viernes.', color: 'yellow', fijada: 1, creado_en: `${today}T09:10:00.000Z`, autor: 'Jefe Admin' },
  { id: 2, usuario_id: 2, contenido: 'Actualizar carta de cocktails: entra margarita picante esta semana.', color: 'purple', fijada: 0, creado_en: `${today}T11:20:00.000Z`, autor: 'Encargado Principal' },
];

const turnos = [
  { id: 1, usuario_id: 3, empleado_nombre: 'Maria Garcia', empleado_rol: 'employee', fecha: today, hora_inicio: '18:00', hora_fin: '02:00', local: 'Principal', companeros: 'Juan Perez', compañeros: 'Juan Perez' },
  { id: 2, usuario_id: 4, empleado_nombre: 'Juan Perez', empleado_rol: 'employee', fecha: today, hora_inicio: '18:00', hora_fin: '02:00', local: 'Principal', companeros: 'Maria Garcia', compañeros: 'Maria Garcia' },
  { id: 3, usuario_id: 5, empleado_nombre: 'Ana Lopez', empleado_rol: 'employee', fecha: tomorrow, hora_inicio: '12:00', hora_fin: '20:00', local: 'Segundo Local', companeros: '', compañeros: '' },
];

const pedidos = [
  { id: 1, fecha: today, local: 'Principal', proveedor_id: 1, proveedor_nombre: 'Distribuciones Norte', proveedor_telefono: '+34 600 100 200', productos: JSON.stringify([{ nombre: 'Cerveza Lager 33cl', cantidad: 20 }, { nombre: 'Ginebra Tanqueray 70cl', cantidad: 4 }]), estado: 'pendiente' },
  { id: 2, fecha: yesterday, local: 'Segundo Local', proveedor_id: 2, proveedor_nombre: 'Huerta Local', proveedor_telefono: '+34 600 200 300', productos: JSON.stringify([{ nombre: 'Aguacate maduro caja', cantidad: 4 }]), estado: 'recibido' },
];

const mensajesAdmin = [
  { id: 1, remitente_id: 3, remitente_nombre: 'Maria Garcia', asunto: 'Cambio de turno', cuerpo: 'Puedo cambiar el turno del jueves si hace falta cubrir el Segundo Local.', fecha: `${today}T10:15:00.000Z`, leido: 0 },
  { id: 2, remitente_id: 4, remitente_nombre: 'Juan Perez', asunto: 'Stock de cerveza', cuerpo: 'Quedan pocas cajas de lager en el almacen principal.', fecha: `${yesterday}T18:40:00.000Z`, leido: 1 },
];

const mensajesEmpleado = [
  { id: 3, remitente_id: 1, remitente_nombre: 'Jefe Admin', asunto: 'Reunion manana', cuerpo: 'Revisamos el cierre y el cuadrante antes de abrir.', fecha: `${today}T08:30:00.000Z`, leido: 0 },
  { id: 4, remitente_id: 2, remitente_nombre: 'Encargado Principal', asunto: 'Checklist de hoy', cuerpo: 'Prioridad alta: cafetera, camara y reposicion de barra.', fecha: `${today}T09:00:00.000Z`, leido: 0 },
];

const presencia = [
  { usuario_id: 2, usuario_nombre: 'Encargado Principal', usuario_rol: 'manager', usuario_local: 'Principal', ultimo_fichaje_entrada: `${today}T09:00:00.000Z`, ultimo_fichaje_salida: null, estado_presencia: 'trabajando' },
  { usuario_id: 3, usuario_nombre: 'Maria Garcia', usuario_rol: 'employee', usuario_local: 'Principal', ultimo_fichaje_entrada: `${today}T17:55:00.000Z`, ultimo_fichaje_salida: null, estado_presencia: 'trabajando' },
  { usuario_id: 4, usuario_nombre: 'Juan Perez', usuario_rol: 'employee', usuario_local: 'Principal', ultimo_fichaje_entrada: `${yesterday}T18:00:00.000Z`, ultimo_fichaje_salida: `${today}T02:05:00.000Z`, estado_presencia: 'fuera' },
  { usuario_id: 5, usuario_nombre: 'Ana Lopez', usuario_rol: 'employee', usuario_local: 'Segundo Local', ultimo_fichaje_entrada: null, ultimo_fichaje_salida: null, estado_presencia: 'fuera' },
];

const fakePosterSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1080" viewBox="0 0 720 1080">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ec4899"/><stop offset="0.5" stop-color="#7c3aed"/><stop offset="1" stop-color="#10b981"/></linearGradient>
  </defs>
  <rect width="720" height="1080" fill="#020617"/>
  <circle cx="560" cy="180" r="220" fill="url(#g)" opacity="0.35"/>
  <circle cx="120" cy="880" r="260" fill="#16a34a" opacity="0.22"/>
  <text x="60" y="185" fill="#ffffff" font-size="72" font-family="Arial" font-weight="900">SALGUACATE</text>
  <text x="60" y="320" fill="#f9a8d4" font-size="54" font-family="Arial" font-weight="800">PINCHADA</text>
  <text x="60" y="395" fill="#ffffff" font-size="44" font-family="Arial" font-weight="700">Tropical con DJ Lua</text>
  <text x="60" y="820" fill="#bbf7d0" font-size="42" font-family="Arial" font-weight="800">Viernes · 22:30</text>
  <text x="60" y="890" fill="#ffffff" font-size="30" font-family="Arial">Entrada libre · Cocktails · Musica</text>
</svg>`;

const fakePosterDataUrl = `data:image/svg+xml;base64,${Buffer.from(fakePosterSvg).toString('base64')}`;

function byLocal(data, local) {
  if (!local || local === 'Todos') return data;
  return data.filter((item) => item.local === local);
}

async function installApiMocks(page) {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();

    const json = (body, status = 200) => route.fulfill({
      status,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(body),
    });

    let body = {};
    try { body = request.postDataJSON(); } catch (_) { body = {}; }

    if (pathname === '/api/usuarios/public') return json(users.map(({ id, nombre, rol }) => ({ id, nombre, rol })));
    if (pathname === '/api/usuarios' && method === 'GET') return json(users);
    if (pathname === '/api/usuarios' && method === 'POST') return json({ id: 99, success: true });
    if (pathname.startsWith('/api/usuarios/')) return json({ success: true });

    if (pathname === '/api/login') {
      const found = users.find((user) => user.id === Number(body.usuario_id)) || users[0];
      return json({ success: true, user: { id: found.id, nombre: found.nombre, rol: found.rol, local: found.local } });
    }

    if (pathname === '/api/fichajes/presencia') return json(presencia);
    if (pathname === '/api/fichar') return json({ success: true });

    if (pathname === '/api/inventario/alertas') {
      const local = url.searchParams.get('local') || 'Todos';
      return json(byLocal(inventory, local).filter((item) => item.stock_actual < item.stock_minimo));
    }
    if (pathname.startsWith('/api/inventario/') && pathname.endsWith('/stock')) return json({ success: true });
    if (pathname === '/api/inventario') {
      if (method === 'POST') return json({ id: 99, success: true });
      const local = url.searchParams.get('local') || 'Todos';
      return json(byLocal(inventory, local));
    }

    if (pathname === '/api/proveedores') return json(method === 'GET' ? providers : { id: 99, success: true });

    if (pathname === '/api/turnos') {
      if (method === 'POST') return json({ id: 99, success: true });
      const userId = url.searchParams.get('usuario_id');
      return json(userId ? turnos.filter((turno) => String(turno.usuario_id) === String(userId)) : turnos);
    }

    if (pathname === '/api/mensajes') {
      if (method === 'POST') return json({ id: 99, success: true });
      const userId = Number(url.searchParams.get('usuario_id'));
      return json(userId === 3 ? mensajesEmpleado : mensajesAdmin);
    }

    if (pathname === '/api/cierres') return json(method === 'GET' ? cierres : { id: 99, success: true });
    if (pathname === '/api/gastos') return json(method === 'GET' ? gastos : { id: 99, success: true });

    if (pathname === '/api/eventos') return json(method === 'GET' ? eventos : { id: 99, success: true });
    if (pathname.startsWith('/api/eventos/')) return json({ success: true });

    if (pathname === '/api/notas') return json(method === 'GET' ? notes : { id: 99, success: true });
    if (pathname.startsWith('/api/notas/')) return json({ success: true });

    if (pathname === '/api/tareas') return json(method === 'GET' ? tasks : { id: 99, success: true });
    if (pathname.startsWith('/api/tareas/')) return json({ success: true });

    if (pathname === '/api/pedidos') return json(method === 'GET' ? pedidos : { id: 99, success: true });
    if (pathname.startsWith('/api/pedidos/')) return json({ success: true });

    if (pathname === '/api/ai/vision') {
      if (body.mode === 'inventory') {
        return json({ success: true, result: { botellasEstimadas: 18, confianza: '82%', rawText: 'Se distinguen dos baldas con botellas completas y varias parcialmente ocultas.' } });
      }
      return json({ success: true, result: { total: 142.35, proveedor: 'Distribuciones Norte', rawText: 'Factura de bebidas detectada con IVA incluido y total legible.' } });
    }

    if (pathname === '/api/ai/poster') return json({ success: true, image: fakePosterDataUrl });
    if (pathname === '/api/ai/chat') return json({ success: true, actionExecuted: true, reply: 'He revisado el inventario y hay 3 productos bajo minimo. Tambien puedo crear eventos, asignar turnos y modificar stock si me lo pides de forma directa.' });

    return json({ success: true });
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  await context.addInitScript(() => localStorage.setItem('theme', 'light'));
  const page = await context.newPage();
  await installApiMocks(page);

  const screenshots = [];
  let sequence = 1;

  async function waitForUi(ms = 700) {
    await page.waitForTimeout(ms);
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  async function screenshot(id, title, options = {}) {
    await waitForUi(options.wait || 350);
    const filename = `${String(sequence).padStart(2, '0')}-${id}.png`;
    const filePath = path.join(SHOTS_DIR, filename);
    await page.screenshot({ path: filePath, fullPage: options.fullPage === true });
    const viewport = page.viewportSize() || { width: 0, height: 0 };
    screenshots.push({ id, title, filename, width: viewport.width, height: viewport.height });
    sequence += 1;
  }

  async function go(route) {
    await page.evaluate((nextRoute) => {
      window.history.pushState({}, '', nextRoute);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, route);
    await waitForUi(900);
  }

  async function loginAs(name) {
    await page.getByText(name).click();
    await page.locator('input').fill('0000');
    await page.getByRole('button', { name: 'Acceder' }).click();
    await waitForUi(1200);
  }

  const samplePng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAyAAAAJYCAIAAAB2A+LBAAAACXBIWXMAAAsTAAALEwEAmpwYAAACMUlEQVR4nO3WMQ0AAAgDINc/9K3hFkQKrswAADbN7gAAwH8RAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECDwZrsDAJTy0J4AAAAASUVORK5CYII=',
    'base64'
  );
  const uploadImage = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z8BQDwAFgwJ/lhU6UAAAAABJRU5ErkJggg==',
    'base64'
  );

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await screenshot('login-seleccion', 'Login: seleccion de perfil');
  await page.getByText('Jefe Admin').click();
  await screenshot('login-pin', 'Login: introduccion de PIN');
  await page.locator('input').fill('0000');
  await page.getByRole('button', { name: 'Acceder' }).click();
  await waitForUi(1200);

  await page.setViewportSize({ width: 1280, height: 900 });
  await screenshot('admin-dashboard-desktop', 'Panel de control administrativo con sidebar');

  await go('/inventario');
  await screenshot('inventario-catalogo', 'Inventario critico: catalogo, filtros y stock rapido');
  await page.getByText('Alertas de Stock').click();
  await screenshot('inventario-alertas', 'Inventario critico: alertas y pedido por proveedor');
  await page.getByText('Catálogo').click();
  await page.locator('main button').first().click();
  await screenshot('inventario-nuevo-producto', 'Inventario critico: modal de nuevo producto');

  await go('/control-stock');
  await screenshot('control-stock-revision', 'Control de stock: revision por local');
  await page.getByText('Seleccionar stock bajo').click();
  await page.getByText(/Generar Pedido/).click();
  await screenshot('control-stock-pedido', 'Control de stock: pedido agrupado para WhatsApp');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await waitForUi(300);
  await page.getByText('Historial').click();
  await screenshot('control-stock-historial', 'Control de stock: historial y recibido');

  await go('/proveedores');
  await screenshot('proveedores-listado', 'Proveedores: agenda de contactos');
  await page.locator('main button').first().click();
  await screenshot('proveedores-nuevo', 'Proveedores: alta de proveedor');

  await go('/escaner');
  await screenshot('escaner-inicio', 'Escaner: captura de factura o ticket');
  await page.locator('input[type=file]').setInputFiles({ name: 'factura-demo.png', mimeType: 'image/png', buffer: uploadImage });
  await waitForUi(600);
  await page.getByText('Factura IA').click();
  await page.getByText('Analizar con Gemini').click();
  await page.getByText('Resultados de la Inteligencia Artificial').waitFor({ timeout: 5000 });
  await screenshot('escaner-factura-ia', 'Escaner: resultado de factura con IA');

  await go('/rrhh');
  await screenshot('rrhh-plantilla-turnos', 'Recursos Humanos: plantilla y agenda de turnos');
  await page.locator('main button').filter({ hasText: 'Empleado' }).first().click();
  await screenshot('rrhh-empleado-modal', 'Recursos Humanos: crear o editar empleado');
  await go('/');
  await go('/rrhh');
  await page.getByText('Crear Cuadrante').click();
  await screenshot('rrhh-turno-modal', 'Recursos Humanos: asignar turno manual');

  await go('/tareas');
  await screenshot('tareas-listado', 'Tareas: checklists, filtros y prioridades');
  await page.locator('main button').filter({ hasText: 'Nueva' }).first().click();
  await screenshot('tareas-nueva', 'Tareas: creacion de checklist');

  await go('/agenda');
  await screenshot('agenda-eventos', 'Agenda: eventos, edicion y tipos');
  await page.locator('main button').filter({ hasText: 'Nuevo' }).first().click();
  await screenshot('agenda-evento-modal', 'Agenda: alta o edicion de evento');
  await go('/');
  await go('/agenda');
  await page.getByText('Crear Cartel Promocional').first().click();
  await page.getByText('Descargar Cartel').waitFor({ timeout: 5000 });
  await screenshot('agenda-cartel-ia', 'Agenda: cartel promocional generado con IA');

  await go('/correos');
  await screenshot('mensajes-bandeja', 'Buzon interno: mensajes recibidos');
  await page.locator('main button').first().click();
  await screenshot('mensajes-componer', 'Buzon interno: nuevo mensaje');

  await go('/notas');
  await screenshot('notas-muro', 'Muro de notas: notas fijadas, colores y autores');
  await page.locator('main button').filter({ hasText: 'Nueva' }).first().click();
  await screenshot('notas-nueva', 'Muro de notas: nueva nota y dictado');

  await go('/ventas');
  await screenshot('ventas-nuevo-cierre', 'Ventas: formulario de cierre de caja');
  await page.getByText('Historial').click();
  await screenshot('ventas-historial', 'Ventas: historial de cierres por local');

  await go('/analiticas');
  await screenshot('analiticas-financieras', 'Analiticas: KPIs y graficos financieros');

  await go('/informes');
  await screenshot('informes-mensuales', 'Informes: periodo, local y exportacion PDF');

  await go('/ajustes');
  await screenshot('ajustes-perfil', 'Ajustes: perfil y opciones visibles');

  await go('/');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('open_ai_chat', { detail: { message: 'Resume el stock bajo y dime si hay tareas urgentes.' } })));
  await waitForUi(400);
  await page.locator('input[placeholder="Pregúntame sobre el stock o la plantilla..."]').press('Enter');
  await page.getByText('He revisado el inventario').waitFor({ timeout: 5000 });
  await screenshot('salguabot-chat', 'Salguabot: asistente IA contextual');

  await page.getByText('Cerrar Sesión').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs('Maria Garcia');

  await screenshot('empleado-dashboard', 'Empleado: inicio, turno del dia y checklist');
  await go('/calendario');
  await screenshot('empleado-calendario', 'Empleado: calendario de turnos asignados');
  await go('/fichaje');
  await screenshot('empleado-fichaje-inicio', 'Empleado: control horario antes de fichar');
  await page.getByText('Fichar Entrada').click();
  await page.getByText('Turno Activo').waitFor({ timeout: 5000 });
  await screenshot('empleado-fichaje-activo', 'Empleado: turno activo, descanso y salida');
  await go('/correos');
  await screenshot('empleado-buzon', 'Empleado: buzon interno');
  await go('/peticiones');
  await screenshot('empleado-peticiones', 'Empleado: formulario de peticiones');
  await go('/ajustes');
  await screenshot('empleado-ajustes', 'Empleado: ajustes de perfil');

  const html = buildGuideHtml(screenshots);
  fs.writeFileSync(HTML_PATH, html, 'utf8');

  const pdfPage = await context.newPage();
  await pdfPage.goto(`file://${HTML_PATH.replace(/\\/g, '/')}`, { waitUntil: 'load' });
  await pdfPage.pdf({
    path: PDF_PATH,
    format: 'A4',
    printBackground: true,
    margin: { top: '12mm', right: '12mm', bottom: '14mm', left: '12mm' },
  });

  await browser.close();

  console.log(`Guia HTML: ${HTML_PATH}`);
  console.log(`Guia PDF: ${PDF_PATH}`);
  console.log(`Capturas: ${screenshots.length}`);
}

function buildGuideHtml(screenshots) {
  const byId = new Map(screenshots.map((shot) => [shot.id, shot]));
  const generatedAt = new Date().toLocaleString('es-ES');

  const fig = (id, caption) => {
    const shot = byId.get(id);
    if (!shot) return '';
    const kind = shot.width && shot.width < 700 ? 'phone' : 'wide';
    return `
      <figure class="${kind}">
        <img src="assets/guide/screenshots/${shot.filename}" alt="${caption}" />
        <figcaption>${caption}</figcaption>
      </figure>`;
  };

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Guia de Usuario Salguacate ERP</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #0f172a; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 11.5px; line-height: 1.42; background: #fff; }
    h1, h2, h3, h4 { margin: 0 0 8px; line-height: 1.18; color: #0f172a; }
    h1 { font-size: 32px; letter-spacing: -0.04em; }
    h2 { font-size: 21px; margin-top: 18px; padding-top: 7px; border-top: 2px solid #16a34a; break-after: avoid; }
    h3 { font-size: 15px; margin-top: 12px; color: #166534; break-after: avoid; }
    h4 { font-size: 13px; margin-top: 12px; color: #334155; text-transform: uppercase; letter-spacing: .06em; }
    p { margin: 0 0 6px; }
    ul, ol { margin: 5px 0 10px 17px; padding: 0; }
    li { margin: 2px 0; }
    table { border-collapse: collapse; width: 100%; margin: 8px 0 12px; font-size: 10.5px; }
    th, td { border: 1px solid #dbeafe; padding: 6px 7px; vertical-align: top; }
    th { background: #f0fdf4; color: #14532d; text-align: left; }
    code { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 1px 4px; color: #0f172a; }
    figure { margin: 7px 0 10px; break-inside: avoid; page-break-inside: avoid; border: 1px solid #dbeafe; border-radius: 14px; overflow: hidden; background: #f8fafc; box-shadow: 0 8px 20px rgba(15, 23, 42, .08); }
    figure img { display: block; height: auto; object-fit: contain; }
    figure.wide { width: fit-content; max-width: 100%; margin-left: auto; margin-right: auto; }
    figure.wide img { width: auto; max-width: 100%; max-height: 92mm; background: #e2e8f0; margin: 0 auto; }
    figure.phone { display: inline-block; width: 62mm; max-width: 45%; margin: 6px 7mm 10px 0; vertical-align: top; border-radius: 20px; border: 4px solid #0f172a; background: #0f172a; padding: 3px; }
    figure.phone img { width: 100%; max-height: 132mm; border-radius: 13px 13px 6px 6px; background: #fff; }
    figcaption { padding: 6px 8px; color: #475569; font-size: 9.5px; border-top: 1px solid #dbeafe; background: #f8fafc; }
    figure.phone figcaption { border: 0; border-radius: 0 0 14px 14px; margin-top: 3px; }
    .cover { min-height: 265mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; break-after: page; background: radial-gradient(circle at 85% 12%, rgba(187,247,208,.22), transparent 30%), linear-gradient(135deg, #052e16, #166534 45%, #0f172a); color: white; padding: 22mm; border-radius: 24px; overflow: hidden; position: relative; }
    .cover h1, .cover h2, .cover p { color: white; border: 0; }
    .cover h1 { font-size: 44px; max-width: 620px; }
    .cover .badge { display: inline-block; width: fit-content; padding: 6px 10px; border: 1px solid rgba(255,255,255,.35); border-radius: 999px; text-transform: uppercase; letter-spacing: .12em; font-size: 11px; margin-bottom: 18px; }
    .cover .meta { margin-top: 28px; color: #bbf7d0; }
    .toc { page-break-after: always; break-after: page; }
    .callout { border-left: 4px solid #16a34a; background: #f0fdf4; padding: 8px 10px; border-radius: 8px; margin: 8px 0 12px; }
    .warning { border-left-color: #f59e0b; background: #fffbeb; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .page-break { page-break-before: always; }
    .small { color: #64748b; font-size: 10px; }
  </style>
</head>
<body>
  <section class="cover">
    <div class="badge">Manual operativo completo</div>
    <h1>Guia de Usuario de Salguacate ERP</h1>
    <p>Administracion, plantilla, inventario, caja, IA, agenda, informes y flujos diarios con pantallazos reales de la aplicacion.</p>
    <p class="meta">Generado el ${generatedAt}<br/>Capturas incluidas: ${screenshots.length}</p>
  </section>

  <section class="toc">
    <h2>Indice</h2>
    <ol>
      <li>Alcance, roles y conceptos basicos.</li>
      <li>Acceso, navegacion, tema claro/oscuro y cierre de sesion.</li>
      <li>Panel de administracion y operaciones.</li>
      <li>Inventario, alertas, pedidos, proveedores y escaner.</li>
      <li>Recursos humanos, turnos, tareas, mensajes, notas y agenda.</li>
      <li>Ventas, analiticas e informes mensuales.</li>
      <li>Flujo de empleado: inicio, turnos, fichaje, buzon y peticiones.</li>
      <li>Funciones de inteligencia artificial y consideraciones operativas.</li>
    </ol>
    <div class="callout">
      Esta guia esta orientada a usuarios finales y responsables de negocio. Explica que hace cada pantalla, cuando usarla, que datos se guardan y que limitaciones visibles conviene conocer.
    </div>
  </section>

  <h2>1. Vision General</h2>
  <p>Salguacate ERP centraliza la gestion diaria de un negocio de hosteleria con dos locales: <code>Principal</code> y <code>Segundo Local</code>. La aplicacion se divide en perfiles administrativos y perfiles de empleado para mantener separadas las tareas de gestion y las operaciones personales.</p>
  <table>
    <tr><th>Rol</th><th>Acceso principal</th><th>Uso esperado</th></tr>
    <tr><td>Propietario</td><td>Todos los modulos administrativos</td><td>Supervision global, caja, inventario, RRHH, informes, IA y configuracion.</td></tr>
    <tr><td>Encargado</td><td>Gestion diaria del local</td><td>Control de stock, turnos, cierres, tareas, mensajes, eventos y proveedores.</td></tr>
    <tr><td>Empleado</td><td>Panel personal</td><td>Ver turnos, fichar, completar tareas, leer mensajes y enviar peticiones.</td></tr>
  </table>

  <h2>2. Acceso y Navegacion</h2>
  <h3>Seleccion de perfil</h3>
  <p>La pantalla inicial muestra los usuarios dados de alta. Cada tarjeta identifica nombre y rol. Se debe tocar el usuario correspondiente antes de introducir el PIN.</p>
  ${fig('login-seleccion', 'Pantallazo: seleccion de perfil de acceso')}
  <h3>PIN de acceso</h3>
  <p>Tras elegir usuario, se introduce el PIN numerico. El PIN por defecto de los usuarios iniciales es <code>0000</code>. La sesion se mantiene en memoria: si se refresca la pagina, se vuelve al login por seguridad.</p>
  ${fig('login-pin', 'Pantallazo: formulario de PIN')}
  <h3>Navegacion global</h3>
  <p>En escritorio aparece una barra lateral con las secciones Operaciones, Gestion y Equipo, y Finanzas. En movil aparece una barra inferior simplificada. Los botones de tema permiten alternar entre modo claro y oscuro.</p>
  ${fig('admin-dashboard-desktop', 'Pantallazo: panel administrativo con navegacion lateral')}

  <h2>3. Panel de Control Administrativo</h2>
  <p>El panel resume la situacion del negocio: ingresos del mes, gastos, beneficio neto, numero de cierres, tareas pendientes, empleados, productos de inventario, stock bajo, proximo evento y presencia en tiempo real.</p>
  <ul>
    <li>Las alertas rapidas enlazan con tareas, inventario o agenda segun corresponda.</li>
    <li>El bloque de modulos permite entrar rapidamente en cierres, RRHH, agenda, stock, pedidos, notas, informes, tareas y analiticas.</li>
    <li>La presencia distingue estados <code>Trabajando</code>, <code>Descanso</code> y <code>Fuera</code>.</li>
  </ul>

  <h2>4. Inventario Critico</h2>
  <p>El inventario permite consultar productos por local, categoria y busqueda textual. Cada tarjeta muestra producto, categoria, local, stock actual, minimo y botones rapidos para sumar o restar unidades.</p>
  ${fig('inventario-catalogo', 'Pantallazo: catalogo de inventario con filtros y ajuste rapido')}
  <h3>Crear producto</h3>
  <p>El modal de nuevo producto guarda nombre, stock actual, stock minimo, categoria, local, proveedor e imagen opcional. La imagen se sube como archivo y queda asociada al producto.</p>
  ${fig('inventario-nuevo-producto', 'Pantallazo: alta de producto')}
  <h3>Alertas de stock</h3>
  <p>La pestana de alertas agrupa productos por proveedor cuando el stock esta por debajo del minimo. Desde ahi se genera un texto de pedido para WhatsApp o email.</p>
  ${fig('inventario-alertas', 'Pantallazo: alertas de stock agrupadas por proveedor')}

  <h2>5. Pedidos de Reposicion</h2>
  <p>Control de Stock esta pensado para preparar pedidos reales. Primero se elige el local, despues se seleccionan productos manualmente o se usa <code>Seleccionar stock bajo</code>. El pedido se agrupa por proveedor.</p>
  ${fig('control-stock-revision', 'Pantallazo: revision de stock por local')}
  <p>Antes de enviar, cada cantidad puede ajustarse con los botones <code>-</code> y <code>+</code>. El boton WhatsApp abre un mensaje listo para enviar y registra el pedido en el historial.</p>
  ${fig('control-stock-pedido', 'Pantallazo: pedido agrupado para WhatsApp')}
  <p>El historial permite comprobar pedidos recientes y marcarlos como recibidos. Marcar recibido cambia el estado del pedido, pero no incrementa automaticamente el inventario.</p>
  ${fig('control-stock-historial', 'Pantallazo: historial de pedidos')}

  <h2>6. Proveedores</h2>
  <p>El directorio de proveedores centraliza nombre, categoria, telefono y email. Los telefonos y correos se presentan como enlaces directos para llamar o escribir.</p>
  ${fig('proveedores-listado', 'Pantallazo: listado de proveedores')}
  <p>El alta de proveedor pide empresa, telefono, categoria y email opcional. Actualmente no hay edicion ni borrado visible desde esta pantalla.</p>
  ${fig('proveedores-nuevo', 'Pantallazo: alta de proveedor')}

  <h2>7. Escaner de Facturas y Stock Visual</h2>
  <p>El escaner abre la camara o selector de imagen. Puede guardar una foto como PDF, analizar una factura con IA o estimar stock visual.</p>
  ${fig('escaner-inicio', 'Pantallazo: entrada del escaner')}
  <p>En modo Factura IA, Gemini extrae proveedor, total y resumen. El boton <code>Registrar Gasto Directamente</code> guarda el gasto en contabilidad.</p>
  ${fig('escaner-factura-ia', 'Pantallazo: resultado de factura analizada por IA')}

  <h2>8. Recursos Humanos y Turnos</h2>
  <p>RRHH muestra la plantilla, permite crear, editar y eliminar empleados, y lista la agenda de turnos. Cada empleado tiene rol, local, telefono y PIN.</p>
  ${fig('rrhh-plantilla-turnos', 'Pantallazo: plantilla y agenda de turnos')}
  ${fig('rrhh-empleado-modal', 'Pantallazo: crear o editar empleado')}
  <p>El modal de turno asigna empleado, fecha, hora de inicio, hora de fin y companeros. La opcion <code>Autogenerar con IA</code> abre Salguabot con una instruccion preparada.</p>
  ${fig('rrhh-turno-modal', 'Pantallazo: asignar turno manual')}

  <h2>9. Tareas y Checklists</h2>
  <p>Las tareas organizan trabajo diario por prioridad, fecha, empleado y local. Se filtran por pendientes, hechas o todo. Tocar el check cambia el estado de completada.</p>
  ${fig('tareas-listado', 'Pantallazo: listado de tareas')}
  <p>Al crear una tarea puede asignarse a un empleado o dejarse para todos. El local puede ser <code>Principal</code>, <code>Segundo Local</code> o <code>Ambos</code>.</p>
  ${fig('tareas-nueva', 'Pantallazo: nueva tarea')}

  <h2>10. Agenda de Eventos</h2>
  <p>La agenda registra eventos generales, mantenimiento, citas con proveedor, reuniones, pinchadas y conciertos. Los eventos pasados aparecen atenuados.</p>
  ${fig('agenda-eventos', 'Pantallazo: agenda de eventos')}
  ${fig('agenda-evento-modal', 'Pantallazo: formulario de evento')}
  <p>En eventos musicales futuros aparece <code>Crear Cartel Promocional</code>. La imagen generada puede descargarse para redes sociales.</p>
  ${fig('agenda-cartel-ia', 'Pantallazo: cartel generado por IA')}

  <h2>11. Mensajes Internos</h2>
  <p>El buzon muestra mensajes recibidos ordenados por fecha. La composicion permite elegir destinatario, asunto y cuerpo del mensaje.</p>
  ${fig('mensajes-bandeja', 'Pantallazo: buzon de mensajes')}
  ${fig('mensajes-componer', 'Pantallazo: nuevo mensaje interno')}

  <h2>12. Muro de Notas</h2>
  <p>Las notas permiten dejar avisos internos con color, autor y opcion de fijar arriba. El dictado por voz depende del navegador y funciona mejor en Chrome o Edge.</p>
  ${fig('notas-muro', 'Pantallazo: muro de notas')}
  ${fig('notas-nueva', 'Pantallazo: nueva nota')}

  <h2>13. Ventas y Cierres de Caja</h2>
  <p>El cierre registra fecha, local, efectivo, tarjeta, invitaciones y descuadre. El total se calcula como efectivo mas tarjeta.</p>
  ${fig('ventas-nuevo-cierre', 'Pantallazo: nuevo cierre de caja')}
  <p>El historial permite filtrar por local y revisar importes anteriores. Los descuadres distintos de cero se resaltan.</p>
  ${fig('ventas-historial', 'Pantallazo: historial de cierres')}

  <h2>14. Analiticas Financieras</h2>
  <p>Analiticas combina cierres y gastos para mostrar ingresos brutos, gastos detectados, beneficio neto, descuadre total, evolucion temporal, metodos de pago y descuadres.</p>
  ${fig('analiticas-financieras', 'Pantallazo: analiticas financieras')}

  <h2>15. Informes Mensuales</h2>
  <p>Informes permite seleccionar mes, ano y local. El boton de exportacion abre un informe imprimible que puede guardarse como PDF desde el dialogo del navegador.</p>
  ${fig('informes-mensuales', 'Pantallazo: informes mensuales')}

  <h2>16. Ajustes</h2>
  <p>Ajustes muestra el perfil activo y opciones de datos personales, notificaciones, privacidad y seguridad. Para propietarios tambien aparece Gestion de Locales. En la version actual estas filas son informativas y no ejecutan acciones.</p>
  ${fig('ajustes-perfil', 'Pantallazo: ajustes de perfil administrativo')}

  <h2>17. Salguabot e Inteligencia Artificial</h2>
  <p>Salguabot esta disponible para propietario y encargado. Puede responder sobre stock y plantilla y ejecutar acciones conectadas a base de datos, como crear eventos, modificar stock, borrar eventos o asignar turnos.</p>
  ${fig('salguabot-chat', 'Pantallazo: asistente IA contextual')}
  <div class="callout warning">
    Las funciones de IA dependen de la clave de Gemini configurada en el backend. Si la clave, el modelo o la facturacion no estan disponibles, el modulo mostrara error de conexion o de generacion.
  </div>

  <h2 class="page-break">18. Flujo de Empleado</h2>
  <p>El empleado accede a un panel simplificado con su turno del dia, checklist asignado, calendario, fichaje, buzon y peticiones.</p>
  ${fig('empleado-dashboard', 'Pantallazo: inicio de empleado')}
  <h3>Turnos asignados</h3>
  <p>El calendario lista los proximos turnos del usuario autenticado con horario, local y companeros.</p>
  ${fig('empleado-calendario', 'Pantallazo: calendario personal')}
  <h3>Control horario</h3>
  <p>El empleado ficha entrada y salida. Los botones de descanso y volver cambian el estado visual del turno en la pantalla.</p>
  ${fig('empleado-fichaje-inicio', 'Pantallazo: fichaje antes de entrada')}
  ${fig('empleado-fichaje-activo', 'Pantallazo: fichaje con turno activo')}
  <h3>Buzon, peticiones y ajustes</h3>
  <p>El empleado puede leer mensajes internos, enviar comunicaciones y rellenar una peticion de vacaciones, cambio de turno, baja medica o asuntos propios. En la version actual, la pantalla de peticiones es visual y no persiste en backend.</p>
  ${fig('empleado-buzon', 'Pantallazo: buzon del empleado')}
  ${fig('empleado-peticiones', 'Pantallazo: nueva peticion de empleado')}
  ${fig('empleado-ajustes', 'Pantallazo: ajustes del empleado')}

  <h2>19. Limitaciones Operativas Visibles</h2>
  <ul>
    <li>Las peticiones de empleado no se guardan todavia en servidor.</li>
    <li>Los ajustes son informativos; no abren subpantallas funcionales.</li>
    <li>Marcar un pedido como recibido no actualiza automaticamente el inventario.</li>
    <li>El descanso del fichaje cambia el estado visual local, pero no persiste un registro separado en backend.</li>
    <li>Los gastos creados por IA se registran con proveedor y total; la imputacion por local depende de la implementacion backend disponible.</li>
  </ul>

  <h2>20. Rutina Recomendada</h2>
  <ol>
    <li>Al abrir: revisar panel, presencia, tareas del dia y alertas de stock.</li>
    <li>Durante el servicio: ajustar stock rapido, completar checklists y responder mensajes.</li>
    <li>Antes de cerrar: registrar cierre de caja, escanear facturas y dejar notas importantes.</li>
    <li>Semanalmente: revisar analiticas, emitir informe mensual si procede, preparar pedidos y actualizar cuadrantes.</li>
  </ol>
  <p class="small">Documento generado automaticamente con datos de demostracion interceptados en navegador. No modifica la base de datos real.</p>
</body>
</html>`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
