# Guía técnica de Salguacate ERP

Esta guía sustituye las descripciones previas del arranque con usuarios de prueba, doble backend SQLite/Turso y chat con herramientas de escritura.

## Fuentes de verdad

- [README](README.md): requisitos, configuración y comandos.
- [Recuperación](docs/architecture/recovery-foundation.md): decisiones, migración y límites.
- [Módulos y flujos](docs/architecture/recovery-modules.md): organización vigente y contratos reforzados del segundo bloque.
- [Pantallas de gestión](docs/architecture/recovery-screens.md): carga, errores, borradores y confirmaciones del tercer bloque.
- `package.json`, `package-lock.json` y `.node-version`: dependencias y runtime.
- `apps/api/database.js`: esquema y migraciones; `security.js`: autenticación; `operations.js`: transacciones.
- Los informes anteriores y propuestas de arquitectura son históricos. No acreditan validación ni funcionalidades implementadas.

## Convenciones

- Instalar en la raíz con el lockfile raíz. No crear otro lockfile bajo apps.
- Todo cambio de autorización se comprueba en el servidor, no solo ocultando botones.
- No introducir cuentas automáticas, credenciales compartidas ni secretos en Git o en variables VITE.
- Preservar identificadores e historial; probar migraciones sobre copias. No resolver inconsistencias borrando datos.
- Las operaciones multi-escritura deben ser transaccionales. No confirmar éxito HTTP antes del commit.
- Las pruebas usan bases temporales y nunca endpoints ni datos de producción.
- Una respuesta HTTP 200 o una compilación correcta no acredita despliegue ni validación funcional completa.
- Mantener separados los permisos de cambio local y publicación.
- No asumir implementados TPV, TicketBAI o el wrapper Android por existir sus directorios.
- Las nuevas pantallas deben conservar soporte móvil/tablet, accesibilidad y permisos por rol.
- Para cargas de listas relacionadas, usar `useApiLists`: no sustituir un fallo por una lista vacía ni publicar métricas parciales. Las escrituras comprueban HTTP/JSON, conservan el borrador si fallan y no se reintentan automáticamente.

## Arquitectura vigente

React 18 + TypeScript, Tailwind y React Router para el ERP; Express para la API; SQLite local/persistente. Sesión cliente en memoria, API con sesiones revocables y PIN scrypt. La IA es opcional y no ejecuta escrituras. El servidor se compone en `apps/api/index.js`; las rutas están distribuidas por áreas bajo `apps/api/modules`, junto a seguridad y operaciones transaccionales. Las URLs se conservan.
