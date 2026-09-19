# Panel y cierres: valores financieros comunes

## Estado

Undécimo bloque publicado como `af5808b` en `refactor/recovery-foundation`, con [CI correcto](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35430540100). No se ha desplegado ni utilizado una base real.

## Panel

El panel reutiliza la lectura validada de cierres/gastos y sus sumas en céntimos. Las siete listas requeridas se publican juntas; si alguna falla, o los datos financieros o las fechas de eventos son inválidos, se muestra el error con reintento de lectura, sin métricas parciales.

Ingresos, gastos y saldo corresponden al mes civil actual del navegador y al conjunto de locales. La comparación usa el mes anterior, también al pasar de enero a diciembre. No se modifica la definición de saldo ni se añaden invitaciones o descuadres al total registrado.

El último cierre es el de mayor fecha civil de todo el historial, no solo del mes; si hay empate se usa el ID mayor como criterio determinista, sin atribuirle una hora de creación. Se muestran fecha y local y se distingue un historial vacío de un cierre de importe cero. Un total histórico que no coincide con efectivo más tarjeta conserva su valor y genera un aviso.

El próximo evento se presenta como fecha civil `DD/MM/YYYY`. Los instantes de fichaje continúan mostrando su hora local; no se convierten en fechas civiles.

## Nuevo cierre e historial

El historial comparte el validador de cierres con informes, analíticas y panel. Ordena por fecha/ID en una copia, mantiene el filtro de local y muestra total registrado, efectivo, tarjeta, invitaciones y descuadre en euros con dos decimales. Cada registro inconsistente lleva su aviso sin alterar el histórico. No se añaden edición ni borrado de cierres existentes.

El formulario de alta muestra una vista previa de efectivo más tarjeta en céntimos. No suma invitaciones ni descuadre. Replica el contrato vigente de la API: fecha civil, local configurado, hasta dos decimales y máximo absoluto de 1.000.000 € por campo; solo descuadre admite negativos. Efectivo y tarjeta siguen siendo obligatorios; invitaciones y descuadre vacíos siguen enviándose como cero.

El POST conserva los textos del formulario y no envía un total calculado por el cliente: la API sigue calculándolo. Los datos inválidos se rechazan también en el manejador, sin depender únicamente de la validación nativa del navegador. Durante el guardado se bloquean los campos; un rechazo conserva el borrador. Un fallo de lectura después del éxito permite reintentar GET sin volver a enviar el cierre.

No se introduce idempotencia nueva para cierres ni recuperación del borrador entre rutas o recargas. La unicidad por fecha/local y la advertencia de consultar el historial ante una respuesta incierta siguen vigentes. No cambia la API, el esquema SQLite ni los permisos.

## Validación

`npm run check` correcto: lint, 232 pruebas, TypeScript y compilación. Pruebas nuevas para cambio de año, céntimos, negativos, máximos, borradores inválidos, registros inconsistentes, orden independiente de la respuesta, errores de lectura y guardado, y ausencia de reenvío tras un fallo del GET posterior.

22 pruebas funcionales de navegador y 5 sobre archivos compilados correctas. El recorrido financiero utiliza API y SQLite desechable, fija el reloj civil en febrero y comprueba panel, formulario, historial, informe imprimible y analíticas en `America/Los_Angeles` y `Pacific/Kiritimati`. Verifica el rechazo de un duplicado real y conserva todos los campos. Las capturas móviles son evidencia local generada, no archivos entregables ni un ensayo de impresión física.

JavaScript inicial: 224.059 bytes, 71.884 bytes comprimidos; dentro del presupuesto vigente. Sin llamadas externas a IA, micrófono, WhatsApp, migración de datos reales, merge ni despliegue.

## Siguiente bloque propuesto

La continuación sobre fechas civiles y validación de agenda y tareas se documenta en [el duodécimo bloque](recovery-planning-values.md). Las horas de fichaje siguen tratándose como instantes.
