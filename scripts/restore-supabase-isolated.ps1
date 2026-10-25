# OJ / Exterior R39 -- isolated Supabase logical-archive restore drill.
# Windows PowerShell 5.1 and PostgreSQL 17 client tools.
#
# NEVER connects to the live Supabase source. Inspect an existing private
# archive or restore to a pre-created, EMPTY disposable loopback database.
# Never drops, cleans, or overwrites user objects. Mechanical restoration is
# NOT application recovery, authenticated RLS testing, or Storage byte recovery.
[CmdletBinding()]
param(
  [ValidateSet('Inspect','Restore','VerifyTarget')][string]$Action = 'Inspect',
  [string]$ArchivePath = '',
  [string]$TargetHost = '127.0.0.1',
  [ValidateRange(1024,65535)][int]$TargetPort = 15432,
  [string]$TargetDatabase = '',
  [string]$TargetUser = 'postgres',
  [string]$TargetConfirmation = '',
  [string]$EvidenceDirectory = '',
  [string]$AgeIdentity = ''
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRef = 'vgckpcktsfuithqggknd'
$archivePattern = '^supabase-' + $projectRef + '-\d{8}T\d{6}Z\.dump(?:\.age)?$'
$privateRoot = if ($env:LOCALAPPDATA) {
  Join-Path $env:LOCALAPPDATA 'OJWorkspace\PrivateBackups\supabase'
} else { '' }

function CanonicalFile([string]$path,[string]$description) {
  if ([string]::IsNullOrWhiteSpace($path) -or -not [IO.Path]::IsPathRooted($path)) {
    throw "$description must be an explicit, absolute private path."
  }
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "$description was not found." }
  $item = Get-Item -LiteralPath $path -Force
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "$description cannot be a symlink or reparse point."
  }
  $full = $item.FullName
  if ($full -match '(?i)[\\/]oj-workspace(?:[\\/]|$)' -or
      $full -match '(?i)[\\/]oj-workspace-deploy-test(?:[\\/]|$)' -or
      $full -match '(?i)[\\/]oj-workspace-releases(?:[\\/]|$)') {
    throw "$description cannot live inside application source or deployment directories."
  }
  return $item
}
function SafeDirectory([string]$directory) {
  if ([string]::IsNullOrWhiteSpace($directory) -or -not [IO.Path]::IsPathRooted($directory)) {
    throw 'EvidenceDirectory must be an explicit absolute private directory.'
  }
  $full = [IO.Path]::GetFullPath($directory)
  if ($full -match '(?i)[\\/]oj-workspace(?:[\\/]|$)' -or
      $full -match '(?i)[\\/]oj-workspace-deploy-test(?:[\\/]|$)' -or
      $full -match '(?i)[\\/]oj-workspace-releases(?:[\\/]|$)') {
    throw 'Never store restore evidence or database logs in a repository or deployment folder.'
  }
  if (-not (Test-Path -LiteralPath $full)) {
    New-Item -ItemType Directory -Path $full -Force | Out-Null
  }
  $item = Get-Item -LiteralPath $full -Force
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'Evidence directory must not be a symlink or reparse point.'
  }
  if ($env:OS -eq 'Windows_NT') {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $acl = New-Object System.Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($entry in @($identity,'NT AUTHORITY\SYSTEM','BUILTIN\Administrators')) {
      $rule = New-Object System.Security.AccessControl.FileSystemAccessRule -ArgumentList @(
        $entry,'FullControl','ContainerInherit,ObjectInherit','None','Allow'
      )
      $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $full -AclObject $acl
  }
  return $full
}
function PgTool([string]$name) {
  $candidate = $null
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if ($cmd) { $candidate = $cmd.Source }
  elseif ($env:ProgramFiles) {
    $fixed = Join-Path $env:ProgramFiles ('PostgreSQL\17\bin\' + $name + '.exe')
    if (Test-Path -LiteralPath $fixed) { $candidate = $fixed }
  }
  if (-not $candidate -and $env:LOCALAPPDATA) {
    $portable = Join-Path $env:LOCALAPPDATA ('OJWorkspace\tools\pg17\portable\pgsql\bin\' + $name + '.exe')
    if (Test-Path -LiteralPath $portable) { $candidate = $portable }
  }
  if (-not $candidate) { throw "$name not found. Install PostgreSQL 17 client tools." }
  $version = (& $candidate --version | Out-String)
  if ($LASTEXITCODE -ne 0 -or $version -notmatch '(?i)(?:PostgreSQL\s+)?(\d+)\.(\d+)') {
    throw "Cannot determine $name version."
  }
  if ([int]$Matches[1] -ne 17) { throw "$name must be PostgreSQL 17." }
  return $candidate
}
function AgeTool {
  $command = Get-Command age.exe -ErrorAction SilentlyContinue
  if (-not $command) { $command = Get-Command age -ErrorAction SilentlyContinue }
  if ($command) { return $command.Source }
  if ($env:LOCALAPPDATA) {
    $pinned = Join-Path $env:LOCALAPPDATA 'OJWorkspace\tools\age\1.3.2\age\age.exe'
    if (Test-Path -LiteralPath $pinned) { return $pinned }
  }
  throw 'The approved age encryption tool is missing.'
}
function QuoteProcessArgument([string]$value) { return '"' + $value.Replace('"','\"') + '"' }
function StartByteProcess([string]$file,[string[]]$arguments,[bool]$redirectInput,[bool]$redirectOutput) {
  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = $file
  $info.Arguments = (($arguments | ForEach-Object { QuoteProcessArgument ([string]$_) }) -join ' ')
  $info.UseShellExecute = $false; $info.CreateNoWindow = $true
  $info.RedirectStandardInput = $redirectInput; $info.RedirectStandardOutput = $redirectOutput
  $info.RedirectStandardError = $true
  $process = New-Object System.Diagnostics.Process; $process.StartInfo = $info
  if (-not $process.Start()) { throw "Could not start $([IO.Path]::GetFileName($file))." }
  return $process
}
# Only constant, allowlisted diagnostic categories may escape a private restore.
# PostgreSQL stderr may contain SQL, object paths, roles or customer data;
# never include it in a public error, PR log or sanitized preflight report.
function SafePgRestoreCode([string]$errorText) {
  if ($errorText -match '(?i)(could not connect to server|connection refused|could not translate host name|no route to host|connection timed out)') {
    return 'TARGET_UNREACHABLE'
  }
  if ($errorText -match '(?i)(password authentication failed|no password supplied|authentication failed|no pg_hba.conf entry)') {
    return 'TARGET_AUTHENTICATION'
  }
  if ($errorText -match '(?i)(role .+ does not exist|must be member of role|permission denied to set role)') {
    return 'MISSING_TARGET_ROLE'
  }
  if ($errorText -match '(?i)(extension .+ is not available|extension .+ does not exist|could not open extension control file)') {
    return 'MISSING_TARGET_EXTENSION'
  }
  if ($errorText -match '(?i)(permission denied|must be owner|must be superuser|insufficient privilege)') {
    return 'TARGET_PRIVILEGES'
  }
  if ($errorText -match '(?i)(already exists|duplicate key value violates unique constraint)') {
    return 'TARGET_NOT_EMPTY_OR_DUPLICATE'
  }
  if ($errorText -match '(?i)(schema .+ does not exist|relation .+ does not exist|function .+ does not exist|type .+ does not exist)') {
    return 'MISSING_TARGET_DEPENDENCY'
  }
  return 'OTHER_POSTGRES_RESTORE_FAILURE'
}
function GetAgeIdentityText {
  if ($AgeIdentity) {
    if (-not (Test-Path -LiteralPath $AgeIdentity -PathType Leaf)) { throw 'Age recovery identity file was not found.' }
    return (Get-Content -LiteralPath $AgeIdentity -Raw).Trim()
  }
  $protectedIdentity = Join-Path $env:APPDATA 'OJWorkspace\supabase-backup\age-identity.dpapi'
  if (-not (Test-Path -LiteralPath $protectedIdentity -PathType Leaf)) {
    throw 'No local age identity is configured. Supply a separately stored recovery identity with -AgeIdentity.'
  }
  $secure = ConvertTo-SecureString ((Get-Content -LiteralPath $protectedIdentity -Raw).Trim())
  $handle = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($handle) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($handle) }
}
function PipeAgeToPgRestore([string]$archivePath,[string]$identity,[string[]]$restoreArguments) {
  $age = AgeTool; $restoreTool = PgTool 'pg_restore'
  $decryptor = $null; $restorer = $null
  try {
    $decryptor = StartByteProcess $age @('-d','-i','-','-o','-',$archivePath) $true $true
    $restorer = StartByteProcess $restoreTool $restoreArguments $true $true
    $ageError = $decryptor.StandardError.ReadToEndAsync()
    $pgError = $restorer.StandardError.ReadToEndAsync()
    $pgOutput = $restorer.StandardOutput.ReadToEndAsync()
    $decryptor.StandardInput.WriteLine($identity)
    $decryptor.StandardInput.Close()
    $copyFailure = $false
    $buffer = New-Object byte[] 65536
    while (($read = $decryptor.StandardOutput.BaseStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
      if (-not $copyFailure) {
        try { $restorer.StandardInput.BaseStream.Write($buffer, 0, $read) }
        catch {
          # pg_restore --list exits after the archive TOC. Continue draining
          # so age can authenticate the complete ciphertext before success.
          $copyFailure = $true
          try { $restorer.StandardInput.Close() } catch { }
        }
      }
    }
    try { $restorer.StandardInput.Close() } catch { }
    $decryptor.WaitForExit(); $restorer.WaitForExit()
    [void]$ageError.GetAwaiter().GetResult()
    $restoreOutput = $pgOutput.GetAwaiter().GetResult()
    $restoreError = $pgError.GetAwaiter().GetResult()
    if ($decryptor.ExitCode -ne 0) { throw "Encrypted archive authentication/decryption failed (age exit $($decryptor.ExitCode))." }
    if ($restorer.ExitCode -ne 0) {
      $code = SafePgRestoreCode $restoreError
      throw ('OJ_RECOVERY_CODE:' + $code + ' — PostgreSQL refused the isolated restore. Raw stderr remains private.')
    }
    return $restoreOutput + $restoreError
  } finally {
    if ($decryptor -and -not $decryptor.HasExited) { $decryptor.Kill(); $decryptor.WaitForExit() }
    if ($restorer -and -not $restorer.HasExited) { $restorer.Kill(); $restorer.WaitForExit() }
    if ($decryptor) { $decryptor.Dispose() }; if ($restorer) { $restorer.Dispose() }
  }
}
function ValidateTargetArguments {
  if ($TargetHost -ne '127.0.0.1' -and $TargetHost -ne 'localhost' -and $TargetHost -ne '::1') {
    throw 'REFUSED: target must be an isolated loopback-only disposable PostgreSQL instance; remote database host is not allowed.'
  }
  if ($TargetDatabase -cnotmatch '^oj_drill_[a-z0-9]{8,24}$') {
    throw 'REFUSED: target database must be named oj_drill_<8-24 lowercase letters or digits>.'
  }
  if ($TargetUser -notmatch '^[a-zA-Z_][a-zA-Z0-9_]{0,62}$') {
    throw 'REFUSED: invalid local database user.'
  }
  if ($TargetConfirmation -cne ('RESTORE ONLY INTO ' + $TargetDatabase)) {
    throw ('REFUSED: supply -TargetConfirmation "RESTORE ONLY INTO ' + $TargetDatabase + '" for this disposable local target.')
  }
  if ($TargetPort -eq 5432) {
    throw 'REFUSED: use a separately bound non-default target port, not the common source PostgreSQL port 5432.'
  }
}
function RunPsql([string]$sql,[string]$psql) {
  # The disposable target password must be set in .pgpass/PGPASSFILE or PGPASSWORD
  # by the operator; never print passwords or put them in CLI arguments.
  $args = @('-h',$TargetHost,'-p',"$TargetPort",'-U',$TargetUser,'-d',$TargetDatabase,
    '--no-psqlrc','--tuples-only','--no-align','-v','ON_ERROR_STOP=1','-c',$sql)
  $output = @(& $psql @args 2>&1)
  if ($LASTEXITCODE -ne 0) {
    throw 'Local disposable target query failed. Check the PRIVATE target connection and permissions.'
  }
  return (($output | Out-String).Trim())
}
# Invalid destinations are refused BEFORE archive tools or database commands.
if ($Action -ne 'Inspect') { ValidateTargetArguments }
if (-not $ArchivePath) {
  if (-not $privateRoot) { throw 'Supply -ArchivePath explicitly. Local private backup directory is unknown.' }
  $backups = @(Get-ChildItem -LiteralPath $privateRoot -Filter "supabase-$projectRef-*.dump.age" -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTimeUtc -Descending)
  if ($backups.Count -eq 0) { throw 'No private backup archive was found; run backup-supabase-windows.ps1 -Action Backup.' }
  $ArchivePath = $backups[0].FullName
}
$archive = CanonicalFile $ArchivePath 'Archive'
if ($archive.Name -cnotmatch $archivePattern) { throw 'Archive filename does not match the approved production project and timestamp format.' }
$manifestFile = CanonicalFile ($archive.FullName + '.manifest.json') 'Archive manifest'
$manifest = Get-Content -LiteralPath $manifestFile.FullName -Raw | ConvertFrom-Json
$hash = (Get-FileHash -LiteralPath $archive.FullName -Algorithm SHA256).Hash
if ($manifest.project_ref -cne $projectRef -or
    ($manifest.format -cne 'pg_dump-custom' -and $manifest.format -cne 'pg_dump-custom+age-v1') -or
    [int64]$manifest.size_bytes -ne [int64]$archive.Length -or
    $manifest.sha256 -cne $hash -or
    [int]$manifest.client_major -ne 17) {
  throw 'ARCHIVE BLOCKED: project, format, client version, byte length or SHA-256 mismatch.'
}
$restore = PgTool 'pg_restore'
$isEncrypted = $manifest.format -eq 'pg_dump-custom+age-v1'
if ($isEncrypted -and ($manifest.encrypted -ne $true -or $archive.Extension -ne '.age')) {
  throw 'ARCHIVE BLOCKED: age encryption metadata or filename is inconsistent.'
}
if ($isEncrypted) {
  $identityText = GetAgeIdentityText
  $archiveTocText = PipeAgeToPgRestore $archive.FullName $identityText @('--list')
  $identityText = $null
  if (-not $archiveTocText -or $archiveTocText -notmatch '(?m)^; Archive created at ') {
    throw 'ARCHIVE BLOCKED: decrypted PostgreSQL 17 archive table of contents is incomplete.'
  }
} else {
  $archiveToc = @(& $restore --list $archive.FullName 2>&1)
  if ($LASTEXITCODE -ne 0 -or $archiveToc.Count -lt 3) {
    throw 'ARCHIVE BLOCKED: PostgreSQL 17 pg_restore could not enumerate the custom-format archive.'
  }
}
if ($Action -eq 'Inspect') {
  Write-Output ('ARCHIVE READABLE: ' + $archive.Name)
  Write-Output ('SHA-256: ' + $hash)
  Write-Output ('Size bytes: ' + $archive.Length)
  Write-Output 'NO RESTORE WAS EXECUTED. This is not recovery verification.'
  Write-Output 'Storage bytes, global roles, grants, actor RLS and services remain unverified.'
  return
}
$psql = PgTool 'psql'
$evidenceRoot = if ($EvidenceDirectory) { $EvidenceDirectory } else {
  if (-not $privateRoot) { throw 'Supply -EvidenceDirectory explicitly.' }
  Join-Path $privateRoot 'restore-drills'
}
$evidenceRoot = SafeDirectory $evidenceRoot
$receiptPath = Join-Path $evidenceRoot ($archive.BaseName + '-' + $TargetDatabase + '.receipt.json')
$restoreLogPath = Join-Path $evidenceRoot ($archive.BaseName + '-' + $TargetDatabase + '.pg-restore.log')
if ($Action -eq 'Restore') {
  if (Test-Path -LiteralPath $receiptPath) { throw 'A prior receipt already exists for this archive/target; create a NEW disposable database.' }
  $preflightSQL = @'
SELECT current_database() || '|' ||
 (SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.relkind IN ('r','p','v','m','f')
    AND n.nspname NOT IN ('pg_catalog','information_schema')
    AND n.nspname NOT LIKE 'pg_toast%'
    AND n.nspname NOT LIKE 'pg_temp%');
'@
  $preflight = RunPsql $preflightSQL $psql
  $parts = $preflight.Split('|')
  if ($parts.Count -ne 2 -or $parts[0] -cne $TargetDatabase -or $parts[1] -ne '0') {
    throw 'REFUSED: local target identity cannot be confirmed or contains preexisting user objects. Never restore over populated databases.'
  }
  if (Test-Path -LiteralPath $restoreLogPath) { throw 'A restore log already exists for target; create a NEW disposable database.' }
  $restoreArgs = @(
    '--host',$TargetHost,'--port',"$TargetPort",'--username',$TargetUser,
    '--dbname',$TargetDatabase,'--single-transaction','--exit-on-error',
    '--no-owner','--no-acl','--verbose'
  )
  Write-Output 'Single-transaction archive restore to the explicitly confirmed EMPTY LOCAL disposable target.'
  $restoreExit = -1
  $oldPref = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    if ($isEncrypted) {
      $identityText = GetAgeIdentityText
      $restoreOutput = PipeAgeToPgRestore $archive.FullName $identityText $restoreArgs
      $identityText = $null
      $restoreOutput | Out-File -LiteralPath $restoreLogPath -Encoding UTF8
      $restoreExit = 0
    } else {
      & $restore ($restoreArgs + @($archive.FullName)) 2>&1 | Out-File -LiteralPath $restoreLogPath -Encoding UTF8
      $restoreExit = $LASTEXITCODE
    }
  } finally {
    $ErrorActionPreference = $oldPref
  }
  if ($restoreExit -ne 0) {
    throw ('RESTORE FAILED (exit ' + $restoreExit + '). Review the PRIVATE restore log, provision compatible Supabase roles/extensions, create a NEW empty isolated target and retry. No receipt created.')
  }
}
# An independent VerifyTarget action re-queries target and compares with
# the original mechanical restore receipt; it cannot waive role/storage gates.
$inspectSQL = @'
SELECT json_build_object(
  'database', current_database(),
  'public_leads', (SELECT COUNT(*) FROM public.leads),
  'public_bookings', (SELECT COUNT(*) FROM public.bookings),
  'public_memberships', (SELECT COUNT(*) FROM public.oj_memberships),
  'public_cards', (SELECT COUNT(*) FROM public.oj_cards),
  'public_comments', (SELECT COUNT(*) FROM public.oj_comments),
  'auth_users', (SELECT COUNT(*) FROM auth.users),
  'public_tables', (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE'),
  'rls_enabled', (SELECT COUNT(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity),
  'source_policies', (SELECT COUNT(*) FROM pg_policies
     WHERE schemaname='public' AND tablename IN ('leads','bookings','oj_memberships','oj_cards','oj_comments'))
)::text;
'@
$raw = RunPsql $inspectSQL $psql
try { $counts = $raw | ConvertFrom-Json }
catch { throw 'Isolated database returned no valid source count evidence.' }
if ($counts.database -cne $TargetDatabase -or [int]$counts.public_tables -lt 5 -or
    [int]$counts.rls_enabled -lt 4 -or [int]$counts.source_policies -lt 5) {
  throw 'RESTORE VALIDATION FAILED: OJ tables / row-level security definitions are missing. Recovery not verified.'
}
if ($Action -eq 'VerifyTarget') {
  if (-not (Test-Path -LiteralPath $receiptPath)) {
    throw 'No earlier mechanical restore receipt exists for this exact archive/target. Run Restore first.'
  }
  $saved = Get-Content -LiteralPath $receiptPath -Raw | ConvertFrom-Json
  if ($saved.sha256 -cne $hash -or $saved.target_database -cne $TargetDatabase -or
      $saved.project_ref -cne $projectRef -or $saved.mechanical_restore_passed -ne $true) {
    throw 'Private restore receipt does not match hash, source, target or previous success.'
  }
  foreach ($field in @('public_leads','public_bookings','public_memberships','public_cards',
       'public_comments','auth_users','public_tables','rls_enabled','source_policies')) {
    if ([int64]$saved.target_counts.$field -ne [int64]$counts.$field) {
      throw ('Restore target drift detected since original receipt: ' + $field)
    }
  }
  Write-Output 'PASS: isolated target still matches the private mechanical restore receipt.'
  Write-Output 'NOT PROVEN: original source parity, authenticated RLS actor tests, Storage object bytes, complete recovery.'
  return
}
$receipt = [ordered]@{
  format = 'oj-exterior-isolated-restore-evidence-v1'
  project_ref = $projectRef
  archive_name = $archive.Name
  sha256 = $hash
  archive_size_bytes = $archive.Length
  restored_utc = (Get-Date).ToUniversalTime().ToString('o')
  target_database = $TargetDatabase
  target_isolated_claim = 'operator-confirmed-local-disposable'
  mechanical_restore_passed = $true
  target_counts = [ordered]@{
    public_leads = [int64]$counts.public_leads
    public_bookings = [int64]$counts.public_bookings
    public_memberships = [int64]$counts.public_memberships
    public_cards = [int64]$counts.public_cards
    public_comments = [int64]$counts.public_comments
    auth_users = [int64]$counts.auth_users
    public_tables = [int64]$counts.public_tables
    rls_enabled = [int64]$counts.rls_enabled
    source_policies = [int64]$counts.source_policies
  }
  source_vs_restore_reconciled = $false
  authenticated_rls_actor_tests_passed = $false
  storage_objects_restored = $false
  email_sms_and_webhooks_proven_disabled = $false
  complete_application_recovery_verified = $false
  production_migration_approved = $false
  note = 'Mechanical restore only. Other recovery and permissions gates remain separate. KEEP PRIVATE.'
}
($receipt | ConvertTo-Json -Depth 7) | Set-Content -LiteralPath $receiptPath -Encoding UTF8
Write-Output 'MECHANICAL RESTORE PASS: isolated target queried, OJ tables and RLS policies visible.'
Write-Output ('PRIVATE receipt: ' + $receiptPath)
Write-Output 'NOT A MIGRATION UNLOCK: original source counts, actor RLS, Storage objects and full application recovery NOT proven.'
