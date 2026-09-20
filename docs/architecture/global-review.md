# Revisión global: código/funcionalidad y UI/UX

Revisión local del 20/09/2026 sobre el ERP web y su API, en dos pasadas diferenciadas. No comprende una recuperación del wrapper Android, TPV ni fiscalidad; tampoco acredita publicación, auditoría independiente de seguridad o aceptación del cliente.

## Primera pasada: código y funcionalidad

Se contrastaron los contratos de los módulos de API, operaciones transaccionales, autenticación y carga de listas con sus pantallas y pruebas. La regresión existente mantiene cobertura específica de documentos privados, revisión documental, sesiones, planificación, finanzas y catálogo. Es una revisión global orientada a riesgos, no una afirmación de lectura exhaustiva de cada línea.

Correcciones aplicadas:

- **Entrada HTTP:** las peticiones sin cuerpo llegan a la validación de campos como un objeto vacío; un payload con tipo de contenido incorrecto devuelve 400, no un error de destructuración 500. Logout sin cuerpo y health conservan su contrato.
- **Stock:** se impide almacenar cantidades fuera del rango de enteros seguros. Los ajustes negativos conservan el comportamiento histórico de mínimo cero.
- **Recepción de pedidos:** se comprueba el resultado acumulado de todas las líneas antes de modificar existencias. Si una línea desborda, no se recibe parcialmente el pedido ni se modifica otro producto. Las líneas repetidas siguen permitidas y se suman para validar el resultado.
- **Alta de pedidos:** la existencia y el local de los productos, y la existencia del proveedor, se vuelven a verificar dentro de la misma transacción que escribe el pedido y revalida al actor.
- **Tema:** un navegador que bloquee localStorage ya no impide arrancar la aplicación ni cambiar de tema durante la sesión.

No se cambian roles, identificadores de locales, cálculos financieros, datos históricos, PIN ni esquema. La instalación local continúa en esquema 6.

## Segunda pasada: UI/UX

Se recorrieron las 17 pantallas de gestión de la demo: Inicio, Relevo y rutinas, Tareas, Agenda, Inventario, Pedidos, Proveedores, Escáner de facturas, Documentos, Personal y turnos, Buzón, Notas, Cierres de caja, Gastos, Evolución económica, Informe mensual y Ajustes.

Correcciones aplicadas:

- **Semántica financiera:** las invitaciones se muestran como dato informativo independiente, no como método de pago. «Gastos registrados» sustituye etiquetas que los confundían con facturas o detecciones automáticas.
- **Contexto:** el informe mensual indica período y local; su impresión incluye el local tanto en la cabecera como en cada gasto. Evolución económica declara expresamente que muestra todo el histórico disponible y ofrece actualización manual.
- **Interpretación:** se aclara que el saldo compara registros y no equivale a beneficio neto ni conciliación bancaria. No se recalculan ni alteran importes.
- **Móvil:** las tarjetas financieras adaptan sus columnas a pantallas estrechas; se admite ruptura de importes largos para evitar solapamientos. Se probaron cifras sintéticas próximas al límite de entrada.
- **Teclado:** enlace para saltar al contenido y foco visible en controles; selección de local del informe expuesta con aria-pressed.
- **Movimiento:** las animaciones y transiciones CSS respetan la preferencia de movimiento reducido. No se certifica con ello cada animación JavaScript ni todas las tecnologías de asistencia.

La inspección visual incluyó móvil de 320/390 px, escritorio de 1280 px y temas claro/oscuro. El recorrido automatizado global cubre 17 destinos de gestión a 320 y 1280 px con localStorage bloqueado, y siete destinos del empleado a 390 px: carga, encabezados, ausencia de alertas inesperadas y desbordamiento horizontal. No sustituye las pruebas funcionales específicas de cada acción ni pruebas en dispositivos físicos.

## Verificación

- `npm run check`: 805 pruebas de API/componentes en 50 archivos, lint, TypeScript y compilación correctos.
- `npm run test:e2e`: 50 recorridos en 32 archivos correctos, con una API y base desechables por archivo.
- `npm run test:e2e:production`: seis recorridos correctos sobre archivos compilados servidos localmente, incluidos visor PDF privado, carga diferida y acceso del empleado.
- Demo conservada: 19 tablas de negocio sin cambios; clasificación de 13 documentos, bytes originales y eventos previos de historial intactos, comprobados contra la copia anterior. Verificación de integridad referencial correcta.
- Consola del recorrido manual: sin advertencias ni errores capturados en la lectura final.

Las pruebas usan bases y archivos desechables. Las integraciones simuladas conservan ese carácter: no se presenta un doble de Cloudinary o IA como validación remota. Las evidencias históricas de proveedores remotos no se han repetido en esta revisión. No se han ejecutado Git de escritura, merge ni despliegue.

Entorno comprobado: Node 22.23.2 y Chrome instalado en Windows mediante `E2E_CHROME_PATH`. Dos expectativas antiguas del recorrido financiero se actualizaron después de los cambios de rótulos; una ejecución sin seleccionar Chrome no arrancó por ausencia del navegador empaquetado. Tras corregir la configuración, la batería completa terminó con código 0. No se instalaron navegadores ni se omitieron casos para lograr el resultado.

## Evolutivos pertinentes, separados de las correcciones

1. **Matriz explícita de permisos por rol y local.** Los gestores conservan el alcance amplio heredado de módulos generales, mientras Documentos aplica su aislamiento por local. Definir y aprobar la matriz antes de restringir o ampliar accesos; no trasladar automáticamente la política de documentos al resto.
2. **Protección uniforme de escrituras.** Extender idempotencia y resolución de conflictos de edición al catálogo, planificación y comunicaciones según cada operación. No todas las altas tienen hoy el recibo recuperable de notas/gastos/documentos, ni todos los editores controlan versiones como Documentos.
3. **Escala de históricos.** Medir volumen y latencia y añadir paginación/consulta agregada donde hoy se descargan listas completas. La demo pequeña no demuestra comportamiento con años de actividad.
4. **Despliegue documental privado.** Definir almacén remoto privado, permisos, retención y restauración conjunta de base/originales antes de publicar este módulo. El almacén público de fotografías de catálogo no es un destino válido para documentos privados.

Estos puntos son propuestas y puertas pendientes, no funcionalidades implementadas ni autorizaciones de cambio de política. Prioridad recomendada: cerrar la matriz de acceso y la protección de escrituras antes de ampliar módulos o exponer información real.
