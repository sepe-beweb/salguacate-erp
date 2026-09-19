# Alta remota atómica sobre una base nueva

## Bloque 37: preparación local

`npm run bootstrap:remote -- --help` describe un comando separado del servidor.
Exige `--database-url`, `--confirm-host`, `--name` y `--secrets-stdin`. No lee `.env`
ni adopta variables de otro entorno. La entrada privada contiene exclusivamente
un objeto JSON con `token` y `pin`: no ponerlos en argumentos, archivos, historial
de terminal, Git ni chat. Utilizar un receptor privado o prompt seguro; el titular
introduce, confirma y envía personalmente su nuevo PIN.

La función valida destino exacto, nombre y PIN; realiza scrypt antes de abrir una
transacción. Después, en una sola transacción de escritura:

1. Rechaza cualquier objeto de usuario existente, aunque su tabla esté vacía.
2. Exige claves foráneas activadas y aplica el esquema derivado de las migraciones
   canónicas, sin una segunda copia DDL manual.
3. Inserta únicamente el propietario activo, con local `Todos`, hash scrypt y
   sin renovación pendiente, y el evento de auditoría del alta.
4. Comprueba las claves foráneas y confirma la transacción.

No inserta muestras, sesiones ni productos. Una vez confirmado el COMMIT, vuelve
a ejecutar las comprobaciones de esquema/propietario usadas por el arranque.
Un fallo antes del COMMIT se deja al rollback del adaptador; una confirmación
perdida devuelve `COMMIT_UNCONFIRMED`. Si falla la verificación posterior, devuelve
`BOOTSTRAP_VERIFICATION_UNCONFIRMED`: **el propietario puede estar creado**. Ningún
caso autoriza reintentar o borrar la base sin conciliación explícita.

Los errores del comando solo exponen códigos propios, nunca el mensaje del SDK,
JSON recibido, token o PIN. La conexión se cierra al terminar. Esto no cifra copias,
gestiona tokens operativos ni activa servicios.

## Evidencia y estado externo

`npm run check`: lint, **646 pruebas en 40 archivos**, TypeScript y compilación
correctos. Los 21 casos nuevos usan un doble asíncrono local del SDK, con SQLite en
memoria: instalación, login, esquema canónico, rechazo de bases existentes, rollback
del DDL/propietario/auditoría, COMMIT no confirmado, fallo posterior y entrada privada.
No equivalen a un bootstrap real en Turso.

El [bloque 36](recovery-remote-startup.md) está publicado como
`141a739a18d9b747b0231646f5af586ec867c77d`, con
[CI correcta](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35458569445)
y recorridos 40/5. El bloque 37 está publicado como
`bab3600661feaa724f8f5b68416adbb7cbc0e621`, con
[CI correcta](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35459183799).

Se ha creado mediante el panel una base nueva `salguacate-erp`, en la organización
personal Free y el grupo de Irlanda, separada de `salguacate-probe-20260919`.
La ficha recién creada indicó lecturas, escrituras y almacenamiento cero. Después
el titular introdujo y envió personalmente su nombre/PIN en el formulario local
privado. El proceso terminó con código cero y resultado `status: ready`,
`ownerId: 1`, `sampleDataInserted: false`, también visible en el formulario.
La inicialización real confirmó el COMMIT y superó la verificación posterior del
esquema, migraciones, claves foráneas y propietario. No es solo una inferencia de
los contadores del panel, ni acredita todavía un login remoto del titular.

Con autorización específica se ha emitido un token RW de un día exclusivo de esta
base, mantenido en memoria. Tras el alta se ejecutó y confirmó en el panel
`Invalidate Tokens` exclusivamente para esa base nueva, cuyo único token emitido
era el del alta. No se conservaron el token ni el PIN para repetir peticiones;
no se realizó una prueba HTTP 401 posterior. El plan Free no ofrece auditoría de
la organización. El proceso privado terminó y sus campos de credenciales se
vaciaron al enviar; su desaparición del formulario no indica un fallo del alta.
No se ha enviado ninguna credencial a Render. La clave temporal Cloudinary
del ensayo anterior sigue desactivada.

## Siguiente puerta

Tras el alta real, validar la instalación con el arranque y una credencial operativa
acotada, hacer el ensayo conjunto con fotos, preparar copia/restauración remotas y
revisar la exposición pública antes de activar Render. La base de compatibilidad
no se vacía ni se convierte en operacional para evitar este procedimiento.
