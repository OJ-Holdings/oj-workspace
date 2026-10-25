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
$ageIdentityFile = Join-Path $privateSettings 'age-identity.dpapi'
$defaultBackup = Join-Path $env:LOCALAPPDATA 'OJWorkspace\PrivateBackups\supabase'
$defaultRef = 'vgckpcktsfuithqggknd'

function ProtectDirectory([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { New-Item -ItemType Directory -Path $path -Force | Out-Null }
  # Use a private, explicit ACL so a copied credential or backup does not
  # accidentally inherit permissive permissions from a shared parent folder.
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  $acl = New-Object Security.AccessControl.DirectorySecurity
  $acl.SetAccessRuleProtection($true, $false)
  foreach ($entry in @($identity, 'NT AUTHORITY\SYSTEM', 'BUILTIN\Administrators')) {
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule -ArgumentList @(
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

function PhysicalDiskNumber([string]$path) {
  $root = [IO.Path]::GetPathRoot([IO.Path]::GetFullPath($path))
  if (-not $root -or $root -notmatch '^([A-Za-z]):\\$') {
    throw 'Backup locations must be on local Windows drive volumes.'
  }
  $partition = Get-Partition -DriveLetter $Matches[1] -ErrorAction Stop
  if (-not $partition) { throw 'Could not identify the physical disk for a backup destination.' }
  return [int]$partition.DiskNumber
}

function PostgreSQLTool([string]$name) {
  $command = Get-Command $name -ErrorAction SilentlyContinue
  $candidate = $null
  if ($command) {
    $candidate = $command.Source
  } else {
    $fixed = Join-Path $env:ProgramFiles ("PostgreSQL\17\bin\" + $name + '.exe')
    if (Test-Path -LiteralPath $fixed) { $candidate = $fixed }
    # EDB's portable PostgreSQL 17 package used for the isolated restore drill.
    # PATH changes do not reach already-open or elevated PowerShell windows.
    if (-not $candidate -and $env:LOCALAPPDATA) {
      $portable = Join-Path $env:LOCALAPPDATA ("OJWorkspace\tools\pg17\portable\pgsql\bin\" + $name + '.exe')
      if (Test-Path -LiteralPath $portable) { $candidate = $portable }
    }
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

function AgeTool {
  $command = Get-Command age.exe -ErrorAction SilentlyContinue
  if (-not $command) { $command = Get-Command age -ErrorAction SilentlyContinue }
  $candidate = if ($command) { $command.Source } else { $null }
  if (-not $candidate -and $env:LOCALAPPDATA) {
    $pinned = Join-Path $env:LOCALAPPDATA 'OJWorkspace\tools\age\1.3.2\age\age.exe'
    if (Test-Path -LiteralPath $pinned) { $candidate = $pinned }
  }
  if (-not $candidate) { throw 'The approved age encryption tool is missing. Install the pinned Windows release outside the repository.' }
  $version = (& $candidate --version | Out-String)
  if ($LASTEXITCODE -ne 0 -or $version -notmatch '(?i)\bv?1\.3\.2\b') {
    throw "age v1.3.2 is required for backup encryption (found: $version)"
  }
  return $candidate
}

function AgeKeygenTool {
  $age = AgeTool
  $candidate = Join-Path (Split-Path -Parent $age) 'age-keygen.exe'
  if (-not (Test-Path -LiteralPath $candidate)) { throw 'age-keygen.exe is missing beside the approved age tool.' }
  return $candidate
}

function QuoteProcessArgument([string]$value) {
  return '"' + $value.Replace('"','\"') + '"'
}

function StartByteProcess([string]$file,[string[]]$arguments,[bool]$redirectInput,[bool]$redirectOutput) {
  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = $file
  $info.Arguments = (($arguments | ForEach-Object { QuoteProcessArgument ([string]$_) }) -join ' ')
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardInput = $redirectInput
  $info.RedirectStandardOutput = $redirectOutput
  $info.RedirectStandardError = $true
  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $info
  if (-not $process.Start()) { throw "Could not start $([IO.Path]::GetFileName($file))." }
  return $process
}

function DescribeStreamChildFailure([string]$kind,[string]$stderr) {
  if ($kind -eq 'age') {
    if ($stderr -match '(?i)(unknown|invalid|malformed|unsupported).{0,48}(recipient|public key)|recipient.{0,48}(unknown|invalid|malformed)') {
      return 'age rejected the configured encryption recipient'
    }
    if ($stderr -match '(?i)(permission denied|access is denied|cannot open|failed to open|could not open)') {
      return 'age could not write the encrypted output in the configured backup directory'
    }
    return 'age exited while encrypting the backup stream'
  }
  if ($kind -eq 'pg_restore') {
    if ($stderr -match '(?i)(does not appear to be a valid archive|did not find magic string|unsupported version|invalid archive)') {
      return 'PostgreSQL could not read the decrypted stream as a custom-format archive'
    }
    return 'pg_restore exited while validating the decrypted archive'
  }
  if ($stderr -match '(?i)(password authentication failed|authentication failed|no password supplied)') {
    return 'Supabase rejected the stored database credentials'
  }
  if ($stderr -match '(?i)(could not translate host|connection timed out|timeout expired|could not connect|no route to host|SSL connection has been closed)') {
    return 'pg_dump could not maintain its database connection'
  }
  if ($stderr -match '(?i)(permission denied|access is denied|no space left|disk full)') {
    return 'pg_dump could not read the database stream or the destination ran out of space'
  }
  return 'pg_dump exited while reading the database'
}

function EncryptProcessOutput([string]$producer,[string[]]$producerArgs,[string]$recipient,[string]$encryptedPath) {
  $age = AgeTool
  $source = $null
  $encryptor = $null
  try {
    $encryptor = StartByteProcess $age @('-r',$recipient,'-o',$encryptedPath) $true $false
    $ageErrors = $encryptor.StandardError.ReadToEndAsync()
    $source = StartByteProcess $producer $producerArgs $false $true
    $sourceErrors = $source.StandardError.ReadToEndAsync()
    $copyFailure = $null
    try {
      $source.StandardOutput.BaseStream.CopyTo($encryptor.StandardInput.BaseStream)
    } catch {
      $copyFailure = $_.Exception
    }
    if ($copyFailure -and -not $source.HasExited) {
      # A consumer that exits early closes its stdin pipe. Stop the producer
      # before waiting so it cannot remain blocked on a full stdout pipe.
      $source.Kill()
    }
    try { $encryptor.StandardInput.Close() } catch { }
    $source.WaitForExit()
    $encryptor.WaitForExit()
    $sourceErrorText = $sourceErrors.GetAwaiter().GetResult()
    $ageErrorText = $ageErrors.GetAwaiter().GetResult()
    if ($copyFailure) {
      if ($encryptor.ExitCode -ne 0) {
        $cause = DescribeStreamChildFailure 'age' $ageErrorText
      } elseif ($source.ExitCode -ne 0) {
        $cause = DescribeStreamChildFailure 'pg_dump' $sourceErrorText
      } else {
        $cause = 'the operating system closed a process stream unexpectedly'
      }
      throw "Backup stream stopped early: $cause (pg_dump exit $($source.ExitCode), age exit $($encryptor.ExitCode)). No plaintext dump was retained."
    }
    if ($source.ExitCode -ne 0) { throw "PostgreSQL dump failed (exit $($source.ExitCode)); no plaintext archive was retained." }
    if ($encryptor.ExitCode -ne 0) {
      $cause = DescribeStreamChildFailure 'age' $ageErrorText
      throw "Backup encryption failed: $cause (age exit $($encryptor.ExitCode)). No plaintext archive was retained."
    }
    if (-not (Test-Path -LiteralPath $encryptedPath) -or (Get-Item -LiteralPath $encryptedPath).Length -lt 64) {
      throw 'age did not produce a complete encrypted archive.'
    }
  } finally {
    if ($source -and -not $source.HasExited) { $source.Kill(); $source.WaitForExit() }
    if ($encryptor -and -not $encryptor.HasExited) { $encryptor.Kill(); $encryptor.WaitForExit() }
    if ($source) { $source.Dispose() }
    if ($encryptor) { $encryptor.Dispose() }
  }
}

function GetAgeIdentityPlaintext {
  $protected = Get-Content -LiteralPath $ageIdentityFile -Raw
  $secure = ConvertTo-SecureString $protected.Trim()
  $handle = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($handle) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($handle) }
}

function TestEncryptedArchive([string]$archivePath,[string]$identity) {
  $age = AgeTool
  $restore = PostgreSQLTool 'pg_restore'
  $decryptor = $null
  $inspector = $null
  try {
    $decryptor = StartByteProcess $age @('-d','-i','-','-o','-',$archivePath) $true $true
    $decryptErrors = $decryptor.StandardError.ReadToEndAsync()
    # pg_restore reads stdin when no archive filename is supplied.
    $inspector = StartByteProcess $restore @('--list') $true $true
    $inspectErrors = $inspector.StandardError.ReadToEndAsync()
    $inspectOutput = $inspector.StandardOutput.ReadToEndAsync()
    $decryptor.StandardInput.WriteLine($identity)
    $decryptor.StandardInput.Close()
    $copyFailure = $null
    $buffer = New-Object byte[] 65536
    while (($read = $decryptor.StandardOutput.BaseStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
      if (-not $copyFailure) {
        try {
          $inspector.StandardInput.BaseStream.Write($buffer, 0, $read)
        } catch {
          # pg_restore --list reads the archive header and TOC, then exits
          # without consuming the payload. Keep draining age's output so it
          # can reach EOF and verify the authenticated-encryption trailer.
          $copyFailure = $_.Exception
          try { $inspector.StandardInput.Close() } catch { }
        }
      }
    }
    try { $inspector.StandardInput.Close() } catch { }
    $decryptor.WaitForExit()
    $inspector.WaitForExit()
    $decryptErrorText = $decryptErrors.GetAwaiter().GetResult()
    $inspectErrorText = $inspectErrors.GetAwaiter().GetResult()
    [void]$inspectOutput.GetAwaiter().GetResult()
    # A broken pipe alone is expected when --list exits after reading the TOC;
    # success requires age to drain/authenticate to EOF and pg_restore to pass.
    if ($decryptor.ExitCode -ne 0 -or $inspector.ExitCode -ne 0) {
      if ($inspector.ExitCode -ne 0) {
        $cause = DescribeStreamChildFailure 'pg_restore' $inspectErrorText
      } elseif ($decryptor.ExitCode -ne 0) {
        $cause = DescribeStreamChildFailure 'age' $decryptErrorText
      } else {
        $cause = 'the operating system closed a process stream unexpectedly'
      }
      throw "Encrypted archive validation failed: $cause (age exit $($decryptor.ExitCode), pg_restore exit $($inspector.ExitCode))."
    }
  } finally {
    if ($decryptor -and -not $decryptor.HasExited) { $decryptor.Kill(); $decryptor.WaitForExit() }
    if ($inspector -and -not $inspector.HasExited) { $inspector.Kill(); $inspector.WaitForExit() }
    if ($decryptor) { $decryptor.Dispose() }
    if ($inspector) { $inspector.Dispose() }
  }
}

function ReadSettings {
  if (-not (Test-Path -LiteralPath $settingsFile) -or -not (Test-Path -LiteralPath $secretFile) -or
      -not (Test-Path -LiteralPath $ageIdentityFile)) {
    throw "Backup credentials are not configured. Run .\scripts\backup-supabase-windows.ps1 -Action Configure first."
  }
  $settings = Get-Content -LiteralPath $settingsFile -Raw | ConvertFrom-Json
  if ($settings.project_ref -ne $defaultRef -or
      $settings.host -notmatch '^[a-z0-9.-]+\.pooler\.supabase\.com$' -or
      $settings.user -notmatch '^[a-zA-Z0-9_.-]+$' -or
      [int]$settings.port -ne 5432 -or $settings.archive_encryption -ne 'age-v1' -or
      $settings.age_recipient -notmatch '^age1[a-z0-9]+$') {
    throw 'Stored backup settings are invalid or target a different project'
  }
  return $settings
}

if ($Action -eq 'Configure') {
  if (Test-Path -LiteralPath $ageIdentityFile -PathType Leaf) {
    throw 'Backup encryption is already configured. Refusing to replace its recovery identity because existing archives would become unrecoverable.'
  }
  $dump = PostgreSQLTool 'pg_dump'
  $restore = PostgreSQLTool 'pg_restore'
  $age = AgeTool
  $keygen = AgeKeygenTool
  Write-Output "Configuring a logical dump of Supabase project $defaultRef; the utility does not write database records."
  Write-Output 'In Supabase Dashboard > Connect, select SESSION POOLER (port 5432).'
  Write-Output 'Enter the hostname and username shown there. Do not paste a connection URI.'
  $hostName = (Read-Host 'Session pooler host').Trim()
  $userName = (Read-Host "Database user (usually postgres.$defaultRef)").Trim()
  if ($hostName -notmatch '^[a-z0-9.-]+\.pooler\.supabase\.com$' -or
      $userName -ne ('postgres.' + $defaultRef)) {
    throw 'Enter the Supabase-managed session-pooler hostname and the exact username for this project'
  }
  $password = Read-Host 'Database password (hidden; never saved in plain text)' -AsSecureString
  if (-not $password -or $password.Length -eq 0) { throw 'A database password is required' }
  $destination = if ($BackupDirectory) { $BackupDirectory } else { $defaultBackup }
  $destination = AssertSafeLocation $destination
  $offsite = if ($OffsiteDirectory) { AssertSafeLocation $OffsiteDirectory } else { '' }
  if ($offsite -and $offsite.TrimEnd('\') -eq $destination.TrimEnd('\')) {
    throw 'Offsite destination must be different from the primary destination'
  }
  if ($offsite -and (PhysicalDiskNumber $offsite) -eq (PhysicalDiskNumber $destination)) {
    throw 'The mirror must be on a separate physical disk from the primary backup.'
  }
  ProtectDirectory $privateSettings
  ProtectDirectory $destination
  if ($offsite) { ProtectDirectory $offsite }
  $keygenInfo = New-Object System.Diagnostics.ProcessStartInfo
  $keygenInfo.FileName = $keygen
  $keygenInfo.UseShellExecute = $false
  $keygenInfo.CreateNoWindow = $true
  $keygenInfo.RedirectStandardOutput = $true
  $keygenInfo.RedirectStandardError = $true
  $keygenProcess = New-Object System.Diagnostics.Process
  $keygenProcess.StartInfo = $keygenInfo
  if (-not $keygenProcess.Start()) { throw 'age-keygen could not start.' }
  $identityTask = $keygenProcess.StandardOutput.ReadToEndAsync()
  $recipientTask = $keygenProcess.StandardError.ReadToEndAsync()
  $keygenProcess.WaitForExit()
  $identityOutput = $identityTask.GetAwaiter().GetResult()
  $recipientOutput = $recipientTask.GetAwaiter().GetResult()
  $keygenProcess.Dispose()
  $identityMatch = [regex]::Match($identityOutput, '(?m)^(AGE-SECRET-KEY-[A-Z0-9]+)\s*$')
  $recipientMatch = [regex]::Match($recipientOutput, '(?m)^Public key:\s*(age1[a-z0-9]+)\s*$')
  if (-not $identityMatch.Success -or -not $recipientMatch.Success) {
    throw 'age-keygen did not return a valid recovery identity and public recipient.'
  }
  $identity = $identityMatch.Groups[1].Value
  Write-Host ''
  Write-Host 'RECOVERY KEY — save this privately outside this PC before continuing. Do not paste it into chat or source control:' -ForegroundColor Yellow
  Write-Host $identity -ForegroundColor Yellow
  $saved = Read-Host 'Type SAVED after placing this key in a secure password manager or encrypted offline vault'
  if ($saved -cne 'SAVED') { throw 'Configuration stopped; the recovery key was not confirmed as safely stored.' }
  $record = @{
    project_ref = $defaultRef
    host = $hostName
    port = 5432
    user = $userName
    database = 'postgres'
    backup_directory = $destination
    offsite_directory = $offsite
    age_recipient = $recipientMatch.Groups[1].Value
    archive_encryption = 'age-v1'
    configured_at = (Get-Date).ToUniversalTime().ToString('o')
  }
  $record | ConvertTo-Json | Set-Content -LiteralPath $settingsFile -Encoding UTF8
  $password | ConvertFrom-SecureString | Set-Content -LiteralPath $secretFile -Encoding UTF8
  ConvertTo-SecureString $identity -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath $ageIdentityFile -Encoding UTF8
  Write-Output 'Configuration saved with a Windows user-bound DPAPI database password and recovery identity.'
  Write-Output "Private backup destination: $destination"
  if ($offsite) { Write-Output "Encrypted second-copy destination on a separate physical disk: $offsite" }
  Write-Output 'Database archive bytes are streamed directly through age encryption; no plaintext dump is written to disk.'
  Write-Warning 'Keep the printed recovery identity in a separate secure vault. DPAPI alone cannot recover archives on another Windows account or PC.'
  Write-Output 'NOTE: Scheduled backups must run as THIS SAME Windows user to decrypt DPAPI credentials.'
  Write-Output 'NEXT: Run this script with -Action Backup to create an actual backup.'
  return
}

$settings = ReadSettings
$dumpRoot = AssertSafeLocation ([string]$settings.backup_directory)
ProtectDirectory $dumpRoot
$restore = PostgreSQLTool 'pg_restore'

if ($Action -eq 'Verify') {
  $backups = @(Get-ChildItem -LiteralPath $dumpRoot -Filter "supabase-$defaultRef-*.dump.age" -File -ErrorAction SilentlyContinue |
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
  $identity = GetAgeIdentityPlaintext
  TestEncryptedArchive $latest.FullName $identity
  $identity = $null
  if ($manifest.format -ne 'pg_dump-custom+age-v1' -or $manifest.encrypted -ne $true) {
    throw 'Latest backup is not marked as an authenticated age-encrypted PostgreSQL archive.'
  }
  Write-Output "Archive/checksum verified: $($latest.FullName)"
  Write-Output "Size: $($latest.Length) bytes; SHA256: $hash"
  Write-Output 'Authenticated decryption and PostgreSQL archive readability verified; a separate isolated restore drill is still required.'
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
  $credential = ConvertTo-SecureString ((Get-Content -LiteralPath $secretFile -Raw).Trim())
  $passwordBuffer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($credential)
  $plaintext = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordBuffer)
  $env:PGPASSWORD = $plaintext
  $env:PGSSLMODE = 'require'
  $env:PGCONNECT_TIMEOUT = '12'
  $stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
  $target = Join-Path $dumpRoot ("supabase-$defaultRef-$stamp.dump.age")
  $targetPartial = $target + '.partial'
  # age receives the pg_dump byte stream directly. No plaintext archive or
  # temporary plaintext dump is ever written to the backup volume.
  $args = @(
    '--format=custom', '--no-owner', '--verbose',
    '--host', [string]$settings.host,
    '--port', [string]$settings.port,
    '--username', [string]$settings.user,
    '--dbname', [string]$settings.database
  )
  Write-Output 'Creating a private age-encrypted logical database backup (source connection is read-only)...'
  $priorErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    EncryptProcessOutput $dump $args ([string]$settings.age_recipient) $targetPartial
  } finally { $ErrorActionPreference = $priorErrorActionPreference }
  $identity = GetAgeIdentityPlaintext
  TestEncryptedArchive $targetPartial $identity
  $identity = $null
  Move-Item -LiteralPath $targetPartial -Destination $target
  $targetPartial = $null

  $info = Get-Item -LiteralPath $target
  $digest = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
  $manifest = @{
    project_ref = $defaultRef
    produced_utc = (Get-Date).ToUniversalTime().ToString('o')
    size_bytes = $info.Length
    sha256 = $digest
    format = 'pg_dump-custom+age-v1'
    encrypted = $true
    encryption = 'age-v1; PostgreSQL dump streamed directly into authenticated encryption'
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
  Write-Output 'ENCRYPTED ARCHIVE AUTHENTICATED AND READABLE; FULL RESTORE NOT YET VERIFIED.'
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
