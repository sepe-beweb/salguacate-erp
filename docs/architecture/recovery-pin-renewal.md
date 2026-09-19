# Renovación obligatoria del PIN

Decimonoveno bloque. La pantalla de renovación valida el PIN nuevo con la política ya existente del servidor: 6–8 dígitos, no todos iguales y distinto del anterior. El alta/edición de plantilla reutiliza la misma comprobación cliente. Se solicita confirmar el nuevo valor; esa confirmación no se envía a la API.

Durante la escritura se bloquean los tres campos y la salida. Una guarda síncrona evita envíos concurrentes incluso sin validación nativa. Solo una respuesta JSON con `success: true` confirma la operación; un fallo HTTP, JSON ilegible o respuesta incompleta no se presenta como éxito ni inicia un reintento. Tras una respuesta incierta se indica comprobar el acceso antes de repetir.

Los campos son contraseñas y no se almacenan de forma persistente. Cancelar o completar correctamente limpia los valores. Se mantienen la renovación obligatoria previa al ERP, logout, revocación de sesiones y tratamiento existente de 401. No se cambia el servidor, las políticas ni las cuentas reales.

Las pruebas de componentes cubren límites de PIN, repetición, coincidencia con el actual, confirmación, doble envío, bloqueo de salida, respuestas inválidas y limpieza de secretos. El recorrido real local comprueba que una confirmación distinta no envía PUT, bloquea el formulario durante el transporte retenido y verifica después rechazo del PIN anterior, revocación del token anterior y acceso con el nuevo PIN. Captura móvil a 320 px revisada.

Validación local final: `npm run check` correcto con 328 pruebas, lint, TypeScript y compilación; 30 recorridos funcionales y 5 de producción. Presupuesto inicial: 227.567 bytes de JavaScript, 73.195 comprimidos. Sin despliegue ni modificaciones de cuentas reales.

Siguiente bloque: pantalla de acceso, lectura validada de perfiles, recuperación sin recarga y bloqueo del usuario/PIN durante un intento pendiente.
