# Acceso asíncrono y ensayo HTTP sobre Turso

## Cambios del bloque 33

Todas las rutas usan ahora `async-store.js`: una interfaz de promesas compartida
por SQLite local y el adaptador libSQL. Se conserva la conexión síncrona original
para migraciones, recuperación y fixtures, no para atender peticiones.

- Cola por instancia compartida: ninguna consulta ajena entra en una transacción
  SQLite mientras su callback está esperando. La cola no coordina varios procesos.
- Manejador de transacción explícito, invalidado al salir; se rechazan consultas
  raíz y transacciones anidadas dentro del callback, sin enrutamiento implícito.
- Callbacks heredados y respuestas HTTP después del commit; errores asíncronos
  enviados al manejador de Express, también en autenticación.
- Revalidación transaccional de sesión, actividad, rol, versión, local y obligación
  de renovar PIN antes de escribir. El hashing permanece fuera de la transacción.
- Fichajes, actividad del destinatario/asignado y permiso de tarea comprobados
  junto con su escritura. Dos comandos simultáneos no reutilizan un estado viejo.
- Recepción de hasta 500 líneas: una consulta de productos y un lote de cambios,
  conservando pedido, stock y auditoría en la misma transacción.
- Un COMMIT sin confirmación no se declara revertido ni se repite. Se conserva
  una foto ya subida si pudiera estar referenciada por un producto confirmado.

## Ensayo remoto observado el 19 de septiembre de 2026

Se ejecutó `runTursoApiProbe` contra la misma base desechable del
[bloque 32](recovery-turso-compatibility.md), en Irlanda. El cliente HTTP llamó a
una API Express real escuchando exclusivamente en loopback; esa API consultó
Turso mediante el SDK HTTP. No se desplegó ningún servidor público.

| Grupo de comprobaciones | Resultado | Tiempo del grupo |
| --- | --- | --- |
| Salud, listas y restricción de plantilla por rol | Correcto | 2694 ms |
| Ocho altas de gasto con una clave, recibo y conflicto | Correcto | 3524 ms |
| Nota, recuperación del recibo, fijado y borrado sintético | Correcto | 1633 ms |
| Proveedor, producto, pedido de 500 líneas y recepción única | Stock final 510 | 2565 ms |
| Fichaje completo, tarea y permiso de borrado | Correcto | 3327 ms |
| Logout y rechazo de la sesión revocada | Correcto | 468 ms |

Los grupos contienen varias peticiones; estos tiempos no son latencias de una
petición, percentiles ni un benchmark desde Render. La prueba crea exclusivamente
dos actores sintéticos sin PIN con sesiones aleatorias de diez minutos en memoria.
Al terminar se verificaron cero sesiones y cero usuarios activos. Se mantienen
los registros de negocio sintéticos; los borrados solo afectaron a notas/tareas
creadas por el propio ensayo. La base no se convierte en instalación operativa.

El token Turso autorizado no se guardó en archivos ni Git. El receptor privado
temporal terminó y se retiró el token de la sesión de trabajo tras comprobar el
resultado. El token del proveedor conserva su caducidad original de un día.

## Evidencia local y límites

`npm run check`: lint, 559 pruebas en 35 archivos, TypeScript y compilación
correctos. La ampliación incluye pruebas de aislamiento de cola, rollback, callbacks,
commit pendiente, revocación entre middleware y escritura, fichajes concurrentes,
deduplicación HTTP y retirada de sesiones del ensayo incluso al fallar.

Los 39 recorridos E2E y los cinco del frontend compilado pasan con Chrome y SQLite
local desechable. No son navegador contra Turso. El ensayo remoto tampoco cubre
login/PIN real, todas las altas de personal, varios servidores, corte de red en
COMMIT, backup remoto ni disponibilidad continuada.

El arranque ordinario aún exige SQLite: no se habilitan variables Turso mediante
una elección implícita ni se modifica el blueprint antiguo. Siguientes puertas:
fotos Cloudinary, arranque/bootstrap remoto explícito, copia y restauración,
revisión de exposición pública y despliegue en las cuentas gratuitas.
