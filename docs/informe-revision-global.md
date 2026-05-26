# Informe de Revision Global de Salguacate ERP

Fecha: 2026-05-26

Este documento resume la revision global de la aplicacion Salguacate ERP. Incluye fallos detectados, riesgos tecnicos, mejoras funcionales y una propuesta de hoja de ruta para estabilizar el producto.

## Verificaciones Ejecutadas

| Verificacion | Resultado | Observaciones |
|---|---:|---|
| `npm run build` | OK | TypeScript y Vite compilan. Hay aviso de bundle principal grande. |
| `npm test` | OK | 7 tests pasan. La cobertura es baja para el tamano de la aplicacion. |
| `npm run test:e2e` | OK | 4 tests E2E pasan. Riesgo: usan SQLite real/local. |
| `npm run lint` | FALLA | El script existe, pero `eslint` no esta instalado en dependencias. |

## Resumen Ejecutivo

La aplicacion compila y los flujos basicos de login/fichaje pasan en E2E, pero hay riesgos importantes antes de considerarla lista para uso operativo real.

Los puntos mas urgentes son:

1. La API no tiene autenticacion/autorizacion real y expone operaciones administrativas a cualquier cliente que alcance el backend.
2. `GET /api/usuarios` devuelve PINs de empleados.
3. Los fichajes permiten duplicados, no cargan estado real al abrir la pantalla y el descanso no se persiste.
4. Las peticiones de empleado no se guardan; el formulario solo es visual.
5. Gastos, analiticas e informes no imputan correctamente por local.
6. Los tests E2E pueden modificar `server/database.sqlite` real/local.
7. El despliegue con Turso/libSQL tiene riesgo de inicializacion desordenada por asincronia.
8. El exportador de informes puede inyectar HTML/JS al usar `document.write()` con datos sin escape.

## Prioridad P0: Seguridad y Datos Criticos

### 1. Proteger la API con autenticacion y autorizacion por rol

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `server/index.js` | 35, 41-95, 146-324, 380-539, 612-745 |

Problema:

El backend usa `cors()` abierto y no valida sesion, identidad ni rol en ningun endpoint. Cualquier cliente puede leer usuarios, cambiar stock, borrar eventos, registrar cierres, crear empleados, usar IA o modificar turnos.

Impacto:

Compromiso completo del ERP si el backend es accesible desde internet o desde una red compartida.

Acciones recomendadas:

1. Crear middleware de autenticacion.
2. Emitir token de sesion corto tras login o implementar sesion server-side.
3. Validar rol por endpoint: `owner`, `manager`, `employee`.
4. Restringir CORS a dominios permitidos.
5. Auditar acciones sensibles con usuario, fecha, IP y payload resumido.

### 2. Dejar de exponer PINs en listados

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `server/index.js` | 41-45 |
| `src/pages/HRManagement.tsx` | 64-67, 345-357 |

Problema:

`GET /api/usuarios` devuelve `pin`. El modulo RRHH lo usa para editar, pero la API no esta protegida.

Impacto:

El PIN deja de ser secreto. Permite suplantar usuarios.

Acciones recomendadas:

1. No devolver `pin` en `GET /api/usuarios`.
2. Usar campo `has_pin` si hace falta indicar que existe PIN.
3. Crear endpoint separado para cambiar PIN.
4. Guardar PIN hasheado, no en texto plano.
5. Evitar mostrar PIN actual en formularios.

### 3. Corregir integridad del fichaje

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `server/index.js` | 98-117, 120-144 |
| `src/pages/employee/Clock.tsx` | 9, 17-30, 70-77 |

Problemas:

1. La pantalla siempre arranca con `status = 'out'` aunque exista un fichaje abierto.
2. El backend permite varias entradas abiertas para el mismo usuario.
3. La salida responde OK aunque no encuentre entrada abierta.
4. Si `tipo` no es `entrada` ni `salida`, la peticion queda sin respuesta.
5. Descanso y volver solo cambian el estado local de UI, no se guardan en base de datos.

Impacto:

El control horario puede quedar corrupto y la presencia en tiempo real no refleja la realidad.

Acciones recomendadas:

1. Crear endpoint para consultar fichaje activo del usuario.
2. Bloquear nueva entrada si ya existe fichaje abierto.
3. En salida, devolver `409` si no hay entrada abierta.
4. Ampliar `/api/fichar` o crear endpoints para `descanso` y `volver`.
5. Cargar el estado real al abrir `Clock.tsx`.
6. Cubrir con tests API y E2E.

### 4. Implementar persistencia real de peticiones de empleados

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `src/pages/employee/Requests.tsx` | 11, 53-56, 59-67 |

Problema:

El formulario solo ejecuta `preventDefault()`. No existe endpoint ni tabla para peticiones. Tambien muestra una peticion anterior hardcodeada.

Impacto:

El empleado cree que ha solicitado vacaciones, bajas o cambios, pero no llega nada a administracion.

Acciones recomendadas:

1. Crear tabla `peticiones` con usuario, tipo, fechas, comentario, estado y timestamps.
2. Crear endpoints `GET/POST/PATCH /api/peticiones`.
3. Mostrar peticiones reales del empleado.
4. Crear vista administrativa para aprobar/rechazar.
5. Eliminar datos estaticos.

### 5. Sanear exportacion de informes para evitar XSS

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `src/pages/Reports.tsx` | 61-80, 82-216 |

Problema:

El HTML del informe se construye con `document.write()` interpolando datos de BD sin escape: proveedor, concepto, local, etc.

Impacto:

Si un dato editable contiene HTML o JavaScript, se ejecuta en la ventana de informe.

Acciones recomendadas:

1. Escapar HTML antes de interpolar.
2. Evitar `document.write()` con strings sin sanear.
3. Generar informe con React o con un renderer controlado.
4. Anadir tests con payloads maliciosos.

## Prioridad P1: Consistencia de Negocio y Contabilidad

### 6. Corregir gastos por local en backend, analiticas e informes

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `server/index.js` | 314-323 |
| `server/database.js` | 159-160 |
| `src/pages/Analytics.tsx` | 55, 71-73, 97 |
| `src/pages/Reports.tsx` | 45-55 |
| `src/pages/Scanner.tsx` | 242-253 |

Problemas:

1. La tabla `gastos` tiene columna `local`, pero `POST /api/gastos` la ignora.
2. El escaner registra gastos sin local, fecha revisable ni concepto.
3. Analiticas filtra cierres por local, pero suma gastos de todos los locales.
4. Informes filtra cierres por local, pero no gastos.

Impacto:

Beneficio neto y costes por local pueden ser incorrectos.

Acciones recomendadas:

1. Aceptar `local` en `POST /api/gastos`.
2. Validar local contra `Principal` y `Segundo Local`.
3. Permitir revisar fecha, local, proveedor, total y concepto desde el escaner.
4. Filtrar gastos por local en `Analytics.tsx` y `Reports.tsx`.
5. Crear tests contables por local.

### 7. Unificar criterio de stock bajo

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `server/index.js` | 196-203 |
| `src/pages/Dashboard.tsx` | 69 |
| `src/pages/Inventory.tsx` | 357 |
| `src/pages/StockControl.tsx` | 72, 225 |

Problema:

El backend considera alerta si `stock_actual < stock_minimo`, pero frontend marca stock bajo con `stock_actual <= stock_minimo`.

Impacto:

El dashboard y control visual pueden indicar stock bajo para productos que no aparecen en alertas.

Acciones recomendadas:

1. Elegir una regla unica.
2. Aplicarla en backend y frontend.
3. Documentarla como regla de negocio.
4. Anadir test para caso `stock_actual === stock_minimo`.

### 8. Aplicar filtro de local a alertas de inventario

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `src/pages/Inventory.tsx` | 57-60, 65-68, 172-180 |
| `server/index.js` | 196-205 |

Problema:

El backend soporta `?local=...`, pero `Inventory.tsx` siempre llama a `/api/inventario/alertas` sin pasar el local seleccionado.

Impacto:

Al filtrar por local, las alertas siguen mostrando productos de todos los locales.

Acciones recomendadas:

1. Reutilizar `filterLocal` al cargar alertas.
2. Refrescar alertas tras cambios de stock y alta de producto.
3. Verificar que pedidos generados no mezclen locales.

### 9. Revisar flujo de pedidos y recepcion de stock

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `src/pages/StockControl.tsx` | 111-143, 178-180 |
| `server/index.js` | 514-531 |

Problemas:

1. Pulsar WhatsApp guarda el pedido antes de confirmar que se envio.
2. Marcar recibido no actualiza inventario.
3. `JSON.parse(p.productos)` puede romper la pantalla si el campo no es JSON valido.

Impacto:

Historial de pedidos poco fiable y stock no reconciliado.

Acciones recomendadas:

1. Separar acciones: generar, enviar, guardar.
2. Preguntar confirmacion antes de registrar pedido enviado.
3. Al marcar recibido, permitir sumar cantidades al inventario.
4. Envolver `JSON.parse` en `try/catch`.
5. Guardar productos de pedidos en tabla normalizada a medio plazo.

### 10. Validar importes y fechas de cierres

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `src/pages/Sales.tsx` | 23-30, 52-78, 141-201 |
| `server/index.js` | 293-303 |

Problemas:

1. Efectivo y tarjeta aceptan negativos.
2. Backend permite `NaN` o campos no numericos.
3. No se controla duplicado por fecha/local.
4. Se usa `toISOString()` para fecha por defecto, que puede desfasarse respecto al dia local.

Impacto:

Cierres incorrectos y analiticas contaminadas.

Acciones recomendadas:

1. Validar numeros en frontend y backend.
2. `efectivo`, `tarjeta` e `invitaciones` con minimo 0.
3. `descuadre` puede ser negativo.
4. Prevenir duplicados o avisar si ya existe cierre de fecha/local.
5. Usar fecha local, no UTC, para valores por defecto.

## Prioridad P1: Backend, Turso y Persistencia

### 11. Rehacer inicializacion de base de datos para Turso/libSQL

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `server/database.js` | 5-189, 201-244 |

Problema:

El wrapper Turso implementa `serialize()` llamando el callback inmediatamente, pero `run/get/all` son asincronos. Las tablas, migraciones y seed pueden ejecutarse fuera de orden.

Impacto:

Arranque inestable en produccion con Turso: tablas no creadas, migraciones a destiempo o seed fallido.

Acciones recomendadas:

1. Convertir inicializacion a `async/await` secuencial.
2. No simular `sqlite3.serialize()` con operaciones paralelas.
3. Controlar errores de migracion esperados.
4. Validar `err` antes de usar `row.count`.
5. Crear test de inicializacion con Turso mock o libSQL local.

### 12. Activar claves foraneas y definir estrategia de borrado

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `server/database.js` | 22-157, 247-255 |
| `server/index.js` | 89-95 |

Problema:

SQLite no aplica foreign keys si no se ejecuta `PRAGMA foreign_keys = ON`. El borrado de usuarios puede dejar turnos, mensajes, fichajes, tareas y notas huerfanos.

Impacto:

Datos inconsistentes. Si se activa FK sin plan de borrado, empezaran a fallar deletes existentes.

Acciones recomendadas:

1. Activar `PRAGMA foreign_keys = ON`.
2. Definir `ON DELETE CASCADE` o `SET NULL` por tabla.
3. Considerar borrado logico de usuarios con campo `activo`.
4. Evitar borrar el ultimo owner.

### 13. Usar `process.env.PORT` en backend

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `server/index.js` | 38, 747-750 |

Problema:

El puerto esta hardcodeado a `3001`.

Impacto:

Despliegues PaaS como Render suelen exigir escuchar `process.env.PORT`.

Acciones recomendadas:

1. Cambiar a `const PORT = process.env.PORT || 3001`.
2. Verificar `render.yaml`.

### 14. Revisar almacenamiento de uploads en Render

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `server/index.js` | 29-33, 173-183 |

Problema:

Las imagenes se guardan en `server/uploads`. En Render el filesystem puede ser efimero si no hay disco persistente.

Impacto:

Imagenes de inventario perdidas tras redeploy o restart.

Acciones recomendadas:

1. Configurar disco persistente en Render o usar almacenamiento externo.
2. Validar tamano y tipo real de imagen.
3. Usar escritura asincrona.
4. Crear limpieza de archivos huerfanos.

## Prioridad P1: IA y Function Calling

### 15. Corregir segunda llamada a Gemini tras function calling

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `server/index.js` | 643, 680-685 |

Problema:

La primera llamada usa `chatSession.sendMessage({ message })`, pero la respuesta de funcion se manda como array directo. Segun el SDK, deberia enviarse como objeto con `message`.

Impacto:

El endpoint puede ejecutar la accion en base de datos y luego fallar al generar respuesta final, provocando reintentos y duplicados.

Acciones recomendadas:

1. Cambiar a `chatSession.sendMessage({ message: [{ functionResponse: ... }] })`.
2. Crear test mock de function calling completo.
3. Garantizar idempotencia o confirmacion para acciones destructivas.

### 16. Hacer seguras las acciones de IA

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `server/index.js` | 651-677 |

Problemas:

1. `actionExecuted = true` se marca antes de saber si la base de datos actualizo correctamente.
2. `modificar_stock` puede dejar stock negativo.
3. `borrar_evento` no confirma existencia ni solicita confirmacion humana.
4. `asignar_turno` fuerza local `Principal` y no guarda companeros.

Impacto:

La IA puede producir datos incorrectos o acciones no confirmadas.

Acciones recomendadas:

1. Mover `actionExecuted = true` despues de exito real.
2. Usar `max(0, stock_actual + ?)` para stock.
3. Comprobar `changes` en updates/deletes.
4. Pedir confirmacion en frontend para acciones destructivas.
5. Anadir local a herramienta `asignar_turno`.

## Prioridad P2: UX, Estados y Accesibilidad

### 17. Mostrar errores reales de API en formularios

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `src/pages/Inventory.tsx` | 121-136 |
| `src/pages/Sales.tsx` | 52-78 |
| `src/pages/HRManagement.tsx` | 70-94, 108-127 |
| `src/pages/ManagerCalendar.tsx` | 75-101 |
| `src/pages/Tasks.tsx` | formularios y deletes |
| `src/pages/employee/Messages.tsx` | 64-91 |

Problema:

Muchos formularios solo hacen algo si `res.ok`; si el backend devuelve 400/500 no se informa al usuario.

Impacto:

El usuario no sabe si la accion se guardo o fallo.

Acciones recomendadas:

1. Crear patron comun `apiFetch` con manejo de errores.
2. Mostrar mensajes visibles y no solo `console.error`.
3. Deshabilitar boton durante envio.
4. Reintento cuando tenga sentido.

### 18. Corregir login cuando el backend no responde

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `src/context/AuthContext.tsx` | 26-47 |
| `src/pages/Login.tsx` | 21-25, 52-62 |

Problema:

Cualquier fallo de red se trata como `PIN incorrecto` o deja la pantalla sin usuarios.

Impacto:

Diagnostico incorrecto para usuarios y encargados.

Acciones recomendadas:

1. Distinguir 401 de error de conexion.
2. Mostrar estado `Servidor no disponible`.
3. Anadir boton reintentar.

### 19. Mejorar rutas Android/WebView

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `src/App.tsx` | 345-349 |
| `src/config.ts` | 1-11 |

Problema:

La app usa `BrowserRouter`. En modo `file://` para Android/WebView puede romper recargas, historial o rutas internas.

Impacto:

Rutas no resueltas en la app nativa.

Acciones recomendadas:

1. Usar `HashRouter` cuando `window.location.protocol === 'file:'`.
2. Probar navegacion completa en Android.

### 20. Quitar o implementar elementos clicables sin accion

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `src/pages/Inventory.tsx` | 348-350 |
| `src/pages/Settings.tsx` | 23-48 |

Problema:

Hay boton de filtro sin accion y opciones de Ajustes con `cursor-pointer` sin `onClick`.

Impacto:

UX enganosa.

Acciones recomendadas:

1. Eliminar affordance clicable si no hay funcion.
2. O implementar pantallas reales de ajustes y filtro avanzado.

### 21. Corregir clases Tailwind no generadas

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `tailwind.config.js` | 1-28 |
| `src/App.tsx` | 39, 63 |
| `src/pages/Dashboard.tsx` | 205, 230, 242 |

Problema:

Se usan clases como `pb-safe`, `animate-in`, `slide-in-*`, `zoom-in-*`, `fade-in`, `bg-slate-850`, `text-slate-450`, `text-slate-550`, pero Tailwind no tiene plugins ni colores extendidos para ellas.

Impacto:

Animaciones, safe area y algunos colores no se aplican.

Acciones recomendadas:

1. Instalar/configurar `tailwindcss-animate` si se quieren animaciones.
2. Definir colores custom o reemplazar por escalas existentes.
3. Anadir utilidades safe-area para movil.

### 22. Mejorar accesibilidad de botones, modales y divs interactivos

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `src/pages/Scanner.tsx` | 145-164 |
| `src/pages/HRManagement.tsx` | 150-158 |
| `src/components/AIChatbot.tsx` | 94-120, 167-173 |
| Multiples modales | varios |

Problemas:

1. Elementos `<div onClick>` usados como botones.
2. Botones solo icono sin `aria-label` en varios sitios.
3. Modales sin gestion de foco ni cierre con Escape.

Impacto:

Peor accesibilidad y navegacion por teclado.

Acciones recomendadas:

1. Usar `<button>` para acciones.
2. Anadir `aria-label` a botones icon-only.
3. Implementar foco inicial, trap focus y Escape en modales.

## Prioridad P2: Pruebas y Calidad

### 23. Arreglar `npm run lint`

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `package.json` | 9, 26-39 |

Problema:

El script llama a `eslint`, pero `eslint` no esta instalado.

Impacto:

No hay lint automatico. Errores de calidad no se detectan.

Acciones recomendadas:

1. Instalar ESLint y plugins React/TypeScript.
2. Ajustar configuracion para el stack actual.
3. Anadir script a CI.

### 24. Aislar tests E2E de la base real

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `playwright.config.ts` | 5, 20-33 |
| `server/database.js` | 248 |
| `tests/e2e/auth.spec.ts` | 40-63 |

Problema:

Playwright arranca `node server/index.js` sin `NODE_ENV=test`, por lo que usa `server/database.sqlite`. El test de fichaje modifica datos reales/locales.

Impacto:

Tests contaminan la base de desarrollo y pueden ser flaky.

Acciones recomendadas:

1. Ejecutar backend E2E con `NODE_ENV=test` o `DATABASE_PATH` temporal.
2. Desactivar `fullyParallel` o aislar base por worker.
3. Resetear datos antes de cada suite.
4. No depender de estado previo.

### 25. Separar entorno Vitest de frontend y backend

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `vitest.config.ts` | 6-11 |
| `server/tests/api.test.js` | 5, 27-28 |

Problemas:

1. Tests backend se ejecutan en `jsdom`.
2. En ESM, `process.env.NODE_ENV = 'test'` puede aplicarse demasiado tarde frente a imports estaticos.
3. Tests backend dependen de seeds e IDs fijos.

Acciones recomendadas:

1. Crear config Vitest separada para Node/backend.
2. Usar setup file para establecer env antes de importar servidor.
3. Crear fixtures explicitamente en cada test.
4. Limpiar o recrear base entre tests.

### 26. Ampliar cobertura de tests

Areas sin cobertura suficiente:

1. Inventario y stock no negativo.
2. Alertas por local.
3. Proveedores.
4. Cierres y gastos por local.
5. Pedidos y recepcion.
6. Eventos y carteles IA con mocks.
7. Mensajes y lectura.
8. Peticiones de empleados cuando se implemente.
9. Fichaje duplicado y salida sin entrada.
10. Autorizacion por rol cuando se implemente.

## Prioridad P3: Mejoras Funcionales

### 27. Mensajes internos: estado de lectura y enviados

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `src/pages/employee/Messages.tsx` | 6-14, 183-205 |
| `server/index.js` | 265-283 |

Mejoras:

1. Marcar mensajes como leidos.
2. Mostrar no leidos visualmente.
3. Bandeja de enviados.
4. Borrado o archivado.
5. Notificaciones en dashboard.

### 28. Turnos: filtrar, ordenar y editar

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `src/pages/HRManagement.tsx` | 35-42, 245-281 |
| `src/pages/employee/Calendar.tsx` | 20-27, 57-88 |
| `server/index.js` | 232-262 |

Mejoras:

1. Filtrar turnos pasados/proximos.
2. Ordenar por fecha y hora.
3. Editar y borrar turnos manualmente.
4. Validar solapes.
5. Soportar local en function calling de IA.

### 29. Ajustes reales de usuario y locales

Referencias:

| Archivo | Lineas aprox. |
|---|---:|
| `src/pages/Settings.tsx` | 4-53 |

Mejoras:

1. Editar datos personales propios.
2. Cambiar PIN.
3. Preferencias de notificaciones.
4. Gestion real de locales para owner.
5. Privacidad y cierre de sesiones.

### 30. Android y experiencia movil

Mejoras:

1. Validar `HashRouter` en `file://`.
2. Safe area real para bottom nav.
3. Dar acceso movil a todos los modulos administrativos o menu compacto.
4. Revisar solapamiento de Salguabot con navegacion inferior.
5. Probar camara, descarga PDF y WhatsApp en Android real.

## Hoja de Ruta Recomendada

### Sprint 1: Estabilizacion critica

1. Autenticacion/autorizacion backend.
2. Ocultar y hashear PINs.
3. Fichaje robusto con estado real y descanso persistente.
4. Peticiones de empleado persistentes.
5. Aislar tests E2E de la base real.
6. Corregir `npm run lint`.

### Sprint 2: Contabilidad y operaciones

1. Gastos por local end-to-end.
2. Informes y analiticas filtrados correctamente por local.
3. Alertas de inventario con filtro local.
4. Regla unica de stock bajo.
5. Pedidos con recepcion que actualiza inventario.
6. Validaciones de cierres, gastos, inventario y turnos.

### Sprint 3: Backend productivo

1. Inicializacion secuencial para Turso.
2. Foreign keys y estrategia de borrado.
3. `process.env.PORT`.
4. Uploads persistentes.
5. Validacion centralizada de payloads.
6. Comprobacion de `this.changes` en updates/deletes.

### Sprint 4: UX y accesibilidad

1. Estados de error visibles.
2. Accesibilidad en modales y botones.
3. Ajustes reales o eliminar affordance clicable.
4. Navegacion movil completa.
5. Tests de regresion para componentes principales.

## Lista Corta de Quick Wins

1. Cambiar `PORT` a `process.env.PORT || 3001`.
2. Pasar `local` en `POST /api/gastos`.
3. Pasar `filterLocal` a `/api/inventario/alertas`.
4. Revisar `res.ok` en `updateStock` y refrescar alertas.
5. Envolver `JSON.parse(p.productos)` en `try/catch`.
6. Anadir `min="0"` a efectivo, tarjeta e invitaciones.
7. Mostrar error de conexion real en login.
8. Quitar boton `Filter` de inventario si no se implementa.
9. Quitar `cursor-pointer` en Ajustes si no navega.
10. Instalar/configurar ESLint.

## Notas de Estado Actual

1. El build esta operativo.
2. Los tests actuales pasan, pero no garantizan seguridad ni consistencia de negocio.
3. Hay que tratar el ERP como prototipo funcional hasta cerrar P0 y P1.
4. No se realizaron cambios de codigo durante esta revision, solo se genero este informe.
