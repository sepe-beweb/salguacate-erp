# Modales y borradores de planificación

Decimocuarto bloque. Agenda y tareas usan un diálogo nativo compartido, con nombre accesible, foco inicial en el título, fondo inerte y restauración del foco al cerrar. Escape cierra sin borrar el borrador y se bloquea durante el guardado. No se introduce una trampa de teclado propia: Chrome puede permitir foco en su barra, pero no en controles de la aplicación detrás del diálogo.

Tareas conserva los campos al cerrar/reabrir. Al abrir un formulario sin cambios se toma la fecha local actual, incluso si la pantalla se montó el día anterior. Descartar un borrador requiere confirmación. Una respuesta incierta recuerda consultar la lista antes de repetir el alta; no se introduce idempotencia ni reintento automático.

Agenda permite retomar el borrador de alta o edición conservando su destino. Cambiar a otro evento o pasar de una edición pendiente a un alta requiere confirmar el descarte. Escape y el botón de cierre no lo descartan. Tras éxito se limpia el borrador. No se guarda en almacenamiento persistente ni se conserva al navegar fuera de la ruta o cerrar sesión.

El generador de carteles conserva su comportamiento anterior y queda fuera de esta migración. No se contactó con servicios de IA ni se activaron micrófonos.

Validación local: `npm run check` correcto con 270 pruebas, lint, TypeScript y compilación. El ensayo de navegador comprueba foco inicial, fondo inerte, retorno al botón de apertura, Escape, reapertura y descarte cancelado. Retiene temporalmente el transporte de un POST para comprobar bloqueo durante el guardado; la API real rechaza el título sobredimensionado sin crear datos. Los métodos de diálogo simulados en jsdom solo acreditan lógica de componentes; el comportamiento nativo se comprueba en Chrome.

La batería completa pasó: 25 pruebas funcionales de navegador y 5 sobre archivos compilados. Se revisaron capturas móviles de ambos editores. Presupuesto inicial: 224.263 bytes de JavaScript, 71.964 comprimidos. No es un despliegue ni una prueba con datos reales.

Publicado en `0099ade63d5689992ead84a7116f67823164d1df`; [CI correcto](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35438178427).

Continuación: [peticiones de personal y gestión de RRHH](recovery-personnel-requests.md).
