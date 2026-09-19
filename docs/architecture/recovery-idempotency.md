# Altas recuperables de notas y gastos

## Estado y alcance

Séptimo bloque publicado como `45040cf` sobre `refactor/recovery-foundation`, con [CI correcto](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35421203289). Este documento no acredita migración de datos reales ni despliegue. La retención de intentos entre rutas se amplía en el [octavo bloque local](recovery-session-attempts.md).

La protección cubre `POST /api/notas` y `POST /api/gastos` cuando reciben `Idempotency-Key`. Las pantallas de notas y escáner envían esa cabecera. No se cambia automáticamente el comportamiento de otros endpoints ni se reenvía ninguna escritura en segundo plano.

## Contrato de API

- Clave UUID v4, generada por el cliente por intento lógico. Las mayúsculas se normalizan; una cabecera presente pero inválida devuelve 400 con `IDEMPOTENCY_KEY_INVALID`.
- La clave se delimita por usuario autenticado y operación (`note.create` / `expense.create`). No es una credencial ni permite recuperar resultados de otro usuario.
- Autenticación, rol y validación se ejecutan antes de consultar el recibo. Una sesión revocada o un rol no autorizado no pueden recuperar el resultado.
- Primer intento válido: escritura de negocio, auditoría y recibo se confirman en una misma transacción SQLite. Si falla cualquiera, se revierte todo y la clave no queda consumida.
- Mismo usuario, operación, clave y datos efectivos: devuelve el mismo estado y cuerpo de la primera respuesta, con el mismo ID. Notas conserva HTTP 200; gastos conserva HTTP 201. No crea otra entidad ni otra auditoría.
- Misma clave con otros datos válidos: HTTP 409 y código raíz `IDEMPOTENCY_CONFLICT`. Nunca sobrescribe el resultado anterior.
- Una validación fallida no reserva la clave. Clientes antiguos sin cabecera conservan el contrato anterior, **sin deduplicación**. Dos claves distintas son dos altas intencionales, aunque el contenido coincida.

La huella SHA-256 se calcula sobre los campos efectivos ordenados explícitamente: contenido/color en notas; fecha/local/proveedor recortado/concepto/importe en céntimos en gastos. No depende del orden de propiedades JSON ni de diferencias equivalentes como `12.50` frente a `12.5`. La autoría procede de la sesión; los campos no utilizados no cambian la huella.

El recibo confirma que una creación ocurrió, no el estado actual del registro. Si una nota fue borrada después, repetir su clave devuelve el recibo original pero no la recrea.

## Interfaz

`useIdempotentCreate` conserva una clave y una copia exacta del cuerpo enviado mientras el intento queda sin confirmar. Impide llamadas simultáneas y rechaza localmente que ese intento se cambie por otro contenido.

Tras un fallo de red, un 5xx, un conflicto o una confirmación incompleta, el borrador sigue visible y sus campos quedan bloqueados. El botón **Confirmar guardado pendiente** reenvía el mismo intento solo cuando se pulsa. Un identificador positivo válido confirma el éxito y libera el borrador; un 400 con error JSON de validación permite corregirlo.

Notas conserva el intento al cerrar y reabrir su diálogo. El escáner conserva imagen y formulario, impide cambiar de modo y exige confirmación antes de descartarlos. Abandonar explícitamente el intento advierte que el servidor pudo haberlo guardado y que hay que conciliar antes de crear otro.

En el séptimo bloque las claves y los borradores vivían en memoria de la pantalla: salir de ruta perdía el intento. El [octavo bloque](recovery-session-attempts.md) sustituye esa limitación por un almacén en memoria de la sesión; recargar o terminar la sesión sigue perdiendo el identificador en la interfaz. No se añade almacenamiento de tokens, notas, imágenes o gastos en disco. La API sí conserva los recibos entre sesiones y reinicios para cualquier cliente que conserve la misma clave.

La garantía requiere desplegar conjuntamente la API con este contrato y el cliente que lo utiliza. Una API antigua que ignore la cabecera no ofrece esta protección.

## Esquema y recuperación

Migración 2: tabla `idempotency_requests`, clave primaria compuesta por actor, operación y UUID; almacena huella, respuesta mínima, estado HTTP y fecha. No duplica textos de notas, proveedores, importes ni imágenes en el recibo. Añade auditoría `note.created`; `expense.created` continúa dentro de su transacción.

Los recibos no caducan ni se purgan automáticamente: eliminarlos permitiría recrear entidades al repetir claves antiguas. Su retención y crecimiento requieren una política explícita antes de producción; no se introduce una ventana de deduplicación silenciosa.

La inicialización completa sigue siendo transaccional. Se prueba el paso desde versión 1 y la reversión de una migración 2 fallida, sin borrar tablas inesperadas ni alterar registros históricos para hacerla pasar. Las versiones futuras se rechazan.

Backup/restauración incluye los recibos dentro de las huellas verificadas. La prueba restaura un recibo, revoca las sesiones copiadas, inicia una sesión nueva y confirma el mismo intento sin duplicar la nota. Volver al código anterior exige una copia compatible: la versión anterior rechaza el esquema 2.

## Evidencia y límites

Pruebas de API: reenvío, peticiones duplicadas concurrentes, claves distintas, aislamiento por usuario/operación, autorización actual, claves inválidas, normalización, rollback al fallar el recibo, borrado posterior, compatibilidad sin cabecera, preflight CORS, reapertura y migración.

Pruebas de componentes: payload inmutable, respuestas perdidas/malformadas, confirmación explícita, rechazo de validación, doble pulsación y cancelación de descarte.

Las pruebas de navegador hacen llegar el POST a la API real desechable y descartan únicamente la primera respuesta después del guardado. Comprueban la fila mediante GET antes y después de confirmar; ambas peticiones llevan exactamente la misma clave y cuerpo. En gastos, solo la extracción visual se simula con una imagen sintética: no se utiliza Gemini ni se acredita su integración.

Validación local final: `npm run check` correcto, con lint, 152 pruebas (84 API y 68 componentes/helpers), TypeScript y build. Pasan 17 recorridos funcionales y 4 sobre archivos compilados; el presupuesto de JavaScript inicial continúa dentro del límite. Se generan capturas de los dos borradores pendientes a 390 px. Sin nuevas dependencias, datos reales, servicios de IA ni despliegue; persiste el aviso conocido de SQLite experimental.

No es deduplicación por similitud de facturas ni detección de dos personas registrando el mismo documento. No cubre claves perdidas, claves nuevas, bases independientes o restauraciones anteriores al primer intento. No se ha ensayado corte eléctrico, volumen masivo ni escalado distribuido. Los errores de almacenamiento mantienen el rollback actual y no disparan reintentos automáticos.

El modelo usa transacciones síncronas `BEGIN IMMEDIATE` de una misma base, coherente con el [control de transacciones de SQLite](https://www.sqlite.org/lang_transaction.html); no promete garantías de un sistema distribuido.

Continuación implementada localmente: [recuperación de intentos durante la sesión](recovery-session-attempts.md), sin guardar datos sensibles en disco.
