# Run manually in a private PowerShell terminal. No files or persistent secrets.
[CmdletBinding()]
param([string]$NodePath = 'node')
$ErrorActionPreference = 'Stop'
$probeScript = Join-Path $PSScriptRoot '..\apps\api\scripts\turso-probe.js'
$probeUrl = Read-Host 'URL de una base Turso/libSQL NUEVA Y VACIA, exclusiva para el ensayo'
$probeUri = $null
if (-not [Uri]::TryCreate($probeUrl, [UriKind]::Absolute, [ref]$probeUri)) { throw 'URL no valida.' }
$confirmation = Read-Host "Se crearan esquema y datos sinteticos en $($probeUri.Host). Escribe el nombre completo de ese host para confirmar"
if ($confirmation -cne $probeUri.Host) { throw 'Host no confirmado. No se ha conectado.' }
$secureProbeToken = Read-Host 'Token exclusivo de esa base (entrada oculta; no pegarlo en el chat)' -AsSecureString
$previousProbeUrl = [Environment]::GetEnvironmentVariable('SALGUACATE_TURSO_PROBE_URL', 'Process')
$previousProbeToken = [Environment]::GetEnvironmentVariable('SALGUACATE_TURSO_PROBE_TOKEN', 'Process')
$tokenPointer = [IntPtr]::Zero
try {
    $tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureProbeToken)
    [Environment]::SetEnvironmentVariable('SALGUACATE_TURSO_PROBE_URL', $probeUrl, 'Process')
    [Environment]::SetEnvironmentVariable('SALGUACATE_TURSO_PROBE_TOKEN', [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer), 'Process')
    & $NodePath $probeScript --confirm-empty-disposable $confirmation
    if ($LASTEXITCODE -ne 0) { throw 'El ensayo no ha pasado. No activar la aplicacion ni reintentar sobre esta base.' }
} finally {
    [Environment]::SetEnvironmentVariable('SALGUACATE_TURSO_PROBE_URL', $previousProbeUrl, 'Process')
    [Environment]::SetEnvironmentVariable('SALGUACATE_TURSO_PROBE_TOKEN', $previousProbeToken, 'Process')
    if ($tokenPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer) }
    $secureProbeToken.Dispose()
    $previousProbeToken = $null
}
