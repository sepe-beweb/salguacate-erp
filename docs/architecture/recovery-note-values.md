# Lectura de notas y fijado sin sobrescritura

Vigésimo sexto bloque. El muro valida identificadores, contenido, autoría, fecha y estado fijado antes de ofrecer acciones. Acepta únicamente booleanos o los enteros SQLite 0/1 como estado; una cadena «false» no se considera fijada. Las filas inválidas bloquean la lista, sin representar un muro vacío ni notas parciales, y el reintento solo vuelve a leer.

La consulta incorpora `autor` mediante LEFT JOIN con usuarios y no omite notas antiguas sin usuario. El nombre es el actual del registro de usuario, no una firma histórica inmutable. Cuando falta, se indica explícitamente; no se atribuye la nota a quien la consulta. Las fechas SQLite CURRENT_TIMESTAMP se interpretan como UTC y se muestran en la zona del navegador con año y atributo time/datetime. El orden es fijadas primero, instante descendente e ID descendente como desempate.

La API admite colores de texto arbitrarios y las bases antiguas pueden tener nulos. Se conserva ese valor: un color no presente en la paleta se muestra con estilo neutro y etiqueta del valor registrado, no se convierte en amarillo ni se modifica para mostrarlo.

Nuevo `PATCH /api/notas/:id/fijada`: exige sesión, rol de gestión, ID positivo válido y estado booleano/0/1. Actualiza únicamente `fijada`, con 404 si no existe. El frontend ya no envía una copia antigua de contenido y color al fijar: una edición concurrente de esos campos se conserva. El PUT completo previo sigue disponible por compatibilidad; no se añade control de versión a ese PUT ni a cambios de fijado entre varios clientes. El último estado fijado escrito sigue prevaleciendo.

Fijado y borrado tienen bloqueo síncrono y releen también tras un fallo, sin repetir la escritura automáticamente. La creación idempotente, sus recibos y los intentos por sesión no cambian; tampoco se modifica el consentimiento de dictado ni se accede al micrófono.

Las pruebas verifican autoría ausente, tipos incorrectos, colores históricos, orden, UTC, permisos y rechazo de estados/IDs incorrectos. El navegador ejecuta el muro en Los Ángeles y Kiritimati, recupera una respuesta dañada y comprueba el mismo instante UTC. Un segundo cliente edita contenido y color antes de fijar desde una pantalla desactualizada: la nota conserva la edición nueva, fecha y autor. Solo se usan API y bases desechables; no hay migración ni despliegue.

Validación local: `npm run check` supera 473 pruebas, lint, TypeScript y build; pasan 37 recorridos E2E de desarrollo y 5 de producción local. Arranque: 230269 bytes de JavaScript, 74021 comprimidos, dentro del presupuesto vigente.

Siguiente bloque: validación de presencia y cifras de inventario en el panel, manteniendo independientes la navegación y el resto de lecturas financieras ya recuperadas.

Publicado como `80c73def741e7583c946bb386778aad8dbd89105`; [CI correcta](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35443178296). Sin merge ni despliegue.
