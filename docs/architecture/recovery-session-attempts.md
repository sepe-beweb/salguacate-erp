# Recuperación de guardados durante la sesión

## Estado y alcance

Octavo bloque publicado como `68adeb6` sobre `refactor/recovery-foundation`, con [CI correcto](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35422123480). Este documento no acredita despliegue.

Se amplía la recuperación de `POST /api/notas` y `POST /api/gastos` al navegar entre rutas en la misma sesión y pestaña. No cambia el contrato de API, los permisos, el esquema 2 ni los recibos persistentes del servidor.

## Propiedad y ciclo de vida

`AuthProvider` posee una instancia de `createPendingCreates` por inicio de sesión. No hay singleton compartido, serialización del almacén, almacenamiento local, almacenamiento de sesión ni IndexedDB para estos datos. Una nueva autenticación sustituye y cierra la instancia anterior, incluso si corresponde al mismo usuario.

Cada operación conserva como máximo un intento: clave UUID, cadena JSON exacta enviada, estado de espera, error y, cuando llega, identificador confirmado. Los snapshots se sustituyen al cambiar, con suscripción estable mediante [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore). Los consumidores leen el mismo bloqueo; desmontar una ruta no libera una petición en curso.

- Envío en curso: no se permite confirmar otra vez ni descartar. Navegar no lo cancela ni repite.
- Resultado incierto: se mantienen clave y cuerpo bloqueados; solo una pulsación explícita confirma el mismo intento.
- Rechazo 400 válido: se conserva el formulario como editable, sin reutilizar la clave rechazada en la siguiente corrección.
- Éxito: el recibo queda en memoria si la pantalla está ausente. Cuando vuelve, muestra la confirmación y libera el formulario. No se reenvía el POST para consultar ese éxito.
- Descarte de un intento incierto: exige confirmación y advierte de conciliar con los registros guardados; no borra nada en la API.
- Cierre de sesión: pide confirmación si hay un resultado pendiente. Cancelar conserva todo y no llama al logout; aceptar limpia los intentos aunque falle la revocación remota.
- 401 de la sesión vigente: limpia los intentos sin permitir conservar datos de una sesión caducada. Un 401 tardío de otra sesión no limpia la actual.
- Desmontar el proveedor de autenticación invalida su almacén. Las respuestas tardías no pueden repoblar una instancia cerrada ni escribir en la siguiente.

La ruta no decide el resultado del POST. El almacén lo recibe; la pantalla montada consume su confirmación. Esto evita perder una respuesta recibida mientras se cambia de pantalla.

## Interfaz y privacidad

Un aviso fuera del límite de errores y de la carga diferida de las rutas permite volver al guardado, con estados «guardando», «por revisar» o «confirmado». No expone texto de notas, proveedor ni importe en el aviso.

Notas permite recuperar contenido y color en su diálogo. El escáner recupera fecha, local, proveedor, importe y concepto enviados, sin necesitar otro análisis. La imagen, la extracción original y los consentimientos de imagen/dictado no se conservan al navegar. Las URLs de imagen se revocan al desmontar la pantalla. Los PDF siguen siendo locales a esa pantalla y deben descargarse para conservarlos.

Los avisos distinguen navegación interna de recarga o cierre de sesión. `beforeunload` solicita el aviso nativo si existe un intento pendiente, pero depende del navegador: no es una garantía de retención ni evita cierres forzados del proceso.

## Límites

No se recupera tras recargar, cerrar la pestaña, expirar/cerrar sesión ni abrir otra pestaña. No se trasladan claves entre usuarios o autenticaciones. El servidor puede haber guardado la entidad aunque se pierda el identificador del intento en el cliente: hay que conciliar antes de crear otra.

Solo se conservan formularios que ya se intentaron enviar, no todo borrador sin enviar ni correcciones todavía no reenviadas. No se añade una cola offline, reintento automático, sincronización entre dispositivos ni recuperación de imágenes. Una petición que no termina continúa bloqueada; el bloque no introduce timeout ni interpreta cancelar la espera como cancelar la escritura del servidor.

La deduplicación sigue dependiendo de la [clave y el contrato del séptimo bloque](recovery-idempotency.md), no de comparar notas o facturas similares.

## Validación

Pruebas de componentes y almacén: remontaje con campos originales, bloqueo compartido durante la petición, fallo y éxito tardíos, éxito consumido sin reenviar, validación corregible tras navegar, operaciones independientes, cierre de instancia, logout cancelado/aceptado, nueva autenticación, 401 actual/antiguo y desmontaje bajo StrictMode. Se comprueba que el flujo de sesión no escribe en Storage.

Los recorridos de navegador usan una API real con SQLite desechable: pérdida de respuesta después del commit, navegación y confirmación de nota/gasto con la misma clave/cuerpo, respuesta retenida hasta salir de ruta y logout con intento pendiente. Comprueban que solo existe una entidad y que volver no envía por sí solo. La extracción visual de factura está simulada: no acredita integración con Gemini ni utiliza ese servicio.

Validación local: lint, 163 pruebas (84 de API y 79 de componentes/helpers), TypeScript y build correctos. Pasan 19 recorridos funcionales y 4 de archivos compilados. El arranque queda en 223.476 bytes de JavaScript y 70.912 comprimidos según el verificador, por debajo de 250.000/85.000. Captura de recuperación del gasto revisada a 390 px; no hay nuevas dependencias, cambios de API, datos reales, servicios externos de IA ni despliegue.

Continuación implementada localmente: [alta manual y consulta de gastos](recovery-manual-expenses.md), compartiendo esta protección con el escáner. El aviso global del gasto conduce ahora a `/gastos`.
