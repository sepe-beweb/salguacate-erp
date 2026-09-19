# Frontera de la sesión autenticada

Vigésimo primer bloque. La respuesta de acceso debe confirmar éxito, token hexadecimal de 64 caracteres, identificador numérico igual al perfil solicitado, nombre no vacío, rol conocido, local de texto o nulo y estado booleano explícito de renovación. No se convierte un rol desconocido en gestión ni una cadena `false` en una renovación verdadera. Una respuesta inválida no sustituye una sesión ni cierra su almacén de intentos pendientes.

Cada login tiene una generación y un transporte abortable. Un intento posterior, logout, expiración vigente o desmontaje invalida el anterior. Se comprueba la generación tanto al recibir HTTP como después de leer JSON: una respuesta tardía no puede reabrir la sesión ni sustituir la identidad nueva, aunque un transporte de prueba ignore AbortSignal. Logout usa el token vigente incluso antes del siguiente render. Las respuestas 401 de sesiones antiguas siguen sin cerrar una sesión nueva.

Cancelar el transporte no prueba que el servidor no haya creado una sesión: si la respuesta se pierde antes de obtener el token, no se puede revocar ese token desconocido desde el cliente. Se mantienen la expiración y políticas existentes del servidor. No se añade almacenamiento persistente de tokens, PIN ni borradores y no se cambia el backend.

Las pruebas cubren respuesta incompleta, token/identidad/rol inválidos, renovación explícita, conservación de intentos ante respuesta inválida, login fuera de orden, logout durante JSON pendiente, desmontaje e inmediata revocación con token actualizado. El recorrido de navegador autentica contra la API real y daña solo la respuesta cliente: el ERP no se abre y un acceso posterior con respuesta válida se recupera. La prueba no acredita una auditoría completa de seguridad.

Validación local: `npm run check` supera 358 pruebas, lint, TypeScript y build; los 32 recorridos E2E de desarrollo y los 5 de producción pasan con API y bases desechables. JavaScript inicial: 230234 bytes, 74018 comprimidos, dentro del presupuesto existente. Esto no acredita despliegue ni comportamiento con datos reales.

Siguiente bloque: lectura de pedidos y catálogo, fechas civiles del historial y rechazo explícito de líneas de pedido inválidas.
