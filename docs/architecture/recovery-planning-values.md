# Fechas y lecturas de agenda y tareas

## Alcance

Duodécimo bloque de recuperación. Se validan las listas de eventos, tareas y personas antes de publicarlas. El panel usa las mismas lecturas que sus pantallas; un fallo o registro inválido bloquea la vista afectada, sin contadores parciales ni mensajes de lista vacía ficticios. No se modifica la API, el esquema, las asignaciones ni los permisos.

Las fechas de eventos y tareas se presentan como `DD/MM/YYYY`, sin convertirlas a instantes UTC. Las tareas vencen por comparación civil con el día local del navegador. La fecha inicial se obtiene al crear el estado del formulario, no al importar el módulo. Los borradores existentes no cambian su fecha automáticamente.

Los eventos se ordenan por fecha, hora e ID; las tareas conservan orden descendente de fecha, pendientes primero en cada día e ID para desempatar. Los estados persistidos 0/1 se normalizan a booleanos tras validación; cadenas como `"0"` se rechazan. Se admiten los tipos históricos de evento como texto, sin restringirlos a las opciones actuales del formulario.

La marca de evento pasado compara fecha y hora de pared con el reloj del navegador. No se inventa una zona de negocio ni un offset para horarios que no lo tienen almacenado. No se recalculan automáticamente las vistas por el paso del reloj ni se cambian los instantes de fichaje.

Tareas utiliza el cargador común que cancela e ignora lecturas obsoletas. Los controles de alta esperan a tareas/personas válidas, el formulario y cierre del editor quedan bloqueados durante el POST, y el borrador rechazado se conserva. Completar y eliminar bloquean otras escrituras mientras se confirma su lectura posterior. La eliminación requiere confirmación y cancelarla no envía DELETE. Un error no dispara un reintento de escritura; el reintento de carga sigue siendo solo GET.

## Validación

`npm run check`: lint, 252 pruebas, TypeScript y compilación correctos. Se ajustó la prueba histórica de apertura del editor para esperar a la carga válida antes de pulsar Nueva.

23 pruebas funcionales de navegador y 5 sobre compilación correctas. El nuevo recorrido realiza alta, cancelación de eliminación, completar, reabrir y eliminar una tarea sintética, y alta/edición/eliminación de un evento sintético. Comprueba fechas próximas a medianoche en `America/Los_Angeles` y `Pacific/Kiritimati`, con presentación móvil de 390 px. Solo API y SQLite desechable; sin datos reales ni generación de carteles externos.

JavaScript inicial: 224.173 bytes, 71.928 bytes comprimidos, dentro del presupuesto. CI y publicación se concilian después del commit; estas pruebas locales no acreditan despliegue.

## Continuación

Aplicar la misma validación de tareas y fechas al panel del empleado y su calendario de turnos. Mantener horas de turno como horas civiles, sin inferir duración, cruce de medianoche ni horas trabajadas.
