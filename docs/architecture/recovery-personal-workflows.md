# Recuperación de notas, escáner y área de empleado

## Alcance

Quinto bloque local sobre `refactor/recovery-foundation`. El cuarto bloque se publicó como `060487c` y pasó [CI](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35418755531). Este documento no acredita la publicación del quinto, un despliegue ni aceptación con datos reales.

## Lecturas y fichajes

`useApiRead` conserva la cancelación y el descarte de respuestas antiguas del cargador de listas. `useApiLists` sigue usando esa misma base para exigir que todas las listas relacionadas carguen correctamente. Los errores no se convierten en listas vacías.

- El panel del empleado no muestra un día libre ni un checklist vacío si falla la carga de turnos o tareas. Una lista vacía válida se describe como ausencia de registros, no como autorización para librar.
- El calendario muestra error y reintento de lectura; sus fechas civiles se presentan sin conversión desde medianoche UTC.
- Las tareas dejan de marcarse de forma optimista: el cambio se comprueba y se vuelve a consultar su estado.
- El reloj distingue estado desconocido de ausencia de fichaje. Solo `null`, `trabajando` y `descanso` habilitan las acciones correspondientes. Tras cada escritura se consulta el estado del servidor, tanto si tuvo éxito como si se perdió la respuesta. Nunca se repite automáticamente el POST. Si la consulta falla, los botones permanecen bloqueados hasta una lectura válida.

## Notas

Crear, fijar y eliminar comprueban HTTP/JSON y muestran los fallos. Un guardado fallido conserva contenido y color; el reintento disponible consulta notas y no vuelve a escribir. Eliminar requiere confirmación.

El formulario usa diálogo nativo, nombre accesible, foco explícito después de abrir, cierre con Escape y retorno al botón de apertura. El borrador se conserva al cerrar y reabrir dentro de la pantalla. Los selectores de color y fijado exponen su estado.

El dictado requiere una aceptación separada porque el navegador puede enviar audio a su proveedor. Solo se instancia al pulsar el botón. Añade resultados finales una sola vez, conserva el texto escrito, bloquea edición/guardado durante la escucha y aborta al cerrar o desmontar. Los callbacks tardíos no alteran otra nota. No se ha utilizado un micrófono real para validar este bloque.

## Escáner

- Captura mediante botón accesible por teclado y selector nativo. Admite JPEG, PNG y WebP de hasta 10 MB; después de decodificar rechaza dimensiones inválidas o superiores a 40 megapíxeles. No es una garantía contra todo archivo malicioso ni una validación del rendimiento en móviles.
- El PDF sigue siendo local. La interfaz explica que la galería vive en memoria y debe descargarse antes de salir o recargar.
- El análisis externo requiere una aceptación explícita por imagen/modo. No se habilita Gemini en el servidor. El PDF no depende de ese permiso ni del servicio de IA.
- Se validan los campos de la respuesta antes de renderizarlos: texto, importe no negativo, conteo entero y confianza de 0 a 100. El importe cero no se pierde.
- La factura se revisa en un formulario etiquetado antes de registrar el gasto. Un fallo conserva imagen y todos los campos; un éxito confirmado limpia el borrador. No hay alertas de éxito sin confirmación ni reintentos automáticos de escrituras.
- Durante una operación se bloquean cambios de imagen/modo y envíos repetidos. Cambiar de modo o descartar la imagen descarta explícitamente el resultado anterior; las respuestas tardías tras abandonar la pantalla no publican resultados.
- El análisis de stock es una estimación informativa y no modifica inventario.

## Evidencia y límites

Las pruebas de componentes usan transporte, voz y decodificación simulados para cubrir errores, borradores, consentimiento, respuestas inválidas y operaciones pendientes. No acreditan integración con Gemini ni compatibilidad del dictado en dispositivos reales.

Los recorridos de navegador usan Chrome, API Express real y SQLite en memoria: alta/fijado/borrado confirmado de notas, cancelación, foco y Escape, vista móvil, entrada/descanso/vuelta/salida, selección de imagen por teclado, rechazo real de IA desactivada y generación de un PDF local. Se revisan capturas de notas y escáner a 390 px. No se envían imágenes ni audio a proveedores externos.

Validación local final: `npm run check` correcto, con lint, 117 pruebas (64 API y 53 componentes/helpers), TypeScript y compilación Vite. Los 15 recorridos completos de Playwright pasan en Chrome contra la API de prueba; `git diff --check` no detecta errores. Persisten los avisos conocidos de SQLite experimental y bundle principal grande (799,41 kB minificado, 209,68 kB gzip); no se ocultan ni elevan los umbrales para silenciarlos.

Pendiente: dictado y cámara en dispositivos físicos, límites prácticos de imágenes grandes, integración de IA expresamente habilitada, borradores persistentes, idempotencia de gastos/notas frente a respuestas perdidas, migración real y despliegue. Ante respuesta perdida hay que conciliar antes de repetir la escritura.

Siguiente bloque propuesto: carga por rutas y gestión de errores de carga de módulos para reducir el bundle inicial, conservando navegación, permisos y recorridos actuales.
