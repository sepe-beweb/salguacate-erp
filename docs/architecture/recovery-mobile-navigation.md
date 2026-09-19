# Navegación móvil completa

Decimoctavo bloque. Escritorio y menú móvil comparten los mismos destinos y grupos por rol. El menú se abre desde la cabecera, fuera de las lecturas y del límite de errores del contenido: permite salir de un panel cuyo resumen no carga sin recargar ni perder la sesión.

Los accesos rápidos inferiores se conservan. El diálogo nativo tiene nombre accesible, foco en la ruta activa, fondo inerte, Escape y retorno al botón de apertura. Se cierra al seleccionar un destino, cambiar de ruta o pasar al ancho de escritorio; no deja un fondo bloqueado tras el cambio de tamaño. La ruta activa se indica mediante `aria-current`. El menú del empleado solo muestra sus cinco rutas personales y Ajustes; no convierte un rol desconocido en navegación de gestión.

No se cambian URLs, componentes de ruta ni autorizaciones de la API. La navegación sigue siendo explícita y no añade conservación de borradores entre rutas.

Las pruebas verifican los destinos de propietario, encargado y empleado, ruta activa y rol desconocido. En Chrome se simula únicamente el fallo del GET de cierres: el menú abre RRHH contra la API local real, conserva foco y funciona entre 320 px, tablet y escritorio. Se revisaron capturas de gestión y empleado. No se despliega ni se utilizan datos reales.

Validación local final: `npm run check` correcto con 311 pruebas, lint, TypeScript y compilación; 30 recorridos funcionales y 5 de producción. Presupuesto inicial: 226.063 bytes de JavaScript, 72.698 comprimidos; las 19 pantallas de funcionalidad siguen diferidas.

Publicado en `a7e55c5d60663b6b6fe5e28e134ae1665c41f0b4`; [CI correcto](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35439843733). Continuación: [renovación obligatoria del PIN](recovery-pin-renewal.md).
