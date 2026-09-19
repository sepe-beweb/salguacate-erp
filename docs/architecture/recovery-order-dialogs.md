# Borrador y diálogo de pedidos

Vigésimo tercer bloque. Los pedidos se agrupan por ID de proveedor mediante Map, no por nombre ni propiedades de un objeto. Dos proveedores homónimos se registran por separado; nombres como `__proto__` permanecen texto. Los productos sin proveedor usan un grupo propio, distinto de un proveedor que se llame «Sin proveedor». Cada grupo muestra su identificador para distinguir homónimos.

El borrador captura local, fecha civil, productos, proveedor y cantidades al generarlo. Cerrar o Escape lo conservan en esta pantalla; «Retomar pedido» recupera esa misma instantánea incluso si ha cambiado el filtro de local o el día. Sustituirlo o descartarlo exige confirmación y no elimina pedidos registrados. No se persiste entre rutas, recargas ni sesiones, y la interfaz indica ese límite.

Generación y recepción usan el diálogo nativo compartido: fondo inerte, foco inicial en cerrar/cancelar, restauración de foco y Escape bloqueado mientras se escribe. El registro tiene un bloqueo síncrono y los grupos confirmados conservan su bloqueo después del GET, aunque este falle. Reintentar carga solo hace GET. Las cantidades no pueden bajar de uno ni superar un millón; un mínimo antiguo que produzca reposición fuera de rango se rechaza, sin recortarlo silenciosamente. El límite de 500 líneas se aplica por pedido/proveedor.

Copiar y abrir WhatsApp siguen siendo acciones explícitas que no registran ni confirman envíos. Una copia tardía no marca como copiado un borrador cerrado, cambiado o sustituido. Las pruebas de portapapeles y enlaces son simuladas; no se contacta con proveedores.

La prueba de navegador crea tres proveedores y productos en la API desechable, incluidos dos homónimos y un nombre reservado de JavaScript. Comprueba móvil, foco, Escape, local conservado, cantidades, bloqueo durante un POST retenido y tres pedidos persistidos independientes. Retomar un borrador confirmado no habilita un segundo registro.

Este bloque no añade idempotencia a pedidos: una respuesta de escritura perdida sigue exigiendo revisar el historial antes de repetir. Tampoco revalida automáticamente el catálogo dentro del borrador; el servidor conserva sus controles de producto, proveedor y local. No hay migraciones, despliegue ni operaciones con datos reales.

Validación local: `npm run check` supera 412 pruebas, lint, TypeScript y build; pasan 34 recorridos E2E de desarrollo y 5 sobre producción local. JavaScript inicial: 230175 bytes, 73975 comprimidos, dentro del presupuesto.

Siguiente bloque: lectura del almacén y proveedores, coherencia de alertas y categorías sin atribuir valores ausentes.
