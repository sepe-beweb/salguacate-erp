# Alojamiento gratuito: primera puerta de compatibilidad

## Decisión y alcance

Plan aprobado: Render Static Site para React, Render Free para Express, Turso Free
con motor libSQL para datos y Cloudinary Image & Video API Free para fotos.
No hay históricos que conservar. El objetivo inicial es un piloto sin cuota,
no disponibilidad garantizada para la operación del negocio.

Este bloque prepara la puerta de base remota. **No cambia el backend activo**,
no activa Turso en `readConfig`, no modifica servicios remotos, no crea cuentas,
no fusiona `main` ni convierte `render.yaml` en un despliegue gratuito válido.
La configuración publicada sigue necesitando el disco de la arquitectura local.
No usar el script histórico de creación de servicios.

## Ensayo preparado

`npm run probe:turso -- --help` describe una herramienta manual, separada del
arranque del servidor y de CI. Requiere una base Turso **libSQL** nueva, vacía y
exclusiva del ensayo, con token limitado a ella; no una base operativa ni un token
de administración de toda la organización.

El comando requiere `--confirm-empty-disposable HOST` y las variables de proceso
`SALGUACATE_TURSO_PROBE_URL` / `SALGUACATE_TURSO_PROBE_TOKEN`. No lee `.env`, no usa
las variables de producción `TURSO_*`, no admite archivos locales, URLs sin TLS,
hosts distintos del confirmado ni credenciales dentro de la URL. El transporte
HTTP tiene límite de diez segundos por petición y rechaza redirecciones HTTP.

En Windows, ejecutar manualmente `scripts/turso-probe-private.ps1` desde una
terminal privada. Admite `-NodePath` si Node no está en PATH. Pide URL, confirmación
del host y token con entrada oculta; el token solo se entrega al proceso hijo por
el entorno, nunca como argumento, y se restaura el entorno al terminar. No guarda
credenciales ni cambia la política de ejecución de PowerShell. No pegar secretos
en conversaciones, capturas, Git ni variables `VITE_*`.

La herramienta:

1. Obtiene el esquema nuevo de las migraciones autoritativas, ejecutadas sobre
   SQLite exclusivamente en memoria; no mantiene una segunda definición manual.
2. Comprueba dentro de una transacción de escritura que el destino está vacío y
   aplica el esquema completo, con claves foráneas activas y verificadas.
3. Inserta datos sintéticos; el usuario está inactivo y no tiene PIN.
4. Comprueba rollback conjunto de negocio, auditoría y recibo; rechazo de huérfanos;
   ocho altas concurrentes equivalentes serializadas por una instancia; recuperación
   del recibo tras descartar una respuesta y un lote de 500 incrementos de stock.
5. Emite solo resultados y tiempos, sin credenciales, SQL sensible ni respuestas de error remotas.

**Conserva la base y sus datos sintéticos para inspección.** No borra nada ni limpia
automáticamente. Una segunda ejecución sobre esa base se rechaza. Si falla tras
el primer commit, puede haber datos sintéticos: no reintentar sobre el mismo destino.
La base de instalación posterior será otra base nueva, no la del ensayo.

## Adaptador y garantías de evidencia

`@libsql/client` está fijado a 0.18.0 en el lockfile raíz, licencia MIT. Se importa
`@libsql/client/web`: el entrypoint nativo no dispone del binding Windows ARM64
en esta instalación. La variante HTTP no necesita ese binding ni instala runtimes.

El adaptador es asíncrono y cada transacción recibe su propio manejador. Serializa
las transacciones de una instancia, espera el commit, cierra los manejadores y no
reintenta escrituras. Una confirmación de commit perdida se marca
`COMMIT_UNCONFIRMED`; no se afirma que una operación así se haya revertido. Los
enteros fuera del rango seguro se rechazan antes de perder precisión.

Las pruebas automáticas usan SQLite en memoria como doble asíncrono del contrato;
una prueba adicional usa el SDK HTTP real con transporte simulado. Comprueban la
lógica local, **no** conectividad, motor, cuotas, región o latencia de Turso. El
ensayo tampoco equivale a ejecutar las rutas del ERP, a concurrencia entre varios
servidores ni a una interrupción real de red durante COMMIT. El caso de confirmación
perdida del adaptador se inyecta de manera controlada.

## Puertas siguientes

Validación local del bloque 31: lint y compilación correctos; batería final de
537 pruebas en 33 archivos, incluidas 27 del ensayo/adaptador; 39 recorridos E2E y
5 de archivos compilados correctos. La ayuda del comando no conecta a servicios.
El helper PowerShell pasó análisis sintáctico y pruebas con entradas y proceso
simulados para éxito/fallo y restauración del entorno; no se introdujo un token
real. La instalación desde el lockfile no ejecutó scripts de dependencias y la
consulta de auditoría npm devolvió cero avisos en ese momento.

El acceso remoto sigue pendiente: el navegador disponible muestra la pantalla
de login de Turso, sin sesión iniciada. No se ha ejecutado el ensayo real ni
medido su latencia. Estas pruebas no acreditan las puertas siguientes.

1. **Acceso y compatibilidad remota:** cuenta Free, base desechable libSQL y token
   privado. Ejecutar el ensayo real y revisar tiempos: las transacciones libSQL
   interactivas tienen un límite de cinco segundos; deben dejar margen suficiente.
2. **Acceso asíncrono del ERP:** adaptar seguridad, permisos, idempotencia, operaciones
   y lecturas. Eliminar suposiciones síncronas, no añadir una selección implícita de
   backend ni fallback a una base vacía. Repetir pruebas de API y recorridos completos.
3. **Fotos:** almacenamiento firmado Cloudinary, imágenes limitadas/optimizadas,
   CDN de la cuenta permitida y retirada controlada de huérfanos; secretos solo servidor.
4. **Instalación y recuperación:** bootstrap remoto privado y base nueva sin muestras;
   copia de base y fotos fuera de Git, protección de secretos y ensayo de restauración.
5. **Render y aceptación:** configuración gratuita sin disco, orígenes reales exactos,
   IA desactivada, revisión del directorio público de personal, login tras proxy y
   facturación. Desplegar solo después de validar, comprobar versión servida, fotos,
   permisos, flujo principal, consola, móvil y despertar tras inactividad.

La cuenta de Render comparte horas, tráfico y compilaciones con otros proyectos.
No activar ampliaciones automáticas ni complementos de pago. Si una cuenta ya tiene
método de pago, verificar sus condiciones antes de declarar un techo de cero euros.
Revisar región y condiciones de tratamiento antes de introducir datos personales.
No usar pings periódicos para eludir la suspensión gratuita.

## Fuentes oficiales contrastadas

- [Render Free](https://render.com/docs/free): suspensión tras 15 minutos y arranque
  aproximado de un minuto; sin disco persistente; límites de uso y tráfico externo.
- [Turso: SDK y transacciones](https://docs.turso.tech/sdk/ts/reference) y
  [límites](https://docs.turso.tech/cloud/limitations).
- [Turso Free](https://turso.tech/pricing): cuota compartida por organización.
- [Cloudinary](https://cloudinary.com/pricing) y
  [créditos](https://cloudinary.com/documentation/billing_and_plans): recursos compartidos,
  no bolsas independientes de almacenamiento y tráfico.
