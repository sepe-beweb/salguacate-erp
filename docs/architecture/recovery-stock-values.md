# Lectura de stock e historial de pedidos

Vigésimo segundo bloque. Control de Stock valida conjuntamente inventario e historial antes de mostrar selección o recepción. Comprueba identificadores positivos únicos, existencias y mínimos enteros seguros no negativos, locales conocidos y campos de proveedor. Conserva categoría nula como «Sin categoría», sin atribuirle Bebida. Las existencias acumuladas pueden superar un millón: no se confunden con el límite de cantidad por escritura.

Los pedidos requieren fecha civil válida, estado conocido y JSON de líneas no vacío, de hasta 500 líneas. Cada línea exige identificador, nombre y cantidad entera positiva de hasta un millón, conforme a la recepción actual. JSON dañado, estados desconocidos o filas duplicadas generan error explícito y reintento solo de lectura; no se sustituyen por pedidos vacíos, recibidos o listas parciales. No se modifica ningún registro histórico para hacerlo pasar.

El historial conserva todas las líneas, incluso identificadores de producto repetidos que permite la API. No exige que el producto o proveedor histórico aparezca en el inventario del local actualmente seleccionado. Mantiene la consulta de todos los locales y ahora la etiqueta expresamente. Ordena por fecha descendente y, en empates, ID descendente. La fecha se formatea como día civil, sin convertirla a un instante UTC.

Las pruebas cubren filas y líneas malformadas, cantidades inseguras, duplicados, fechas imposibles, orden estable, categoría ausente y recuperación GET. El navegador crea pedidos mediante la API local, los consulta desde móvil en Los Ángeles y Kiritimati y los recibe sin cambiar stock: comprueba fecha, líneas persistidas y existencias. No se contacta con proveedores, WhatsApp ni datos reales. Esto no acredita despliegue ni saneamiento de bases antiguas.

Validación local: `npm run check` supera 395 pruebas, lint, TypeScript y build. Pasan 33 recorridos E2E de desarrollo y 5 sobre la compilación de producción. El arranque ocupa 230175 bytes de JavaScript y 73968 comprimidos, dentro del presupuesto vigente.

La validación se aplica a Control de Stock. La pantalla Almacén conserva su lector anterior y queda pendiente de una recuperación específica. Siguiente bloque: agrupar pedidos por identidad del proveedor y proteger su diálogo, cantidades y borrador frente a cambios de local.
