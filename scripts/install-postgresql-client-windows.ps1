[CmdletBinding()]
param()

# Installs only EDB's PostgreSQL 17 command-line binaries into this Windows
# user's LocalAppData. It does not register or start a database service.
# Source: https://www.enterprisedb.com/download-postgresql-binaries
# EDB-confirmed SHA-256 for this exact archive:
# https://github.com/EnterpriseDB/edb-installers/issues/731
$ErrorActionPreference = 'Stop'
$version = '17.11-5'
$fileName = "postgresql-$version-windows-x64-binaries.zip"
$url = "https://get.enterprisedb.com/postgresql/$fileName"
$expectedSha256 = '80379b2c04d51c30225532e0ae04509899141e9957ed096fe749d7fd9df8f82f'
$installRoot = Join-Path $env:LOCALAPPDATA 'OJWorkspace\tools\pg17\portable'
$pgsqlRoot = Join-Path $installRoot 'pgsql'
$pgDump = Join-Path $pgsqlRoot 'bin\pg_dump.exe'
$pgRestore = Join-Path $pgsqlRoot 'bin\pg_restore.exe'

if ([Environment]::Is64BitOperatingSystem -ne $true) {
  throw 'The pinned PostgreSQL client package requires 64-bit Windows.'
}

if (Test-Path -LiteralPath $pgDump) {
  $existingVersion = (& $pgDump --version | Out-String).Trim()
  if ($LASTEXITCODE -eq 0 -and $existingVersion -match '\b17\.') {
    Write-Output "PostgreSQL client tools are already installed: $existingVersion"
    exit 0
  }
  throw "A pg_dump already exists at the target but is not PostgreSQL 17: $existingVersion"
}

if (Test-Path -LiteralPath $pgsqlRoot) {
  throw "The target folder already exists without a usable pg_dump: $pgsqlRoot. Nothing was overwritten."
}

$workRoot = Join-Path $env:TEMP ("oj-postgresql-client-" + [guid]::NewGuid().ToString('N'))
$archivePath = Join-Path $workRoot $fileName
$expandedRoot = Join-Path $workRoot 'expanded'

try {
  New-Item -ItemType Directory -Path $workRoot -Force | Out-Null
  Write-Output 'Downloading the official EDB PostgreSQL 17.11-5 Windows x64 binaries...'
  Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $archivePath

  $actualSha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualSha256 -ne $expectedSha256) {
    throw 'The downloaded PostgreSQL archive did not match EDB’s published SHA-256. Nothing was installed.'
  }

  Expand-Archive -LiteralPath $archivePath -DestinationPath $expandedRoot
  $expandedPgsql = Join-Path $expandedRoot 'pgsql'
  foreach ($requiredTool in @('pg_dump.exe', 'pg_restore.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $expandedPgsql "bin\$requiredTool"))) {
      throw "The verified archive is missing $requiredTool. Nothing was installed."
    }
  }

  New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
  Move-Item -LiteralPath $expandedPgsql -Destination $pgsqlRoot

  $dumpVersion = (& $pgDump --version | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or $dumpVersion -notmatch '\b17\.11\b') {
    throw "Installed pg_dump returned an unexpected version: $dumpVersion"
  }
  $restoreVersion = (& $pgRestore --version | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or $restoreVersion -notmatch '\b17\.11\b') {
    throw "Installed pg_restore returned an unexpected version: $restoreVersion"
  }

  Write-Output "Installed and verified: $dumpVersion; $restoreVersion"
  Write-Output "Tools are under: $pgsqlRoot\bin"
}
finally {
  if (Test-Path -LiteralPath $workRoot) {
    $resolvedTemp = [IO.Path]::GetFullPath($env:TEMP).TrimEnd('\') + '\'
    $resolvedWork = [IO.Path]::GetFullPath($workRoot)
    if (-not $resolvedWork.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase)) {
      throw 'Refusing to remove installer temporary files outside the Windows TEMP folder.'
    }
    Remove-Item -LiteralPath $resolvedWork -Recurse -Force
  }
}
