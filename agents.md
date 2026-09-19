# Guía técnica de Salguacate ERP

Esta guía sustituye las descripciones previas del arranque con usuarios de prueba, doble backend SQLite/Turso y chat con herramientas de escritura.

## Fuentes de verdad

- [README](README.md): requisitos, configuración y comandos.
- [Recuperación](docs/architecture/recovery-foundation.md): decisiones, migración y límites.
- [Módulos y flujos](docs/architecture/recovery-modules.md): organización vigente y contratos reforzados del segundo bloque.
- [Pantallas de gestión](docs/architecture/recovery-screens.md): carga, errores, borradores y confirmaciones del tercer bloque.
- [Recuperación de datos](docs/architecture/recovery-data.md): backup, restauración aislada y ensayo de migraciones.
- [Notas, escáner y empleado](docs/architecture/recovery-personal-workflows.md): errores, borradores, consentimiento y conciliación del fichaje.
- [Carga por rutas](docs/architecture/recovery-route-loading.md): pantallas diferidas, límite de errores, presupuesto y pruebas de archivos compilados.
- [Idempotencia](docs/architecture/recovery-idempotency.md): contrato de altas de notas/gastos, esquema 2 y límites de recuperación.
- [Intentos por sesión](docs/architecture/recovery-session-attempts.md): recuperación entre rutas, resultados tardíos, cierre de sesión y límites de privacidad.
- [Gastos manuales](docs/architecture/recovery-manual-expenses.md): alta sin IA, formulario compartido, filtros y consulta de registros.
- [Valores financieros](docs/architecture/recovery-financial-values.md): fechas civiles, céntimos, lectura conjunta y consistencia de informe/analíticas.
- [Panel y cierres](docs/architecture/recovery-dashboard-closings.md): resumen mensual, historial validado y vista previa del alta de cierre.
- [Agenda y tareas](docs/architecture/recovery-planning-values.md): fechas civiles, estados persistidos y lecturas completas compartidas con el panel.
- [Planificación del empleado](docs/architecture/recovery-employee-planning.md): turnos validados, fecha completa y todos los turnos del día.
- [Modales de planificación](docs/architecture/recovery-planning-dialogs.md): foco nativo, Escape seguro y descarte explícito de borradores.
- [Peticiones de personal](docs/architecture/recovery-personnel-requests.md): lecturas validadas, fechas civiles, decisiones bloqueadas y acceso móvil.
- [Editores de personal](docs/architecture/recovery-personnel-dialogs.md): diálogos nativos, borradores, PIN y aislamiento E2E por archivo.
- `package.json`, `package-lock.json` y `.node-version`: dependencias y runtime.
- `apps/api/database.js`: esquema y migraciones; `security.js`: autenticación; `operations.js`: transacciones.
- Los informes anteriores y propuestas de arquitectura son históricos. No acreditan validación ni funcionalidades implementadas.

## Convenciones

- Instalar en la raíz con el lockfile raíz. No crear otro lockfile bajo apps.
- Todo cambio de autorización se comprueba en el servidor, no solo ocultando botones.
- No introducir cuentas automáticas, credenciales compartidas ni secretos en Git o en variables VITE.
- Preservar identificadores e historial; probar migraciones sobre copias. No resolver inconsistencias borrando datos.
- La inicialización completa se ejecuta en una transacción. Rechazar esquemas futuros y comprobar claves foráneas antes del commit. Las herramientas de recuperación no sobrescriben destinos ni activan instalaciones; una restauración revoca las sesiones copiadas.
- Las operaciones multi-escritura deben ser transaccionales. No confirmar éxito HTTP antes del commit.
- Las pruebas usan bases temporales y nunca endpoints ni datos de producción.
- Una respuesta HTTP 200 o una compilación correcta no acredita despliegue ni validación funcional completa.
- Mantener separados los permisos de cambio local y publicación.
- No asumir implementados TPV, TicketBAI o el wrapper Android por existir sus directorios.
- Las nuevas pantallas deben conservar soporte móvil/tablet, accesibilidad y permisos por rol.
- Para cargas de listas relacionadas, usar `useApiLists`: no sustituir un fallo por una lista vacía ni publicar métricas parciales. Las escrituras comprueban HTTP/JSON, conservan el borrador si fallan y no se reintentan automáticamente.
- Un estado de fichaje desconocido bloquea las acciones; después de escribir se consulta al servidor antes de habilitar otro fichaje. El análisis externo de imágenes y el dictado requieren aceptación explícita; no se confunden con la generación local de PDF.
- Declarar las pantallas diferidas fuera de los componentes. Mantener la navegación fuera de Suspense y del límite de errores de contenido. No recargar automáticamente ante fallos de módulos: la sesión y los borradores viven en memoria. Comprobar `test:e2e:production` y su presupuesto además de la batería funcional habitual.
- En altas de notas/gastos, mantener clave y cuerpo exactos de cada intento sin confirmar. No generar una clave nueva silenciosamente tras un fallo. La API verifica usuario, operación y huella y confirma negocio, auditoría y recibo en una sola transacción. No purgar recibos ni excluirlos del ensayo de recuperación sin revisar la garantía de deduplicación.
- Los intentos enviados pertenecen a una instancia de sesión, no a una ruta ni a un singleton. Navegar no desbloquea una petición en curso. Cerrar/expirar sesión invalida su almacén y ninguna respuesta tardía puede repoblarlo. No persistir borradores sensibles ni trasladar consentimientos o fotos para recuperar un guardado.
- Alta manual y escáner comparten el mismo intento de gasto. Una coincidencia en la lista no confirma un POST: solo lo hace su recibo. Un fallo de lectura posterior al éxito no debe repetir el alta. La consulta no añade conciliación automática ni permisos de edición/borrado.
- En informes y analíticas, usar los valores financieros comunes: fechas civiles sin convertir a instantes, agregación en céntimos seguros y formato común. Preservar el total registrado de cierres inconsistentes y advertir; no reinterpretar invitaciones, descuadres ni históricos para cuadrarlos. Una lectura inválida bloquea el informe, no genera totales parciales.
- Panel e historial de cierres comparten esos valores y validadores. La vista previa del alta no envía un total cliente ni sustituye la validación de la API; preservar el borrador rechazado y no repetir el POST por un fallo del GET posterior. El último cierre se elige por fecha civil e ID, no por el orden recibido ni por una hora inferida.
- Agenda y tareas usan `planningData` para validar las lecturas; no convertir estados desconocidos en contadores válidos ni fechas civiles en instantes. Completar/eliminar tareas espera la lectura posterior, no reintenta escrituras y conserva confirmación explícita antes de eliminar.

## Arquitectura vigente

React 18 + TypeScript, Tailwind y React Router para el ERP; Express para la API; SQLite local/persistente. Sesión cliente en memoria, API con sesiones revocables y PIN scrypt. La IA es opcional y no ejecuta escrituras. El servidor se compone en `apps/api/index.js`; las rutas están distribuidas por áreas bajo `apps/api/modules`, junto a seguridad y operaciones transaccionales. Las URLs se conservan.
