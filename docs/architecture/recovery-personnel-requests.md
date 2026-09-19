# Peticiones y lecturas de personal

Decimoquinto bloque. Empleado y RRHH comparten la validación completa de peticiones: identificadores únicos, tipo y estado conocidos, fechas civiles válidas y rangos coherentes. RRHH publica plantilla, turnos y peticiones solo cuando las tres lecturas son válidas; un fallo no se presenta como plantilla vacía ni como contadores parciales. Reintentar repite únicamente las lecturas.

Inicio y fin se muestran sin convertirlos a instantes. La fecha de registro sí es un instante: la API usa `CURRENT_TIMESTAMP` de SQLite en UTC; se admite ese formato y el ISO con UTC explícito, no una zona supuesta para cadenas arbitrarias. El historial se ordena por registro e identificador.

Durante el envío se bloquean los campos y se conserva el borrador si falla. Las decisiones de aprobación/rechazo se bloquean mientras hay una pendiente y consultan el estado persistido incluso tras un conflicto. No hay reintento automático ni nueva garantía de idempotencia: ante una respuesta incierta se indica revisar el historial antes de repetir. La navegación inferior del empleado incorpora Solicitudes, antes inaccesible desde ese menú móvil.

Validación local: `npm run check` correcto con 291 pruebas, lint, TypeScript y compilación; 26 pruebas funcionales de navegador y 5 sobre archivos compilados. El flujo real local de envío y rechazo se comprueba en móvil en Los Ángeles y Kiritimati, conservando las fechas 29/02/2024 y 01/03/2024. Se revisó la captura móvil del revisor. Presupuesto inicial: 224.710 bytes de JavaScript, 72.015 comprimidos.

Sin cambios de esquema, permisos o dependencias. Sin datos reales, despliegue ni servicios externos. Siguiente bloque: diálogos de plantilla y asignación de turnos, etiquetas accesibles, validación de PIN y conservación explícita de borradores.
