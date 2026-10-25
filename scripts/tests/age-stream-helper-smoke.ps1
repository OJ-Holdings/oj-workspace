# Exercises the production pg_dump -> age -> pg_restore streaming path using
# a temporary loopback-only PostgreSQL cluster and entirely synthetic data.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$scripts = Split-Path $PSScriptRoot -Parent
$backupScript = Join-Path $scripts 'backup-supabase-windows.ps1'
$restoreScript = Join-Path $scripts 'restore-supabase-isolated.ps1'
$ageRoot = Join-Path $env:LOCALAPPDATA 'OJWorkspace\tools\age\1.3.2\age'
$pgRoot = Join-Path $env:LOCALAPPDATA 'OJWorkspace\tools\pg17\portable\pgsql\bin'
$age = Join-Path $ageRoot 'age.exe'
$keygen = Join-Path $ageRoot 'age-keygen.exe'
foreach ($tool in @($age,$keygen)) {
  if (-not (Test-Path -LiteralPath $tool)) { throw 'Pinned age Windows binaries are required for this local synthetic smoke test.' }
}
foreach ($tool in @('pg_dump','pg_restore','initdb','pg_ctl','createdb','psql')) {
  if (-not (Test-Path -LiteralPath (Join-Path $pgRoot ($tool + '.exe')))) {
    throw 'PostgreSQL 17 client/server binaries are required for this local synthetic smoke test.'
  }
}

function RunChecked([string]$file,[string[]]$arguments) {
  & $file @arguments
  if ($LASTEXITCODE -ne 0) { throw "$([IO.Path]::GetFileName($file)) failed with exit code $LASTEXITCODE" }
}
foreach ($source in @(@{path=$backupScript;names=@('AgeTool','PostgreSQLTool','QuoteProcessArgument','StartByteProcess','DescribeStreamChildFailure','EncryptProcessOutput','TestEncryptedArchive')},@{path=$restoreScript;names=@('PgTool','PipeAgeToPgRestore')})) {
  $tokens = $null; $parseErrors = $null
  $ast = [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $source.path).Path,[ref]$tokens,[ref]$parseErrors)
  if ($parseErrors.Count) { throw "PowerShell syntax errors in $($source.path)" }
  foreach ($function in $ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst]},$true)) {
    if ($function.Name -in $source.names) { Invoke-Expression $function.Extent.Text }
  }
}
$recipientFailure = DescribeStreamChildFailure 'age' 'age: error: unknown recipient type'
if ($recipientFailure -notmatch 'rejected the configured encryption recipient') {
  throw 'Backup child-process diagnostics did not classify a rejected age recipient.'
}
$authFailure = DescribeStreamChildFailure 'pg_dump' 'FATAL: password authentication failed for user'
if ($authFailure -notmatch 'rejected the stored database credentials') {
  throw 'Backup child-process diagnostics did not classify a PostgreSQL authentication failure.'
}
$temporary = Join-Path $env:TEMP ('oj-age-restore-smoke-' + [guid]::NewGuid().ToString('N'))
$dataDirectory = Join-Path $temporary 'data'
$logPath = Join-Path $temporary 'postgres.log'
$sourceDatabase = 'oj_age_src'
$targetDatabase = 'oj_age_dst'
$port = 55439
$serverStarted = $false
New-Item -ItemType Directory -Path $temporary | Out-Null
try {
  RunChecked (Join-Path $pgRoot 'initdb.exe') @('-D',$dataDirectory,'-U','postgres','--auth=trust','--no-locale','--encoding=UTF8')
  RunChecked (Join-Path $pgRoot 'pg_ctl.exe') @('-D',$dataDirectory,'-l',$logPath,'-o',"-h 127.0.0.1 -p $port",'-w','-t','30','start')
  $serverStarted = $true
  RunChecked (Join-Path $pgRoot 'createdb.exe') @('-h','127.0.0.1','-p',"$port",'-U','postgres',$sourceDatabase)
  RunChecked (Join-Path $pgRoot 'psql.exe') @('-h','127.0.0.1','-p',"$port",'-U','postgres','-d',$sourceDatabase,'-v','ON_ERROR_STOP=1','-c',"CREATE TABLE smoke (id integer primary key, payload text not null); INSERT INTO smoke VALUES (1,'synthetic exact-text recovery'); INSERT INTO smoke SELECT n, md5(random()::text)||md5(random()::text)||md5(random()::text)||md5(random()::text) FROM generate_series(2,30002) AS n;")
  $keygenInfo = New-Object Diagnostics.ProcessStartInfo
  $keygenInfo.FileName = $keygen
  $keygenInfo.UseShellExecute = $false; $keygenInfo.CreateNoWindow = $true
  $keygenInfo.RedirectStandardOutput = $true; $keygenInfo.RedirectStandardError = $true
  $keyProcess = New-Object Diagnostics.Process; $keyProcess.StartInfo = $keygenInfo
  [void]$keyProcess.Start()
  $identityTask = $keyProcess.StandardOutput.ReadToEndAsync()
  $publicTask = $keyProcess.StandardError.ReadToEndAsync()
  $keyProcess.WaitForExit()
  $identityOutput = $identityTask.GetAwaiter().GetResult()
  $publicOutput = $publicTask.GetAwaiter().GetResult()
  $keyProcess.Dispose()
  $identityMatch = [regex]::Match($identityOutput,'(?m)^(AGE-SECRET-KEY-[A-Z0-9]+)\s*$')
  $recipientMatch = [regex]::Match($publicOutput,'(?m)^Public key:\s*(age1[a-z0-9]+)\s*$')
  if (-not $identityMatch.Success -or -not $recipientMatch.Success) { throw 'Synthetic age key generation failed.' }
  $identity = $identityMatch.Groups[1].Value
  $recipient = $recipientMatch.Groups[1].Value

  $encrypted = Join-Path $temporary 'synthetic.dump.age'
  $dump = Join-Path $pgRoot 'pg_dump.exe'
  $dumpArgs = @('--format=custom','--no-owner','--verbose','--host','127.0.0.1','--port',"$port",'--username','postgres','--dbname',$sourceDatabase)
  EncryptProcessOutput $dump $dumpArgs $recipient $encrypted
  $earlyExitPath = Join-Path $temporary 'rejected-recipient.dump.age'
  $earlyExitMessage = ''
  try {
    EncryptProcessOutput $dump $dumpArgs 'not-an-age-recipient' $earlyExitPath
  } catch {
    $earlyExitMessage = $_.Exception.Message
  }
  if ($earlyExitMessage -notmatch 'Backup (stream stopped early|encryption failed): age rejected the configured encryption recipient') {
    throw "An early age process exit was not reported with a safe, useful cause: $earlyExitMessage"
  }
  # Diagnostic validation of the fixture itself. This plaintext archive only
  # contains synthetic data and is confined to this temporary test directory.
  $syntheticPlain = Join-Path $temporary 'synthetic-only.dump'
  $decrypt = StartByteProcess $age @('-d','-i','-','-o',$syntheticPlain,$encrypted) $true $false
  $decryptErrorTask = $decrypt.StandardError.ReadToEndAsync()
  $decrypt.StandardInput.WriteLine($identity); $decrypt.StandardInput.Close(); $decrypt.WaitForExit()
  [void]$decryptErrorTask.GetAwaiter().GetResult()
  $decryptExit = $decrypt.ExitCode; $decrypt.Dispose()
  if ($decryptExit -ne 0) { throw 'Synthetic age archive decryption failed.' }
  $fixtureList = & (Join-Path $pgRoot 'pg_restore.exe') '--list' $syntheticPlain 2>&1
  if ($LASTEXITCODE -ne 0) { throw ('Synthetic pg_dump fixture is unreadable: ' + ($fixtureList | Out-String)) }
  Remove-Item -LiteralPath $syntheticPlain -Force
  TestEncryptedArchive $encrypted $identity
  $invalidArchive = Join-Path $temporary 'encrypted-invalid-archive.age'
  $invalidEncryptor = StartByteProcess $age @('-r',$recipient,'-o',$invalidArchive) $true $false
  $invalidEncryptErrors = $invalidEncryptor.StandardError.ReadToEndAsync()
  $invalidEncryptor.StandardInput.WriteLine('synthetic invalid PostgreSQL archive')
  $invalidEncryptor.StandardInput.Close()
  $invalidEncryptor.WaitForExit()
  [void]$invalidEncryptErrors.GetAwaiter().GetResult()
  $invalidEncryptExit = $invalidEncryptor.ExitCode
  $invalidEncryptor.Dispose()
  if ($invalidEncryptExit -ne 0) { throw 'Could not create encrypted invalid-archive fixture.' }
  $invalidArchiveMessage = ''
  try { TestEncryptedArchive $invalidArchive $identity } catch { $invalidArchiveMessage = $_.Exception.Message }
  if ($invalidArchiveMessage -notmatch 'Encrypted archive validation failed: PostgreSQL could not read the decrypted stream as a custom-format archive') {
    throw "Invalid decrypted archive did not produce a safe classified validation failure: $invalidArchiveMessage"
  }
  $streamedList = PipeAgeToPgRestore $encrypted $identity @('--list')
  if ($streamedList -notmatch '(?m)^; Archive created at ') { throw 'Streaming archive inspection did not return a PostgreSQL archive table of contents.' }

  RunChecked (Join-Path $pgRoot 'createdb.exe') @('-h','127.0.0.1','-p',"$port",'-U','postgres',$targetDatabase)
  $restoreArgs = @('--host','127.0.0.1','--port',"$port",'--username','postgres','--dbname',$targetDatabase,'--single-transaction','--exit-on-error','--no-owner','--no-acl','--verbose')
  $restoreOutput = PipeAgeToPgRestore $encrypted $identity $restoreArgs
  if (-not $restoreOutput) { throw 'The encrypted restore returned no PostgreSQL restore output.' }
  $actual = (& (Join-Path $pgRoot 'psql.exe') -h 127.0.0.1 -p $port -U postgres -d $targetDatabase -At -c 'SELECT payload FROM smoke WHERE id=1;')
  if ($LASTEXITCODE -ne 0 -or $actual.Trim() -cne 'synthetic exact-text recovery') {
    throw 'The restored PostgreSQL row did not match the exact synthetic source text.'
  }

  $tampered = Join-Path $temporary 'tampered.dump.age'
  [byte[]]$bytes = [IO.File]::ReadAllBytes($encrypted)
  $bytes[$bytes.Length - 1] = $bytes[$bytes.Length - 1] -bxor 1
  [IO.File]::WriteAllBytes($tampered,$bytes)
  $tamperRejected = $false
  try { TestEncryptedArchive $tampered $identity } catch { $tamperRejected = $true }
  if (-not $tamperRejected) { throw 'Authenticated age decryption accepted a modified archive.' }
  Write-Output 'PASS: production pg_dump -> age -> pg_restore pipeline restored and verified exact synthetic row content; tampering was rejected.'
} finally {
  if ($serverStarted) {
    & (Join-Path $pgRoot 'pg_ctl.exe') -D $dataDirectory -m immediate -w -t 20 stop *> $null
  }
  Remove-Item -LiteralPath $temporary -Recurse -Force -ErrorAction SilentlyContinue
}
# The temporary database is loopback-only and contains no user or production data.
