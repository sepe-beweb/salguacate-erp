# Recuperación: backup, restauración y ensayo de migraciones

Fecha: 2026-09-19. Cuarto bloque local sobre `81fa2a8`.

## Publicación anterior

El tercer bloque se publicó como `de1a14c575281c1604bb5ae7221f4e78f821187c`. La CI encontró una carrera en el recorrido de pedidos: el selector se ejecutaba antes de terminar la navegación y coincidía con los botones de inventario. El reintento además reutilizaba nombres de datos ya creados.

La corrección `81fa2a826a8a24477fabccc548c8120a41b58d02` espera la pantalla de destino y usa nombres distintos por reintento. Solo incluye el archivo de esa prueba. Su [CI final](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35418402286) pasó. Ambos commits están en `origin/refactor/recovery-foundation`; no se modificó main ni se desplegó.

Este cuarto bloque todavía es local y no forma parte de esos commits ni de esa CI.

## Qué hace la herramienta

`npm run recovery -- --help` muestra las opciones. No hay rutas por defecto ni lectura de `.env`.

- `backup`: abre la base de origen en modo de solo lectura y usa la API de backup de SQLite, incluyendo los datos comprometidos que aún estén en WAL. Normaliza únicamente la copia nueva a journal DELETE: el artefacto resultante no depende de archivos WAL/SHM. Copia también uploads y detecta cambios de sus nombres/contenidos durante la operación.
- `verify`: verifica formato del manifiesto, tamaño y SHA-256 de cada archivo, ausencia de archivos adicionales, integridad SQLite, claves foráneas declaradas y existencia de las imágenes locales referenciadas. Rechaza rutas que escapen, duplicados, enlaces y copias que dependan de WAL. No ejecuta migraciones.
- `restore`: verifica y copia a un directorio inexistente, migra allí, revoca todas las sesiones copiadas y compara recuentos y huellas de los campos históricos de las tablas de negocio conocidas. No modifica el origen, el artefacto de backup, los PIN ni el historial. Conserva las cuotas de intentos de acceso. Solo escribe `recovery.json` cuando acaba correctamente.

La restauración es también el ensayo de migración. Una restauración repetida se realiza en **otro directorio nuevo**. No existe `--force`, restauración in situ, sustitución de una instalación, borrado automático ni conmutación de configuración.

## Procedimiento del operador

1. Identificar la base, uploads, versión de código y configuración de la instalación correcta. Mantener las copias fuera del repositorio de producto y protegerlas con permisos adecuados.
2. Detener las escrituras de la API y cualquier otro proceso que cambie uploads. `--offline` es una confirmación del operador, no una detección de procesos ni una orden que los detenga. Esta herramienta no promete una instantánea conjunta de base y archivos con escritores activos.
3. Elegir un directorio nuevo de backup cuyo padre ya exista. Si todavía no hay uploads, preparar y seleccionar explícitamente su directorio vacío; no omitirlo silenciosamente.
4. Ejecutar backup y después verify. Conservar también la configuración y la versión de código por un canal privado separado: la herramienta no copia secretos de `.env` ni claves de IA.
5. Restaurar en otra ruta nueva y comprobar `recovery.json`. Los hashes por tabla comparan los campos originales: las columnas añadidas por migración tienen sus valores iniciales previstos.
6. Revisar recuentos, imágenes, cuentas, cierres y stock en esa copia. Realizar los recorridos de aceptación con servicios externos desactivados. Las sesiones anteriores deben fallar; los usuarios vuelven a iniciar sesión. Los PIN heredados mantienen el requisito de renovación.
7. No activar la copia ni cambiar rutas de producción hasta contar con la decisión operativa correspondiente. Una vuelta a código antiguo requiere la copia previa compatible, no la base ya migrada.

Ejemplo orientativo en PowerShell: las rutas deben sustituirse por las del expediente autorizado; estos comandos no se han ejecutado sobre datos reales.

```powershell
npm run recovery -- backup --database "C:\sepe\personal\datos\salguacate\database.sqlite" --uploads "C:\sepe\personal\datos\salguacate\uploads" --output "C:\sepe\personal\copias\salguacate-20260919-01" --offline
npm run recovery -- verify --backup "C:\sepe\personal\copias\salguacate-20260919-01"
npm run recovery -- restore --backup "C:\sepe\personal\copias\salguacate-20260919-01" --output "C:\sepe\personal\ensayos\salguacate-20260919-01" --offline
```

Si falla una operación, el proceso devuelve código 1. Puede quedar una carpeta parcial para diagnóstico; no se borra automáticamente y no debe activarse. La mera presencia de `manifest.json` no acredita una copia válida: debe pasar `verify`. No editar manifiestos para hacer pasar archivos incompletos.

## Cambios de migración

La creación de tablas heredadas, adición de columnas, migración de seguridad e índices ahora se ejecutan dentro de una sola transacción. Antes, un fallo de los índices podía dejar creadas tablas de la fase previa. Las pruebas comprueban que un fallo por fichajes activos o cierres duplicados conserva ambas filas y revierte los cambios de esquema.

Se rechazan versiones de esquema posteriores a la soportada. También se comprueba `foreign_key_check` antes del commit. Esto valida las relaciones declaradas en SQLite: no demuestra que un esquema heredado sin claves foráneas tenga todas sus relaciones lógicas correctas. No se fusionan duplicados, inventan referencias ni eliminan registros para permitir arrancar.

## Evidencia local

- `npm run check`: lint, 92 pruebas (64 API y 28 componentes/helpers), TypeScript y compilación Vite correctos.
- 19 pruebas nuevas de recuperación sobre directorios temporales y datos desechables: WAL, uploads, restauración, acceso a API restaurada, revocación de tokens, conservación de identificadores/campos, reapertura, rollback de migraciones, archivos alterados, rutas peligrosas, enlaces, destinos existentes, imagen ausente, esquema futuro y referencias huérfanas declaradas.
- Se ejecutan también los comandos CLI completos desde las pruebas, comprobando sus códigos de salida. Las bases de prueba se cierran y los directorios temporales se retiran al terminar.
- La batería de navegador mantiene 13 recorridos contra API real de pruebas y SQLite en memoria. No prueba una migración de producción.
- Sin bases reales, servicios de IA, envíos, cambios de configuración remota, nuevas dependencias ni despliegue. Persisten los avisos de SQLite experimental y tamaño del bundle.

## Límites pendientes

Las copias contienen datos personales, mensajes, PIN o hashes y sesiones; **no están cifradas**. SHA-256 detecta alteraciones respecto al manifiesto, pero no autentica su procedencia. Usar solo copias de confianza, permisos privados y almacenamiento protegido; en Windows hay que revisar las ACL heredadas. No existe retención automática, copia remota ni prueba de recuperación frente a corte eléctrico.

La herramienta lee archivos y huellas de tablas en memoria; no se ha validado para volúmenes grandes ni escritores concurrentes. Conserva uploads completos, no configuración ni otros volúmenes. Los nombres portables admitidos pueden excluir archivos históricos inusuales; imágenes externas o ausentes requieren conciliación explícita. Turso exige su propio proceso de exportación y validación. El ensayo real requiere identificar y autorizar una copia concreta antes de trabajar con ella.

Siguiente bloque local propuesto: completar manejo de errores y accesibilidad en las pantallas aún pendientes (notas, escáner y área de empleado), manteniendo la migración real y el despliegue separados.

## Referencia técnica

La implementación usa [`sqlite.backup`](https://github.com/nodejs/node/blob/main/doc/api/sqlite.md) y la verifica con el runtime fijado por `.node-version`, no una copia directa del archivo SQLite activo.
