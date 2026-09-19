# Ensayo remoto de fotos de catálogo

## Bloque 35: evidencia del 19 de septiembre de 2026

El bloque 34 está publicado como `edb5ecea37b9666653d2da20ba1067e28167ed18`,
con [CI correcta](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35452347156).
Este bloque añade un ensayo explícito, que no se importa desde el arranque normal.

Se comprobó la cuenta personal Cloudinary Free: $0, 25 créditos y uso inicial cero.
Se creó una clave independiente, sin reutilizar Root. El primer intento con el rol
Media Library User no confirmó la subida y se detuvo; no se registró su estado
HTTP, por lo que no se atribuye una causa definitiva a ese fallo. La búsqueda de
Salguacate en la biblioteca no encontró assets, pero no es una prueba exhaustiva
de inexistencia de un recurso cuya respuesta se perdió.

Con autorización específica se amplió temporalmente esa misma clave a Master
Admin del entorno. El segundo ensayo terminó correctamente. Al finalizar se
confirmó la desactivación de la clave de ensayo y que Root seguía activa. No se
guardaron secretos en archivos, Git ni chat, ni se enviaron a Render.

Los roles de carpeta de claves se asignan mediante la API administrativa según
la [documentación de permisos](https://cloudinary.com/documentation/dam_admin_permissions).
La clave temporal amplia **no** es la decisión de permisos de producción: antes
de activar un servicio, definir un entorno dedicado o permisos acotados y una
credencial operativa independiente. No reactivar silenciosamente la de ensayo.

## Recorrido comprobado

`runCloudinaryProbe` usa una SQLite nueva en memoria, un propietario sintético sin
PIN y una sesión aleatoria de diez minutos. Sirve la API en loopback y da de alta
dos productos mediante `POST /api/inventario`; comprueba la referencia persistida
y su entrega por `GET /api/inventario`. No modifica una instalación existente.

El navegador codificó dos dibujos geométricos de 12 × 8 píxeles, sin archivos ni
datos personales. La API los subió con el almacén real Cloudinary. Las descargas
del CDN no recibieron credenciales y coincidieron exactamente con los bytes
originales:

| Formato | Tamaño | Alta, lectura y descarga | SHA-256 |
| --- | ---: | ---: | --- |
| PNG | 141 bytes | 1997 ms | `5b4f36cfbeda6354b48651ace16696f369e2de0a24ad6cd22e2ccdd4fe1ee560` |
| JPEG | 875 bytes | 855 ms | `3cae27c4b408df3657c4221969fc8191399adac34068d095efa1eeacebe5575c` |

Las dos subidas y las dos retiradas devolvieron HTTP 200, con metadatos y resultados
validados. Solo se retiraron los UUID creados por el ensayo; no se purgaron carpetas
ni muestras de la cuenta. La invalidación solicitada no acredita que todas las
cachés públicas del CDN se hayan vaciado inmediatamente.

El receptor privado local fue de un solo uso: origen/Host exactos, ruta aleatoria,
campos de contraseña, CSP, sin caché y límite temporal. El proceso terminó y se
cerró su pestaña. La base, productos y sesión solo existieron en memoria.

## Repetición segura y límites

La función exige confirmación exacta del entorno, dos imágenes PNG/JPEG de menos
de 64 KiB y configuración privada explícita. No carga `.env`, no arranca en CI
contra una cuenta real y no repite escrituras. Conserva únicamente estados HTTP
e identificadores generados, nunca cuerpos ni diagnósticos del proveedor. Retira
solo handles confirmados; si la respuesta se pierde, informa incertidumbre y
requiere conciliación, sin borrar recursos por aproximación.

- `npm run check`: lint, **600 pruebas en 38 archivos**, TypeScript y compilación correctos.
- Ocho casos nuevos ejercitan el ensayo HTTP con transporte Cloudinary simulado:
  éxito, rechazo 403, fallos de subida/descarga/retirada y entradas inválidas.
- Los recorridos de navegador 40/5 son evidencia de la CI del bloque 34; no se
  atribuye al ensayo remoto una interfaz de navegador conectada a Cloudinary.

Este resultado prueba API local + SQLite efímera + Cloudinary real. No acredita
Turso y Cloudinary juntos, login por PIN remoto, arranque en Render, backup de
imágenes, seguridad de exposición pública ni aceptación del usuario. Continúan
pendientes el arranque/bootstrap remotos explícitos y el despliegue gratuito.
