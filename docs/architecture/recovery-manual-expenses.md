# Gastos manuales y consulta de registros

## Estado y alcance

Noveno bloque publicado como `b73eeef` en `refactor/recovery-foundation`, con [CI correcto](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35422723783). Este documento no acredita despliegue.

La nueva ruta `/gastos` permite registrar gastos sin imagen, análisis externo ni consentimiento de IA. Está disponible para propietario y encargado en el menú y en los accesos del panel, también en móvil. La ruta sigue siendo diferida; un empleado no puede abrirla y las restricciones existentes de GET/POST en la API permanecen intactas.

## Alta y recuperación

Campos del contrato existente: fecha civil, local, proveedor, importe y concepto opcional. El formulario admite cero y hasta dos decimales, con máximo de 1.000.000 €, proveedor de hasta 160 caracteres y concepto de hasta 1.000. La API sigue siendo la autoridad para validar; no se cambian esquema, endpoints ni permisos.

`ExpenseFields` reúne los controles utilizados por alta manual y escáner. `expenses.ts` define el borrador común y las funciones de lectura/formato. La revisión del escáner conserva sus etiquetas y la exigencia previa de concepto; el alta manual admite el concepto vacío previsto por el servidor.

Ambas rutas comparten una sola entrada `/api/gastos` del almacén de la sesión. No hay dos claves pendientes ni dos colas independientes. Al abrir cualquiera con un intento pendiente, recupera el cuerpo exacto enviado y mantiene el bloqueo; no inicia otro gasto ni vuelve a analizar la imagen. El aviso global conduce a `/gastos`, donde se puede consultar el historial además de confirmar el intento.

El éxito consume el recibo una sola vez, muestra su identificador y limpia el formulario. En Gastos ajusta el mes de consulta al gasto confirmado, limpia los otros filtros y recarga la lista. Si esa lectura falla, conserva el mensaje de éxito y ofrece solo reintentar la lectura: no vuelve a enviar el alta.

Una fila que coincida por proveedor, fecha, concepto o importe no confirma por sí misma un intento. La confirmación siempre procede de la API y del recibo asociado a su clave. Descartar un intento incierto requiere confirmación y no elimina registros del servidor.

Los límites de [recuperación en sesión](recovery-session-attempts.md) no cambian: no hay borradores persistidos, traslado de fotos, cola offline ni recuperación después de recargar o terminar la sesión. Los borradores todavía no enviados se pierden al salir, como indica el formulario.

## Consulta para comprobación

- Lista de solo lectura con número de registro, proveedor, fecha, local, importe y concepto.
- Filtros combinables por mes, local y texto en proveedor/concepto/número; búsqueda por subcadena sin distinguir mayúsculas. «Ver todos los gastos» elimina los filtros.
- Mes actual por defecto; los filtros de consulta no modifican los datos del formulario de alta.
- Orden por fecha descendente y, a igualdad, identificador descendente.
- Total de la selección calculado sumando céntimos enteros, sin mostrar decimales de coma flotante residuales. Fechas civiles presentadas como `DD/MM/YYYY` sin conversión de zona horaria.
- Carga, error, ausencia real de gastos y ausencia de coincidencias son estados distintos. Una carga fallida no muestra cero registros ni un total parcial.
- La lectura comprueba tipos, fechas, identificadores únicos e importes representables; datos inválidos producen un error de lista y no métricas parciales.

No hay conciliación bancaria/fiscal, estado «conciliado», detección automática de facturas repetidas, edición ni borrado de gastos. La consulta ayuda a comprobar registros existentes, no a asumir que una coincidencia debe descartarse.

El endpoint actual devuelve el historial completo; el filtrado de esta pantalla es local, sin nuevas consultas al cambiar filtros. No se añade paginación ni se acredita rendimiento con historiales masivos. No se modifican los informes ni analíticas en este bloque.

## Validación

Pruebas de componentes: filtros y céntimos, errores de carga, rechazo de filas inválidas, conservación del formulario, confirmación seguida de fallo de lectura, recuperación en ambas direcciones entre alta manual y escáner, validación 400, cancelación de descarte y bloqueo durante envío.

Pruebas de navegador con API real y SQLite desechable: validación HTML antes del POST, concepto vacío, importe y fecha históricos exactos, filtros, consulta del ID persistido y pérdida de respuesta tras commit recuperada con la misma clave/cuerpo. El flujo manual verifica que no se llama a `/api/ai/`. No se contacta con servicios de IA ni se utilizan datos reales.

La pantalla añade la entrada diferida número 19. Se actualiza el recuento esperado del verificador de bundle, sin aumentar los límites de 250.000 bytes de JavaScript inicial y 85.000 comprimidos. Las pruebas compiladas comprueban carga bajo demanda de Gastos y rechazo del acceso directo de empleados.

Resultado local: lint, 175 pruebas (84 de API y 91 de componentes/helpers), TypeScript y build correctos; 21 recorridos funcionales y 5 de archivos compilados. JavaScript inicial: 224.052 bytes, 71.882 comprimidos y tres archivos estáticos según el verificador. Captura móvil de consulta revisada a 390 px. Sin nuevas dependencias, migraciones, datos reales ni despliegue.

Continuación implementada localmente: [fechas civiles e importes financieros](recovery-financial-values.md), reutilizados también por la consulta de gastos.
