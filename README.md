# Salguacate ERP

Aplicación de gestión interna de restauración: React/TypeScript y API Express con SQLite. Esta rama recupera la base técnica; no constituye una versión aprobada para producción.

Estado actual: [cimientos](docs/architecture/recovery-foundation.md), [módulos y flujos operativos](docs/architecture/recovery-modules.md) y [recuperación de pantallas](docs/architecture/recovery-screens.md). Los informes distinguen resultados locales de los commits publicados y su CI.

## Requisitos y arranque local

- Node 22.23.2 (ver `.node-version`).
- Un único `package-lock.json` en la raíz; instalar siempre desde la raíz.
- npm 10/11 para `ci`; si npm 10 falla al actualizar dependencias con `edgesOut`, regenerar con npm 11.19.1 sin ignorar las dependencias peer. No es necesario cambiar la instalación global.
- `npm ci --ignore-scripts`.
- Copiar `apps/api/.env.example` a `apps/api/.env` y ajustar las opciones necesarias.
- Para una base **vacía**, definir `BOOTSTRAP_OWNER_NAME` y un `BOOTSTRAP_OWNER_PIN` privado de 6–8 dígitos; ejecutar `npm run bootstrap` una sola vez. Retirar esas dos variables después. No hay usuarios automáticos ni PIN universal.
- Ejecutar `npm run dev:api` y, en otra terminal, `npm run dev:erp`. Abrir `http://localhost:5173`.

El bootstrap se niega a modificar una base que ya contiene usuarios. No crea contraseñas por defecto ni cambia las cuentas existentes.

## Configuración

La API lee `apps/api/.env`. El frontend lee el `.env` de la raíz; solo la URL pública de API usa el prefijo `VITE_`. Nunca poner secretos en variables `VITE_*`.

En desarrollo: API en loopback, puerto 3001; SQLite y fotos bajo `apps/api`. En producción: ruta persistente explícita y orígenes HTTPS exactos obligatorios. Si el frontend y API no comparten origen, establecer `VITE_API_URL` al compilar. No existe conexión implícita a un servidor de producción.

El servidor solo escucha tras completar las migraciones. `GET /api/health` indica disponibilidad de la base. La IA está desactivada por defecto; incluso activada, el chat no dispone de herramientas de escritura.

## Validación

- `npm run check`: lint, pruebas de API/componentes y compilación web.
- `npx --no-install playwright install chromium`, después `npm run test:e2e`.
- En Windows se puede definir `E2E_CHROME_PATH` con la ruta del ejecutable Chrome instalado.
- E2E reserva `127.0.0.1:5174` y `127.0.0.1:3101`, no reutiliza servidores y crea una base exclusivamente en memoria. Las credenciales bajo `tests/fixtures` no se cargan en el arranque normal.
- `npm audit` consulta avisos actuales; no equivale a una auditoría completa de seguridad.

## Antes de usar datos existentes

Consultar [recuperación y migración](docs/architecture/recovery-foundation.md). Es obligatorio conservar una copia recuperable y ensayar la migración sobre una copia antes de cualquier cambio en producción.

Android, TPV y módulos fiscales no se consideran validados por las pruebas web. El wrapper Android antiguo permanece pendiente de recuperación.

Los scripts `generate-user-guide.cjs` y `render-create-services.cjs` son históricos y no están adaptados a esta base: el primero usa datos simulados y el segundo configuración antigua de despliegue. No usarlos como validación ni para publicar esta versión.

## Publicación

CI comprueba los cambios; no publica. El workflow de Render es manual y exige validación. `render.yaml` declara despliegues automáticos desactivados, pero un cambio en este archivo **no demuestra** que esa configuración se haya aplicado al servicio remoto. No se han modificado servicios remotos desde esta rama.
