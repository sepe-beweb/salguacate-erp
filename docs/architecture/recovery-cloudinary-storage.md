# Almacenamiento de fotos preparado para Cloudinary

## Alcance del bloque 34

Se añade un almacén de imágenes intercambiable. El modo local conserva PNG/JPEG
en `/uploads` y el modo Cloudinary guarda referencias HTTPS versionadas. No se
copia una foto al disco local si falla el proveedor remoto.

La API acepta únicamente el contenido PNG/JPEG enviado, con cabecera y base64
válidos y límite de 3 MB. No acepta URLs para que el servidor descargue imágenes.
El proveedor realiza la decodificación remota; el control local de cabecera no
es un analizador completo del formato ni un antivirus.

Las llamadas salen del backend al endpoint HTTPS fijo de Cloudinary, con
autenticación en cabecera, límite de tiempo, sin seguir redirecciones ni
reintentar automáticamente. No se habilitan presets de subida anónima, IA,
transformaciones adicionales ni sobrescritura de assets. La implementación sigue
la [API oficial de subida](https://cloudinary.com/documentation/upload_images)
y la [referencia de subida/borrado](https://cloudinary.com/documentation/image_upload_api_reference).

Cada subida usa un UUID dentro de `salguacate/inventory`. Se verifican cuenta,
identificador, tipo, versión, tamaño, formato y URL devueltos. No se imprime el
cuerpo de error del proveedor. Un fallo SQL confirmado intenta retirar únicamente
la imagen creada por esa operación; un COMMIT incierto conserva el asset. Una
subida cuya respuesta se pierde puede dejar un asset sin producto: no se afirma
que no exista ni se borra por aproximación. Requiere conciliación operativa.

La subida se realiza fuera de la transacción y el actor se revalida dentro de la
escritura posterior. Si cierra sesión mientras sube, no se crea el producto.

## Configuración explícita

En la API:

- `IMAGE_STORAGE=cloudinary`.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET` mediante
  configuración privada del servicio, nunca Git, URLs ni chat.
- No establecer `UPLOADS_DIR` al usar Cloudinary. La mezcla se rechaza al arrancar.

En la compilación del frontend: `VITE_CLOUDINARY_CLOUD_NAME`, solo el nombre
público de esa misma cuenta, además de `VITE_API_URL`. El secreto y la API key no
usan prefijo `VITE_`. El catálogo rechaza otros hosts, cuentas, carpetas, formatos,
parámetros y fragmentos. Las imágenes se solicitan directamente al CDN sin
cabecera de referencia; no pasan por el disco ni por un proxy de archivos Render.

Las fotos siguen siendo públicas para quien conozca su URL. No subir documentos
personales, tickets con datos privados ni otros archivos ajenos al catálogo.

## Validación y puerta pendiente

- `npm run check`: lint, 592 pruebas en 37 archivos, TypeScript y compilación correctos.
- Los 39 recorridos E2E previos vuelven a pasar, incluida subida/lectura local de PNG/JPEG.
- Un recorrido móvil nuevo comprueba la carga del CDN permitido y el rechazo de
  otra cuenta, con todas las peticiones Cloudinary interceptadas (40 casos en total).
- Los cinco recorridos de archivos compilados pasan con la cuenta CDN sintética.

Las pruebas nuevas cubren contratos de subida/retirada, metadatos falsos,
timeouts/errores sin secretos ni reintento, ausencia de fallback, compensación,
revocación durante la subida y destinos del navegador. El transporte Cloudinary
es **simulado**: no se ha validado aún una subida ni descarga contra la cuenta real.

Se ha abierto el registro Free al titular para que complete personalmente acceso
y condiciones. No se ha creado ni guardado ninguna clave Cloudinary, activado una
suscripción, añadido tarjeta ni desplegado el ERP. Antes de la activación faltan
el ensayo PNG/JPEG real, la comprobación del plan/cuenta, bootstrap y arranque
remotos, copias/retirada de assets y aceptación de exposición pública.

Las herramientas de backup SQLite + uploads locales **no** respaldan Cloudinary:
rechazan referencias no locales. No interpretar una copia de la base como una
copia de sus imágenes remotas ni retirar esa protección sin nuevo procedimiento.
