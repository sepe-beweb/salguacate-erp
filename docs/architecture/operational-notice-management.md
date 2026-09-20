# Gestión de avisos y continuidad del servicio

## Contrato

La dirección asigna un aviso a una persona activa del local o al propietario,
marca prioridad normal/alta y cambia su estado: pendiente, en curso o resuelto.
El personal solo puede poner en curso los avisos asignados a sí mismo; no puede
reasignar, cambiar prioridad ni resolver. Los permisos existentes de dirección
sobre ambos locales se mantienen. Confirmar lectura no resuelve el aviso.

`PUT /api/relevos/:id/gestion` recibe responsable_id (ID o null), prioridad,
estado y revision observada. Un cambio sobre una revisión antigua devuelve 409.
Si el resultado solicitado ya coincide exactamente, la repetición es inocua y no
duplica historial. Negocio, historial y auditoría se guardan en una transacción
que revalida la sesión. No hay reintentos automáticos. El botón de resolución del
cliente también envía la revisión; el endpoint antiguo se mantiene compatible.

Una baja o traslado no borra una asignación histórica: se muestra como no
disponible y entra en el filtro de revisión por falta de responsable disponible.
Reabrir limpia la resolución vigente, pero conserva el cambio en el historial.

`GET /api/relevos/resumen` entrega una lectura transaccional por local de avisos
pendientes, no leídos por el actor, asignados al actor, sin responsable disponible
y pasos de rutina preparados/completados para la fecha. No prepara tareas ni
confirma lecturas. El inicio valida fecha/local y no publica contadores parciales
si falla ese apartado. Sus enlaces conservan el local y aplican el filtro de
avisos. La actualización es explícita, no una suscripción en tiempo real.

El editor conserva el borrador al cerrar o fallar. Ante un conflicto, el usuario
puede descartarlo y abrir la versión actual; no se sobrescribe silenciosamente.

## Persistencia y recuperación

Esquema 4: tablas auxiliares `relevo_gestion` y `relevo_cambios`, incluidas en la
verificación de recuperación. Los avisos anteriores conservan IDs, autoría,
resolución y lecturas; por defecto quedan sin asignar, prioridad normal y revisión
1. La resolución sigue derivándose del registro original, sin dos fuentes de
verdad. La migración local se comprueba sobre una copia v3 y también desde v2.
El arranque remoto exige el esquema exacto; no migra la base Turso existente.

## Catálogo y demostración

El catálogo usa tarjetas adaptables con foto ampliada, proveedor y cantidades,
carga diferida de imágenes, dimensiones reservadas y alternativa sin foto. Se
mantienen los permisos, validación de URLs y operaciones de stock existentes.

La marca visual `VITE_DEMO_MODE=true` identifica una instancia de demostración.
Solo controla el rótulo: no crea usuarios, no cambia permisos ni limita escrituras.
No debe conectarse una demo a información real. Por defecto no está activada.
Los datos, fotos y scripts auxiliares de presentación se mantienen fuera del
repositorio y no forman parte del bootstrap ni del despliegue ordinario.

## Límites

Validación local: 723 pruebas de API/componentes en 46 archivos, lint, TypeScript
y compilación correctos; 45 recorridos E2E en 29 archivos con instancias aisladas,
y cinco recorridos de archivos compilados. Incluye asignación desde dirección,
inicio por empleado, resolución e historial, además de conflictos y rollback.

No hay avisos push, adjuntos, SLA, caducidad de asignaciones ni conciliación
automática entre un aviso y una recepción de pedido. La dirección resuelve el
aviso explícitamente. Las fotos de catálogo conservan el contrato de URL pública.
Esta ampliación es local; no acredita despliegue ni validación sobre Turso real.
