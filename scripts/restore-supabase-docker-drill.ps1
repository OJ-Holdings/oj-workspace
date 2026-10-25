# Runs the guarded R39 restore against a disposable Supabase-compatible PG17
# container. Requires elevated Windows PowerShell and Docker Desktop.
[CmdletBinding()]
param(
  [string]$ArchivePath = '',
  [string]$EvidenceDirectory = '',
  [switch]$UseR40,
  [switch]$RefreshBackup
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
  if ($RefreshBackup) {
    if ($ArchivePath) { throw 'Do not combine -RefreshBackup with a pinned ArchivePath.' }
    $backupReport = ((@(& $r40Script -Action Backup -EmitSanitizedJson) -join '') | ConvertFrom-Json)
    if ($backupReport.production_database_modified -ne $false -or
        $backupReport.backup_created_this_run -ne $true -or
        $backupReport.migration_authorized -ne $false) {
      throw 'R40 did not confirm creation of a new encrypted backup. No restore target was started.'
    }
  }
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
} elseif ($RefreshBackup) {
  throw '-RefreshBackup requires -UseR40.'
}
$archive = Get-Item -LiteralPath $ArchivePath -ErrorAction Stop
if ($archive.PSIsContainer -or $archive.Name -notmatch '^supabase-vgckpcktsfuithqggknd-\d{8}T\d{6}Z\.dump\.age$') {
  throw 'Archive path must be a file matching the configured encrypted production backup format.'
}
if (-not $EvidenceDirectory) { $EvidenceDirectory = Join-Path (Split-Path -Parent $archive.FullName) 'restore-drills' }
if ($UseR40) {
  $archiveManifest = Get-Content -LiteralPath ($archive.FullName + '.manifest.json') -Raw | ConvertFrom-Json
  Write-Output ('OJ_ARCHIVE_PRODUCED_UTC=' + [string]$archiveManifest.produced_utc)
}

# Authenticate and enumerate the source archive before launching a database.
# R40 mode suppresses helper output because operator-facing evidence must be
# limited to sanitized status and diagnostic codes.
if ($UseR40) {
  $archiveInspection = @(& $restoreScript -Action Inspect -ArchivePath $archive.FullName -EvidenceDirectory $EvidenceDirectory 2>&1)
  $archiveTableLine = $archiveInspection | ForEach-Object { [string]$_ } | Where-Object { $_ -match '^OJ_ARCHIVE_PUBLIC_TABLES=' } | Select-Object -First 1
  $archiveTableNames = if ($archiveTableLine) { @(($archiveTableLine -replace '^OJ_ARCHIVE_PUBLIC_TABLES=','') -split '\|' | Where-Object { $_ }) } else { @() }
  $archiveTimestampLine = $archiveInspection | ForEach-Object { [string]$_ } | Where-Object { $_ -match '^OJ_ARCHIVE_PRODUCED_UTC=' } | Select-Object -First 1
  if (-not $archiveTimestampLine) { throw 'The encrypted archive inspection did not provide its creation timestamp.' }
  $archiveTocCreatedLine = $archiveInspection | ForEach-Object { [string]$_ } | Where-Object { $_ -match '^OJ_ARCHIVE_TOC_CREATED=' } | Select-Object -First 1
  if (-not $archiveTocCreatedLine) { throw 'The encrypted archive TOC did not provide its creation timestamp.' }
  Write-Output $archiveTocCreatedLine
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

$psql = Join-Path $env:LOCALAPPDATA 'OJWorkspace\tools\pg17\portable\pgsql\bin\psql.exe'
if (-not (Test-Path -LiteralPath $psql -PathType Leaf)) { throw 'The verified PostgreSQL 17 psql client is missing.' }
function Invoke-Psql([string]$DbHost,[int]$Port,[string]$Database,[string]$User,[string]$Sql) {
  $psqlArgs = @('-h',$DbHost,'-p',"$Port",'-U',$User,'-d',$Database,'-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',$Sql)
  $prior = $ErrorActionPreference
  try { $ErrorActionPreference = 'Continue'; $lines = @(& $psql @psqlArgs 2>&1); $exit = $LASTEXITCODE }
  finally { $ErrorActionPreference = $prior }
  return [pscustomobject]@{ ExitCode=[int]$exit; Text=(($lines | ForEach-Object { [string]$_ }) -join [Environment]::NewLine).Trim() }
}
function Invoke-SourcePsql([string]$Sql) {
  $settingsPath = Join-Path $env:APPDATA 'OJWorkspace\supabase-backup\settings.json'
  $secretPath = Join-Path $env:APPDATA 'OJWorkspace\supabase-backup\password.dpapi'
  $settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
  $cipher = (Get-Content -LiteralPath $secretPath -Raw).Trim()
  $secure = ConvertTo-SecureString $cipher
  $buffer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $priorPassword = $env:PGPASSWORD; $priorSsl = $env:PGSSLMODE; $priorTimeout = $env:PGCONNECT_TIMEOUT
  try {
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($buffer)
    $env:PGSSLMODE = 'require'; $env:PGCONNECT_TIMEOUT = '15'
    return (Invoke-Psql ([string]$settings.host) ([int]$settings.port) ([string]$settings.database) ([string]$settings.user) $Sql)
  } finally {
    Remove-Item Env:PGPASSWORD,Env:PGSSLMODE,Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue
    if ($priorPassword) { $env:PGPASSWORD = $priorPassword }; if ($priorSsl) { $env:PGSSLMODE = $priorSsl }; if ($priorTimeout) { $env:PGCONNECT_TIMEOUT = $priorTimeout }
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($buffer)
  }
}
function Invoke-TargetPsql([string]$Sql) {
  return (Invoke-Psql '127.0.0.1' 15432 $database 'supabase_admin' $Sql)
}
function Get-LastNumericValue([string]$Text) {
  $matches = [regex]::Matches($Text,'(?m)^\s*(\d+)\s*$')
  if ($matches.Count -eq 0) { return $null }
  return [int64]$matches[$matches.Count - 1].Groups[1].Value
}
function Get-CatalogSetDifference($Left,$Right) {
  $rightSet = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  foreach ($entry in @($Right)) { $null = $rightSet.Add([string]$entry) }
  return @($Left | Where-Object { -not $rightSet.Contains([string]$_) })
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

    $catalogSql = @'
SELECT json_build_object(
  'tables',(SELECT coalesce(json_agg(table_name ORDER BY table_name),'[]'::json)
    FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'),
  'constraints',(SELECT coalesce(json_agg(n.nspname||'.'||r.relname||'.'||c.conname||'|'||md5(json_build_array(c.contype,c.convalidated,pg_get_constraintdef(c.oid))::text) ORDER BY r.relname,c.conname),'[]'::json)
    FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public'),
  'policies',(SELECT coalesce(json_agg(schemaname||'.'||tablename||'.'||policyname||'|'||md5(json_build_array(permissive,ARRAY(SELECT role_name::text FROM unnest(roles) AS role_name ORDER BY 1),cmd,qual,with_check)::text) ORDER BY tablename,policyname),'[]'::json)
    FROM pg_policies WHERE schemaname='public'),
  'rls',(SELECT coalesce(json_agg(r.relname||'|'||r.relrowsecurity||'|'||r.relforcerowsecurity ORDER BY r.relname),'[]'::json)
    FROM pg_class r JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND r.relkind IN ('r','p'))
)::text;
'@
    $sourceCatalogResult = Invoke-SourcePsql $catalogSql
    $targetCatalogResult = Invoke-TargetPsql $catalogSql
    $publicTableParity = $false; $schemaSignatureParity = $false; $constraintParity = $false; $policyParity = $false; $rlsFlagParity = $false; $allRowCountParity = $false; $authUserCountParity = $false
    $sourceOnlyTables = @(); $targetOnlyTables = @(); $archiveOnlyTables = @(); $sourceMissingFromArchive = @(); $constraintSourceOnly = @(); $constraintTargetOnly = @(); $policySourceOnly = @(); $policyTargetOnly = @(); $rlsSourceOnly = @(); $rlsTargetOnly = @(); $sourceCatalog = $null; $targetCatalog = $null
    if ($sourceCatalogResult.ExitCode -eq 0 -and $targetCatalogResult.ExitCode -eq 0) {
      try {
        $sourceCatalog = $sourceCatalogResult.Text | ConvertFrom-Json
        $targetCatalog = $targetCatalogResult.Text | ConvertFrom-Json
        $sourceNames = @($sourceCatalog.tables | ForEach-Object { [string]$_ } | Sort-Object -CaseSensitive -Unique)
        $targetNames = @($targetCatalog.tables | ForEach-Object { [string]$_ } | Sort-Object -CaseSensitive -Unique)
        $sourceNameSet = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        $targetNameSet = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        foreach ($name in $sourceNames) { $null = $sourceNameSet.Add($name) }
        foreach ($name in $targetNames) { $null = $targetNameSet.Add($name) }
        $sourceOnlyTables = @($sourceNames | Where-Object { -not $targetNameSet.Contains($_) })
        $targetOnlyTables = @($targetNames | Where-Object { -not $sourceNameSet.Contains($_) })
        $archiveNameSet = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        foreach ($name in $archiveTableNames) { $null = $archiveNameSet.Add([string]$name) }
        $sourceMissingFromArchive = @($sourceNames | Where-Object { -not $archiveNameSet.Contains($_) })
        $archiveOnlyTables = @($archiveTableNames | Where-Object { -not $sourceNameSet.Contains([string]$_) })
        $publicTableParity = ($sourceOnlyTables.Count -eq 0 -and $targetOnlyTables.Count -eq 0)
        $sourceConstraints = @($sourceCatalog.constraints | ForEach-Object { [string]$_ })
        $targetConstraints = @($targetCatalog.constraints | ForEach-Object { [string]$_ })
        $sourcePolicies = @($sourceCatalog.policies | ForEach-Object { [string]$_ })
        $targetPolicies = @($targetCatalog.policies | ForEach-Object { [string]$_ })
        $sourceRls = @($sourceCatalog.rls | ForEach-Object { [string]$_ })
        $targetRls = @($targetCatalog.rls | ForEach-Object { [string]$_ })
        $constraintSourceOnly = @(Get-CatalogSetDifference $sourceConstraints $targetConstraints)
        $constraintTargetOnly = @(Get-CatalogSetDifference $targetConstraints $sourceConstraints)
        $policySourceOnly = @(Get-CatalogSetDifference $sourcePolicies $targetPolicies)
        $policyTargetOnly = @(Get-CatalogSetDifference $targetPolicies $sourcePolicies)
        $rlsSourceOnly = @(Get-CatalogSetDifference $sourceRls $targetRls)
        $rlsTargetOnly = @(Get-CatalogSetDifference $targetRls $sourceRls)
        $constraintParity = ($constraintSourceOnly.Count -eq 0 -and $constraintTargetOnly.Count -eq 0)
        $policyParity = ($policySourceOnly.Count -eq 0 -and $policyTargetOnly.Count -eq 0)
        $rlsFlagParity = ($rlsSourceOnly.Count -eq 0 -and $rlsTargetOnly.Count -eq 0)
        $schemaSignatureParity = ($constraintParity -and $policyParity -and $rlsFlagParity)

        $allRowCountParity = $publicTableParity
        foreach ($tableName in $sourceNames) {
          $quoted = '"' + $tableName.Replace('"','""') + '"'
          $sourceCount = Invoke-SourcePsql ('SELECT count(*)::text FROM public.' + $quoted)
          $targetCount = Invoke-TargetPsql ('SELECT count(*)::text FROM public.' + $quoted)
          $sourceValue = if ($sourceCount.ExitCode -eq 0) { Get-LastNumericValue $sourceCount.Text } else { $null }
          $targetValue = if ($targetCount.ExitCode -eq 0) { Get-LastNumericValue $targetCount.Text } else { $null }
          if ($null -eq $sourceValue -or $null -eq $targetValue -or $sourceValue -ne $targetValue) { $allRowCountParity = $false }
        }
        $sourceAuthUsers = Invoke-SourcePsql 'SELECT count(*)::text FROM auth.users'
        $targetAuthUsers = Invoke-TargetPsql 'SELECT count(*)::text FROM auth.users'
        $sourceAuthCount = if ($sourceAuthUsers.ExitCode -eq 0) { Get-LastNumericValue $sourceAuthUsers.Text } else { $null }
        $targetAuthCount = if ($targetAuthUsers.ExitCode -eq 0) { Get-LastNumericValue $targetAuthUsers.Text } else { $null }
        $authUserCountParity = ($null -ne $sourceAuthCount -and $null -ne $targetAuthCount -and $sourceAuthCount -eq $targetAuthCount)
    } catch { $publicTableParity=$false; $schemaSignatureParity=$false; $constraintParity=$false; $policyParity=$false; $rlsFlagParity=$false; $allRowCountParity=$false; $authUserCountParity=$false }
    }
    Write-Output ('OJ_PUBLIC_TABLE_NAME_PARITY=' + $(if ($publicTableParity) { 'PASS' } else { 'FAIL' }))
    Write-Output ('OJ_PUBLIC_TABLE_COUNT_SOURCE=' + $(if ($sourceCatalog) { @($sourceCatalog.tables).Count } else { 'UNAVAILABLE' }))
    Write-Output ('OJ_PUBLIC_TABLE_COUNT_RESTORED=' + $(if ($targetCatalog) { @($targetCatalog.tables).Count } else { 'UNAVAILABLE' }))
    Write-Output ('OJ_SOURCE_ONLY_PUBLIC_TABLES=' + ($sourceOnlyTables -join ','))
    Write-Output ('OJ_TARGET_ONLY_PUBLIC_TABLES=' + ($targetOnlyTables -join ','))
    Write-Output ('OJ_SOURCE_TABLES_MISSING_FROM_ARCHIVE=' + ($sourceMissingFromArchive -join ','))
    Write-Output ('OJ_ARCHIVE_ONLY_PUBLIC_TABLES=' + ($archiveOnlyTables -join ','))
    Write-Output ('OJ_ARCHIVE_PUBLIC_TABLE_COUNT=' + $archiveTableNames.Count)
    Write-Output ('OJ_RLS_POLICY_CONSTRAINT_SIGNATURE_PARITY=' + $(if ($schemaSignatureParity) { 'PASS' } else { 'FAIL' }))
    Write-Output ('OJ_CONSTRAINT_SIGNATURE_PARITY=' + $(if ($constraintParity) { 'PASS' } else { 'FAIL' }))
    Write-Output ('OJ_POLICY_SIGNATURE_PARITY=' + $(if ($policyParity) { 'PASS' } else { 'FAIL' }))
    Write-Output ('OJ_RLS_FLAG_PARITY=' + $(if ($rlsFlagParity) { 'PASS' } else { 'FAIL' }))
    Write-Output ('OJ_CONSTRAINT_DIFF_COUNTS=' + $constraintSourceOnly.Count + '/' + $constraintTargetOnly.Count)
    Write-Output ('OJ_POLICY_DIFF_COUNTS=' + $policySourceOnly.Count + '/' + $policyTargetOnly.Count)
    Write-Output ('OJ_RLS_DIFF_COUNTS=' + $rlsSourceOnly.Count + '/' + $rlsTargetOnly.Count)
    Write-Output ('OJ_CONSTRAINTS_SOURCE_ONLY=' + ($constraintSourceOnly -join ','))
    Write-Output ('OJ_CONSTRAINTS_TARGET_ONLY=' + ($constraintTargetOnly -join ','))
    Write-Output ('OJ_POLICIES_SOURCE_ONLY=' + ($policySourceOnly -join ','))
    Write-Output ('OJ_POLICIES_TARGET_ONLY=' + ($policyTargetOnly -join ','))
    Write-Output ('OJ_RLS_TABLES_SOURCE_ONLY=' + ($rlsSourceOnly -join ','))
    Write-Output ('OJ_RLS_TABLES_TARGET_ONLY=' + ($rlsTargetOnly -join ','))
    Write-Output ('OJ_ALL_PUBLIC_ROW_COUNT_PARITY=' + $(if ($allRowCountParity) { 'PASS' } else { 'FAIL' }))
    Write-Output ('OJ_AUTH_USER_COUNT_PARITY=' + $(if ($authUserCountParity) { 'PASS' } else { 'FAIL' }))
    $migrationResult = Invoke-SourcePsql "SELECT coalesce(max(version::text),'') FROM supabase_migrations.schema_migrations"
    $latestMigration = if ($migrationResult.ExitCode -eq 0) { $migrationResult.Text.Trim() } else { '' }
    $archiveAfterMigration = $false
    if ($latestMigration -match '^\d{14}$') {
      try {
        $migrationUtc = [datetime]::ParseExact($latestMigration,'yyyyMMddHHmmss',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::AssumeUniversal)
        $archiveUtc = [datetime]::Parse([string]$archiveManifest.produced_utc,[Globalization.CultureInfo]::InvariantCulture).ToUniversalTime()
        $archiveAfterMigration = ($archiveUtc -ge $migrationUtc.ToUniversalTime())
      } catch { $archiveAfterMigration = $false }
    }
    Write-Output ('OJ_LATEST_SCHEMA_MIGRATION_VERSION=' + $(if ($latestMigration) { $latestMigration } else { 'UNAVAILABLE' }))
    Write-Output ('OJ_ARCHIVE_AFTER_LATEST_SCHEMA_MIGRATION=' + $(if ($archiveAfterMigration) { 'PASS' } else { 'FAIL' }))
    Write-Output ('OJ_ARCHIVE_CREATED_UTC=' + [string]$archiveManifest.produced_utc)

    $actorAccessSql = @'
SELECT json_build_object(
  'public_usage',has_schema_privilege('authenticated','public','USAGE'),
  'auth_usage',has_schema_privilege('authenticated','auth','USAGE'),
  'private_usage',has_schema_privilege('authenticated','oj_private','USAGE'),
  'membership_select',has_table_privilege('authenticated','public.oj_memberships','SELECT'),
  'member_role_execute',coalesce(has_function_privilege('authenticated',to_regprocedure('oj_private.member_role(uuid)'),'EXECUTE'),false)
)::text;
'@
    $sourceAccessResult = Invoke-SourcePsql $actorAccessSql
    $targetAccessResult = Invoke-TargetPsql $actorAccessSql
    $actorGrantParity = $false
    if ($sourceAccessResult.ExitCode -eq 0 -and $targetAccessResult.ExitCode -eq 0) {
      try {
        $sourceAccess = $sourceAccessResult.Text | ConvertFrom-Json
        $targetAccess = $targetAccessResult.Text | ConvertFrom-Json
        $accessMappings = @(
          [pscustomobject]@{ Key='public_usage'; Grant='GRANT USAGE ON SCHEMA public TO authenticated'; Revoke='REVOKE USAGE ON SCHEMA public FROM authenticated' },
          [pscustomobject]@{ Key='auth_usage'; Grant='GRANT USAGE ON SCHEMA auth TO authenticated'; Revoke='REVOKE USAGE ON SCHEMA auth FROM authenticated' },
          [pscustomobject]@{ Key='private_usage'; Grant='GRANT USAGE ON SCHEMA oj_private TO authenticated'; Revoke='REVOKE USAGE ON SCHEMA oj_private FROM authenticated' },
          [pscustomobject]@{ Key='membership_select'; Grant='GRANT SELECT ON TABLE public.oj_memberships TO authenticated'; Revoke='REVOKE SELECT ON TABLE public.oj_memberships FROM authenticated' },
          [pscustomobject]@{ Key='member_role_execute'; Grant='GRANT EXECUTE ON FUNCTION oj_private.member_role(uuid) TO authenticated'; Revoke='REVOKE EXECUTE ON FUNCTION oj_private.member_role(uuid) FROM authenticated' }
        )
        $targetGrantSql = @()
        foreach ($mapping in $accessMappings) {
          $key = [string]$mapping.Key
          if ([bool]$sourceAccess.$key -and -not [bool]$targetAccess.$key) { $targetGrantSql += [string]$mapping.Grant }
          elseif (-not [bool]$sourceAccess.$key -and [bool]$targetAccess.$key) { $targetGrantSql += [string]$mapping.Revoke }
        }
        if ($targetGrantSql.Count -gt 0) {
          $grantResult = Invoke-TargetPsql ('BEGIN; ' + ($targetGrantSql -join '; ') + '; COMMIT;')
          if ($grantResult.ExitCode -eq 0) { $targetAccessResult = Invoke-TargetPsql $actorAccessSql }
        }
        if ($targetAccessResult.ExitCode -eq 0) {
          $targetAccess = $targetAccessResult.Text | ConvertFrom-Json
          $actorGrantParity = $true
          foreach ($mapping in $accessMappings) {
            $key = [string]$mapping.Key
            if ([bool]$sourceAccess.$key -ne [bool]$targetAccess.$key) { $actorGrantParity = $false }
          }
        }
      } catch { $actorGrantParity = $false }
    }
    Write-Output ('OJ_AUTHENTICATED_SOURCE_GRANTS_REPLICATED_IN_SCRATCH=' + $(if ($actorGrantParity) { 'PASS' } else { 'FAIL' }))
    $memberResult = Invoke-TargetPsql 'SELECT user_id::text FROM public.oj_memberships WHERE user_id IS NOT NULL ORDER BY user_id LIMIT 1'
    $memberId = if ($memberResult.ExitCode -eq 0) { ($memberResult.Text -split "`r?`n" | Where-Object { $_ -match '^[0-9a-fA-F-]{36}$' } | Select-Object -First 1) } else { $null }
    $authorizedMemberPass = $false; $outsiderDeniedPass = $false; $anonDeniedPass = $false
    if ($memberId -match '^[0-9a-fA-F-]{36}$') {
      $memberSql = @"
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$memberId',true);
SELECT set_config('request.jwt.claims','{"sub":"$memberId","role":"authenticated","aud":"authenticated"}',true);
SELECT count(*) FROM public.oj_memberships;
ROLLBACK;
"@
      $memberRead = Invoke-TargetPsql $memberSql
      $memberCount = if ($memberRead.ExitCode -eq 0) { Get-LastNumericValue $memberRead.Text } else { $null }
      $authorizedMemberPass = ($null -ne $memberCount -and $memberCount -gt 0)
      $outsiderId = [guid]::NewGuid().ToString()
      $outsiderSql = @"
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$outsiderId',true);
SELECT set_config('request.jwt.claims','{"sub":"$outsiderId","role":"authenticated","aud":"authenticated"}',true);
SELECT count(*) FROM public.oj_memberships;
ROLLBACK;
"@
      $outsiderRead = Invoke-TargetPsql $outsiderSql
      $outsiderCount = if ($outsiderRead.ExitCode -eq 0) { Get-LastNumericValue $outsiderRead.Text } else { $null }
      $outsiderDeniedPass = ($null -ne $outsiderCount -and $outsiderCount -eq 0)
      $anonRead = Invoke-TargetPsql 'BEGIN; SET LOCAL ROLE anon; SELECT count(*) FROM public.oj_memberships; ROLLBACK;'
      if ($anonRead.ExitCode -eq 0) {
        $anonCount = Get-LastNumericValue $anonRead.Text
        $anonDeniedPass = ($null -ne $anonCount -and $anonCount -eq 0)
      } else {
        $anonDeniedPass = ($anonRead.Text -match '(?i)permission denied|insufficient privilege|does not have permission')
      }
    }
    Write-Output ('OJ_AUTHORIZED_MEMBER_RLS=' + $(if ($authorizedMemberPass) { 'PASS' } else { 'FAIL' }))
    Write-Output ('OJ_OUTSIDER_RLS_DENIED=' + $(if ($outsiderDeniedPass) { 'PASS' } else { 'FAIL' }))
    Write-Output ('OJ_ANON_RLS_DENIED=' + $(if ($anonDeniedPass) { 'PASS' } else { 'FAIL' }))
    if (-not ($publicTableParity -and $sourceMissingFromArchive.Count -eq 0 -and $archiveOnlyTables.Count -eq 0 -and $schemaSignatureParity -and $allRowCountParity -and $authUserCountParity -and $archiveAfterMigration -and $actorGrantParity -and $authorizedMemberPass -and $outsiderDeniedPass -and $anonDeniedPass)) {
      throw 'Isolated source parity or actor-role validation failed. Review only sanitized results; production remains untouched.'
    }
    Write-Output 'OJ_SOURCE_PARITY_AND_ACTOR_TESTS=PASS'
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
