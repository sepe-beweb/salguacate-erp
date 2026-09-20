# Correcciones de la revisión local

## Alcance

Correcciones de dos fallos funcionales y dos de interfaz reproducidos en una instalación local sintética el 20/09/2026. No activan servicios remotos, no migran datos ni cambian el esquema. La aplicación de revisión conserva su SQLite y sus fotos locales.

## Pedidos antiguos

El historial empezaba y terminaba en los diez pedidos más recientes, incluso si quedaban pendientes fuera de esa ventana. Ahora muestra cuántos registros están visibles y permite cargar diez más hasta llegar al final, conservando los anteriores y el orden civil por fecha/ID. La recepción sigue siendo explícita y transaccional; el servidor rechaza una segunda recepción sin sumar de nuevo stock.

El backend continúa devolviendo el historial completo. Esto resuelve el acceso, no implementa paginación remota ni una política de archivo para grandes volúmenes.

## Asignación de tareas

El servidor verifica el usuario activo y su local dentro de `writeAsActor` antes del INSERT. Si el destinatario es empleado, una tarea localizada solo puede asignarse a su mismo local; las tareas de Ambos conservan su comportamiento. No se amplía la lectura/escritura del empleado ni se reduce el alcance multilocal ya existente de los gestores.

El formulario muestra el local junto al empleado y deshabilita opciones incompatibles. Cambiar el local después de elegir un empleado conserva el borrador, explica el conflicto y bloquea el envío hasta corregirlo. La lectura de personas valida también el tipo de su local.

No se reescriben tareas históricas incompatibles. El cambio posterior de local/rol de una persona sigue siendo un flujo distinto: no se implementa aquí traslado automático, reasignación ni conciliación de sus tareas pendientes. Antes de ese traslado se debe revisar el trabajo pendiente; definir esa política queda para un bloque específico de personal.

## Interfaz

- El asistente utiliza el diálogo modal compartido: fondo inerte, foco inicial en consulta, Escape, retorno del foco y nombres accesibles para abrir/cerrar/enviar. Cerrar conserva la consulta y conversación durante el montaje del componente; no envía nada. No se activa la IA ni se acredita su integración remota.
- El catálogo coloca la categoría bajo el nombre, sin partir palabras; reserva espacio al stock y evita encoger imágenes. El marcador de imagen ausente pasa a «Sin foto».
- Ajustes explica que sus filas todavía no tienen editor y muestra el rol en español. No incorpora funciones inexistentes.

La unificación completa de nombres de navegación y la reorganización de accesos rápidos quedan separadas de estas correcciones; no se cambia silenciosamente la estructura de navegación.

## Regresión

Validación final local del 20/09/2026: `npm run check` correcto (670 pruebas en 41 archivos, lint, TypeScript y compilación); `npm run test:e2e` correcto (43 recorridos en 27 archivos); `npm run test:e2e:production` correcto (5 recorridos). Las tres regresiones nuevas también se ejecutaron por separado. Se verificaron visualmente el catálogo móvil y el foco/Escape del asistente en la instancia de revisión conservada. Sin commit, push ni despliegue asociados a esta evidencia.

- API: rechazo de asignaciones incompatibles sin insertar, mismo local/Ambos, comprobación del local vigente y conservación del alcance de gestores.
- Componentes: historial con 23 pedidos, borrador de tarea incompatible conservado, lectura de local inválido y diálogo del asistente con foco/retorno.
- Navegador: 21 pedidos y recepción del más antiguo una sola vez; formulario y rechazo real del servidor; teclado del asistente y catálogo con nombre largo y stock de seis cifras a 320/390 px.
- La batería general y la de archivos compilados se ejecutan separadamente. El resultado local no equivale a despliegue ni certificación de accesibilidad.
