$ErrorActionPreference = 'Stop'
$source = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'auto-deploy-local.ps1') -Raw
$start = $source.IndexOf('  # Restore the already-deployed, recorded release')
$end = $source.IndexOf('  $ref = @(InvokeGit', $start)
if ($start -lt 0 -or $end -le $start) { throw 'Recovery block not found' }
$recovery = $source.Substring($start, $end - $start)
$root = Join-Path ([IO.Path]::GetTempPath()) ('oj-recovery-test-' + [guid]::NewGuid().ToString('N'))
$sha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
$release = Join-Path $root $sha
New-Item -ItemType Directory -Path (Join-Path $release '.next') -Force | Out-Null
Set-Content -LiteralPath (Join-Path $release '.next\BUILD_ID') -Value 'fixture'
function Log($text) { }
function git { $global:LASTEXITCODE = 0; return $script:fakeSha }
function Launch($folder,$savedSha,$port,$label) { $script:launched = $true; return [pscustomobject]@{ Id=123 } }
function PortOwner($port) { if ($script:occupied -or $script:launched) { return [pscustomobject]@{ ProcessId=123 } }; return $null }
function WaitHealth($port,$savedSha,$versioned) { return $script:healthy }
function Stop-Process { param($Id, [switch]$Force); $script:stopped = $true }
function ExpectFailure($action) { $failed=$false; try { & $action } catch { $failed=$true }; if (!$failed) { throw 'Expected a recovery guard to reject the fixture' } }
try {
  $Apply = $true; $script:fakeSha = $sha; $script:healthy = $true; $script:occupied = $false; $script:launched = $false
  $state = [pscustomobject]@{ sha=$sha; path=$release }
  Invoke-Expression $recovery
  if (!$script:launched) { throw 'Valid recorded release was not restored' }
  $script:launched = $false; $state.sha = 'bad'; ExpectFailure { Invoke-Expression $recovery }
  $state.sha = $sha; $state.path = (Join-Path $root 'other'); ExpectFailure { Invoke-Expression $recovery }
  $state.path = $release; $script:fakeSha = ('b' * 40); ExpectFailure { Invoke-Expression $recovery }
  $script:fakeSha = $sha; $script:healthy = $false; $script:stopped = $false; ExpectFailure { Invoke-Expression $recovery }
  if (!$script:stopped) { throw 'Failed recovery process was not stopped' }
  $script:launched = $false; $script:occupied = $true; Invoke-Expression $recovery
  if ($script:launched) { throw 'An occupied port caused a second process to launch' }
  Write-Output 'PASS recorded-release recovery and negative guards'
} finally {
  $resolved = (Resolve-Path -LiteralPath $root).Path
  $temp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
  if (!$resolved.StartsWith($temp, [StringComparison]::OrdinalIgnoreCase) -or !(Split-Path -Leaf $resolved).StartsWith('oj-recovery-test-')) { throw 'Unexpected test cleanup path' }
  Remove-Item -LiteralPath $resolved -Recurse -Force
}
