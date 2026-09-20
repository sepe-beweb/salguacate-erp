# Piloto gratuito en Render

El blueprint actual prepara una API Node **Free**, sin disco, y un sitio estático.
La persistencia se guarda en Turso/libSQL y Cloudinary, nunca en el sistema de
archivos efímero de Render. Esta configuración no demuestra que haya servicios
creados ni una URL validada: consultar el [estado vigente](architecture/recovery-status.md).

El código actual exige esquema 6 y un almacén privado para el archivo documental.
La configuración gratuita descrita aquí solo resuelve la base y las fotos públicas;
no proporciona ese almacén privado. No guardar originales en el disco efímero ni
en el catálogo público. Sin adaptador privado las rutas de documentos devuelven
503. Migración remota ensayada y persistencia documental son puertas pendientes
antes de considerar desplegada la aplicación completa.

## Crear los servicios

1. Entrar en el workspace personal de Render y comprobar plan, uso y facturación.
   No añadir tarjeta, contratar recursos ni activar extras para este piloto.
2. Conectar exclusivamente `sepe-beweb/salguacate-erp` y seleccionar
   `refactor/recovery-foundation`, con un commit cuya CI haya terminado correctamente.
   No desplegar el `main` antiguo ni ejecutar `scripts/render-create-services.cjs`:
   ese cliente histórico sigue preparado para SQLite con disco y no sirve para este piloto.
3. Crear los dos servicios desde `render.yaml` o copiar su configuración en el panel.
   Revisar posibles servicios existentes antes de aplicar un blueprint con el mismo
   nombre. Confirmar API **Free**, región Frankfurt y frontend estático, sin disco.
4. Configurar las variables siguientes. Los nombres de servicio del YAML no
   garantizan que sus subdominios estén disponibles: usar las URLs que asigne Render.
   Si se crean por separado, obtener primero la URL del frontend, configurar la API
   y, al obtener su URL, compilar/republicar el frontend con ella.
5. Mantener el despliegue automático desactivado. No ejecutar bootstrap ni migraciones
   como parte del build o del arranque: la base debe estar preparada de antemano.

## Variables

Las variables con `sync: false` se introducen en Render, no en Git. Los secretos
operativos necesitan autorización para crearlos y transmitirlos a Render; no
reutilizar credenciales temporales ya retiradas. No copiar secretos al chat, logs,
archivos versionados ni variables `VITE_*`.

| Servicio | Variable | Valor |
| --- | --- | --- |
| API | `NODE_ENV` / `NODE_VERSION` | `production` / `22.23.2`, ya fijados |
| API | `DATABASE_DRIVER` | `libsql`, ya fijado |
| API | `TURSO_DATABASE_URL` | URL `libsql://` de la instalación operativa |
| API | `TURSO_DATABASE_HOST` | Host exacto de esa misma URL, sin protocolo ni ruta |
| API | `TURSO_AUTH_TOKEN` | Token operativo de lectura/escritura solo de esa base |
| API | `IMAGE_STORAGE` | `cloudinary`, ya fijado |
| API | `CLOUDINARY_CLOUD_NAME` | Entorno de imágenes autorizado |
| API | `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Clave operativa dedicada, nunca Root |
| API | `CORS_ORIGINS` | Origen HTTPS exacto del frontend, sin barra final |
| API | `AI_ENABLED` | `false`, ya fijado; no necesita Gemini |
| Frontend | `VITE_API_URL` | Origen HTTPS real de la API |
| Frontend | `VITE_CLOUDINARY_CLOUD_NAME` | Mismo nombre público que en la API; no es el secreto |

Render inyecta `PORT`; el servidor escucha en `0.0.0.0` en producción. No configurar
`SQLITE_DATABASE_PATH`, `UPLOADS_DIR` ni `JWT_SECRET`: no forman parte de este despliegue.
El PIN del propietario ya existe en la base y no se añade como variable de entorno.
Un cambio de `VITE_*` requiere recompilar el frontend.

## Comprobación de salida

- Build y arranque del commit elegido, health `/api/health` y dominio HTTPS real.
- Frontend servido con el bundle correspondiente, sin errores de consola ni CORS.
- Login del titular con su PIN privado; navegación y lectura de la base nueva.
- Recorrido de escritura y foto acordado, comprobación tras recargar y reiniciar la API.
- Pantalla móvil y acceso directo a rutas internas: rewrite `/*` a `/index.html`.

El selector de acceso actual muestra nombres y roles públicamente; acordar esa
exposición antes de publicar. Las fotos son públicas por URL: no cargar documentos
personales. No se ha ensayado todavía una copia/restauración conjunta de Turso y
Cloudinary; resolverla antes de confiar datos operativos irremplazables al piloto.

## Límites y vuelta atrás

Render Free se duerme tras 15 minutos sin tráfico y puede tardar aproximadamente
un minuto en despertar. Sus cuotas de horas, transferencia y compilación son
compartidas por workspace; sin método de pago puede suspender servicio o builds
al agotarlas. No añadir pings para evitar la suspensión ni cambiar de plan sin decisión
expresa. Revisar también las cuotas gratuitas independientes de Turso y Cloudinary.

Para volver a una versión anterior, usar únicamente un commit compatible con el
esquema remoto actual. No activar el backend SQLite histórico ni restaurar datos
encima de la base operativa como una simple reversión de código. Conservar los
despliegues manuales y registrar versión, URLs, fecha de caducidad/rotación de
credenciales y comprobaciones reales, sin registrar sus valores.

El workflow `render-deploy.yml` es manual, limita su disparo a `main` y necesita hooks
opcionales; no se usa para esta publicación desde la rama de recuperación.

Referencias: [Render Free](https://render.com/docs/free) y
[especificación de Blueprint](https://render.com/docs/blueprint-spec), consultadas
el 19 de septiembre de 2026.
