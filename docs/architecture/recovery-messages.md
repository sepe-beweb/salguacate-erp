# Buzón interno y envíos

Decimoséptimo bloque. El buzón valida conjuntamente mensajes y directorio de destinatarios: identificadores únicos, campos de texto, roles conocidos, estado de lectura y fechas de registro válidas. Un error bloquea la consulta y composición sin presentar listas parciales; reintentar solo repite GET. La carga compartida cancela e ignora resultados obsoletos.

La fecha de registro es un instante UTC: se admite el ISO explícito que escribe la ruta actual y el formato SQLite UTC del esquema. `storedUtcTimestamp` comparte ese contrato con peticiones; no transforma una fecha civil en un instante ni adivina zonas de cadenas ambiguas. El buzón ordena por instante e identificador y muestra fecha completa y hora local mediante `time`.

Componer exige elegir explícitamente un destinatario. Cancelar oculta y conserva el borrador; descartarlo exige confirmación. Durante el POST se congelan destinatario, asunto, cuerpo, cierre y descarte; una guarda síncrona impide otro envío simultáneo. Un rechazo conserva los campos. Si la respuesta es incierta se indica comprobar con el destinatario antes de repetir: el buzón es de entrada, no un registro de enviados, y no se añade idempotencia ni reenvío automático.

El éxito confirmado limpia el borrador y tiene su propio estado visible, aunque falle el GET posterior. La navegación móvil de gestión incorpora Buzón. Las tarjetas permiten partir textos largos sin ensanchar la pantalla.

Las pruebas de componentes cubren contratos, lecturas parciales, elección explícita, borrador, descarte, envío duplicado bloqueado y éxito seguido de fallo de lectura. El recorrido integrado usa API local real, retiene temporalmente un POST y comprueba recepción única por el usuario destino, autor e instante mostrado en Los Ángeles y Kiritimati. Captura móvil revisada. Sin datos reales, servicios externos, esquema, permisos ni despliegue.

Validación local final: `npm run check` correcto con 307 pruebas, lint, TypeScript y compilación; 28 recorridos funcionales y 5 sobre archivos compilados. Presupuesto inicial: 225.138 bytes de JavaScript, 72.048 comprimidos.

Siguiente bloque: navegación móvil completa por rol, accesible también cuando falla la carga del panel y sin depender de sus accesos rápidos.
