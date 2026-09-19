# Carga por rutas y recuperación de módulos

## Estado y alcance

Sexto bloque local de `refactor/recovery-foundation`. El quinto se publicó como `165d5bc` y pasó [CI](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35419721827). Este documento describe cambios locales posteriores, no su publicación ni un despliegue.

Las 18 pantallas funcionales se cargan al acceder a su ruta. Login, renovación de PIN, sesión, navegación y el asistente global permanecen en el arranque. Se conservan URLs, selección de rutas por rol y contratos de API; no hay nuevas dependencias.

## Comportamiento

- `React.lazy` se declara fuera de los componentes, con imports estáticos y explícitos. No se vuelven a crear pantallas al cambiar el tema o renderizar el layout.
- `Suspense` muestra un estado accesible de carga dentro del área de contenido. El menú, encabezado y cierre de sesión permanecen disponibles.
- `ScreenBoundary` contiene fallos de carga y de renderizado de la pantalla. No imprime la excepción en la interfaz, no reintenta escrituras ni recarga automáticamente.
- El límite de error se reinicia al cambiar de ruta, usuario o rol. Una sección distinta puede abrirse aunque la anterior esté rota.
- Una importación rechazada queda en caché. No se ofrece un falso botón de reintento de ese mismo módulo: se permite navegar o recargar con confirmación explícita de pérdida de sesión local, borradores y PDF no guardados.
- La sesión sigue siendo exclusivamente en memoria. Una recarga exige autenticarse otra vez; no introduce almacenamiento de tokens ni cambia su expiración/revocación en el servidor.
- Un empleado que intenta abrir una URL de gestión vuelve a su inicio sin descargar esa pantalla. Esto no sustituye la autorización del servidor, que permanece intacta.

No se añaden recargas globales ante `vite:preloadError`, bucles de reintento ni parámetros aleatorios para evitar la caché. La generación de PDF conserva su propia carga bajo demanda.

## Medición y protección de tamaño

Antes, el archivo principal medía 799,41 kB minificado. Tras separar rutas, el arranque completo de JavaScript ronda 220,16 kB incluyendo sus dependencias estáticas: aproximadamente un 72 % menos. No es una medida de tiempo de carga ni una reducción equivalente de todo el código descargable. Las pantallas y sus dependencias se descargan cuando se usan.

`scripts/check-web-bundle.cjs` lee el manifiesto generado por Vite y recorre todas las dependencias estáticas del entry, sin contar imports dinámicos como descarga inicial. El presupuesto es 250.000 bytes de JavaScript y 85.000 bytes gzip, sumando cada archivo una sola vez. Comprueba también las 18 entradas de pantalla diferidas. Si se amplían las rutas o el presupuesto debe revisarse esa decisión, no subir el límite para ocultar una regresión.

La suma gzip del script usa `gzipSync` de Node y no es directamente intercambiable con la cifra individual presentada por Vite. La compresión HTTP efectiva depende del servidor. CSS, HTML, imágenes, datos de API y scripts de extensiones no entran en este presupuesto.

## Validación reproducible

- `npm run check`: lint, pruebas de API/componentes, TypeScript y build habitual.
- `npm run test:e2e`: batería funcional existente en desarrollo con API real y SQLite en memoria.
- `npm run test:e2e:production`: recompila con la API local de pruebas, comprueba el presupuesto y sirve los archivos con Vite preview. No usa ni publica servicios de producción. Reserva los mismos puertos 5174/3101 que la batería de desarrollo; deben ejecutarse secuencialmente y no reutilizan servidores.
- CI incorpora la nueva batería después de la anterior. El resultado remoto del quinto bloque no acredita todavía esta ampliación de CI.

Las pruebas compiladas comprueban descarga diferida antes/después del login, caché entre visitas, cierre de caja y gráficos, módulo ausente, confirmación/cancelación de recarga, nueva autenticación, navegación durante descarga lenta, respuesta tardía y acceso de empleado a URL de gestión. Los fallos de módulo y el retraso se inyectan en el navegador; la interfaz compilada y la API de prueba son reales. No se simula un despliegue remoto.

Las pruebas de componentes cubren Suspense, import rechazado, error de render, estado independiente de otro componente y reinicio por clave. Se silencian solo las excepciones sintéticas esperadas dentro de esos tests, no errores de producto.

Resultado local final: lint, 122 pruebas (64 API y 58 componentes/helpers), TypeScript y build correctos; 15 recorridos funcionales y 4 de archivos compilados pasan. El presupuesto registra 220.159 bytes iniciales y 69.838 bytes gzip en dos archivos estáticos. La vista del error a 390 px conserva la navegación y no desborda horizontalmente. Ya no aparece el aviso de chunks superiores a 500 kB, sin modificar su umbral; persiste el aviso conocido de SQLite experimental.

## Límites y siguiente bloque

La protección cubre el contenido de rutas, no errores anteriores al arranque de React ni fallos del layout global o del asistente. Navegar fuera de un formulario sigue descartando su estado local como antes; no hay persistencia nueva de borradores. Una carga que no termina permite salir de la ruta, pero no tiene un timeout artificial. No se ha medido rendimiento en móviles físicos ni con la red de un cliente.

Antes de desplegar hay que revisar la política del HTML y la conservación de assets antiguos en el alojamiento para evitar referencias a archivos retirados. No se han cambiado cabeceras remotas, Render, Android, datos reales ni integraciones externas.

Siguiente bloque propuesto: evitar duplicados al recuperar respuestas perdidas en altas de notas y gastos, con idempotencia en la API y pruebas transaccionales, sin reenvíos automáticos.

## Fuentes técnicas

[React lazy](https://react.dev/reference/react/lazy) documenta la carga bajo demanda y la caché del resultado/promesa; [Suspense](https://react.dev/reference/react/Suspense) describe el fallback durante carga. [Vite: errores de carga](https://vite.dev/guide/build#load-error-handling) explica los módulos ausentes tras cambios de assets. La implementación y las pruebas se ejecutan con las versiones fijadas en el lockfile del proyecto.
