# Recuperación de la pantalla de acceso

Vigésimo bloque. Acceso y buzón comparten el lector de perfiles públicos: identificadores positivos y únicos, nombres no vacíos y roles conocidos. Tanto la carga inicial como cada reintento comprueban HTTP y estructura. Una lista vacía válida se distingue de un fallo del servidor.

El acceso usa la carga común con transporte anónimo explícito: no añade Authorization ni envía un intento de login al reintentar perfiles. Las consultas obsoletas se cancelan y no publican resultados después de salir. La función de transporte conserva la invocación correcta de `fetch` en navegador; ese comportamiento está comprobado en Chrome, no solo con mocks.

La entrada de PIN es un formulario nativo. Enter y el botón comparten una guarda síncrona: durante el intento se bloquean PIN y cambio de usuario. Se aceptan los 4–8 dígitos que contempla el acceso del servidor para permitir la renovación de cuentas antiguas; no se rebaja la política de PIN nuevos. Un rechazo muestra un aviso accesible y limpia el secreto, también ante una excepción de transporte. Cambiar de usuario lo limpia igualmente.

La prueba de navegador mantiene indisponible únicamente el directorio hasta el reintento explícito, tolerando el montaje de comprobación de desarrollo. El POST de PIN incorrecto se retiene temporalmente para comprobar bloqueo y ausencia de duplicados; después se accede con el PIN válido contra la API local real. Captura móvil revisada. No se crean perfiles ni se cambia su exposición pública, la política de autenticación o el servidor.

Validación local final: `npm run check` correcto con 340 pruebas, lint, TypeScript y compilación; 31 recorridos funcionales y 5 de producción. Presupuesto inicial: 229.057 bytes de JavaScript, 73.632 comprimidos. Sin despliegue ni cuentas reales.

Siguiente bloque: validación de la respuesta autenticada y aislamiento de intentos de login para impedir que una respuesta antigua reabra o sustituya una sesión.
