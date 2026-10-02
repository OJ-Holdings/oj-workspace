$ErrorActionPreference = 'Stop'
$taskExisting = Get-NetTCPConnection -State Listen -LocalPort 3011 -ErrorAction SilentlyContinue
if ($taskExisting) {
  foreach ($taskListener in $taskExisting) {
    $taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($taskListener.OwningProcess)"
    if ($taskListener.LocalAddress -ne '127.0.0.1' -or $taskProcess.CommandLine -notmatch 'node_modules/next/dist/bin/next.*start.*--hostname.*127\.0\.0\.1.*--port.*3011') {
      throw 'Unexpected port owner; refusing to stop it.'
    }
    Stop-Process -Id $taskProcess.ProcessId
    Wait-Process -Id $taskProcess.ProcessId -Timeout 10 -ErrorAction SilentlyContinue
  }
}
& "$PSScriptRoot\serve-local.ps1"
