# Railway: web, API y documentos privados

El servicio Node sirve la compilación `dist/erp` y `/api` en el mismo origen. Turso conserva los datos y Cloudinary solo las fotos públicas del catálogo. Los documentos se guardan en un volumen privado: no se publican mediante `express.static` ni se envían a Cloudinary.

## Configuración explícita

- Repositorio raíz, Node de `.node-version`; instalar con `npm ci --ignore-scripts` incluyendo dependencias de compilación.
- Compilar: `npm run build`. Arrancar: `node apps/api/server.js` o `npm start`.
- Healthcheck: `/api/health`. Una sola réplica, sin migración automática ni pre-deploy de documentos.
- Volumen montado en `/data`. Railway proporciona `RAILWAY_VOLUME_MOUNT_PATH`; el arranque comprueba el montaje Linux real antes de conectar a la base. No simularlo con una variable manual.
- Variables: `NODE_ENV=production`, `DATABASE_DRIVER=libsql`, `IMAGE_STORAGE=cloudinary`, `DOCUMENT_STORAGE=railway-volume`, `SERVE_WEB=true`, `AI_ENABLED=false`.
- `CORS_ORIGINS`: el origen HTTPS exacto del dominio generado, sin barra final. No comodines.
- Variables públicas de compilación: `VITE_API_URL=/` y `VITE_CLOUDINARY_CLOUD_NAME` con el nombre público del entorno. Nunca añadir secretos con prefijo `VITE_`.
- Variables privadas: `TURSO_DATABASE_URL`, `TURSO_DATABASE_HOST`, `TURSO_AUTH_TOKEN`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Solo credenciales operativas limitadas, nunca claves administrativas.
- No combinar con `SQLITE_DATABASE_PATH`, `UPLOADS_DIR` ni `DOCUMENTS_DIR`.

La clave de Cloudinary necesita permiso sobre `salguacate/inventory`. En modo de carpetas dinámicas, la subida indica `asset_folder` explícitamente; el prefijo de `public_id` no concede ni selecciona esa carpeta.

El esquema remoto y propietario deben prepararse por separado con copia de seguridad y ensayo. El arranque solo valida el contrato: no elimina ni repara datos. Conservar propietario, hash del PIN, historial y recibos idempotentes al migrar.

## Persistencia y límites

Los archivos quedan en `/data/documents`, con acceso mediante las rutas autenticadas del módulo documental. El almacén conserva sus límites de 10 MiB por archivo y 250 MiB acumulados, verificación SHA-256 y escrituras serializadas. Respaldar tanto la base como este directorio; una copia de Turso no contiene los PDF.

Railway documenta volúmenes de 0,5 GB en Free/Trial, un volumen por servicio y ausencia de réplicas para servicios con volumen. Los montajes solo existen en ejecución, no durante build/pre-deploy. Un redespliegue con volumen puede interrumpir brevemente el servicio. Revisar los límites vigentes antes de contratar o ampliar: [volúmenes](https://docs.railway.com/volumes), [límites](https://docs.railway.com/volumes/reference).

El crédito de prueba no garantiza alojamiento gratuito continuo. No activar planes, ampliaciones ni pagos automáticos sin aprobación del titular. La opción de reposo reduce consumo pero no elimina el coste del almacenamiento ni garantiza que el crédito dure un mes.

## Verificación

`npm run check` valida código, pruebas y compilación. `npm run test:e2e:railway` ejecuta los recorridos del frontend compilado contra un único servidor Node local, con SQLite en memoria y archivos desechables; no usa cuentas remotas ni acredita por sí solo Railway/Turso/Cloudinary.

Antes de entregar una URL: comprobar commit desplegado, `/api/health`, entrada por PIN, navegación y recarga profunda, fotos con la clave limitada, archivo/descarga autenticados y persistencia tras reinicio. No compartir una URL como operativa solo porque el build o la CI hayan terminado.
