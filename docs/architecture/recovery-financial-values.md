# Fechas civiles e importes en vistas financieras

## Estado y alcance

Décimo bloque local en `refactor/recovery-foundation`. El noveno se publicó como `b73eeef`, con [CI correcto](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35422723783). Este documento no acredita publicación del décimo ni despliegue.

Se unifican lectura, agregación y presentación de informes mensuales y analíticas. La pantalla de gastos reutiliza los mismos validadores y formateadores. No se cambia la API, el esquema, los recibos de idempotencia ni ningún registro persistido.

## Valores comunes

`financialValues.ts` valida fechas civiles `YYYY-MM-DD` con calendario gregoriano y reglas de bisiestos. Presenta `DD/MM/YYYY` y ordena/filtra por el valor civil, sin convertir las fechas de negocio en instantes ni aplicar la zona horaria del navegador. La fecha y hora de generación de un informe sí siguen siendo el instante local de generación.

Los importes recibidos deben ser números representables en céntimos exactos. Se rechazan cadenas, valores no finitos, fracciones inferiores al céntimo y números fuera del rango seguro. No se redondean datos inválidos para hacerlos pasar por correctos.

Las sumas y diferencias se realizan en céntimos enteros con comprobación de desbordamiento. El formato español mantiene dos decimales, signo y símbolo de euro; divide la parte entera y los céntimos para no perder el último céntimo al formatear valores próximos al límite seguro. No modifica la representación monetaria almacenada en SQLite.

## Lectura y agregación

`readFinancialLists` publica cierres y gastos juntos, solo cuando ambas lecturas y sus validaciones han terminado. Comprueba identificadores, fechas, importes, duplicidad de IDs y límites de agregación. Una lectura fallida o inválida no produce totales parciales, cero ficticio ni un botón de exportación utilizable.

`financialSummary` y `financialDays` usan el total **registrado** de cada cierre como ingresos. Invitaciones y descuadres no se añaden ni se descuentan de ese total. Si un total registrado difiere de efectivo más tarjeta, se conserva y se muestra un aviso tanto en pantalla como en el documento imprimible; no se corrige el histórico silenciosamente. Las vistas no constituyen una auditoría contable ni fiscal.

Las gráficas agrupan por fecha civil completa: los dos locales suman en el mismo día y cada gasto se cuenta una sola vez. También aparecen días con gastos pero sin cierre, con saldo negativo cuando corresponde. Las etiquetas incluyen el año para distinguir días equivalentes de años distintos. La agregación diaria recorre los registros y no vuelve a filtrar todos los gastos por cada cierre.

Las series y los valores de tooltip comparten la unidad de céntimos; los ejes y tooltips muestran euros con dos decimales. La serie antes llamada «Beneficio» se presenta como «Saldo ingresos − gastos», sin atribuirle un significado contable más amplio.

Las gráficas no animan la entrada de datos: al filtrar o redimensionar se muestran completas, sin un estado transitorio vacío. Se revisó su presentación móvil a 390 px de ancho.

## Periodos y exportación

Los informes siguen filtrados por mes/año y local. Analíticas mantiene su alcance anterior: todo el historial del local seleccionado, sin un nuevo filtro temporal. Las selecciones no cambian los arrays originales ni los datos persistidos.

Pantalla e informe imprimible utilizan las mismas sumas y formatos. Se mantiene el escape HTML de textos de usuario. La exportación sigue abriendo HTML para imprimir/guardar desde el navegador: no se introduce un generador PDF nuevo ni se acredita impresión física. Las proporciones de medios de pago conservan las reglas existentes; este bloque no redefine invitaciones ni cierres históricos inconsistentes.

Panel de control e historial/editor de cierres quedan fuera de esta iteración y aún usan sus funciones anteriores. El siguiente bloque propuesto es extender allí estos valores comunes sin alterar las reglas del cierre.

## Validación y límites

Pruebas de helpers/componentes: bisiestos, fechas no civiles, años distintos, céntimos, valores negativos/cero, límites seguros, errores de listas, agregación multilocal, gastos sin cierre, filtros, discrepancias de totales históricos y correspondencia entre pantalla y HTML imprimible, incluyendo escape de contenido.

El ensayo de navegador crea datos sintéticos en la API con SQLite desechable y consulta informes y gráficas en `America/Los_Angeles` y `Pacific/Kiritimati`. Verifica el 29 de febrero, filtros, céntimos en tarjetas y tooltip, y el HTML de impresión. El diálogo de impresión del sistema se sustituye solo en la prueba para poder inspeccionar el documento.

Validación local completada: `npm run check` correcto (lint, 207 pruebas, TypeScript y compilación); 22 pruebas de navegador funcionales y 5 contra la compilación de producción correctas. El ensayo financiero también pasó dos veces consecutivas reutilizando sus datos sintéticos. JavaScript inicial de la última compilación: 224.109 bytes, 71.904 bytes comprimidos, dentro del presupuesto vigente.

No se utilizan datos reales ni servicios de IA. No se prueba un volumen masivo, una migración de históricos ni una auditoría contable; los históricos inválidos se señalan para revisión, no se reparan automáticamente.
