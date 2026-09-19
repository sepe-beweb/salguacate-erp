# Fotos de catálogo: persistencia comprobada en entorno desechable

Vigésimo noveno bloque. Amplía la evidencia que faltaba en el [estado consolidado](recovery-status.md), sin cambiar el comportamiento del catálogo ni su API de producto. La consolidación anterior se publicó como `e44edd276d371fae95c73c2d7fc11e33f85bd8ed`, con [CI correcta](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35443995331).

## Aislamiento del arnés

`npm run test:e2e` crea, además de una API en memoria por archivo, un directorio de uploads exclusivo mediante `mkdtemp`. El proceso principal pasa esa ruta a su proceso hijo mediante una variable exclusiva de pruebas; no usa `UPLOADS_DIR`, `.env` ni rutas de la instalación. También funciona con una selección explícita de pruebas.

El servidor de pruebas acepta únicamente una ruta absoluta, existente, no enlazada y con el prefijo de sandbox bajo el directorio temporal real del sistema. Sin esa variable mantiene el comportamiento anterior sin almacenamiento; las pruebas de producción local, que no suben fotos, no lo necesitan.

El proceso principal valida otra vez la ruta antes de eliminar exclusivamente el directorio que creó, después de terminar Playwright. La limpieza se ejecuta también si el hijo falla. Las pruebas del helper comprueban creación vacía, separación de dos directorios, conservación del vecino, limpieza tras error y rechazo de raíces/rutas ajenas. Una terminación forzada del proceso principal o un bloqueo de archivos puede dejar un temporal: no se barre ni elimina por patrón ningún directorio previo.

## Qué prueba el navegador

Desde móvil se generan dos imágenes sintéticas en canvas (PNG y JPEG), se seleccionan en el formulario y se comprueba la vista previa. El guardado real crea el producto con una URL local aleatoria. Un GET sin bearer comprueba el contrato público actual, Content-Type y coincidencia exacta de bytes. El navegador verifica dimensiones decodificadas, no solo la existencia de una etiqueta `img`.

Después se recarga la aplicación, se vuelve a iniciar sesión y se comprueba que ambos productos conservan sus URLs y sus imágenes se renderizan. La base sigue siendo la API desechable de ese archivo; esto no prueba persistencia de SQLite tras reiniciar un servicio ni infraestructura remota. Los nombres distinguen el reintento de CI para no confundirlo con filas creadas por un intento fallido.

El recorrido anterior de conservación del borrador ahora inyecta explícitamente el 503 de almacenamiento antes de enviar la escritura. Ya no depende de que toda la API carezca de uploads. Es evidencia de recuperación de interfaz ante un fallo simulado; el nuevo recorrido de subida y lectura no simula la API ni los archivos. Los informes de los bloques 25 y 28 conservan su evidencia histórica anterior.

No hay imágenes personales, llamadas de IA, cambio de permisos públicos ni nuevas dependencias. Se revisa la captura móvil de los dos productos. La aceptación de imágenes sobre la copia real y sobre la infraestructura elegida sigue pendiente junto al ensayo de datos.

## Evidencia local final

`npm run check` correcto: 496 pruebas en 31 archivos, lint, TypeScript y build. Pasan los 39 recorridos de desarrollo y los 5 de producción local. El arranque sigue en 230281 bytes de JavaScript y 74026 gzip, con 19 pantallas diferidas. La revisión posterior encuentra cero directorios temporales de uploads de estas pruebas. Se comprueban también sintaxis de los scripts, diff y 77 enlaces locales de los documentos modificados.

El primer intento del nuevo recorrido falló porque esperaba el panel tras reautenticar desde inventario; se corrigió la expectativa del test para respetar el destino conservado y se repitieron las baterías. No se modificó la navegación del producto para hacer pasar esa prueba.
