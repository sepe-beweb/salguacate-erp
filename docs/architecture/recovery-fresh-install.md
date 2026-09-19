# Instalación nueva y primer propietario

Trigésimo bloque. Decisión vigente: no hay datos anteriores que conservar; la instalación objetivo será nueva y vacía. Esto elimina la necesidad de migrar históricos en esta continuación, no autoriza a borrar directorios por aproximación ni activa un despliegue. No se ha eliminado ninguna instalación anterior ni creado credenciales reales.

## Comando explícito

Desde la raíz, `npm run bootstrap -- --help` describe las opciones. La nueva forma exige conjuntamente `--database`, `--name` y `--pin-stdin`; no lee `.env`, no interpreta configuración Turso/IA ni cae al modo de variables si falta una opción. La ruta debe ser absoluta, su padre debe existir y el archivo de base debe ser nuevo. La creación exclusiva impide sobrescribir incluso una base vacía o perder una carrera entre dos altas.

El PIN entra por stdin desde un prompt privado, nunca como argumento. Solo admite 6–8 dígitos y rechaza un único dígito repetido. El nombre se recorta y valida. La entrada no debe venir de un terminal visible; la lectura tiene límite y acepta un único fin de línea de la tubería. Los errores de argumentos no reproducen sus valores, evitando imprimir accidentalmente una credencial introducida como argumento.

El propietario recibe rol `owner`, local `Todos`, cuenta activa y PIN scrypt con salt individual; no necesita renovar ese PIN recién elegido. No se crean productos, empleados, cierres, notas ni registros de ejemplo. Se vuelve a comprobar la ausencia de usuarios dentro de la transacción de alta.

La creación del archivo solicita modo 0600 en sistemas POSIX. En Windows hay que revisar las ACL del directorio elegido: ese modo no sustituye los permisos de Windows ni configura el almacenamiento del servicio.

Si la inicialización falla después de crear el archivo, puede quedar una base parcial sin propietario. El comando no la elimina ni la reutiliza automáticamente: conservar para diagnóstico y elegir otro destino nuevo. El modo no es un instalador de servicios, no configura la API/frontend ni almacena el PIN en un archivo.

## Operación local propuesta

1. Elegir directorio de datos **nuevo** fuera del repositorio, nombre del propietario y ubicación de uploads. No usar destinos de ejemplo como si ya estuvieran autorizados o vacíos. Preparar el directorio padre y revisar sus permisos privados.
2. Con el runtime fijado y dependencias instaladas, ejecutar desde la raíz el siguiente patrón en PowerShell. Pedir el PIN con entrada oculta; no pegarlo en el chat, comandos literales, historial, variables persistentes ni `.env`.

```powershell
$installationDatabase = Read-Host 'Ruta absoluta del nuevo archivo SQLite'
$installationOwner = Read-Host 'Nombre del primer propietario'
$installationPin = Read-Host 'PIN privado de 6 a 8 dígitos' -AsSecureString
$installationPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($installationPin)
try {
    [Runtime.InteropServices.Marshal]::PtrToStringBSTR($installationPointer) |
        npm run bootstrap -- --database $installationDatabase --name $installationOwner --pin-stdin
    if ($LASTEXITCODE -ne 0) { throw 'Alta inicial fallida; no activar este destino.' }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($installationPointer)
    $installationPin.Dispose()
}
```

El PIN existe transitoriamente en memoria de los procesos para poder comprobarlo y aplicar scrypt. Este patrón evita el argumento y archivo persistente, pero no promete borrado perfecto de todas las copias de memoria ni protege un equipo comprometido. No registrar transcripciones de stdin ni redirigir la tubería a archivos.

3. Configurar la API para **esa misma ruta** mediante `SQLITE_DATABASE_PATH` y para el directorio de fotos mediante `UPLOADS_DIR`; no añadir las variables BOOTSTRAP. Mantener `AI_ENABLED=false`, host loopback y orígenes locales exactos para el primer ensayo. La configuración operativa normal de la API sigue leyendo su `.env`; el modo explícito de bootstrap es el que no lo lee.
4. Arrancar API/frontend, comprobar disponibilidad, entrar con el propietario y verificar catálogos vacíos. Crear únicamente los locales/perfiles/productos requeridos para la operación acordada, no importar fixtures de tests. No se implementa un editor nuevo de locales por este bloque.
5. Antes de exponer o desplegar: elegir entorno/URL, validar volumen persistente, orígenes, acceso público y reglas por local. Preparar backup desde el momento en que haya datos que conservar. Eliminar la migración histórica no elimina estas puertas de seguridad ni las de publicación.

## Compatibilidad y pruebas

`npm run bootstrap` sin argumentos conserva el modo BOOTSTRAP del entorno. Ahora rechaza una base con usuarios en una inspección de solo lectura **antes** de inicializar/migrar, y vuelve a comprobarlo en la transacción. No usar este modo para reiniciar o restablecer PIN de una instalación.

Pruebas sobre archivos temporales: propietario único y login real contra API local, hash correcto, ausencia de semillas, repetición sin cambios, carrera entre dos altas, entradas inválidas sin crear base, conservación byte a byte de una base histórica rechazada y ejecución real del CLI con configuración ambiental deliberadamente incompatible. La salida no muestra el PIN ni siquiera ante argumentos incorrectos. El prompt privado requiere intervención del operador y no se ha ejecutado con una credencial real.

El bloque anterior de fotos se publicó como `ccccf5c633fc42880928b50ed805388f246a00a8`, con [CI correcta](https://github.com/sepe-beweb/salguacate-erp/actions/runs/35444372055). Esta evidencia previa no acredita por sí sola la ampliación del bootstrap.

Validación local: `npm run check` supera 510 pruebas en 32 archivos, lint, TypeScript y build; pasan 39 recorridos de navegador y 5 de archivos compilados. El comando raíz de ayuda y la sintaxis de ambos módulos se comprueban sin abrir `.env` ni crear una instalación. El script npm raíz invoca directamente el CLI para conservar todos los argumentos explícitos. Sin nuevas dependencias ni cambios del bundle web.
