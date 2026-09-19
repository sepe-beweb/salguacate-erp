# Recuperación: cimientos verificables

Fecha: 2026-09-19. Primera iteración local. No declara el producto listo para producción.

Informe histórico del primer bloque: sus pendientes y cifras corresponden a esa iteración. Consultar el [estado consolidado](recovery-status.md) para la situación posterior; no interpretar «siguiente iteración» ni «sin ejecución remota» como estado vigente de toda la rama.

## Decisiones aplicadas

1. Conservar React, los flujos operativos útiles y el esquema histórico; separar arranque, configuración, seguridad y operaciones atómicas. El resto de rutas antiguas sigue en `apps/api/index.js` y se extraerá por módulos en iteraciones siguientes.
2. Una base SQLite explícita, mediante `node:sqlite`, sin compilación de sqlite3. Node fijado a 22.23.2. Este módulo sigue siendo experimental en Node 22: el aviso es esperado y cualquier actualización de runtime exige repetir pruebas. No ofrece escalado distribuido; una instancia con volumen persistente es el modelo previsto.
3. Migración incremental registrada y transaccional para seguridad e índices. Sin semillas durante el arranque. La configuración Turso detiene el proceso: no hay fallback que abra una base nueva y oculte los datos remotos.
4. Sesiones opacas de 8 horas, aleatorias y guardadas como digest. Cada petición verifica usuario activo, rol actual y versión de autorización. Logout, cambio de PIN, edición de usuario y desactivación revocan sesiones.
5. PIN con scrypt y salt individual; los formatos anteriores se verifican y actualizan al acceder. Las cuentas antiguas requieren renovación antes de usar rutas de negocio. Límite persistente de intentos por usuario, IP y global. No se confía en cabeceras proxy arbitrarias; detrás de un proxy la cuota por IP puede ser compartida y debe diseñarse antes de producción.
6. Desactivación lógica, protección del último propietario y conservación de historial. Auditoría técnica sin PIN, tokens, mensajes ni imágenes.
7. Recepción de pedidos y actualización opcional de stock en una única transacción. Validación de todas las líneas antes de escribir y conflicto 409 ante una segunda recepción. Ajustes de stock enteros; cierres únicos por fecha/local; importes validados a dos decimales y sumados en céntimos antes de almacenarlos en las columnas REAL heredadas.
8. Imágenes de producto PNG/JPEG con firma básica, tamaño máximo 3 MB, nombre aleatorio y rechazo explícito de errores. No es un análisis antivirus ni una decodificación completa; las fotos continúan siendo públicas mediante URL. No subir documentos personales.
9. IA desactivada por defecto. Activarla requiere clave y decisión expresa sobre datos enviados. El chat solo consulta hasta 200 productos y carece de herramientas que modifiquen la base. Escáner/carteles siguen pendientes de validación independiente y no se han llamado servicios externos durante las pruebas.
10. Pruebas separadas para Node y navegador, fixtures aislados y readiness real. Un único lockfile raíz y comprobaciones CI antes del workflow manual de publicación.

## Migración de una base real

1. Identificar la ruta/servicio que realmente contiene los datos. Esta iteración no ha abierto ninguna base de producción.
2. Detener las escrituras y realizar una copia coherente mediante backup SQLite o con el proceso detenido, incluyendo los ficheros WAL/SHM si existen. Guardar también uploads y configuración por un canal privado.
3. Restaurar esa copia en una ruta aislada y arrancar esta versión contra ella. No usar el bootstrap sobre datos existentes.
4. Si existen varios fichajes activos por usuario o cierres repetidos por fecha/local, los índices únicos hacen fallar la migración. No se borran ni fusionan automáticamente registros: investigar y acordar la conciliación.
5. Verificar recuentos e historial, integridad de relaciones, acceso y renovación de PIN, fichajes, cierres y recepción de pedidos sobre la copia.
6. Si el origen es Turso, obtener una exportación consistente y diseñar/verificar la conversión por separado. Las variables Turso impiden el arranque de esta versión.
7. Para rollback, detener la versión nueva y restaurar una copia íntegra con el código anterior. No basta con cambiar el código tras modificar datos: los PIN scrypt y las sesiones no son compatibles con el servidor antiguo.

## Límites y siguientes iteraciones

- No hay migración real ensayada, copias automáticas ni restauración operativa certificada.
- Mantener el despliegue bloqueado hasta revisar reglas por local, validación de todas las rutas antiguas, manejo uniforme de errores HTTP en pantallas y pruebas de cada módulo.
- Los perfiles públicos conservan nombre y rol para la selección de usuario; decidir si ese modelo es apropiado antes de exponer el servicio en Internet.
- La sesión cliente permanece solo en memoria y se pierde al recargar. Si el dispositivo pierde conexión durante logout, el token se descarta localmente pero la sesión remota puede seguir vigente hasta su caducidad.
- Las columnas monetarias históricas siguen siendo REAL; migrar a enteros en céntimos exige una conciliación específica. Esto no implementa contabilidad fiscal ni TicketBAI.
- Desactivación de personal conserva fichajes activos e historial; el procedimiento de salida de plantilla debe conciliar esos fichajes, nunca inventar horas.
- Android mantiene su WebView y configuración antigua. No se valida ni publica un APK en esta iteración.
- Modularización del resto del backend, pantallas de error/carga accesibles y división del bundle web quedan para la siguiente iteración.
- Las pruebas de CI y configuración Render son archivos locales; no hay ejecución remota ni despliegue acreditados.

## Evidencia de esta iteración

Comprobado localmente en Windows ARM64 con Node 22.23.2:

- Instalación limpia: `npm ci --ignore-scripts --no-audit --no-fund`, correcta con npm 10.9.8. Resolución de actualizaciones realizada con npm 11.19.1 portátil tras un fallo `edgesOut` en npm 10; no se cambió npm global ni PATH.
- `npm run check`: lint sin avisos, 31 pruebas (29 API y 2 componentes) y compilación TypeScript/Vite correctas.
- Playwright con Chrome instalado: 8 pruebas de integración local correctas, sin mocks de API ni llamadas a IA externa. Acceso por roles, PIN incorrecto, fichaje, logout, renovación de PIN, recepción atómica desde pantalla y generación real de PDF.
- `npm audit`: 0 avisos conocidos en la consulta del 2026-09-19, frente a 24 paquetes afectados inicialmente. No implica ausencia de vulnerabilidades desconocidas.
- Dependencias principales recuperadas: Vite 8.3.0, plugin React 6.0.5, Vitest 4.1.11, React Router 7.18.4, jsPDF 4.2.1 y Express 4.22.3; React permanece en 18.3.1.
- Puerto 3101 y 5174 cerrados al finalizar. No se creó una base normal del ERP, no se ejecutaron despliegues y no se modificó el índice de Git.
- Se retiraron el lockfile duplicado de la API y el resultado histórico versionado de Playwright; recuperables en Git. Los nuevos resultados generados quedan ignorados.
- Avisos pendientes: SQLite experimental en Node 22, ESLint 8 fuera de soporte y bundle inicial todavía de aproximadamente 794 kB sin comprimir. El PDF ahora se carga bajo demanda.

## Referencias técnicas

- [Node 22 SQLite](https://nodejs.org/download/release/v22.13.1/docs/api/sqlite.html).
- [Migración a Vite 8](https://vite.dev/guide/migration).
- [Seguridad de jsPDF](https://github.com/parallax/jsPDF/security).
- [React Router: historial de cambios](https://reactrouter.com/changelog).
- [Configuración declarativa de Render](https://render.com/docs/blueprint-spec).
