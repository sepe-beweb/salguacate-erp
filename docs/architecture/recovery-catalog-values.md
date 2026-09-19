# Catálogo, proveedores y alertas coherentes

Vigésimo cuarto bloque. Almacén valida las filas de inventario mediante el lector común de stock y el directorio completo de proveedores. La agenda de proveedores usa el mismo lector de identidades y campos de contacto. Se preservan categorías y contactos nulos, con etiqueta «Sin categoría» y sin inventar enlaces. Una categoría ausente no entra en el filtro Bebidas.

Las imágenes del catálogo admiten rutas locales bajo `/uploads/` con nombre simple y extensión PNG/JPEG. Se rechazan rutas externas, segmentos de directorio, parámetros y extensiones distintas, sin solicitar esas imágenes. No se modifica el histórico: un valor antiguo incompatible requiere revisar el registro y su archivo mediante una recuperación autorizada.

Catálogo y alertas salen de la misma respuesta validada de inventario. La pantalla ya no combina dos instantáneas independientes de existencias. El endpoint de alertas continúa disponible para otros consumidores. Se mantiene el criterio `stock_actual <= stock_minimo`, incluida igualdad, rotulada «En el mínimo». Un fallo de inventario o proveedores bloquea el conjunto y nunca se representa como «Todo en orden».

Las alertas se agrupan por ID de proveedor y local, no por nombre. Proveedores homónimos y locales diferentes no se mezclan, y nombres de propiedades reservadas se tratan como texto. Copiar genera una lista informativa con existencias y mínimo, no un pedido de cero unidades ni una confirmación de WhatsApp. La confirmación es accesible y una copia tardía no actualiza una lectura sustituida. Las pruebas de copia simulan el portapapeles y no contactan con proveedores.

Los ajustes de stock incorporan un bloqueo síncrono frente a dobles pulsaciones. Restar en cero y sumar sobre el máximo entero seguro quedan deshabilitados; los resultados se releen desde la API, sin cambios optimistas ni reintento automático del PUT. Esto no introduce control de concurrencia entre dispositivos ni sustituye las validaciones del servidor.

Las pruebas cubren tipos incorrectos, identidades duplicadas, rutas de imagen, categorías ausentes, igualdad del mínimo, grupos separados, recuperación y doble pulsación. El navegador verifica móvil a 390 y 320 píxeles, inyecta una lectura incorrecta y recupera la real, ajusta stock y comprueba que catálogo y alertas coinciden sin crear pedidos. Solo usa API y base desechables.

Validación local: `npm run check` supera 437 pruebas, lint, TypeScript y build; pasan 35 recorridos E2E de desarrollo y 5 de producción local. Arranque: 230319 bytes de JavaScript, 74064 comprimidos, dentro del presupuesto. Sin despliegue ni comprobación de bases reales.

Siguiente bloque: formularios nativos de producto y proveedor, validación de cantidades sin truncar y lectura de imágenes aislada de borradores cerrados o sustituidos.
