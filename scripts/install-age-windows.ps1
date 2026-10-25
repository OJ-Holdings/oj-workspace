[CmdletBinding()]
param()

# Installs the pinned age encryption utilities per-user without a machine-wide
# installer or service. The SHA-256 is published for the release archive and is
# independently mirrored by package registries.
# Release: https://github.com/FiloSottile/age/releases/tag/v1.3.2
$ErrorActionPreference = 'Stop'
$version = '1.3.2'
$fileName = "age-v$version-windows-amd64.zip"
$url = "https://github.com/FiloSottile/age/releases/download/v$version/$fileName"
$expectedSha256 = 'f48d8f8f9ebe903ab5027ed067652f2cc1db94bc206976430133b905dcd8e8c7'
$installRoot = Join-Path $env:LOCALAPPDATA "OJWorkspace\tools\age\$version"
$ageRoot = Join-Path $installRoot 'age'
$ageExe = Join-Path $ageRoot 'age.exe'
$keygenExe = Join-Path $ageRoot 'age-keygen.exe'

if ([Environment]::Is64BitOperatingSystem -ne $true) {
  throw 'The pinned age package requires 64-bit Windows.'
}

if (Test-Path -LiteralPath $ageExe) {
  $existingVersion = (& $ageExe --version | Out-String).Trim()
  if ($LASTEXITCODE -eq 0 -and $existingVersion -match '\bv?1\.3\.2\b' -and (Test-Path -LiteralPath $keygenExe)) {
    Write-Output "age tools are already installed: $existingVersion"
    exit 0
  }
  throw "An age binary already exists at the target but is not a complete v1.3.2 installation: $existingVersion"
}

if (Test-Path -LiteralPath $ageRoot) {
  throw "The target folder already exists without a usable age.exe: $ageRoot. Nothing was overwritten."
}

$workRoot = Join-Path $env:TEMP ("oj-age-" + [guid]::NewGuid().ToString('N'))
$archivePath = Join-Path $workRoot $fileName
$expandedRoot = Join-Path $workRoot 'expanded'

try {
  New-Item -ItemType Directory -Path $workRoot -Force | Out-Null
  Write-Output 'Downloading the official age v1.3.2 Windows x64 release...'
  Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $archivePath

  $actualSha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualSha256 -ne $expectedSha256) {
    throw 'The downloaded age archive did not match the published SHA-256. Nothing was installed.'
  }

  Expand-Archive -LiteralPath $archivePath -DestinationPath $expandedRoot
  $expandedAge = Join-Path $expandedRoot 'age'
  foreach ($requiredTool in @('age.exe', 'age-keygen.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $expandedAge $requiredTool))) {
      throw "The verified archive is missing $requiredTool. Nothing was installed."
    }
  }

  New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
  Move-Item -LiteralPath $expandedAge -Destination $ageRoot

  $installedVersion = (& $ageExe --version | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or $installedVersion -notmatch '\bv?1\.3\.2\b') {
    throw "Installed age returned an unexpected version: $installedVersion"
  }
  Write-Output "Installed and verified: $installedVersion"
  Write-Output "Tools are under: $ageRoot"
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
