# Compatibilidad real de Turso/libSQL

## Destino y alcance

Ensayo ejecutado el 19 de septiembre de 2026 contra la base desechable
`salguacate-probe-20260919`, organización personal `sepe`, región AWS EU West
(Ireland), motor SQLite/libSQL. La consola muestra `Starter (Free)`, sin métodos
de pago. No se han activado ampliaciones, planes de pago ni acceso sin token.

El token de lectura/escritura, autorizado expresamente para esa base, se creó con
caducidad de un día. Su valor no se incorpora a documentación, código, comandos
de shell, argumentos, archivos de credenciales ni Git. La entrega al proceso del
ensayo se hizo mediante un receptor temporal en loopback, de un único uso, con
host/origen exactos y ruta aleatoria. El proceso terminó después del ensayo.

La URL regional de Turso incorpora `.aws-eu-west-1.turso.io`. Se amplió el validador
para ese formato, conservando HTTPS, coincidencia exacta del host confirmado y
rechazo de otros dominios, subdominios arbitrarios y parámetros en la URL.

## Resultado observado

| Comprobación | Resultado | Tiempo |
| --- | --- | --- |
| Esquema nuevo completo y claves foráneas | Correcto | 1078 ms |
| Fixtures sintéticos inactivos, sin PIN | Correcto | 245 ms |
| Rollback de negocio, auditoría y recibo | Correcto | 494 ms |
| Rechazo de referencias huérfanas | Correcto | 207 ms |
| Ocho duplicados concurrentes, una instancia | Una sola alta/recibo/auditoría | 1540 ms |
| Recuperación tras descartar respuesta | Mismo identificador, sin nueva alta | 430 ms |
| Lote de 500 incrementos de stock | Correcto, stock final 510 | 350 ms |

Son mediciones de una ejecución desde el equipo de desarrollo hacia Irlanda,
no un benchmark desde Render ni una garantía de percentiles, disponibilidad o
tiempos futuros. Los tiempos de cada fila incluyen su comprobación; el de los
ocho duplicados es el conjunto, no una única transacción de 1540 ms.

Se conserva la base con sus datos sintéticos para inspección. No se ha borrado
ninguna instalación ni datos anteriores. No usar esta base como instalación
operativa ni volver a ejecutar el bootstrap del ensayo sobre ella.

## Qué permite avanzar

La puerta de compatibilidad de esquema y transacciones remotas queda superada.
Se puede adaptar el acceso del ERP al contrato asíncrono, con manejadores de
transacción explícitos y consultas/lotes acotados.

Esto **no** acredita las rutas de la aplicación sobre Turso, autorización bajo
concurrencia remota, múltiples servidores, un corte real durante COMMIT,
Cloudinary, bootstrap de un propietario real, backups remotos ni despliegue.
Las pruebas de pérdida de confirmación de commit siguen siendo inyectadas
localmente. La API activa aún usa SQLite local y `render.yaml` no es el blueprint
gratuito definitivo.
