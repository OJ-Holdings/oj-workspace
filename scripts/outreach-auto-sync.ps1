$ErrorActionPreference = 'Stop'
$env:PSModulePath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\Modules'
Import-Module Microsoft.PowerShell.Utility
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$log = Join-Path (Join-Path $repo '..\oj-workspace-releases\logs') 'outreach-auto-sync.log'
$mutex = New-Object System.Threading.Mutex($false, 'Local\OJWorkspaceOutreachSheetSync')
$held = $false
try {
  try { $held = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $held = $true }
  if (!$held) { exit 0 }
  try {
    $listeners = @(Get-NetTCPConnection -LocalPort 3011 -State Listen -ErrorAction Stop)
    if ($listeners.Count -ne 1 -or $listeners[0].LocalAddress -ne '127.0.0.1') { throw 'Unexpected listener' }
    $owner = Get-CimInstance Win32_Process -Filter "ProcessId = $($listeners[0].OwningProcess)"
    $pattern = 'node_modules[\\/]+next[\\/]+dist[\\/]+bin[\\/]+next.*start.*--hostname\s+127\.0\.0\.1.*--port\s+3011(\s|$)'
    if (!$owner -or $owner.Name -ne 'node.exe' -or $owner.CommandLine -notmatch $pattern) { throw 'Unexpected owner' }
  } catch {
    [IO.File]::AppendAllText($log, (Get-Date).ToUniversalTime().ToString('s') + ' WORKSPACE_UNAVAILABLE' + [Environment]::NewLine)
    exit 1
  }
  Push-Location -LiteralPath $repo
  try {
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $output = @(& 'C:\Program Files\nodejs\node.exe' (Join-Path $PSScriptRoot 'outreach-auto-sync.mjs') 2>&1)
    $code = $LASTEXITCODE
    $ErrorActionPreference = $oldPreference
  } finally { Pop-Location }
  $summary = if ($code -eq 0) {
    try {
      $result = ($output | Out-String | ConvertFrom-Json)
      if ($result.status -notin @('SYNCED','UNCHANGED')) { throw 'Invalid result' }
      $result.status + $(if ($result.status -eq 'SYNCED') { ' imported=' + [int]$result.imported } else { ' rows=' + [int]$result.rows })
    } catch { $code = 1; 'INVALID_RECEIPT' }
  } else {
    $match = [regex]::Match(($output | Out-String), 'Outreach sync: ([A-Z_]+)')
    if ($match.Success) { $match.Groups[1].Value } else { 'SYNC_FAILED' }
  }
  [IO.File]::AppendAllText($log, (Get-Date).ToUniversalTime().ToString('s') + ' ' + $summary + [Environment]::NewLine)
  if ($code -ne 0) { exit 1 }
} finally { if ($held) { $mutex.ReleaseMutex() }; $mutex.Dispose() }
