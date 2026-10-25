# Runs the guarded R39 restore against a disposable Supabase-compatible PG17
# container. Requires elevated Windows PowerShell and Docker Desktop.
[CmdletBinding()]
param(
  [string]$ArchivePath = '',
  [string]$EvidenceDirectory = '',
  [switch]$UseR40
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($env:OS -ne 'Windows_NT') { throw 'This restore drill is supported only on Windows.' }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Run this command in Administrator PowerShell so the private evidence-folder ACL can be secured.'
}

$docker = Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin\docker.exe'
if (-not (Test-Path -LiteralPath $docker)) { throw 'Docker Desktop CLI was not found. Start Docker Desktop and retry.' }
$dockerDirectory = Split-Path -Parent $docker
$env:PATH = $dockerDirectory + ';' + $env:PATH
$ErrorActionPreference = 'Continue'
$dockerInfo = @(& $docker info --format '{{.ServerVersion}}' 2>&1)
$dockerExit = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($dockerExit -ne 0 -or -not $dockerInfo) { throw 'Docker Desktop is not ready. Open Docker Desktop and wait for its engine to start.' }

$restoreScript = Join-Path $PSScriptRoot 'restore-supabase-isolated.ps1'
if (-not (Test-Path -LiteralPath $restoreScript)) { throw 'The guarded isolated restore helper is missing.' }
if ($UseR40) {
  $r40Script = Join-Path $PSScriptRoot 'exterior-r40-recovery-preflight.ps1'
  if (-not (Test-Path -LiteralPath $r40Script)) { throw 'The guarded R40 recovery preflight is missing.' }
  if (-not $ArchivePath) {
    $settingsPath = Join-Path $env:APPDATA 'OJWorkspace\supabase-backup\settings.json'
    if (-not (Test-Path -LiteralPath $settingsPath -PathType Leaf)) { throw 'Private backup settings are unavailable.' }
    $settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
    $backupDirectory = [string]$settings.backup_directory
    if (-not $backupDirectory -or -not (Test-Path -LiteralPath $backupDirectory -PathType Container)) { throw 'Private backup directory is unavailable.' }
    $latest = Get-ChildItem -LiteralPath $backupDirectory -Filter 'supabase-vgckpcktsfuithqggknd-*.dump.age' -File |
      Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
    if (-not $latest) { throw 'No encrypted source archive is available.' }
    $ArchivePath = $latest.FullName
  }
} elseif (-not $ArchivePath) {
  throw 'ArchivePath is required unless -UseR40 is selected.'
}
$archive = Get-Item -LiteralPath $ArchivePath -ErrorAction Stop
if ($archive.PSIsContainer -or $archive.Name -notmatch '^supabase-vgckpcktsfuithqggknd-\d{8}T\d{6}Z\.dump\.age$') {
  throw 'Archive path must be a file matching the configured encrypted production backup format.'
}
if (-not $EvidenceDirectory) { $EvidenceDirectory = Join-Path (Split-Path -Parent $archive.FullName) 'restore-drills' }

# Authenticate and enumerate the source archive before launching a database.
# R40 mode suppresses helper output because operator-facing evidence must be
# limited to sanitized status and diagnostic codes.
if ($UseR40) {
  & $restoreScript -Action Inspect -ArchivePath $archive.FullName -EvidenceDirectory $EvidenceDirectory *> $null
} else {
  & $restoreScript -Action Inspect -ArchivePath $archive.FullName -EvidenceDirectory $EvidenceDirectory
}
if ($UseR40) {
  $status = ((@(& $r40Script -Action Status -EmitSanitizedJson) -join '') | ConvertFrom-Json)
  if (-not $status.primary_archive_encryption_verified -or
      -not $status.mirror_archive_encryption_verified -or
      -not $status.backup_archive_checksum_verified -or
      -not $status.mirrored_archive_checksum_verified -or
      -not $status.archive_readable_with_pg17) {
    throw 'R40 archive preflight failed. No isolated database was started.'
  }
}

$listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback,15432)
try { $listener.Start(); $listener.Stop() }
catch { throw 'Port 15432 is already in use; stopping before creating a restore target.' }

$dockerImage = 'supabase/postgres:17.6.1.136@sha256:f371b5f3f2ac0a05703f33d6e6134515fb2498cab708fb948a0aeb7481467c00'
$suffix = [guid]::NewGuid().ToString('N').Substring(0,10)
$container = 'oj-restore-' + $suffix
$network = $container + '-net'
$volume = $container + '-data'
$database = 'oj_drill_' + $suffix
$networkCreated = $false
$volumeCreated = $false
$containerCreated = $false
$priorPostgresPassword = $env:POSTGRES_PASSWORD
$priorPgPassword = $env:PGPASSWORD
[byte[]]$random = New-Object byte[] 36
[void][Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($random)
$targetPassword = [Convert]::ToBase64String($random)

function Invoke-Docker([string[]]$Arguments,[string]$FailureMessage) {
  $prior = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $result = @(& $docker @Arguments 2>&1)
    $exit = $LASTEXITCODE
  } finally { $ErrorActionPreference = $prior }
  if ($exit -ne 0) {
    $safe = ($result | ForEach-Object { [string]$_ } | Where-Object { $_.Trim() } | Select-Object -First 1)
    if ($safe -and $safe.Length -gt 220) { $safe = $safe.Substring(0,220) }
    if ($safe) { throw ($FailureMessage + ' ' + $safe) }
    throw $FailureMessage
  }
  return $result
}

try {
  [void](Invoke-Docker @('network','create',$network) 'Could not create the disposable Docker network.')
  $networkCreated = $true
  [void](Invoke-Docker @('volume','create',$volume) 'Could not create the disposable restore volume.')
  $volumeCreated = $true
  $env:POSTGRES_PASSWORD = $targetPassword
  [void](Invoke-Docker @(
    'run','--detach','--name',$container,'--network',$network,
    '--publish','127.0.0.1:15432:5432','--volume',($volume + ':/var/lib/postgresql/data'),
    '--env','POSTGRES_PASSWORD','--env','POSTGRES_HOST_AUTH_METHOD=scram-sha-256',
    $dockerImage
  ) 'The isolated Supabase PostgreSQL container did not start.')
  $containerCreated = $true

  $ready = $false
  for ($attempt=0; $attempt -lt 60; $attempt++) {
    $health = Invoke-Docker @('inspect','--format','{{.State.Health.Status}}',$container) 'Could not inspect the disposable database health.'
    if (($health | Out-String).Trim() -eq 'healthy') { $ready = $true; break }
    Start-Sleep -Seconds 2
  }
  if (-not $ready) { throw 'The isolated PostgreSQL container did not become healthy within two minutes.' }

  # This container has no NET_ADMIN capability. A one-shot privileged exec
  # removes its default route; the host-published loopback port remains usable.
  [void](Invoke-Docker @('exec','--privileged','--user','root',$container,'ip','route','del','default') 'Could not disable outbound routing for the disposable database.')
  $routes = (Invoke-Docker @('exec','--user','root',$container,'ip','route') 'Could not verify the disposable database routes.') -join ' '
  if ($routes -match '(^|\s)default(\s|$)') { throw 'The disposable database still has an outbound default route.' }
  [void](Invoke-Docker @('exec',$container,'pg_isready','-U','supabase_admin','-d','postgres') 'The isolated Supabase database is not accepting local connections.')
  [void](Invoke-Docker @('exec',$container,'psql','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-c',("CREATE DATABASE {0} TEMPLATE template0 ENCODING 'UTF8';" -f $database)) 'Could not create the empty disposable restore database.')

  $env:PGPASSWORD = $targetPassword
  $reachable = $false
  for ($attempt=0; $attempt -lt 20; $attempt++) {
    $client = New-Object Net.Sockets.TcpClient
    try {
      $connect = $client.ConnectAsync('127.0.0.1',15432)
      if ($connect.Wait(500)) { $connect.GetAwaiter().GetResult(); $reachable = $true; break }
    } catch { }
    finally { $client.Dispose() }
    Start-Sleep -Milliseconds 500
  }
  if (-not $reachable) { throw 'Docker did not expose the database on Windows loopback.' }
  Write-Output 'Isolated Supabase PostgreSQL 17 target is healthy; network egress is disabled.'

  if ($UseR40) {
    $latestNow = Get-ChildItem -LiteralPath (Split-Path -Parent $archive.FullName) -Filter 'supabase-vgckpcktsfuithqggknd-*.dump.age' -File |
      Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
    if (-not $latestNow -or $latestNow.FullName -cne $archive.FullName) { throw 'The selected archive is no longer the newest source archive; no restore was started.' }
    try {
      $restoreReport = ((@(& $r40Script -Action Restore -TargetDatabase $database -TargetPort 15432 -TargetConfirmation ('RESTORE ONLY INTO ' + $database) -EmitSanitizedJson) -join '') | ConvertFrom-Json)
      if ($restoreReport.production_database_modified -ne $false -or
          $restoreReport.scratch_restore_performed_this_run -ne $true) { throw 'R40 restore receipt was not confirmed.' }
      $verifyReport = ((@(& $r40Script -Action VerifyTarget -TargetDatabase $database -TargetPort 15432 -TargetConfirmation ('RESTORE ONLY INTO ' + $database) -EmitSanitizedJson) -join '') | ConvertFrom-Json)
      if ($verifyReport.production_database_modified -ne $false -or $verifyReport.migration_authorized -ne $false) { throw 'R40 verification report was invalid.' }
    } catch {
      $safeMessage = [string]$_.Exception.Message
      if ($safeMessage -match '(?:OJ_RECOVERY_CODE:|Diagnostic code:\s*)([A-Z_]+)') { Write-Output ('OJ_RECOVERY_CODE=' + $Matches[1]) }
      else { Write-Output 'OJ_RECOVERY_CODE=R40_GUARDED_RESTORE_FAILURE' }
      throw 'R40 isolated restore did not complete. Private diagnostics remain on this host.'
    }
    Write-Output 'OJ_R40_RESTORE=PASS'
    Write-Output 'OJ_R40_VERIFYTARGET=PASS'
    Write-Output 'OJ_PRODUCTION_MODIFIED=FALSE'
    Write-Output 'OJ_MIGRATIONS_AUTHORIZED=FALSE'
  } else {
    & $restoreScript -Action Restore -TargetHost '127.0.0.1' -TargetPort 15432 -TargetDatabase $database -TargetUser 'supabase_admin' -TargetConfirmation ('RESTORE ONLY INTO ' + $database) -ArchivePath $archive.FullName -EvidenceDirectory $EvidenceDirectory
    & $restoreScript -Action VerifyTarget -TargetHost '127.0.0.1' -TargetPort 15432 -TargetDatabase $database -TargetUser 'supabase_admin' -TargetConfirmation ('RESTORE ONLY INTO ' + $database) -ArchivePath $archive.FullName -EvidenceDirectory $EvidenceDirectory
    Write-Output 'RESTORE DRILL PASSED. The disposable plaintext database will be removed; encrypted backups and private restore evidence remain.'
  }
} finally {
  $env:POSTGRES_PASSWORD = $priorPostgresPassword
  $env:PGPASSWORD = $priorPgPassword
  if ($containerCreated) { try { [void](Invoke-Docker @('rm','--force',$container) 'Could not remove the disposable database container.') } catch { Write-Warning ('Cleanup required for container ' + $container + '.') } }
  if ($networkCreated) { try { [void](Invoke-Docker @('network','rm',$network) 'Could not remove the disposable network.') } catch { Write-Warning ('Cleanup required for network ' + $network + '.') } }
  if ($volumeCreated) { try { [void](Invoke-Docker @('volume','rm',$volume) 'Could not remove the disposable database volume.') } catch { Write-Warning ('Cleanup required for volume ' + $volume + '.') } }
  $targetPassword = $null
}
