import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    console.log("Iniciando servidores...");
    const serverProcess = spawn('npm', ['start'], { cwd: path.join(__dirname, 'server'), shell: true });
    const frontendProcess = spawn('npm', ['run', 'dev'], { cwd: __dirname, shell: true });

    await wait(8000); // Dar tiempo a que los servidores arranquen

    console.log("Servidores iniciados. Lanzando navegador para capturas...");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });

    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir);
    }

    try {
        // Pantalla de Login
        console.log("Capturando Login...");
        await page.goto('http://localhost:5173');
        await page.waitForSelector('button:has-text("Jefe Admin")', { timeout: 10000 });
        await page.screenshot({ path: path.join(screenshotsDir, 'login_seleccionar.png') });

        // Seleccionar a 'Jefe Admin'
        await page.click('button:has-text("Jefe Admin")');
        await page.waitForSelector('input[type="password"]');
        
        await page.screenshot({ path: path.join(screenshotsDir, 'login_pin.png') });

        // Escribir PIN 0000
        await page.fill('input[type="password"]', '0000');
        await page.click('button:has-text("Acceder")');

        // Esperar al Dashboard
        await page.waitForSelector('h1:has-text("Panel de Control")', { timeout: 10000 });
        await wait(2000);
        console.log("Capturando Dashboard...");
        await page.screenshot({ path: path.join(screenshotsDir, 'dashboard.png') });

        // Abrir Chatbot
        console.log("Capturando Chatbot...");
        await page.click('button[title="Asistente de IA"]');
        await wait(2000);
        await page.screenshot({ path: path.join(screenshotsDir, 'chatbot.png') });
        
        // Cerrar chatbot y navegar a Inventario
        await page.click('button:has-text("Cerrar")'); // Assuming the close button might not have text, let's use the X icon if possible, or press Escape
        await page.keyboard.press('Escape');
        await wait(1000);

        await page.click('a:has-text("Inventario")');
        await page.waitForSelector('h1:has-text("Inventario y Stock")', { timeout: 10000 });
        await wait(2000);
        console.log("Capturando Inventario...");
        await page.screenshot({ path: path.join(screenshotsDir, 'inventario.png') });

        // Escáner de Facturas
        await page.click('a:has-text("Escáner")');
        await wait(2000);
        console.log("Capturando Scanner...");
        await page.screenshot({ path: path.join(screenshotsDir, 'scanner.png') });

        // Eventos
        await page.click('a:has-text("Eventos")');
        await wait(2000);
        console.log("Capturando Eventos...");
        await page.screenshot({ path: path.join(screenshotsDir, 'eventos.png') });

        // Cierres de caja (Sales)
        await page.click('a:has-text("Caja")');
        await wait(2000);
        console.log("Capturando Caja...");
        await page.screenshot({ path: path.join(screenshotsDir, 'caja.png') });

        // Analíticas
        await page.click('a:has-text("Analíticas")');
        await wait(2000);
        console.log("Capturando Analíticas...");
        await page.screenshot({ path: path.join(screenshotsDir, 'analiticas.png') });

    } catch (e) {
        console.error("Error durante las capturas:", e);
    }

    console.log("Generando HTML de la guía...");
    
    const imgToBase64 = (file) => {
        if (!fs.existsSync(file)) return '';
        const bitmap = fs.readFileSync(file);
        return 'data:image/png;base64,' + Buffer.from(bitmap).toString('base64');
    };

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Manual de Uso Salguacate ERP</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 0; background: #f8fafc; }
            .page { background: white; margin: 20px auto; padding: 40px; max-width: 900px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border-radius: 8px; page-break-after: always; }
            h1 { color: #166534; font-size: 2.5em; text-align: center; border-bottom: 2px solid #166534; padding-bottom: 10px; margin-bottom: 30px; }
            h2 { color: #15803d; font-size: 1.8em; margin-top: 40px; display: flex; align-items: center; gap: 10px; }
            h3 { color: #16a34a; font-size: 1.3em; }
            p { font-size: 1.1em; color: #475569; }
            .img-container { text-align: center; margin: 30px 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; padding: 10px; background: #f1f5f9; }
            img { max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
            ul { font-size: 1.1em; color: #475569; }
            li { margin-bottom: 10px; }
            .tip { background: #dcfce7; border-left: 4px solid #22c55e; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
            .tip strong { color: #166534; }
            .warning { background: #fef08a; border-left: 4px solid #eab308; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        </style>
    </head>
    <body>
        <div class="page">
            <h1>Manual de Uso Exhaustivo: Salguacate ERP</h1>
            <p style="text-align: center; font-size: 1.3em;">Sistema Integrado de Gestión Comercial y Despliegue en la Nube</p>
            <p>Bienvenido al manual oficial de Salguacate ERP. Esta herramienta no solo digitaliza el día a día del negocio, sino que está preparada para un despliegue gratuito en la nube (Render) y su distribución a través de dispositivos móviles Android. A continuación se detallan todas las operativas tecnológicas y de uso de la aplicación.</p>
            
            <h2>1. Despliegue e Infraestructura Tecnológica</h2>
            <h3>1.1 Despliegue en Render (Cloud)</h3>
            <p>El backend de la aplicación está diseñado para alojarse de manera gratuita y automática en Render:</p>
            <ul>
                <li>Suba el repositorio de la aplicación a GitHub.</li>
                <li>En Render (render.com), cree un "New Web Service" y vincule su repositorio de GitHub.</li>
                <li>Render leerá automáticamente el archivo <code>render.yaml</code> incluido en la raíz del proyecto y configurará el entorno de Node.js.</li>
            </ul>
            
            <h3>1.2 Conexión con Base de Datos Distribuida (Turso/libSQL)</h3>
            <p>Para evitar que el proveedor de hosting gratuito elimine su base de datos (problema común con SQLite), la aplicación tiene integración nativa con <strong>Turso</strong> (hasta 9GB gratuitos en la nube):</p>
            <ul>
                <li>Inicie sesión en Turso y cree una base de datos.</li>
                <li>Vaya a la configuración de variables de entorno de su Web Service en Render y añada: <code>TURSO_DATABASE_URL</code> y <code>TURSO_AUTH_TOKEN</code>.</li>
                <li>El código detectará la configuración de Turso de forma automática sin que tenga que modificar la base de código. Si no se proveen estas variables, la aplicación usará SQLite de manera local (ideal para desarrollo).</li>
            </ul>

            <h3>1.3 Aplicación Nativa para Android</h3>
            <p>Se incluye un proyecto nativo completo en la carpeta <code>/android</code>:</p>
            <ul>
                <li>Para generar la aplicación, primero ejecute el comando <code>npm run build:android</code> desde la terminal. Esto empaquetará el entorno React e inyectará los recursos dentro de la carpeta local de la app de Android.</li>
                <li>Abra Android Studio, cargue la carpeta <code>/android</code> y seleccione <strong>Build &gt; Build APK</strong>. Este APK se puede instalar en cualquier tableta del local.</li>
            </ul>
        </div>

        <div class="page">
            <h2>2. Acceso al Sistema</h2>
            <p>El sistema cuenta con un acceso optimizado para pantallas táctiles (TPVs y Tablets). No es necesario recordar nombres de usuario complejos. Cada empleado tiene su perfil visual.</p>
            <ul>
                <li>Pulse sobre su <strong>Nombre / Perfil</strong> en la lista.</li>
                <li>Introduzca su <strong>PIN de 4 dígitos</strong> usando el teclado numérico.</li>
            </ul>
            <div class="img-container"><img src="${imgToBase64(path.join(screenshotsDir, 'login_seleccionar.png'))}" alt="Pantalla de Selección" /></div>
            <div class="img-container"><img src="${imgToBase64(path.join(screenshotsDir, 'login_pin.png'))}" alt="Pantalla de PIN" /></div>
            <div class="tip"><strong>Seguridad:</strong> El sistema cerrará la sesión automáticamente al recargar la página para prevenir el acceso no autorizado en terminales compartidos.</div>
        </div>

        <div class="page">
            <h2>3. Panel de Control Principal (Dashboard)</h2>
            <p>El Dashboard es el centro neurálgico para los perfiles de Administración (Manager y Owner). Ofrece una vista panorámica en tiempo real del estado del negocio.</p>
            <div class="img-container"><img src="${imgToBase64(path.join(screenshotsDir, 'dashboard.png'))}" alt="Dashboard" /></div>
            <ul>
                <li><strong>KPIs Superiores:</strong> Visualice de un vistazo las ventas del día, los gastos registrados y el número de incidencias.</li>
                <li><strong>Alertas de Stock:</strong> Si el stock de cualquier producto crítico baja de su límite mínimo, aparecerá una alerta inmediata.</li>
                <li><strong>Presencia en Tiempo Real:</strong> Muestra quién está trabajando actualmente en los locales.</li>
            </ul>
            
            <h3>Salguabot: El Asistente de Inteligencia Artificial</h3>
            <div class="img-container"><img src="${imgToBase64(path.join(screenshotsDir, 'chatbot.png'))}" alt="Chatbot AI" /></div>
            <p>Puede pedirle a la IA mediante lenguaje natural que: <i>"Añade un concierto de Rock este viernes a las 22:00"</i>, <i>"Resta 5 botellas de Coca-Cola"</i> o <i>"Asigna el turno de mañana a María"</i>. La IA ejecutará las acciones en la base de datos automáticamente (Function Calling).</p>
        </div>

        <div class="page">
            <h2>4. Operativas del Local</h2>
            
            <h3>4.1 Control de Inventario y Almacén</h3>
            <div class="img-container"><img src="${imgToBase64(path.join(screenshotsDir, 'inventario.png'))}" alt="Inventario" /></div>
            <p>Gestión visual del catálogo. Alternar entre el Local Principal y el Segundo Local. Genera alertas de roturas de stock bajo los límites de seguridad.</p>

            <h3>4.2 Escáner y Reconocimiento de IA</h3>
            <div class="img-container"><img src="${imgToBase64(path.join(screenshotsDir, 'scanner.png'))}" alt="Scanner AI" /></div>
            <p>Utilizando Gemini 2.5 Flash de Google, tome una fotografía de sus facturas/albaranes y el sistema leerá los importes y nombres de proveedor y lo apuntará como un Gasto Contable de forma automática.</p>

            <h3>4.3 Agenda y Generador de Carteles</h3>
            <div class="img-container"><img src="${imgToBase64(path.join(screenshotsDir, 'eventos.png'))}" alt="Agenda de Eventos" /></div>
            <p>Para eventos musicales (Conciertos, Pinchadas de DJ), el sistema invocará a <strong>Imagen 3</strong> para generar automáticamente carteles promocionales listos para publicarse en Instagram.</p>
        </div>

        <div class="page">
            <h2>5. Contabilidad y Cierres</h2>
            
            <h3>5.1 Arqueos Diarios</h3>
            <div class="img-container"><img src="${imgToBase64(path.join(screenshotsDir, 'caja.png'))}" alt="Caja Diaria" /></div>
            <p>Introduzca el dinero contabilizado en el TPV y el cajón. El sistema contrastará el descuadre y agrupará la información para la contabilidad mensual.</p>

            <h3>5.2 Analíticas</h3>
            <div class="img-container"><img src="${imgToBase64(path.join(screenshotsDir, 'analiticas.png'))}" alt="Gráficas Analíticas" /></div>
            <p>Reportes interactivos del ratio de ingresos/gastos de sus locales y tendencias en la salud de su negocio.</p>
        </div>

    </body>
    </html>
    `;

    const htmlPath = path.join(__dirname, 'guia.html');
    fs.writeFileSync(htmlPath, htmlContent);

    console.log("Convirtiendo HTML a PDF...");
    await page.setContent(htmlContent, { waitUntil: 'networkidle' });
    
    await page.evaluate(() => {
        return Promise.all(Array.from(document.images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
            });
        }));
    });

    await page.pdf({
        path: path.join(__dirname, 'Guia_de_Uso_Salguacate_ERP_Profesional.pdf'),
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });

    console.log("PDF generado con éxito. Cerrando recursos...");
    await browser.close();
    serverProcess.kill();
    frontendProcess.kill();
    console.log("Proceso finalizado.");
}

run();
