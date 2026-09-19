# Editores de plantilla y turnos

Decimosexto bloque. Ambos editores de RRHH usan el diálogo nativo compartido: nombre accesible, foco inicial, fondo inerte, Escape y retorno al control de apertura. Campos etiquetados y área desplazable en móvil. Durante el guardado se bloquean campos, descarte y cierre.

Cerrar conserva los campos ordinarios. El PIN está oculto y se borra al cerrar; la ayuda lo advierte. El borrador de empleado conserva el destino de edición: retomar no convierte una edición en alta y cambiar de persona o pasar a un alta exige confirmar el descarte. El turno conserva persona, fecha, horas, local y compañeros; el descarte también es explícito. Los borradores solo viven en la ruta actual, sin almacenamiento persistente.

La validación cliente refleja el contrato existente del servidor: PIN de 6–8 dígitos no todos iguales, vacío permitido solo en edición, nombre y teléfono acotados, local explícito y fecha/horas civiles válidas para una persona activa. No se convierte un local histórico desconocido en Principal al abrir la edición. Se mantienen los turnos nocturnos sin inventar duraciones ni semántica de fin. No se cambian permisos, esquema ni políticas de credenciales.

Un fallo de escritura conserva los datos e indica revisar el estado antes de repetir una respuesta incierta. No se añade idempotencia a estas operaciones.

## Aislamiento de navegador

La batería creciente llegó al límite real de 40 accesos por IP en 15 minutos al compartir una sola API. `npm run test:e2e` ahora ejecuta cada archivo con una API nueva en memoria y se detiene ante el primer fallo. Las protecciones de producción no cambian ni se desactivan. Los artefactos quedan bajo `test-results/e2e/<archivo>`. Un filtro explícito (`npm run test:e2e -- archivo.spec.ts`) ejecuta directamente esa selección; no se debe agrupar una batería ilimitada bajo una sola base.

Las pruebas de componentes cubren PIN inválido, limpieza del secreto, descarte cancelado, destino de edición y bloqueo de turnos. El recorrido de navegador crea una persona, inicia sesión con su PIN y comprueba el turno nocturno en su calendario; también comprueba foco, Escape y bloqueo durante un POST real retenido temporalmente. Los datos son exclusivamente sintéticos.

Validación local final: `npm run check` correcto, 297 pruebas, lint, TypeScript y compilación; 27 recorridos funcionales con aislamiento por archivo y 5 de producción. Captura móvil del turno revisada. Presupuesto inicial: 224.713 bytes de JavaScript, 72.026 comprimidos. No acredita despliegue ni datos reales.

Siguiente bloque: buzón interno, validación de lecturas y fechas de registro, conservación del mensaje y bloqueo del formulario durante el envío.
