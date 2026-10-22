# Opt-in unattended OJ Workspace deployer. Keep Tailscale forwarding to 127.0.0.1:3011.
[CmdletBinding()]
param([switch]$Apply, [switch]$Status)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$root = [IO.Path]::GetFullPath((Join-Path $repo '..\oj-workspace-releases'))
$logs = Join-Path $root 'logs'
$stateFile = Join-Path $root 'state.json'
$pauseFile = Join-Path $root 'PAUSE'
$remote = 'https://github.com/OJ-Holdings/oj-workspace.git'
New-Item -ItemType Directory -Force -Path $root, $logs | Out-Null

function Log([string]$value) {
  $message = ('{0} {1}' -f (Get-Date).ToUniversalTime().ToString('s'), $value)
  Write-Output $message
  Add-Content -LiteralPath (Join-Path $logs 'deploy.log') -Value $message
}
function InvokeGit([string[]]$gitArgs) {
  Push-Location $repo
  $priorPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $output = @(& git @gitArgs 2>&1 | Where-Object { $null -ne $_ })
    if ($LASTEXITCODE -ne 0) { throw ('git failed: ' + ($output | Out-String)) }
    return $output
  } finally { $ErrorActionPreference = $priorPreference; Pop-Location }
}
function GitHubApi([string]$uri) {
  $gh=Get-Command gh -ErrorAction SilentlyContinue
  if(-not $gh){throw 'GitHub CLI (gh) is required for authenticated release checks'}
  $priorPreference=$ErrorActionPreference
  try {
    $ErrorActionPreference='Continue'
    $result=@(& $gh.Source api -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2022-11-28' $uri 2>&1)
    if($LASTEXITCODE -ne 0){throw ('Authenticated GitHub API failed: ' + ($result | Out-String))}
    return (($result | Out-String) | ConvertFrom-Json)
  } finally {$ErrorActionPreference=$priorPreference}
}
function PortOwner([int]$port) {
  $list = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
  if ($list.Count -eq 0) { return $null }
  if ($list.Count -ne 1 -or $list[0].LocalAddress -ne '127.0.0.1') {
    throw "Unexpected listener on port $port"
  }
  $owner = Get-CimInstance Win32_Process -Filter "ProcessId = $($list[0].OwningProcess)"
  $pattern = 'node_modules[\\/]+next[\\/]+dist[\\/]+bin[\\/]+next.*start.*--hostname\s+127\.0\.0\.1.*--port\s+' + $port + '(\s|$)'
  if (-not $owner -or $owner.Name -ne 'node.exe' -or $owner.CommandLine -notmatch $pattern) {
    throw "Unknown process owns port $port; refusing to stop it"
  }
  return $owner
}
function Health([int]$port,[string]$sha,[bool]$versioned) {
  try {
    if ($versioned) {
      $r = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/deploy-health" -TimeoutSec 5
      return ($r.status -eq 'ok' -and $r.release -eq $sha)
    }
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/preview" -UseBasicParsing -TimeoutSec 5
    return $r.StatusCode -eq 200
  } catch { return $false }
}
function WaitHealth([int]$port,[string]$sha,[bool]$versioned) {
  for($i=0;$i -lt 30;$i++){
    if(Health $port $sha $versioned){return $true}
    Start-Sleep -Seconds 1
  }
  return $false
}
function Launch([string]$folder,[string]$sha,[int]$port,[string]$name){
  if(-not (Test-Path -LiteralPath (Join-Path $folder '.next\BUILD_ID'))){
    throw "No production build in $folder"
  }
  $old = $env:OJ_WORKSPACE_RELEASE_SHA
  try {
    $env:OJ_WORKSPACE_RELEASE_SHA = $sha
    $parameters = @{
      FilePath = (Get-Command node).Source
      ArgumentList = @('node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',"$port")
      WorkingDirectory = $folder
      WindowStyle = 'Hidden'
      RedirectStandardOutput = (Join-Path $logs "$name.stdout.log")
      RedirectStandardError = (Join-Path $logs "$name.stderr.log")
      PassThru = $true
    }
    return Start-Process @parameters
  } finally { $env:OJ_WORKSPACE_RELEASE_SHA = $old }
}
function StopPort([int]$port) {
  $owner = PortOwner $port
  if(-not $owner){return}
  Stop-Process -Id $owner.ProcessId -Force
  for($i=0;$i -lt 20;$i++){
    if(-not (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)){return}
    Start-Sleep -Milliseconds 500
  }
  throw "Port $port remained occupied after stopping the OJ process"
}
function Npm([string[]]$npmArgs,[string]$dir,[string]$sha) {
  $file = Join-Path $logs (($sha.Substring(0,12)) + '-' + ($npmArgs -join '-') + '.log')
  Push-Location $dir
  $priorPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    & npm.cmd @npmArgs *> $file
    if($LASTEXITCODE -ne 0){
      throw ('npm ' + ($npmArgs -join ' ') + ' failed. See ' + $file + ': ' + (Get-Content $file -Tail 12 | Out-String))
    }
  } finally {$ErrorActionPreference = $priorPreference; Pop-Location}
  Log ('PASSED npm ' + ($npmArgs -join ' '))
}
$lock = $null
try {
  try {
    $lock = [IO.File]::Open((Join-Path $root 'deploy.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  } catch { Log 'Another updater instance is already running'; return }
  $state = $null
  if(Test-Path $stateFile){$state=Get-Content $stateFile -Raw | ConvertFrom-Json}
  if($Status){
    Log ('Live state: ' + $(if($state){$state.sha}else{'unrecorded'}))
    Log ('Pause: ' + (Test-Path $pauseFile))
    Log ('Port 3011: ' + [bool](PortOwner 3011))
    return
  }
  if(Test-Path $pauseFile){Log 'PAUSED by local operator';return}
  $watchers = @(Get-CimInstance Win32_Process -Filter "name='powershell.exe' or name='pwsh.exe'" |
    Where-Object { $_.CommandLine -match '[\\/]host-loop\.ps1\b' })
  if($watchers.Count -gt 0){Log 'BLOCKED: existing host-loop.ps1 watchdog is running; coordinate its shutdown first';return}
  $ref = @(InvokeGit @('ls-remote',$remote,'refs/heads/main'))
  if($ref.Count -ne 1){throw 'Unable to verify GitHub main HEAD'}
  if($ref[0] -match '^([0-9a-f]{40})\s'){$sha=$Matches[1]}
  else{throw 'Unable to parse GitHub main HEAD'}
  if($state -and $state.sha -eq $sha -and (Health 3011 $sha $true)){return}
  $baseUri='/repos/OJ-Holdings/oj-workspace'
  $checks=GitHubApi "$baseUri/commits/$sha/check-runs?per_page=100"
  $required=@($checks.check_runs | Where-Object {$_.name -eq 'check' -and $_.head_sha -eq $sha} |
    Sort-Object started_at -Descending)
  $approved=$false
  if($checks.total_count -gt 0){
    # When main has its own checks, all must be green. Never fall back to a PR
    # to bypass a pending/failed main check or a missing required main check.
    $notGreen=@($checks.check_runs | Where-Object {
      $_.status -ne 'completed' -or $_.conclusion -ne 'success'
    })
    $approved=($required.Count -gt 0 -and $required[0].status -eq 'completed' -and
      $required[0].conclusion -eq 'success' -and $notGreen.Count -eq 0)
  }else{
    # Some app-initiated squash merges do not create a new push CI run.
    # Accept PR CI ONLY when GitHub verifies the merge relationship and the
    # squash-merge commit has exactly the same source tree as the CI-tested PR head.
    $prs=@(GitHubApi "$baseUri/commits/$sha/pulls?per_page=30")
    $mergedPrs=@($prs | Where-Object {
      $_.merged_at -and $_.merge_commit_sha -eq $sha -and $_.base.ref -eq 'main' -and
      $_.head.repo.full_name -eq 'OJ-Holdings/oj-workspace'
    })
    if($mergedPrs.Count -eq 1){
      $head=[string]$mergedPrs[0].head.sha
      if($head -match '^[a-f0-9]{40}$'){
        $merged=GitHubApi "$baseUri/git/commits/$sha"
        $tested=GitHubApi "$baseUri/git/commits/$head"
        if($merged.tree.sha -and $merged.tree.sha -eq $tested.tree.sha){
          $prChecks=GitHubApi "$baseUri/commits/$head/check-runs?per_page=100"
          $prRequired=@($prChecks.check_runs | Where-Object {
            $_.name -eq 'check' -and $_.head_sha -eq $head
          } | Sort-Object started_at -Descending)
          if($prRequired.Count -gt 0 -and $prRequired[0].status -eq 'completed' -and $prRequired[0].conclusion -eq 'success'){
            $approved=$true
            Log ('VERIFIED: squash merge has identical Git tree to green PR head ' + $head.Substring(0,12))
          }
        }
      }
    }
  }
  if(-not $approved){
    Log ('WAIT: no valid green CI evidence for main ' + $sha.Substring(0,12))
    return
  }
  if(-not $Apply){Log ('READY to deploy ' + $sha.Substring(0,12) + ' (no changes made)');return}
  $priorLocal=@(InvokeGit @('rev-parse','HEAD'))[0].ToString().Trim()
  # Windows can report a metadata-only porcelain M even when the file and index
  # content match HEAD. Refresh the index and use Git's diff exit status.
  # A Windows checkout can return "needs update" for metadata-only index
  # entries. Refresh best-effort; the content-based diff checks below are
  # authoritative and still reject both staged and unstaged edits.
  Push-Location $repo
  try {
    $priorPreference=$ErrorActionPreference
    try {
      $ErrorActionPreference='Continue'
      $refreshOutput=@(& git update-index --refresh 2>&1)
      $refreshExit=$LASTEXITCODE
    } finally { $ErrorActionPreference=$priorPreference }
  } finally { Pop-Location }
  if($refreshExit -ne 0){Log ('Index refresh returned ' + $refreshExit + '; verifying content differences directly')}
  foreach($diffArgs in @(@('diff','--quiet','--exit-code'),@('diff','--cached','--quiet','--exit-code'))){
    Push-Location $repo
    try {
      & git @diffArgs
      $diffExit=$LASTEXITCODE
    } finally { Pop-Location }
    if($diffExit -eq 1){throw 'Local tracked edits exist; no fast-forward or deployment allowed'}
    if($diffExit -ne 0){throw ('Unable to verify tracked source cleanliness (git exit ' + $diffExit + ')')}
  }
  if((@(InvokeGit @('branch','--show-current'))[0].ToString().Trim()) -ne 'main'){
    throw 'Local source checkout must be on main'
  }
  InvokeGit @('fetch','--no-tags',$remote,'refs/heads/main') | Out-Null
  $fetched=@(InvokeGit @('rev-parse','FETCH_HEAD'))[0].ToString().Trim()
  if($fetched -ne $sha){throw 'GitHub moved while fetching; retry next cycle'}
  $baseline=if($state -and $state.sha -match '^[0-9a-f]{40}$'){$state.sha}else{$priorLocal}
  $changed=@(InvokeGit @('diff','--name-only',$baseline,$sha))
  if(@($changed | Where-Object {$_ -match '^(supabase/|\.env\.example$|src/lib/oj-connection\.ts$)'}).Count -gt 0){
    Log 'BLOCKED: SQL/schema or environment configuration changed; requires manual migration/review'
    return
  }
  InvokeGit @('merge','--ff-only',$sha) | Out-Null
  $release=Join-Path $root $sha
  if(-not(Test-Path $release)){
    InvokeGit @('worktree','add','--detach',$release,$sha) | Out-Null
  } else {
    $releaseSha=@(& git -C $release rev-parse HEAD)[0].ToString().Trim()
    if($releaseSha -ne $sha){throw 'Existing release folder belongs to another commit'}
  }
  $envFile=Join-Path $repo '.env.local'
  if(-not(Test-Path $envFile)){throw 'Missing trusted local environment configuration; production untouched'}
  Copy-Item -LiteralPath $envFile -Destination (Join-Path $release '.env.local') -Force
  Log ('Building release ' + $sha.Substring(0,12) + ' separately from the live app')
  Npm @('ci') $release $sha
  Npm @('run','typecheck') $release $sha
  Npm @('test') $release $sha
  Npm @('run','build') $release $sha
  if(Get-NetTCPConnection -LocalPort 3012 -State Listen -ErrorAction SilentlyContinue){
    throw 'Staging port 3012 occupied; production untouched'
  }
  $staging=Launch $release $sha 3012 'staging'
  try{
    if(-not(WaitHealth 3012 $sha $true)){throw 'Staging health check failed; production untouched'}
  }finally{
    if($staging -and -not $staging.HasExited){Stop-Process -Id $staging.Id -Force -ErrorAction SilentlyContinue}
    Start-Sleep -Seconds 1
  }
  $previousPath=if($state){[string]$state.path}else{$null}
  $previousSha=if($state){[string]$state.sha}else{$priorLocal}
  if(-not $state){
    $bootstrapFile=Join-Path $root 'initial-production-path.txt'
    if(-not(Test-Path -LiteralPath $bootstrapFile)){
      throw "First deployment requires initial-production-path.txt in $root; production untouched"
    }
    $previousPath=(Get-Content -LiteralPath $bootstrapFile -Raw).Trim()
    if(-not([IO.Path]::IsPathFullyQualified($previousPath))){
      throw 'Initial production path must be absolute; production untouched'
    }
    if([IO.Path]::GetFullPath($previousPath).TrimEnd('\\') -eq $repo.TrimEnd('\\')){
      throw 'Initial production path cannot be the deployer source checkout'
    }
    if(-not(Test-Path -LiteralPath (Join-Path $previousPath '.next\\BUILD_ID'))){
      throw 'Initial production build not found; production untouched'
    }
    if(-not(Test-Path -LiteralPath (Join-Path $previousPath 'node_modules\\next\\dist\\bin\\next'))){
      throw 'Initial production Next.js runtime not found; production untouched'
    }
    Log ('Verified initial rollback build: ' + $previousPath)
  }
  StopPort 3011
  $live=$null
  try {
    if(Get-NetTCPConnection -LocalPort 3011 -State Listen -ErrorAction SilentlyContinue){
      throw 'Another process took port 3011 during the swap'
    }
    $live=Launch $release $sha 3011 'production'
    if(-not(WaitHealth 3011 $sha $true)){throw 'New release failed live health check'}
    $receipt=@{
      sha=$sha;path=$release;previous_path=$previousPath;previous_sha=$previousSha
      deployed_at=(Get-Date).ToUniversalTime().ToString('o')
    }|ConvertTo-Json
    [IO.File]::WriteAllText(($stateFile+'.new'),$receipt)
    Move-Item -LiteralPath ($stateFile+'.new') -Destination $stateFile -Force
    Log ('LIVE: ' + $sha.Substring(0,12) + ' on port 3011; Tailscale unchanged')
  }catch{
    Log ('FAILED live switch; attempting rollback: ' + $_.Exception.Message)
    if($live -and -not $live.HasExited){Stop-Process -Id $live.Id -Force -ErrorAction SilentlyContinue}
    Start-Sleep -Seconds 2
    if(-not(Get-NetTCPConnection -LocalPort 3011 -State Listen -ErrorAction SilentlyContinue)){
      $old=Launch $previousPath $previousSha 3011 'rollback'
      if(WaitHealth 3011 $previousSha $false){Log 'Previous working build restored'}
      else{Log 'CRITICAL: rollback failed to pass /preview health check'}
    }else{Log 'CRITICAL: port occupied; rollback cannot proceed safely'}
    throw
  }
}catch{
  Log ('ERROR: ' + $_.Exception.Message)
  throw
}finally{
  if($lock){$lock.Dispose()}
}
