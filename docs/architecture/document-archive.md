# Archivo documental privado

## Alcance local

`/documentos` incorpora PDF, JPEG, PNG y WebP con clasificación persistida por local, título, fecha civil, tipo, proveedor opcional, etiquetas y notas. El escáner permite incorporar un archivo o unir hasta diez fotos ordenadas en un PDF generado en el dispositivo. Los borradores PDF del escáner también pueden guardarse en el archivo.

El panel consulta páginas de 24 documentos y filtra por texto, local, fechas, tipo, proveedor, etiqueta exacta, estado, gasto concreto y presencia/ausencia de vínculo contable. Los filtros aplicados se reflejan en la URL y se recuperan con Atrás/Adelante; los cambios pendientes requieren Aplicar. La API ajusta páginas fuera del rango al último resultado disponible. La ficha permite recuperar/descargar el original, editar clasificación con revisión optimista, archivar/reactivar y consultar autor e historial. Archivar es reversible y no borra el original.

El visor PDF usa PDF.js 6.3.289 (Apache-2.0), cargado bajo demanda, con trabajador servido por el propio frontend. Renderiza una página por vez en canvas, permite ampliarla, navegar y consultar su texto disponible; no instala el visor interactivo de anotaciones/formularios ni el sandbox de scripts de PDF. Los archivos permanecen en el dispositivo y la API local: el visor no usa servicios de conversión externos. Las imágenes tienen vista previa y el PDF original siempre se puede descargar.

Una ficha puede vincular un gasto existente del mismo local o crear uno tras confirmación explícita. Un gasto puede tener varios justificantes; un documento tiene como máximo un gasto. Subir, etiquetar como pagado o archivar nunca crea ni modifica importes automáticamente. Los gastos enlazan de vuelta a sus justificantes. No hay OCR automático ni conciliación contable.

## Persistencia y autorización

- Esquema 5: `documentos`, `documento_cambios`, referencias a usuarios/proveedores/gastos, índices y claves únicas de deduplicación. Esquema 6: estado de revisión, responsable, fecha límite, observaciones, autor/fecha de revisión e índice de la bandeja; los documentos existentes quedan pendientes, sin asignación automática.
- Propietario: ambos locales. Encargado: exclusivamente su local. Personal: sin acceso. Las comprobaciones son de servidor, incluida descarga, cambios de local y vínculos. Cada transacción revalida la sesión mediante `writeAsActor`.
- Originales privados fuera de `uploads`; nombres internos SHA-256, sin rutas aportadas por el cliente. Solo se descargan por la API autenticada; no hay URL pública ni token en URL. Respuesta `attachment`, `nosniff`, `private, no-store` y CSP restrictiva. Los objetos de vista previa se revocan al cerrar/salir.
- `DOCUMENTS_DIR` configura almacenamiento local persistente. SQLite usa por defecto `documents` junto a su base; ese directorio por defecto se excluye de Git. Mantenerlo fuera de cualquier raíz pública o sincronización de código. Permisos del sistema operativo y cifrado del disco siguen siendo responsabilidad del entorno.
- **Turso/Netlify no tienen aún un adaptador de archivos privados**: se devuelve 503 sin hacer un fallback efímero ni enviar documentos al catálogo Cloudinary. Este módulo no acredita despliegue remoto.

## Integridad, límites y reintentos

Máximo 10 MB por archivo, diez fotos por PDF y 250 MB en el almacén local. PDF protegido con contraseña o con indicadores de contenido activo/enlaces se rechaza con indicación de exportar una copia estática. Las firmas y el bloqueo conservador no sustituyen un antivirus ni garantizan ausencia de contenido malicioso. No ejecutar acciones, scripts, adjuntos o enlaces de PDF.

Los archivos se escriben exclusivamente, se sincronizan antes de crear su referencia y se verifican por SHA-256 al descargar. El almacén está diseñado para una sola instancia escritora local; no es un volumen compartido multiinstancia. Una escritura de BD fallida o incierta puede dejar un archivo sin referencia: se conserva, cuenta para la cuota y se incluye en la copia. No se purga automáticamente, porque un COMMIT desconocido no acredita rollback. Una interrupción durante la escritura de archivo puede requerir reparación manual; nunca se sobrescribe un hash existente alterado.

Cada alta exige UUID de idempotencia. La clave de usuario y la huella se confirman atómicamente con la ficha y su historial; cambiar el cuerpo con la misma clave devuelve conflicto. La huella única `(local, sha256)` evita incorporar los mismos bytes dos veces en un local, también si el documento está archivado. No detecta dos fotografías distintas de la misma factura ni un PDF regenerado con bytes diferentes.

Mientras el modal siga abierto, un alta de resultado desconocido conserva cuerpo y clave exactos en memoria. No se envía de nuevo automáticamente, no se almacena en localStorage y no se traslada la foto a otra ruta. Salir/recargar pierde el intento; hay que consultar el archivo antes de repetir. Un gasto creado desde documento se liga en la misma transacción: el reintento idéntico devuelve el ya ligado, y una revisión antigua no permite crear otro después de desvincularlo. Los errores conservan los formularios hasta cerrar/actualizar expresamente.

## Revisión de interacción y consistencia

La revisión posterior refuerza la protección de borradores: cerrar, Escape, actualizar o abrir el gasto desde una ficha modificada exigen confirmar el descarte. Cambiar de sección conserva los campos; guardar clasificación conserva la sección abierta. Las operaciones que descartarían otro borrador se bloquean o requieren confirmación. La etiqueta pendiente se incorpora al guardar, sin perderla al alcanzar el límite. Se solicita aviso del navegador antes de recargar/cerrar con datos pendientes; sigue sin existir persistencia del borrador entre sesiones.

La confirmación de escritura vive fuera del editor: aunque falle la lectura posterior, se muestra que el cambio fue confirmado y solo se reintenta la consulta. Cambiar la búsqueda de gastos limpia la selección previa. Las lecturas validan fechas UTC reales y páginas completas, sin convertir respuestas parciales en resultados válidos.

Antes de consumir espacio privado se comprueban proveedor, duplicados y recibos existentes en una transacción; después de escribir el archivo se revalidan dentro de la transacción definitiva. No se mantiene la transacción abierta durante I/O ni se purgan archivos de escrituras inciertas.

Las imágenes se pueden ampliar dentro de un panel desplazable con teclado, sin desbordar la ficha. Los errores de decodificación se explican conservando la descarga del original. El visor PDF conserva el foco de los controles durante los cambios de página y permite desplazar la página con teclado. Las cabeceras de los formularios mantienen accesible el cierre durante el desplazamiento. El escáner diferencia archivo persistente de conversión rápida a PDF.

## Bandeja de revisión documental

Cada ficha conserva estado `pendiente`, `en_revision` o `revisado`, responsable opcional, fecha límite civil y observaciones. Solo pueden asignarse usuarios activos con rol propietario o encargado del mismo local. Empleados y encargados de otro local no pueden acceder ni ser responsables. La asignación no amplía permisos.

La bandeja ofrece pendientes, en revisión, revisados, fuera de plazo, sin responsable y asignados a mí. Sus contadores abarcan todos los documentos activos del local seleccionado, independientemente del resto de filtros; los accesos rápidos limpian expresamente esos filtros. Las vistas de trabajo ordenan por fecha límite y sitúan al final los documentos sin plazo. El vencimiento se compara con el día civil que envía el dispositivo; es una fecha documental, no de pago. Los filtros quedan en la URL.

`PUT /api/documentos/:id/revision` exige la revisión optimista actual y revalida sesión, local y responsable en una transacción junto al historial/auditoría. Marcar revisado pide confirmación y guarda autor y fecha UTC. Cambiar clasificación o vínculo contable de un documento revisado lo devuelve a pendiente; moverlo de local también limpia su responsable. Archivar sin modificar la clasificación conserva la revisión, pero bloquea sus cambios hasta reactivarlo. No se registran pagos ni se modifican importes. Los borradores de revisión están protegidos igual que los de clasificación y gasto; cada sección permite descartar solo su propio borrador.

## Paquete mensual para gestoría

Selección explícita por local y mes de la fecha documental, no de la fecha del gasto. Por defecto incluye únicamente documentos activos revisados; incluir pendientes/en revisión requiere marcar una opción. El propietario puede reunir ambos locales y cada encargado queda limitado al suyo. No aplica silenciosamente los filtros del archivo.

1. `GET /api/documentos/paquete` devuelve vista previa completa y huella de selección.
2. `POST /api/documentos/paquete` exige esa huella, verifica todos los originales y genera un ZIP con `fflate` 0.8.3 (MIT). Se permiten como máximo 100 documentos y 50 MB de originales, con una preparación simultánea por instancia.
3. Después de leer/comprimir fuera de la transacción, vuelve a comprobar permisos y selección antes de responder. Cambios simultáneos, originales ausentes/alterados o sesión revocada bloquean la entrega completa; nunca se ofrece un ZIP parcial.

Carpetas: `Aguacate/AAAA-MM/tipo/documento-ID.ext` y `Salmon/AAAA-MM/tipo/documento-ID.ext`. Los originales conservan sus bytes; `indice.html` permite abrirlos tras extraer el ZIP completo y `indice.json` recoge clasificación, responsable, vínculo de gasto y SHA-256. El índice escapa contenido de usuario, no incluye scripts y solo enlaza rutas controladas. `LEEME.txt` explica su uso y límites.

El ZIP no está cifrado, no se envía a terceros, no archiva documentos y no constituye conciliación ni presentación fiscal. Su descarga debe guardarse y compartirse mediante un canal autorizado. Las URLs de descarga en memoria se revocan al cerrar o cambiar alcance. No hay persistencia de ZIPs en servidor. Quedan fuera OCR, pagos, conciliación, envío automático y almacenamiento privado remoto.

## Procedimiento de copia y recuperación

Con las escrituras detenidas:

```text
npm run recovery -- backup --database ABS_DB --uploads ABS_PUBLICOS --documents ABS_PRIVADOS --output NUEVO_ABS --offline
npm run recovery -- verify --backup ABS_COPIA
npm run recovery -- restore --backup ABS_COPIA --output NUEVO_ABS --offline
```

Una base con documentos exige `--documents`: no se acepta una copia que solo conserve metadatos. El manifiesto incluye originales privados, tamaños y SHA-256; se comprueban todas las referencias. La restauración ensaya migraciones sin alterar origen, comprueba las tablas de negocio/historial y revoca las sesiones copiadas. Las copias previas sin documentos siguen siendo compatibles.

## Verificación

Las pruebas aisladas cubren permisos por local/rol, archivo no público, clasificación y filtros, validación, idempotencia concurrente, revisión obsoleta, gasto atómico y rollback por fallo de auditoría, corrupción de archivos, copia/restauración y migración desde esquema 4. Componentes: lecturas completas, fallos, formularios conservados, respuestas tardías y claves exactas. Navegador: escaneo multipágina, descarga real, gasto, navegación bidireccional, archivado/reactivación y acceso tras nueva sesión. La pantalla sigue siendo diferida y no carga el generador PDF en el acceso inicial.

Comprobación local del bloque (20/09/2026): lint, 751 pruebas unitarias/componentes, TypeScript y compilación; batería de navegador aislada y seis pruebas compiladas, incluido el visor PDF. El ensayo de recuperación de la demo preserva trece documentos y sus vínculos sin añadir gastos. No constituye validación de un despliegue remoto.

Segunda revisión del 20/09/2026: lint, 767 pruebas unitarias/componentes y compilación correctos; batería completa de navegador y seis pruebas compiladas correctas. Las regresiones documentales incluyen Escape sin descarte, ampliación a 320 px, guardado real con lectura fallida inducida, recuperación sin repetir PUT y navegación de filtros. La comparación de negocio y originales con la copia anterior es idéntica. No se ha activado almacenamiento remoto.

Ampliación de revisión y paquetes del 20/09/2026: lint, 787 pruebas unitarias/componentes y compilación correctos; batería completa de navegador y seis recorridos compilados correctos. El nuevo recorrido descarga/descomprime un ZIP real, compara los bytes originales y verifica que los gastos no cambian. Incluye tamaños de 320, 390 y 1280 px; pruebas de conflictos, permisos revocados durante lectura, selección modificada durante preparación y concurrencia. El comando de pruebas compiladas también crea su sandbox de originales mediante el ejecutor común. Migración 5→6 ensayada sobre copia, historial y datos de negocio conservados. Sin despliegue remoto.
