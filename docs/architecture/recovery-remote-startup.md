# Arranque remoto explícito

## Alcance del bloque 36

`DATABASE_DRIVER` admite `sqlite` (valor por defecto) o `libsql`. La mera presencia
de un token nunca cambia de backend. La configuración Turso exige URL HTTPS o
libsql del servicio, token privado y `TURSO_DATABASE_HOST` exactamente coincidente;
rechaza credenciales en URL, rutas, puertos, parámetros y destinos no reconocidos.
No hay réplica SQLite, fallback ni reintentos implícitos.

No combinar Turso con `SQLITE_DATABASE_PATH`. La producción remota exige orígenes
CORS HTTPS explícitos y almacén Cloudinary; no acepta fotos efímeras en el disco
de Render. Las variables privadas no se imprimen ni se copian al frontend.

Antes de escuchar, el servidor remoto verifica:

- Tablas, índices y triggers exactamente iguales al esquema canónico derivado de
  las migraciones locales. Una diferencia SQL, incluso de formato, falla cerrada;
  no normaliza por aproximación ni ejecuta reparaciones.
- Versiones de migración completas y sin versiones futuras.
- Claves foráneas activadas y ausencia de referencias huérfanas.
- Al menos un propietario activo sin renovación pendiente, con hash scrypt de
  formato válido. No prueba que el titular recuerde el PIN; el login real sigue
  siendo una comprobación independiente.

Estas comprobaciones solo leen. No instalan un esquema ni crean usuarios. La base
Turso de compatibilidad, con muestras inactivas y sin PIN, no es una instalación
operativa y no supera esta puerta. Los cambios de esquema requieren una operación
explícita fuera del arranque; no ejecutar migraciones concurrentes con el servicio.

El contrato del esquema se extrae en `schema-contract.js` y es compartido por el
ensayo y la comprobación de arranque. No hay una segunda definición DDL manual.
Los fallos de arranque cierran el adaptador sin filtrar diagnósticos del SDK. El
cierre del servidor espera el cierre asíncrono y retira sus manejadores de señales.

## Validación

`npm run check`: lint, **625 pruebas en 39 archivos**, TypeScript y compilación
correctos. Los 25 casos nuevos cubren configuración, diferencias de esquema,
versiones, claves foráneas, propietario/PIN, ausencia de fallback, login HTTP,
arranque y cierre. Usan SQLite temporal como doble asíncrono del SDK: **no son una
nueva ejecución remota ni validación de Render**.

La batería funcional completa de 40 recorridos de navegador y los cinco
recorridos de archivos compilados también pasan, ejecutados secuencialmente
con Chrome instalado y almacenamiento temporal independiente por archivo.

El [bloque 35](recovery-cloudinary-probe.md), publicado como
`15a225ce91e92f56b5dcc531dbec2679f8607a84`, tiene
[CI correcta](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35458105893).
Su evidencia Cloudinary permanece independiente de este cambio de arranque.

## Puertas siguientes

Preparar bootstrap remoto atómico sobre una base nueva, nombre del propietario
y PIN introducido personalmente, nunca en Git/chat. Después, validar Turso y
Cloudinary conjuntamente, login, copias y exposición antes del despliegue. No se
han modificado el blueprint antiguo, main, servicios Render ni credenciales
operativas. La configuración por defecto sigue siendo local.
