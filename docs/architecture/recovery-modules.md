# Recuperación: módulos y flujos operativos

Fecha: 2026-09-19. Segundo bloque local sobre `2eb9383`.

## Estado de entrega

El primer bloque se publicó como `2eb9383b4130cdff9080a0fd4964916f253cf55e` en `origin/refactor/recovery-foundation`. Su [CI](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35416213471) terminó correctamente. No se modificó main ni se ejecutó un despliegue. Este segundo bloque todavía no está incluido en ese commit ni en esa ejecución remota.

## Organización

`apps/api/index.js` se limita a composición, middleware, disponibilidad y errores HTTP. Se preservaron las 36 rutas registradas en el antiguo archivo principal durante la extracción; autenticación y operaciones atómicas mantienen sus rutas propias.

| Módulo | Responsabilidad |
| --- | --- |
| `modules/workforce.js` | Fichajes, presencia, turnos y peticiones |
| `modules/catalog.js` | Productos, proveedores y pedidos |
| `modules/finance.js` | Consultas de cierres y gastos |
| `modules/communications.js` | Mensajes y notas |
| `modules/events.js` | Agenda de eventos |
| `modules/tasks.js` | Tareas y permisos de completado |
| `modules/ai.js` | Integración opcional, desactivada por defecto |
| `operations.js` | Escrituras transaccionales de caja, gastos y stock |
| `security.js` | Sesiones, PIN, roles y ciclo de vida de usuarios |
| `http.js` / `validation.js` | Errores seguros y validadores comunes |

No se añadió un framework de validación ni se cambiaron dependencias o tablas. Las funciones de registro reciben dependencias explícitas y conservan las URLs públicas.

## Contratos reforzados

- Fechas civiles reales, horas HH:mm, identificadores enteros positivos, enums conocidos y límites de texto. Se rechazan cuerpos JSON de tipo array y consultas anidadas/repetidas no soportadas.
- Los turnos nocturnos siguen admitidos: 18:00–02:00 no se rechaza por cruzar medianoche. No se introduce un corte por fecha pasada ni se presume cómo conciliar solapamientos.
- Nuevos turnos, tareas y mensajes requieren usuarios activos. Los empleados siguen limitados a sus propios turnos/peticiones; el buzón es privado incluso frente a otros administradores. El remitente se obtiene de la sesión.
- Una petición pendiente puede pasar a aprobada o rechazada; otra resolución devuelve 409, y un identificador inexistente devuelve 404. No se implementa reapertura ni se sobrescribe una decisión anterior de forma silenciosa.
- Una tarea visible/modificable para un empleado debe cumplir simultáneamente asignación y local. La compatibilidad con tareas globales de local Ambos se conserva. Los administradores conservan su alcance previo, sin inventar restricciones por local.
- Los pedidos nuevos requieren líneas válidas, cantidades enteras positivas y productos existentes en su local. Se normalizan los identificadores de línea para la recepción transaccional. No se reescriben pedidos históricos.
- Notas, eventos, pedidos y tareas inexistentes ya no generan respuestas falsas de éxito al modificar o eliminar. Los booleanos no admiten cadenas como `"false"`.
- `apiResponse.ts` distingue respuestas HTTP fallidas, JSON inválido y listas inválidas. Mensajes, peticiones, tareas y cargas de RRHH usan estas comprobaciones. Los errores se muestran y no borran borradores fallidos; existen pruebas específicas para mensajes, peticiones y tareas.

## Evidencia local

- `npm run check`: lint, 52 pruebas (45 API y 7 componentes/helpers) y compilación TypeScript/Vite correctas.
- Playwright con Chrome: 10 recorridos correctos contra API real y SQLite en memoria. Incluyen los ocho anteriores, solicitud de vacaciones con revisión del encargado y consulta posterior del empleado, y envío/recepción de mensajes entre cuentas distintas.
- Las pruebas API cubren permisos entre usuarios/locales, turnos nocturnos, rechazo de datos inválidos, ciclo de decisiones y CRUD de notas/eventos/tareas/pedidos.
- Las pruebas de fallos visuales usan respuestas simuladas para provocar errores concretos; son pruebas de componentes, no pruebas E2E. Los diez recorridos de navegador no simulan la API.
- Se verifican sintaxis de los siete módulos y whitespace del diff. No se han usado cuentas, documentos o bases reales ni servicios externos de IA.

## Pendientes

La separación por módulos no equivale a una auditoría completa del producto. Quedan por revisar el manejo de errores en las demás pantallas, accesibilidad integral, integración IA activada, políticas de solapamiento de turnos y operación multilocal, backups/restauración y migración de datos reales. Android y fiscalidad siguen fuera de la validación. Persisten los avisos ya documentados de SQLite experimental, ESLint 8 y tamaño del bundle.

Siguiente bloque recomendado: unificar estados de carga/error y confirmaciones en catálogo, caja, agenda y paneles, con pruebas funcionales por pantalla. Después, preparar el ensayo de backup/restauración y migración sobre una copia autorizada de datos.
