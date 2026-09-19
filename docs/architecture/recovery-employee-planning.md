# Calendario y panel del empleado

Decimotercer bloque de recuperación. La lectura del calendario valida identificadores de turno/persona, fecha civil, horas y textos antes de presentar datos. El panel comparte esa lectura y el validador de tareas; un fallo no se convierte en día libre ni checklist vacío.

Publicado como `c279f66`, con [CI correcto](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35437801679).

El calendario muestra fecha completa `DD/MM/YYYY` y conserva todas las filas ordenadas por fecha, hora de inicio e ID. El panel muestra todos los turnos del día local, no solo el primer registro. Los locales históricos vacíos se muestran como «Local no indicado», sin inventar una asignación.

Se conservan las horas registradas aunque la hora final sea anterior o igual a la inicial. No se calculan duraciones, horas trabajadas, zona de negocio ni fecha final de un turno nocturno. El filtro de día del panel continúa refiriéndose a la fecha de inicio registrada, no a presencia activa. Las reglas de autorización de la API y las asignaciones no cambian.

Validación local: `npm run check` correcto, 266 pruebas, lint, TypeScript y compilación. 24 pruebas funcionales de navegador y 5 sobre compilación correctas. El ensayo nuevo crea turnos sintéticos para dos personas, comprueba que el empleado solo recibe sus turnos, muestra dos turnos del mismo día y otro del mes siguiente, y completa una tarea asignada. Comprueba `America/Los_Angeles` y `Pacific/Kiritimati` a 390 px. Se corrigió el selector móvil de la prueba para usar el nombre real «Turnos»; la limpieza del ensayo ya no oculta un fallo original.

JavaScript inicial: 224.223 bytes, 71.945 comprimidos. Sin API nueva, migración, datos reales ni despliegue. El CI de este bloque se concilia después del commit.

Siguiente bloque: modales de agenda y tareas con foco nativo, Escape seguro y conservación de borradores al cerrar y reabrir, sin desbloquear escrituras pendientes.

Continuación documentada en [modales de planificación](recovery-planning-dialogs.md).
