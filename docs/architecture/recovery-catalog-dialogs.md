# Formularios de producto y proveedor

Vigésimo quinto bloque. Ambos formularios usan el diálogo nativo compartido: foco inicial, fondo inerte, retorno de foco y Escape protegido durante un POST. Cerrar conserva el borrador mientras se permanezca en la pantalla; descartarlo requiere confirmación y no borra registros. El alta de producto sin editar toma el local filtrado al abrir; un borrador existente conserva su local, aunque el filtro cambie. Los proveedores homónimos muestran ID en el selector.

Las cantidades se conservan como texto de formulario y se convierten solo después de validar enteros de 0 a un millón. No se truncan fracciones con parseInt ni se convierten campos vacíos en cero. Se mantienen límites de nombre y contacto coherentes con la API, y un proveedor que desaparezca de la lectura impide guardar hasta revisar la selección. El servidor sigue validando la escritura y los permisos.

Las altas tienen bloqueo síncrono y conservan campos tras rechazo. Una lectura de fondo no desmonta el diálogo: bloquea el guardado mientras carga o falla y permite reintentar solo GET dentro del formulario. Un alta confirmada se limpia antes de releer; el GET posterior no repite el POST.

La lectura local de imagen acepta PNG/JPEG no vacíos de hasta 3 MB, cancela la anterior y descarta sus eventos tardíos. Cerrar cancela una lectura aún pendiente; una imagen ya leída permanece en el borrador y puede retirarse explícitamente. Cambiar de archivo limpia la vista previa anterior. Descartar o desmontar invalida cualquier lectura; guardar queda bloqueado mientras se lee. La API conserva la validación del contenido real y del almacenamiento.

Las pruebas cubren límites, fracciones sin truncar, local inicial y retenido, confirmación de descarte, doble envío, fallos de lectura y secuencias de FileReader que terminan fuera de orden. La prueba de navegador comprueba móvil, foco y Escape, crea un proveedor, rechaza una cantidad fraccionaria y conserva el formulario con su imagen ante un 503 explícito. La API de prueba no configura almacenamiento de imágenes: después de retirar la imagen crea exactamente un producto. Esta prueba no acredita persistencia de fotos; tampoco contacta con datos reales ni servicios externos.

Validación local: `npm run check` supera 453 pruebas, lint, TypeScript y build; pasan 36 recorridos E2E de desarrollo y 5 de producción local. Arranque: 230320 bytes de JavaScript, 74056 comprimidos, dentro del presupuesto existente. Sin despliegue.

Siguiente bloque: lectura de notas, estados fijados y marcas de tiempo UTC, conservando los intentos idempotentes existentes.
