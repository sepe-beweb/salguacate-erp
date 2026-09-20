# Relevo y rutinas de apertura/cierre

Segunda entrega de evolución local, 20/09/2026. Ruta `/turno`, disponible para
dirección y personal desde la navegación y el inicio. Los identificadores
persistidos siguen siendo `Principal` (Aguacate) y `Segundo Local` (Salmón).

## Funcionamiento y permisos

- Los avisos pertenecen a un local, con fecha civil, texto, autor y registro UTC.
  Los pendientes permanecen visibles aunque cambie la fecha consultada. No son
  mensajes privados ni generan notificaciones externas.
- El personal consulta, deja avisos y confirma lectura únicamente en su local.
  La dirección puede operar en ambos, como en las tareas existentes. La autoría
  se obtiene de la sesión, nunca del cuerpo enviado por el cliente.
- «He leído el aviso» registra persona y momento una sola vez. Abrir la pantalla
  no confirma lectura. Resolver corresponde a dirección y conserva quién lo hizo,
  cuándo y todas las lecturas; «Mostrar también los resueltos» abre el historial.
- Dirección crea rutinas inmutables por local: apertura o cierre; todos los días,
  lunes a viernes o sábado/domingo. Cada plantilla tiene entre 1 y 30 pasos.
  Son listas compartidas del local, sin asignación individual automática.
- «Preparar tareas del día» genera explícitamente las ejecuciones y sus tareas.
  La clave única `(rutina_id, fecha)` y la transacción evitan duplicados al repetir
  o recibir peticiones concurrentes. Las frecuencias se aplican a la fecha civil
  elegida, no al huso horario del servidor. No hay temporizador ni escrituras GET.
- Los pasos son registros reales de `tareas`, también visibles en el listado
  general y el inicio del personal. Completar registra persona y hora; reabrir
  limpia la marca actual y conserva auditoría. Repetir el mismo estado no cambia
  quién lo completó primero. No se permite borrar tareas generadas por rutinas.
- Archivar impide nuevas ejecuciones, sin eliminar tareas ni historial. Para
  cambiar una lista hay que archivar la anterior y crear su sustituta; no se
  reemplazan silenciosamente las tareas de un día ya preparado.

## Recuperación y migración

El esquema 3 añade `rutinas`, `rutina_ejecuciones`, `relevos`, `relevo_lecturas`
y metadatos de rutina/completado en `tareas`. Los registros históricos conservan
sus IDs, valores y estados; no se inventa el autor de una tarea completada antes
de esta versión. La tabla de recibos se sustituye transaccionalmente, conservando
todas sus filas y ampliando las operaciones a `routine.create` y `handover.create`.

Las altas nuevas exigen `Idempotency-Key`. Alta, auditoría y recibo se confirman
juntos. La interfaz reutiliza clave y cuerpo exactos tras una respuesta incierta;
los intentos viven en la sesión y pueden recuperarse al volver a la ruta. No se
guardan en almacenamiento persistente del navegador ni pasan a otra sesión.
Un GET fallido después de un alta confirmada no repite el POST.

Las mutaciones revalidan sesión dentro de la transacción. La lectura conjunta
también comprueba la sesión y entrega una instantánea por local/fecha. El cliente
valida listas, relaciones, marcas y fechas antes de mostrar contadores. Un fallo
de lectura bloquea las acciones sobre esos registros; después de una escritura
se consulta de nuevo, sin reintentar cambios automáticamente.

El verificador de arranque remoto exige el nuevo esquema exacto. **La base Turso
existente no se ha migrado: el código nuevo rechazará su esquema 2.** Antes de
desplegar se necesita una migración remota explícita, ensayada y autorizada,
preservando propietario y recibos; no basta con conectar las credenciales.
Los ensayos Turso históricos no acreditan estas rutas nuevas contra Turso real.

## Verificación local

Resultado final: `npm run check` correcto (707 pruebas en 45 archivos, lint,
TypeScript y compilación); 45 recorridos E2E en 29 archivos; cinco recorridos de
archivos compilados correctos, incluida la nueva ruta para dirección y personal.
El presupuesto de JavaScript inicial se mantiene en 250 kB / 85 kB gzip; la
vigésima pantalla se carga de forma diferida.

- Pruebas de API: permisos, locales, identidad del autor, recurrencias, preparación
  concurrente, archivo, historial, lectura/resolución única, completado y rollback.
- Pruebas de migración: actualización de copia de esquema 2 con recibos, rechazo
  remoto sin escrituras, rollback del esquema 3 y cobertura de las cuatro nuevas
  tablas en backup/restauración.
- Componentes: validación completa, borradores, Escape, aislamiento por rol,
  intento incierto entre rutas y bloqueo hasta finalizar la lectura posterior.
- Recorrido E2E con SQLite/API locales: Dora configura y prepara, María confirma
  y completa, Felipe resuelve y archiva. Móvil 320/390 px y escritorio 1280 px.
- La instalación local de revisión se ha actualizado después de backup verificado
  y restauración/migración ensayada en una carpeta separada. No se han cambiado
  los PIN ni los nombres de Felipe/Dora ni los datos de las revisiones anteriores.
  Se dejan dos rutinas y un aviso de ejemplo identificados como prueba local.

## Límites y próximos pasos

No hay responsable individual asignado al aviso, adjuntos, escalados, avisos push,
ejecución en segundo plano ni edición retroactiva de plantillas. La resolución
registra a su responsable real. La asignación previa a una persona y las alertas
de pendientes en el inicio quedan como siguientes evolutivos; requieren reglas
explícitas para cambios de local o bajas. Esta entrega no implica publicación.
