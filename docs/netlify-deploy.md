# Piloto gratuito en Netlify

Alternativa a Render para la cuenta que no pudo completar la verificación de tarjeta.
El equipo personal `sepe-insagurbe`, llamado Salguacate, tiene plan Free y se verificó
sin tarjeta guardada el 19 de septiembre de 2026. Esta comprobación no es un despliegue.

## Arquitectura

- Frontend React estático y API Express en una Netlify Function, bajo el mismo origen.
- `netlify.toml` compila `dist/erp` y empaqueta `apps/api/functions/api.js`.
- `/api/*` se reescribe a la función antes de la regla SPA; no redirige el navegador.
- `serverless-http` adapta los eventos Lambda a la API existente, sin abrir un puerto.
- La inicialización se comparte en cada instancia caliente y verifica la base antes
  de atender peticiones. Otra instancia verifica de nuevo. No hay bootstrap, migración
  automática, réplica local ni almacenamiento de negocio en el disco efímero.
- Las escrituras y sesiones permanecen en Turso y las fotos en Cloudinary. La cola
  local de escrituras no serializa instancias distintas: el bloqueo transaccional de
  Turso sigue siendo necesario. Las transacciones no se reintentan automáticamente.

## Configuración de publicación

El árbol actual requiere el **esquema 6**. Preparar la migración remota de forma
explícita sobre una copia y preservar propietario, sesiones y recibos; el arranque
no actualiza esquemas antiguos ni autoriza repetir bootstrap sobre una base poblada.

**Archivo documental pendiente de adaptación remota:** la configuración actual
solo dispone de un almacén privado local para SQLite. No configurar DOCUMENTS_DIR
en Netlify ni usar su disco efímero o Cloudinary público para originales privados.
Sin adaptador privado, las rutas documentales responden 503: este procedimiento
histórico no permite publicar el módulo completo. Revisar además los límites de
petición/respuesta del proveedor frente a los PDF y paquetes ZIP antes de activarlo.

1. Crear un proyecto en el equipo personal Free y conectar únicamente este repositorio.
   Seleccionar `refactor/recovery-foundation`, no el `main` histórico, y comprobar CI.
2. Usar la raíz y `netlify.toml`. No emplear el generador de aplicaciones, Netlify Database,
   recargas de créditos, planes de pago ni dominio comprado.
3. Fijar `AWS_LAMBDA_JS_RUNTIME=nodejs22.x` en el panel de Netlify; no en el TOML.
   El build usa Node 22.23.2; el parche del runtime remoto lo gestiona el proveedor.
4. Configurar `NODE_ENV=production`, `DATABASE_DRIVER=libsql`, `IMAGE_STORAGE=cloudinary`,
   `AI_ENABLED=false` y `CORS_ORIGINS` con el origen HTTPS exacto asignado al proyecto.
5. Añadir, con autorización específica para Netlify, `TURSO_DATABASE_URL`,
   `TURSO_DATABASE_HOST`, `TURSO_AUTH_TOKEN`, `CLOUDINARY_CLOUD_NAME`,
   `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET`. Solo en el entorno del servidor:
   no en archivos, logs, chat ni nombres `VITE_*`. No copiar claves administrativas
   temporales o Root al alojamiento.
6. Para el frontend, `VITE_API_URL` vacío conserva el mismo origen. Establecer únicamente
   `VITE_CLOUDINARY_CLOUD_NAME` con el nombre público del entorno de imágenes. Nunca
   introducir el PIN del propietario como variable de entorno.
7. Mantener publicaciones manuales/controladas para no consumir créditos con cada push.
   No conectar previews de otras ramas a credenciales de la base operativa.

## Validación obligatoria

Validación local del adaptador: `npm run check` correcto, 658 pruebas en 41 archivos
(12 nuevas), lint y compilación. Empaquetado con la biblioteca oficial incluida en
Netlify CLI 27.8.0, sin iniciar sesión ni subir el artefacto. No sustituye la prueba
del runtime real. La batería de navegador completa se ejecuta en CI al publicar el commit.

Se conserva el empaquetador predeterminado. El modo esbuild de esa versión elimina
el prefijo de `node:sqlite` y genera un `require('sqlite')` inválido; no usarlo para
este entrypoint. El paquete predeterminado se ha importado y ejecutado en Node 22:
sin credenciales devuelve 503 y no crea una instalación local.

Las pruebas del adaptador usan eventos Lambda y una base SQLite desechable: acreditan
rutas, autenticación, errores e inicialización, no el runtime alojado ni Turso real.
Antes de dar la URL por terminada, comprobar el bundle servido, health, login personal
del titular, navegación móvil y una escritura/foto acordada con persistencia después
de recargar. Revisar consola, CORS y acceso directo a rutas SPA. No crear otra cuenta
propietaria: la base Turso nueva ya contiene la introducida por su titular.

El selector público de nombres/roles y las fotos públicas por URL están autorizados
solo para el piloto, sin documentos personales. Queda pendiente la copia/restauración
conjunta remota antes de confiar datos irremplazables.

## Límites comprobados en la documentación

Free tiene 300 créditos mensuales compartidos por el equipo. Publicar en producción
consume 15 créditos, además del consumo por tráfico y funciones. Al agotarlos se
pausan los proyectos; no es una plataforma ilimitada ni se promete continuidad.
La función síncrona tiene un límite de 60 segundos y un payload bufferizado de 6 MB.
Se conserva el límite interno de imagen de 3 MiB; comprobar la envoltura real de la
petición al publicar. Puede haber arranque en frío de la función.

Fuentes oficiales: [Express](https://docs.netlify.com/build/frameworks/framework-setup-guides/express/),
[configuración de funciones](https://docs.netlify.com/build/functions/configuration/) y
[precios](https://www.netlify.com/pricing/), consultadas el 19 de septiembre de 2026.
