# Estado de recuperación y puertas de salida

Consolidación documental del bloque 28, actualizada con la comprobación de fotos del [bloque 29](recovery-catalog-images.md). No modifica datos reales ni habilita despliegues. Rama de trabajo: `refactor/recovery-foundation`; `main` no se ha fusionado desde esta continuación.

## Evidencia de la base candidata

Último cambio de aplicación: `3f36cca46cc56baab072cf0fc2cfb49b0b7be45c` ([presencia y panel](recovery-presence-values.md)), publicado con [CI correcta](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35443710872). La consolidación del bloque 28 tiene también [CI correcta](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35443995331). Ambas CI corresponden a 493/38/5 pruebas; el bloque 29 amplía el arnés y sus pruebas sin cambiar la aplicación. La validación local de esa ampliación se recoge en su informe. Base validada con Node 22.23.2 y Chrome instalado en Windows:

- `npm run check`: lint, 496 pruebas de API/componentes, TypeScript y compilación correctos, incluida la ampliación del bloque 29.
- `npm run test:e2e`: 39 recorridos en 25 archivos, con una API, SQLite en memoria y uploads temporales nuevos por archivo.
- `npm run test:e2e:production`: 5 recorridos de archivos compilados servidos localmente, después de la batería anterior.
- Arranque JavaScript: 230281 bytes, 74026 gzip, 3 archivos estáticos; 19 pantallas diferidas. Presupuesto: 250000/85000 bytes. No incluye CSS, imágenes, API ni todos los módulos descargables, ni mide tiempo de carga en un móvil físico.

Los recorridos combinan operaciones contra una API desechable e inyección explícita de fallos/respuestas perdidas. Las extracciones visuales externas se simulan cuando una prueba necesita sus resultados. No son E2E de producción, de IA activada ni de documentos reales. El código ejecutable y el lockfile siguen siendo la fuente de verdad; las cifras de informes anteriores no se suman a estas.

## Puertas independientes

| Puerta | Estado comprobado | Evidencia o condición para avanzar |
| --- | --- | --- |
| Base técnica y flujos web cubiertos | Validación local correcta | Comandos anteriores; repetir al cambiar código/runtime |
| Publicación del código | Bloques publicados en la rama de recuperación | Verificar HEAD y CI de cada commit; no equivale a merge |
| Backup/restauración | Herramientas y pruebas desechables disponibles | [Procedimiento](recovery-data.md), incluida revocación de sesiones y conservación de recibos |
| Ensayo sobre datos existentes | Pendiente | Identificar origen exacto, copia autorizada, uploads y destinos aislados |
| Aceptación operativa y seguridad de exposición | Pendiente | Reglas por local, datos históricos, acceso público, dispositivos y operación descritos abajo |
| Merge, activación y despliegue | No realizados | Decisión específica, ensayo aceptado, backup recuperable y plan de vuelta |

## Siguiente paso recomendado: ensayo aislado

No buscar ni abrir por aproximación un `database.sqlite`, una exportación o un `.env` de otra instalación. Antes de trabajar con datos existentes se necesita:

1. Origen inequívoco: instalación, versión de código, ruta de SQLite o exportación Turso, directorio completo de uploads y quién confirma la coherencia de la copia. No compartir PIN, tokens o claves por el informe.
2. Autorización de la copia concreta para el ensayo, directorios nuevos fuera del repositorio y permisos privados de almacenamiento. Confirmar quién detiene escrituras; `--offline` no las detiene ni comprueba procesos.
3. `backup`, `verify` y `restore` según el procedimiento, conservando origen y artefacto. Una carpeta parcial o un `manifest.json` aislado no acredita éxito. No ejecutar bootstrap sobre datos existentes.
4. Comparación de recuentos/huellas, relaciones declaradas, recibos idempotentes, imágenes e historial; revisar también relaciones lógicas antiguas no protegidas por claves foráneas. Si hay duplicados, estados o imágenes incompatibles, acordar la conciliación sin borrar ni normalizar datos silenciosamente.
5. Aceptación funcional sobre la copia: propietario/encargado/empleado, renovación de PIN, revocación de sesiones anteriores, fichaje, cierre por fecha/local, stock/recepción, notas/gastos y consultas históricas. Mantener desactivadas las integraciones externas y no usar destinatarios reales.
6. Informe privado de resultado y decisión posterior. No activar el destino, modificar servicios ni apuntar la aplicación a la base real durante este ensayo. Una vuelta a código anterior requiere una copia previa compatible, no reutilizar la base migrada.

No se puede dar por superada esta puerta con fixtures. La herramienta de recuperación no cifra las copias, no autentica su procedencia, no copia secretos de configuración, no hace retención automática ni demuestra recuperación frente a corte eléctrico o grandes volúmenes.

## Límites vigentes que no deben perderse

- **Sesión y borradores:** solo memoria del navegador; recargar/cerrar pierde la sesión y los borradores locales. La protección idempotente cubre notas/gastos con la misma clave, no todas las altas ni similitud entre documentos. Los recibos no se purgan automáticamente; falta definir retención operativa sin romper deduplicación.
- **Personal y locales:** se conserva el alcance actual de los gestores. No se inventan políticas multilocal, solapamientos de turnos ni reglas de jornada. La salida de plantilla debe conciliar fichajes abiertos sin inventar horas. El panel muestra la última lectura, no presencia en tiempo real.
- **Históricos financieros:** columnas REAL heredadas, cálculos cliente/servidor protegidos en céntimos donde se han recuperado; esto no es contabilidad fiscal. No se corrigen totales históricos discrepantes para hacerlos cuadrar.
- **Exposición del servicio:** el selector público revela nombres y roles. Hay que decidir si se mantiene antes de exponerlo en Internet. Las cuotas de login por IP no confían en proxies arbitrarios; revisar proxy/topología y usuarios compartiendo IP antes de producción.
- **SQLite y runtime:** esquema actual 2, una instancia con volumen persistente; no es arquitectura distribuida. SQLite sigue siendo experimental en Node 22 y ESLint 8 requiere una actualización planificada. La consulta de dependencias del primer bloque fue puntual, no una auditoría permanente de seguridad.
- **Fotos:** son públicas por URL; no almacenar documentos personales. El lector cliente, los rechazos y la subida/lectura real de PNG y JPEG sintéticos están cubiertos mediante almacenamiento temporal aislado. Sigue pendiente la aceptación con la copia real y con la infraestructura aprobada; no se ha validado el volumen remoto.
- **IA, voz y comunicaciones externas:** siguen sin validación integrada activada. PDF local no prueba extracción IA. No se han enviado documentos reales, usado micrófono ni enviado pedidos por WhatsApp. Consentimiento y destinos requieren revisión específica.
- **Ajustes, Android, TPV y fiscalidad:** varias filas de Ajustes son informativas sin editor. El wrapper antiguo y los planes TPV/TicketBAI no son producto recuperado ni cumplimiento certificado. Requieren definir alcance antes de continuar esas funciones.
- **Accesibilidad y dispositivos:** hay pruebas de teclado, diálogos y anchura móvil en Chromium, no certificación integral ni prueba en dispositivos físicos o todos los motores.

## Publicación y comprobaciones posteriores

La [CI](../../.github/workflows/ci.yml) ejecuta check, navegador y archivos compilados; no publica servicios. El [workflow de Render](../../.github/workflows/render-deploy.yml) es manual, depende de validación y limita el disparo a `main`. Sus hooks son opcionales: un workflow verde no demuestra que existan ni que se haya desplegado. No se invocaron en esta recuperación.

`render.yaml` declara despliegue automático desactivado, pero no confirma la configuración remota efectiva. Antes de publicar se debe revisar volumen persistente, rutas, orígenes HTTPS, URL de API compilada, copias y política de conservación de assets/HTML. Después de una publicación autorizada, comprobar versión realmente servida, disponibilidad, login y flujo clave, imágenes, consola y vista móvil; HTTP 200 o CI correcta no bastan.

## Cómo mantener este estado

Actualizar este documento al superar una puerta con evidencia nueva. Mantener los [informes por bloque](README.md) como historial sin reescribir sus resultados antiguos como si fueran actuales. El bloque 28 comprobó 75 enlaces locales y la presencia de los 27 informes previos en el índice, además del contraste con scripts/configuración; no se le atribuyen nuevas pruebas de negocio ni una migración real.
