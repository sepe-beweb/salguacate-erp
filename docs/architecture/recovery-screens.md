# Recuperación: pantallas de gestión

Fecha: 2026-09-19. Tercer bloque local sobre `4d8afb3`.

## Entrega publicada

El segundo bloque se publicó como `4d8afb34063593ecab996eee3581b3003de2b544` en `origin/refactor/recovery-foundation`. La [validación remota](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35417186263) finalizó correctamente. Se verificaron los 23 archivos del commit y la coincidencia de HEAD con la rama remota. No se modificó main ni se desplegó.

Los cambios descritos a continuación permanecen locales: no forman parte de ese commit ni de su CI. El informe del segundo bloque conserva su estado histórico anterior a la publicación.

## Cambios y límites

- Inventario, proveedores, pedidos, cierres, agenda, resumen, analíticas e informes distinguen carga, error y datos vacíos. `useApiLists` realiza solo GET y permite repetir explícitamente la carga. Un conjunto de listas relacionado se publica solo cuando todas han cargado; no equivale a una instantánea transaccional del servidor.
- Las cargas se cancelan al cambiar de filtro o desmontar la pantalla. Una secuencia identifica cada carga para ignorar respuestas tardías incluso si el transporte no respeta la cancelación. Tampoco se ejecutan recargas de un filtro antiguo conservadas por una escritura pendiente.
- Productos, proveedores, eventos y cierres comprueban HTTP/JSON antes de cerrar o limpiar formularios. Los errores aparecen junto al editor y conservan los datos. Los controles de guardado se bloquean mientras hay una petición pendiente. Los avisos de conexión indican que debe consultarse el estado antes de repetir una escritura: no existe todavía idempotencia general para altas.
- Los ajustes de stock no se presentan como realizados antes de confirmarlos la API. Después se vuelve a consultar el inventario y sus alertas. Un fallo de lectura posterior no se convierte en stock cero.
- La recepción usa un diálogo nativo con tres acciones explícitas: cancelar, recibir y sumar stock, o recibir sin modificar stock. Cancelar o pulsar Escape no envía escrituras. La cancelación se bloquea mientras se está enviando la recepción; se conserva la protección transaccional del servidor contra segundas recepciones.
- Abrir WhatsApp y copiar texto no registran pedidos ni acreditan su envío. El registro en historial es una acción independiente, bloqueada tras confirmar el alta de ese grupo en el editor actual. El portapapeles solo indica éxito cuando finaliza la escritura. No se ha contactado con proveedores durante las pruebas.
- Los importes opcionales vacíos del cierre se envían como cero; el efectivo y la tarjeta siguen siendo obligatorios. Un cierre duplicado conserva fecha, local e importes. No se modificaron reglas económicas ni endpoints.
- Las fechas por defecto de agenda, pedidos y caja usan fecha civil local. El mes anterior del resumen se calcula desde el día uno para evitar el desbordamiento del día 31. Los años disponibles en informes se obtienen del año actual y los datos cargados, no de una lista que caduca en 2026.
- Los paneles llaman al cálculo existente «Saldo ingresos − gastos», no «Beneficio neto». Las etiquetas estáticas de locales ya no afirman que estén abiertos o pendientes de inaugurar. No hay conexión que acredite su estado comercial en tiempo real.
- Se añadieron etiquetas asociadas a controles y límites de altura desplazables en editores. La revisión móvil de este bloque se concentra en recepción; no acredita accesibilidad integral del producto.

## Validación local

- `npm run check`: lint, 73 pruebas (45 API y 28 componentes/helpers) y compilación TypeScript/Vite correctas.
- Playwright con Chrome: 13 recorridos correctos contra API real y SQLite en memoria. Los tres nuevos recorren catálogo/proveedores/stock/pedidos, cierre duplicado y paneles financieros, y creación/edición/eliminación cancelada de eventos. Se adaptaron las dos comprobaciones anteriores afectadas por la nueva recepción y la denominación del saldo.
- En recepción se verificaron ambas opciones de stock, la cancelación con botón y Escape, el foco inicial en Cancelar y el estado final leído desde la API. Se inspeccionó una captura a 390 × 844 y se comprobó que no hay desbordamiento horizontal. La captura se genera en el directorio ignorado `test-results`.
- Las 21 pruebas nuevas de componentes/helpers provocan errores HTTP, conservan borradores, comprueban bloqueo de ajustes, cancelación de recepción, ausencia de registro automático al abrir WhatsApp, fallo de portapapeles, respuestas fuera de orden y fechas civiles. Estas pruebas usan respuestas simuladas; no son E2E. El diálogo de jsdom se simula solo en esas pruebas, mientras que los recorridos de navegador utilizan el diálogo real.
- Sin cambios de dependencias, esquema, base persistente o configuración remota. Persisten el aviso de SQLite experimental y el bundle principal de unos 800 kB antes de gzip; no se silencian.

## Siguiente bloque

Preparar backup/restauración y ensayos de migración con datos desechables, verificando integridad y recuperación. Antes de ensayar con datos reales debe identificarse una copia autorizada y su origen, sin escribir en la base original. También quedan pendientes las demás pantallas, accesibilidad integral, generación IA activada, política multilocal, Android y fiscalidad.
