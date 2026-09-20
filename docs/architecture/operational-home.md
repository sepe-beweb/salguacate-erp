# Inicio operativo y nombres de los locales

Primera entrega del plan de evolución, 20/09/2026. Implementación local, sin
publicación, migración de esquema ni cambios de permisos.

## Identidad y compatibilidad

`src/locations.ts` del ERP separa los identificadores persistidos de sus etiquetas:

| Identificador existente | Nombre visible |
| --- | --- |
| `Principal` | Aguacate |
| `Segundo Local` | Salmón |

La API, las claves de históricos, las asignaciones, los formularios enviados y
los recibos idempotentes conservan sus valores originales. Las etiquetas se
aplican a consultas, editores, horarios, textos de pedidos/alertas y al informe
imprimible. Un local histórico desconocido no se renombra como otro conocido.

En la instalación local de revisión se han actualizado los perfiles existentes
del propietario y la encargada a Felipe y Dora mediante la API normal. Se
conservan ID, rol, local, PIN y relaciones; la edición revoca las sesiones según
el contrato vigente. No hay cuentas nuevas ni renombrado automático en el
arranque, en los datos remotos o en las instalaciones de terceros.

## Inicio y navegación

- El inicio prioriza tareas de hoy/atrasadas, stock bajo y pedidos pendientes.
- Muestra los turnos que comienzan hoy, con aviso cuando terminan al día
  siguiente. No confunde programación con fichaje ni infiere presencia actual.
- El cierre de hoy muestra si está registrado: no presupone horario de cierre,
  apertura del local o retraso. La fecha del pedido no se trata como entrega.
- Los próximos eventos se identifican como agenda común: aún no tienen local.
- El resumen económico conserva agregación en céntimos, fechas civiles,
  históricos inconsistentes y la distinción entre saldo y beneficio.
- Las nueve lecturas se validan conjuntamente. Si falla una, no se publican
  contadores parciales. La actualización sigue siendo manual y explícita.
- El menú se agrupa en Hoy, Operativa, Equipo, Gestión y Cuenta. Mantiene rutas
  y puertas por rol; personal empleado conserva sus destinos propios.
- El asistente es una acción secundaria al final del contenido. Su diálogo
  conserva foco, Escape y devolución del foco sin tapar acciones de negocio.

## Local de consulta y borradores

La selección se comparte en memoria entre inicio, inventario, pedidos, tareas,
gastos, cierres, evolución económica e informe mensual. No se guarda en disco ni
se arrastra a la siguiente sesión. Dirección comienza en Todos; un perfil manager
con local conocido comienza en ese local. Esto es una preferencia, no una nueva
restricción de permisos. Personal/turnos y agenda mantienen su alcance existente.

Las tareas compartidas siguen apareciendo en los dos locales. Los nuevos
borradores parten del local elegido; los borradores ya abiertos o los intentos
idempotentes recuperados conservan el local de su propio cuerpo. Tras confirmar
un gasto/cierre se muestra el local del registro guardado. Preparar un pedido
requiere un local concreto; el historial permite Todos o cada local.

## Verificación

- `npm run check`: lint, 677 pruebas en 42 archivos, TypeScript y compilación.
- `npm run test:e2e`: 44 recorridos en 28 archivos, cada archivo con su API y
  SQLite desechables. Incluye continuidad del local, valores enviados, nombres
  editados mediante API, cierre de sesión y entrada de un manager en su local.
- `npm run test:e2e:production`: cinco recorridos de archivos compilados correctos.
- Navegación y comprobación móvil del inicio; capturas de 390 px y escritorio de
  1280 px, con comprobación de ausencia de desbordamiento horizontal a 320 px.

Las pruebas usan datos sintéticos y servicios locales desechables, no Turso, IA
externa ni un despliegue público. Las pruebas anteriores se adaptaron a las nuevas
etiquetas visibles manteniendo los IDs en cuerpos HTTP y valores de formulario.

## Siguiente entrega del bloque «Turno bajo control»

Actualización posterior: la [segunda entrega local](operational-handover.md)
implementa el relevo y las rutinas, con sus límites y migración al esquema 3.
El texto siguiente conserva la propuesta al cierre de esta primera entrega.

Pendientes: plantillas de apertura/cierre, recurrencia persistida y bitácora de
relevo con responsable, estado y confirmación de lectura. No están simuladas
mediante notas ni tareas cuyo título contenga una etiqueta especial.

Su implementación deberá distinguir plantilla y ejecución diaria, conservar el
historial, impedir duplicados en transacciones y validar en servidor quién puede
crear, completar o resolver cada entrada. Las lecturas no generarán tareas ni
marcarán un relevo como leído automáticamente. Requiere probar migraciones sobre
copias y actualizar el contrato de arranque remoto antes de activar ese esquema.
