# Estado de recuperación y puertas de salida

Consolidación documental del bloque 28, actualizada con fotos, [alta de instalación nueva del bloque 30](recovery-fresh-install.md) y [ensayo de alojamiento gratuito del bloque 31](recovery-free-hosting.md). Decisión vigente: no hay datos anteriores que conservar; no se realizará migración histórica. Se aprueba preparar el piloto Render + Turso/libSQL + Cloudinary, empezando por compatibilidad remota. No se han borrado instalaciones ni habilitado despliegues. Rama de trabajo: `refactor/recovery-foundation`; `main` no se ha fusionado desde esta continuación.

## Evidencia de la base candidata

El bloque 33 publicó `7d97313bdf6685b6ec7f72dc0eb28cd2d76dca0b`, con
[CI correcta](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35451650477),
559 pruebas y recorridos 39/5, además del ensayo HTTP Turso descrito en su informe.
El [bloque 34](recovery-cloudinary-storage.md) publica el almacén Cloudinary como
`edb5ecea37b9666653d2da20ba1067e28167ed18`, con
[CI correcta](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35452347156).
El [bloque 35](recovery-cloudinary-probe.md) verifica subida, lectura y retirada
reales de PNG/JPEG, con clave temporal ya desactivada. Su validación local reúne
600 pruebas y [CI correcta](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35458105893).
El [bloque 36](recovery-remote-startup.md) añade arranque remoto explícito con
verificación de esquema/propietario, 625 pruebas locales y sin activar un servicio.
Su [CI está correcta](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35458569445).
El [bloque 37](recovery-remote-bootstrap.md) prepara el bootstrap remoto atómico,
con 646 pruebas y [CI correcta](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35459183799).
El alta real en la base nueva terminó correctamente con propietario ID 1, sin
muestras y con verificación posterior; el titular introdujo su PIN personalmente.
El acceso temporal se revocó en el panel al finalizar, sin desplegar Render.

Ampliación local del bloque 31: lint y compilación correctos, batería final de
537 pruebas en 33 archivos (27 nuevas del ensayo/adaptador), 39 recorridos E2E y
5 de archivos compilados correctos. El SDK HTTP usa transporte simulado y las
pruebas SQL usan un doble asíncrono local: **no hay validación Turso remota**.
El [bloque 32](recovery-turso-compatibility.md) añade siete comprobaciones reales
correctas contra Turso/libSQL en una base desechable. El [bloque 33](recovery-async-api.md)
adapta las rutas al acceso asíncrono y supera seis grupos HTTP contra Turso real,
con sesiones sintéticas ya revocadas; el arranque ordinario sigue siendo local.
La evidencia histórica siguiente
corresponde a los bloques anteriores y no sustituye la CI del nuevo commit.

La base de panel/catálogo se publicó con el bloque 27 y la ampliación de fotos como `ccccf5c633fc42880928b50ed805388f246a00a8`, con [CI correcta del bloque 29](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35444372055), correspondiente a 496/39/5 pruebas. El bloque 30 añade el bootstrap explícito; su evidencia local no se atribuye a esa CI anterior. Base validada con Node 22.23.2 y Chrome instalado en Windows:

- `npm run check`: lint, 510 pruebas de API/componentes, TypeScript y compilación correctos, incluida la ampliación del bloque 30.
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
| Migración de datos existentes | No aplicable a la decisión vigente | No hay datos anteriores que conservar; no se han borrado instalaciones |
| Instalación nueva | Alta remota confirmada, propietario ID 1 y sin muestras; acceso temporal retirado | Falta login del titular, credenciales operativas y ensayo conjunto antes del despliegue |
| Compatibilidad Turso/libSQL | Base y rutas HTTP ensayadas en Irlanda | [Compatibilidad](recovery-turso-compatibility.md) y [API asíncrona](recovery-async-api.md), cuenta Free; no son despliegue ni navegador contra Turso |
| Fotos Cloudinary | PNG/JPEG remotos verificados desde API local | [Ensayo real](recovery-cloudinary-probe.md), bytes idénticos y retirada confirmada; clave temporal desactivada, sin despliegue |
| Aceptación operativa y seguridad de exposición | Pendiente | Reglas por local, acceso público, dispositivos y operación descritos abajo |
| Merge, activación y despliegue | No realizados | Decisión específica, instalación aceptada y procedimiento de copia/vuelta |

## Siguiente paso: publicar el piloto gratuito

La creación del servicio Render se bloqueó por verificación de tarjeta; no se creó
una URL operativa. Se continúa con [Netlify Free](../netlify-deploy.md): equipo personal
Salguacate creado, 300 créditos y sin tarjeta comprobados en el panel. El envío de
credenciales se ha autorizado para Netlify en lugar de Render. El adaptador Lambda
y el TOML tienen validación local: 658 pruebas, lint, compilación y paquete importable
con el empaquetador predeterminado; no acreditan publicación remota. La sesión del
panel volvió a solicitar login antes de conectar un repositorio o crear un proyecto.

La [API asíncrona](recovery-async-api.md) conserva transacciones, autorización y
recibos y ya tiene evidencia HTTP con Turso. Las fotos tienen evidencia real
independiente con Cloudinary. El arranque remoto explícito está preparado y
validado localmente; el bootstrap remoto ya terminó con entrada privada del titular
en la base nueva. Aún faltan login remoto del titular, ensayo conjunto, backup remoto
y despliegue. El titular ha autorizado priorizar una URL accesible y posponer el
pulido funcional. El blueprint se adapta a API Free sin disco, Turso y Cloudinary,
según el [procedimiento de Render](../render-deploy.md); todavía no se ha aplicado
en la cuenta. La clave temporal Cloudinary no es una credencial operativa.

## Instalación nueva local disponible

Seguir el [procedimiento de alta inicial](recovery-fresh-install.md) para una instalación local distinta, eligiendo destino y propietario. El modo explícito exige un archivo nuevo, no lee `.env`, recibe el PIN por stdin y no inserta muestras. No se ha creado una instalación operativa local; el propietario real se ha creado exclusivamente en la base Turso nueva mediante el procedimiento remoto anterior. El PIN se introduce en un prompt privado del equipo, no en el chat.

La ausencia de históricos elimina el ensayo de migración como bloqueo de esta instalación, pero no demuestra que exista un servicio nuevo ni elimina la aceptación operativa, los permisos o el backup a partir del primer dato útil. IA y comunicaciones externas permanecen desactivadas durante el arranque local.

Si más adelante cambia la decisión y aparece una base que deba conservarse, recuperar el [procedimiento de backup y ensayo aislado](recovery-data.md) antes de abrirla o migrarla. No se puede dar por superado con fixtures. La herramienta no cifra copias, autentica procedencia, copia secretos de configuración ni demuestra recuperación frente a corte eléctrico o grandes volúmenes.

## Límites vigentes que no deben perderse

- **Sesión y borradores:** solo memoria del navegador; recargar/cerrar pierde la sesión y los borradores locales. La protección idempotente cubre notas/gastos con la misma clave, no todas las altas ni similitud entre documentos. Los recibos no se purgan automáticamente; falta definir retención operativa sin romper deduplicación.
- **Personal y locales:** se conserva el alcance actual de los gestores. No se inventan políticas multilocal, solapamientos de turnos ni reglas de jornada. La salida de plantilla debe conciliar fichajes abiertos sin inventar horas. El panel muestra la última lectura, no presencia en tiempo real.
- **Históricos financieros:** columnas REAL heredadas, cálculos cliente/servidor protegidos en céntimos donde se han recuperado; esto no es contabilidad fiscal. No se corrigen totales históricos discrepantes para hacerlos cuadrar.
- **Exposición del servicio:** el selector público revela nombres y roles. Hay que decidir si se mantiene antes de exponerlo en Internet. Las cuotas de login por IP no confían en proxies arbitrarios; revisar proxy/topología y usuarios compartiendo IP antes de producción.
- **SQLite y runtime:** esquema actual 2, una instancia con volumen persistente; no es arquitectura distribuida. SQLite sigue siendo experimental en Node 22 y ESLint 8 requiere una actualización planificada. La consulta de dependencias del primer bloque fue puntual, no una auditoría permanente de seguridad.
- **Fotos:** son públicas por URL; no almacenar documentos personales. El lector cliente, los rechazos y la subida/lectura real de PNG y JPEG sintéticos están cubiertos mediante almacenamiento temporal aislado. Sigue pendiente la aceptación en la nueva instalación y con la infraestructura aprobada; no se ha validado el volumen remoto.
- **IA, voz y comunicaciones externas:** siguen sin validación integrada activada. PDF local no prueba extracción IA. No se han enviado documentos reales, usado micrófono ni enviado pedidos por WhatsApp. Consentimiento y destinos requieren revisión específica.
- **Ajustes, Android, TPV y fiscalidad:** varias filas de Ajustes son informativas sin editor. El wrapper antiguo y los planes TPV/TicketBAI no son producto recuperado ni cumplimiento certificado. Requieren definir alcance antes de continuar esas funciones.
- **Accesibilidad y dispositivos:** hay pruebas de teclado, diálogos y anchura móvil en Chromium, no certificación integral ni prueba en dispositivos físicos o todos los motores.

## Publicación y comprobaciones posteriores

La [CI](../../.github/workflows/ci.yml) ejecuta check, navegador y archivos compilados; no publica servicios. El [workflow de Render](../../.github/workflows/render-deploy.yml) es manual, depende de validación y limita el disparo a `main`. Sus hooks son opcionales: un workflow verde no demuestra que existan ni que se haya desplegado. No se invocaron en esta recuperación.

`render.yaml` declara despliegue automático desactivado, API Free sin disco y almacenamiento remoto explícito, pero no confirma la configuración remota efectiva. Antes de publicar se deben revisar destinos Turso/Cloudinary, rutas, orígenes HTTPS, URL de API compilada, copias y política de conservación de assets/HTML. Después de una publicación autorizada, comprobar versión realmente servida, disponibilidad, login y flujo clave, imágenes, consola y vista móvil; HTTP 200 o CI correcta no bastan.

## Cómo mantener este estado

Actualizar este documento al superar una puerta con evidencia nueva. Mantener los [informes por bloque](README.md) como historial sin reescribir sus resultados antiguos como si fueran actuales. El bloque 28 comprobó 75 enlaces locales y la presencia de los 27 informes previos en el índice, además del contraste con scripts/configuración; no se le atribuyen nuevas pruebas de negocio ni una migración real.
