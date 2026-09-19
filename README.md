# Salguacate ERP

Aplicación de gestión interna de restauración: React/TypeScript y API Express con SQLite. Esta rama recupera la base técnica; no constituye una versión aprobada para producción.

Consultar primero el [estado y las puertas de salida de la recuperación](docs/architecture/recovery-status.md). El [índice por áreas](docs/architecture/README.md) conserva los informes de cada bloque y separa los planes históricos de TPV/fiscalidad. Un resultado local, un commit publicado, una CI correcta y un despliegue son evidencias diferentes.

## Requisitos y arranque local

- Node 22.23.2 (ver `.node-version`).
- Un único `package-lock.json` en la raíz; instalar siempre desde la raíz.
- npm 10/11 para `ci`; si npm 10 falla al actualizar dependencias con `edgesOut`, regenerar con npm 11.19.1 sin ignorar las dependencias peer. No es necesario cambiar la instalación global.
- `npm ci --ignore-scripts`.
- Copiar `apps/api/.env.example` a `apps/api/.env` y ajustar las opciones necesarias.
- Para una instalación **nueva**, seguir [alta inicial privada](docs/architecture/recovery-fresh-install.md): ruta explícita nueva y PIN por entrada estándar desde un prompt privado. `npm run bootstrap -- --help` describe el comando. No hay usuarios automáticos ni PIN universal.
- Ejecutar `npm run dev:api` y, en otra terminal, `npm run dev:erp`. Abrir `http://localhost:5173`.

El modo explícito se niega a usar cualquier archivo de base existente. El modo anterior sin argumentos sigue admitiendo `BOOTSTRAP_OWNER_NAME`/`BOOTSTRAP_OWNER_PIN` para una tabla de usuarios vacía; retirar esas variables después. Ninguno cambia cuentas existentes.

Para una base Turso nueva existe un [alta remota separada](docs/architecture/recovery-remote-bootstrap.md):
`npm run bootstrap:remote -- --help`. Crea esquema y propietario atómicamente,
exige host exacto y entrada privada, y se niega a tocar cualquier esquema existente.
No usar la base de compatibilidad ni pasar el token/PIN por argumentos o chat.

## Configuración

La API lee `apps/api/.env`. El frontend lee el `.env` de la raíz; solo configuración pública usa el prefijo `VITE_`. Nunca poner secretos en variables `VITE_*`.

El [almacén Cloudinary](docs/architecture/recovery-cloudinary-storage.md) requiere
`IMAGE_STORAGE=cloudinary` y sus tres variables privadas en la API, sin `UPLOADS_DIR`.
El frontend necesita al compilar `VITE_CLOUDINARY_CLOUD_NAME` con el nombre público
de la misma cuenta (no la API key ni el secreto). Por defecto se conserva el
almacenamiento local. No hay fallback implícito. El [ensayo remoto sintético](docs/architecture/recovery-cloudinary-probe.md)
ha validado ambas imágenes y su retirada; no equivale a despliegue.

En desarrollo: API en loopback, puerto 3001; SQLite y fotos bajo `apps/api`. En producción: ruta persistente explícita y orígenes HTTPS exactos obligatorios. Si el frontend y API no comparten origen, establecer `VITE_API_URL` al compilar. No existe conexión implícita a un servidor de producción.

El servidor local solo escucha tras completar las migraciones. El [modo Turso explícito](docs/architecture/recovery-remote-startup.md)
usa `DATABASE_DRIVER=libsql`, `TURSO_DATABASE_URL`, `TURSO_DATABASE_HOST` y un token
privado. Rechaza esquemas incompatibles y bases sin propietario preparado; no
crea ni migra la base remota. En producción remota exige Cloudinary, sin uploads
efímeros. No se ha activado esta configuración en ningún servicio.

`GET /api/health` indica disponibilidad de la base. La IA está desactivada por defecto; incluso activada, el chat no dispone de herramientas de escritura.

## Validación

- `npm run check`: lint, pruebas de API/componentes y compilación web.
- `npx --no-install playwright install chromium`, después `npm run test:e2e`.
- En Windows se puede definir `E2E_CHROME_PATH` con la ruta del ejecutable Chrome instalado.
- La batería funcional usa una API en memoria y un directorio temporal de fotos nuevos por archivo, conservando los límites de acceso reales; los artefactos se separan bajo `test-results/e2e`. El proceso principal elimina únicamente su directorio de fotos al finalizar el proceso de pruebas, también si este devuelve error. Para una selección concreta: `npm run test:e2e -- nombre.spec.ts`. Usar ese runner, no Playwright directo, para los recorridos que guardan imágenes.
- `npm run test:e2e:production`: comprueba el tamaño del arranque y la carga/recuperación de rutas sobre archivos compilados servidos localmente. Ejecutar después de E2E, nunca a la vez: comparten los puertos de prueba. No despliega.
- E2E reserva `127.0.0.1:5174` y `127.0.0.1:3101`, no reutiliza servidores y crea una base exclusivamente en memoria. Las credenciales bajo `tests/fixtures` no se cargan en el arranque normal.
- `npm audit` consulta avisos actuales; no equivale a una auditoría completa de seguridad.

## Antes de usar datos existentes

Consultar [recuperación y migración](docs/architecture/recovery-foundation.md). Es obligatorio conservar una copia recuperable y ensayar la migración sobre una copia antes de cualquier cambio en producción.

`npm run recovery -- --help` muestra los comandos locales de copia, verificación y restauración. Exigen rutas absolutas, destinos nuevos y confirmación de escrituras detenidas. Incluyen SQLite y uploads; no leen `.env`, no detienen servicios, no activan destinos ni publican archivos. Consultar el [procedimiento y sus límites](docs/architecture/recovery-data.md) antes de usarlos: una copia contiene datos sensibles y no está cifrada.

Android, TPV y módulos fiscales no se consideran validados por las pruebas web. El wrapper Android antiguo permanece pendiente de recuperación.

Los scripts `generate-user-guide.cjs` y `render-create-services.cjs` son históricos y no están adaptados a esta base: el primero usa datos simulados y el segundo configuración antigua de despliegue. No usarlos como validación ni para publicar esta versión.

## Publicación

El [plan gratuito aprobado](docs/architecture/recovery-free-hosting.md) comienza con
`npm run probe:turso -- --help`: ensayo manual en una base Turso/libSQL nueva y
desechable, separado del servidor. SQLite sigue siendo el valor por defecto;
el ensayo inicial no constituye despliegue. El [bloque asíncrono](docs/architecture/recovery-async-api.md)
aporta comprobaciones HTTP con Turso y el [arranque explícito](docs/architecture/recovery-remote-startup.md)
prepara su selección operacional, pendiente del bootstrap y la validación conjunta.

CI comprueba los cambios; no publica. El workflow de Render es manual y exige validación. `render.yaml` declara despliegues automáticos desactivados, pero un cambio en este archivo **no demuestra** que esa configuración se haya aplicado al servicio remoto. No se han modificado servicios remotos desde esta rama.
