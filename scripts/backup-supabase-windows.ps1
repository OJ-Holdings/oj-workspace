# OJ Workspace: local, Free-tier-compatible PostgreSQL backup utility.
# Windows PowerShell 5.1+; PostgreSQL 17 client utilities (pg_dump, pg_restore).
# NEVER put backup files or credentials in a source checkout or GitHub.
[CmdletBinding()]
param(
  [ValidateSet('Configure', 'Backup', 'Verify')][string]$Action = 'Verify',
  [string]$BackupDirectory = '',
  [string]$OffsiteDirectory = ''
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$privateSettings = Join-Path $env:APPDATA 'OJWorkspace\supabase-backup'
$settingsFile = Join-Path $privateSettings 'settings.json'
$secretFile = Join-Path $privateSettings 'password.dpapi'
$defaultBackup = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'OJWorkspacePrivateBackups\supabase'
$defaultRef = 'vgckpcktsfuithqggknd'

function ProtectDirectory([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { New-Item -ItemType Directory -Path $path -Force | Out-Null }
  # Use a private, explicit ACL so a copied credential or backup does not
  # accidentally inherit permissive permissions from a shared parent folder.
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  $acl = New-Object Security.AccessControl.DirectorySecurity
  $acl.SetAccessRuleProtection($true, $false)
  foreach ($entry in @($identity, 'NT AUTHORITY\SYSTEM', 'BUILTIN\Administrators')) {
    $rule = New-Object Security.AccessControl.FileSystemAccessRule(
      $entry, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'
    )
    $acl.AddAccessRule($rule)
  }
  Set-Acl -LiteralPath $path -AclObject $acl
}

function AssertSafeLocation([string]$path) {
  if ([string]::IsNullOrWhiteSpace($path)) { throw 'Backup location cannot be blank' }
  $full = [IO.Path]::GetFullPath($path)
  if (-not [IO.Path]::IsPathRooted($full)) { throw 'Backup location must be absolute' }
  if ($full -match '(?i)[\\/]oj-workspace(?:[\\/]|$)' -or
      $full -match '(?i)[\\/]oj-workspace-deploy-test(?:[\\/]|$)' -or
      $full -match '(?i)[\\/]oj-workspace-releases(?:[\\/]|$)') {
    throw 'Refusing to place sensitive backups inside an OJ Workspace source/deployment folder'
  }
  return $full
}

function PostgreSQLTool([string]$name) {
  $command = Get-Command $name -ErrorAction SilentlyContinue
  $candidate = $null
  if ($command) {
    $candidate = $command.Source
  } else {
    $fixed = Join-Path $env:ProgramFiles ("PostgreSQL\17\bin\" + $name + '.exe')
    if (Test-Path -LiteralPath $fixed) { $candidate = $fixed }
  }
  if (-not $candidate) {
    throw "$name was not found. Install the PostgreSQL 17 client tools, then reopen PowerShell."
  }
  $version = (& $candidate --version | Out-String)
  if ($LASTEXITCODE -ne 0 -or $version -notmatch '(\d+)\.(\d+)') {
    throw "Cannot determine $name client version"
  }
  if ([int]$Matches[1] -ne 17) {
    throw "$name must be PostgreSQL 17 for the project's current PostgreSQL 17 server (found: $version)"
  }
  return $candidate
}

function ReadSettings {
  if (-not (Test-Path -LiteralPath $settingsFile) -or -not (Test-Path -LiteralPath $secretFile)) {
    throw "Backup credentials are not configured. Run .\scripts\backup-supabase-windows.ps1 -Action Configure first."
  }
  $settings = Get-Content -LiteralPath $settingsFile -Raw | ConvertFrom-Json
  if ($settings.project_ref -ne $defaultRef -or
      $settings.host -notmatch '^[a-zA-Z0-9.-]+$' -or
      $settings.user -notmatch '^[a-zA-Z0-9_.-]+$' -or
      [int]$settings.port -ne 5432) {
    throw 'Stored backup settings are invalid or target a different project'
  }
  return $settings
}

if ($Action -eq 'Configure') {
  $dump = PostgreSQLTool 'pg_dump'
  $restore = PostgreSQLTool 'pg_restore'
  Write-Output "Configuring a read-only dump of Supabase project $defaultRef."
  Write-Output 'In Supabase Dashboard > Connect, select SESSION POOLER (port 5432).'
  Write-Output 'Enter the hostname and username shown there. Do not paste a connection URI.'
  $hostName = (Read-Host 'Session pooler host').Trim()
  $userName = (Read-Host "Database user (usually postgres.$defaultRef)").Trim()
  if ($hostName -notmatch '^[a-zA-Z0-9.-]+$' -or
      $userName -ne ('postgres.' + $defaultRef)) {
    throw 'The host must be a DNS name and the user must match this project session-pooler username'
  }
  $password = Read-Host 'Database password (hidden; never saved in plain text)' -AsSecureString
  if (-not $password -or $password.Length -eq 0) { throw 'A database password is required' }
  $destination = if ($BackupDirectory) { $BackupDirectory } else { $defaultBackup }
  $destination = AssertSafeLocation $destination
  $offsite = if ($OffsiteDirectory) { AssertSafeLocation $OffsiteDirectory } else { '' }
  if ($offsite -and $offsite.TrimEnd('\') -eq $destination.TrimEnd('\')) {
    throw 'Offsite destination must be different from the primary destination'
  }
  ProtectDirectory $privateSettings
  ProtectDirectory $destination
  $record = @{
    project_ref = $defaultRef
    host = $hostName
    port = 5432
    user = $userName
    database = 'postgres'
    backup_directory = $destination
    offsite_directory = $offsite
    configured_at = (Get-Date).ToUniversalTime().ToString('o')
  }
  $record | ConvertTo-Json | Set-Content -LiteralPath $settingsFile -Encoding UTF8
  $password | ConvertFrom-SecureString | Set-Content -LiteralPath $secretFile -Encoding UTF8
  Write-Output 'Configuration saved with a Windows user-bound DPAPI-encrypted password.'
  Write-Output "Private backup destination: $destination"
  Write-Output 'NOTE: Scheduled backups must run as THIS SAME Windows user to decrypt DPAPI credentials.'
  Write-Output 'NEXT: Run this script with -Action Backup to create an actual backup.'
  return
}

$settings = ReadSettings
$dumpRoot = AssertSafeLocation ([string]$settings.backup_directory)
ProtectDirectory $dumpRoot
$restore = PostgreSQLTool 'pg_restore'

if ($Action -eq 'Verify') {
  $backups = @(Get-ChildItem -LiteralPath $dumpRoot -Filter 'supabase-*.dump' -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTimeUtc -Descending)
  if ($backups.Count -lt 1) { throw "No completed backups found in $dumpRoot" }
  $latest = $backups[0]
  $manifestPath = $latest.FullName + '.manifest.json'
  if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'Missing manifest for latest backup' }
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  $hash = (Get-FileHash -LiteralPath $latest.FullName -Algorithm SHA256).Hash
  if ($manifest.sha256 -ne $hash -or $manifest.size_bytes -ne $latest.Length -or
      $manifest.project_ref -ne $defaultRef) {
    throw 'Backup checksum, size or project identity did not match'
  }
  & $restore --list $latest.FullName *> $null
  if ($LASTEXITCODE -ne 0) { throw 'pg_restore cannot read the backup archive' }
  Write-Output "Archive/checksum verified: $($latest.FullName)"
  Write-Output "Size: $($latest.Length) bytes; SHA256: $hash"
  Write-Output 'This validates archive readability, NOT restoration. A separate isolated restore drill is still required.'
  return
}

# Backup action. Password exists only as DPAPI ciphertext on disk and within
# this account's short-lived process environment while pg_dump is executing.
$dump = PostgreSQLTool 'pg_dump'
$passwordBuffer = $null
$plaintext = $null
$targetPartial = $null
$oldPw = $env:PGPASSWORD
$oldSsl = $env:PGSSLMODE
$oldTimeout = $env:PGCONNECT_TIMEOUT
try {
  $credential = Get-Content -LiteralPath $secretFile -Raw | ConvertTo-SecureString
  $passwordBuffer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($credential)
  $plaintext = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordBuffer)
  $env:PGPASSWORD = $plaintext
  $env:PGSSLMODE = 'require'
  $env:PGCONNECT_TIMEOUT = '12'
  $stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
  $target = Join-Path $dumpRoot ("supabase-$defaultRef-$stamp.dump")
  $targetPartial = $target + '.partial'
  # A custom-format dump includes non-system database schemas such as auth
  # and storage metadata. It does not contain Storage API object bytes or
  # global Postgres roles; verify actual restore compatibility separately.
  $args = @(
    '--format=custom', '--no-owner', '--no-acl', '--verbose',
    '--host', [string]$settings.host,
    '--port', [string]$settings.port,
    '--username', [string]$settings.user,
    '--dbname', [string]$settings.database,
    '--file', $targetPartial
  )
  Write-Output 'Creating encrypted-at-rest-location-dependent logical database backup (read-only source connection)...'
  $priorErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    & $dump @args 2>&1 | Out-Null
    $exitCode = $LASTEXITCODE
  } finally { $ErrorActionPreference = $priorErrorActionPreference }
  if ($exitCode -ne 0) {
    throw "pg_dump failed with code $exitCode. Verify the session pooler host, user, network and password."
  }
  if (-not (Test-Path -LiteralPath $targetPartial) -or
      (Get-Item -LiteralPath $targetPartial).Length -lt 1024) {
    throw 'pg_dump produced an unexpectedly small or absent file'
  }
  & $restore --list $targetPartial *> $null
  if ($LASTEXITCODE -ne 0) { throw 'pg_restore could not enumerate the archive' }
  Move-Item -LiteralPath $targetPartial -Destination $target
  $targetPartial = $null

  $info = Get-Item -LiteralPath $target
  $digest = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
  $manifest = @{
    project_ref = $defaultRef
    produced_utc = (Get-Date).ToUniversalTime().ToString('o')
    size_bytes = $info.Length
    sha256 = $digest
    format = 'pg_dump-custom'
    client_major = 17
    archive_list_checked = $true
    restored_in_isolation = $false
    warning = 'No Storage object bytes, no global roles, and not a complete verified restore.'
  }
  $manifest | ConvertTo-Json | Set-Content -LiteralPath ($target + '.manifest.json') -Encoding UTF8

  $offsite = [string]$settings.offsite_directory
  if ($offsite) {
    $offsite = AssertSafeLocation $offsite
    ProtectDirectory $offsite
    $copied = Join-Path $offsite $info.Name
    Copy-Item -LiteralPath $target -Destination $copied -ErrorAction Stop
    Copy-Item -LiteralPath ($target + '.manifest.json') -Destination ($copied + '.manifest.json') -ErrorAction Stop
    if ((Get-FileHash -LiteralPath $copied -Algorithm SHA256).Hash -ne $digest) {
      throw 'Offsite copy failed checksum verification'
    }
    Write-Output "Second backup copy verified at: $offsite"
  } else {
    Write-Warning 'No offsite directory configured. A second encrypted/off-device copy is strongly recommended.'
  }
  Write-Output "BACKUP CREATED: $target"
  Write-Output "SHA256: $digest"
  Write-Output 'ARCHIVE READABLE; FULL RESTORE NOT YET VERIFIED.'
  Write-Output 'Do not approve production schema migrations until a separate restore drill has succeeded.'
} finally {
  if ($targetPartial -and (Test-Path -LiteralPath $targetPartial)) {
    Remove-Item -LiteralPath $targetPartial -Force -ErrorAction SilentlyContinue
  }
  $env:PGPASSWORD = $oldPw
  $env:PGSSLMODE = $oldSsl
  $env:PGCONNECT_TIMEOUT = $oldTimeout
  if ($passwordBuffer) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordBuffer) }
  $plaintext = $null
}
