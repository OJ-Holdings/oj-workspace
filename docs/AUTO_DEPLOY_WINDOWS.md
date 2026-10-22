# OJ Workspace — unattended Windows/Tailscale releases

This is an opt-in local deployment agent for the Windows PC running OJ Workspace. It checks the official OJ-Holdings/oj-workspace main branch and requires a successful GitHub Actions check for the exact commit before deploying. It does not change Tailscale, your other STRATHOS ports (3002 and 3003), Supabase data, payments, or outbound messaging.

Tailscale Funnel on HTTPS port 10000 already forwards to http://127.0.0.1:3011. Keep that configuration unchanged.

## Mechanism

1. Check the exact GitHub main SHA and its completed passing CI job.
2. Refuse work if locally paused, another updater is running, tracked source edits exist, or an existing host-loop.ps1 watchdog is running.
3. Refuse commits that changed SQL/schema, .env.example or OJ connection configuration. Those require separate manual migration review.
4. Fast-forward the source checkout and create a detached Git worktree in C:\STRATHOS\apps\oj-workspace-releases\SHA.
5. Copy the trusted local environment configuration to the new local-only worktree; run npm ci, typecheck, test and build there while the old site keeps serving.
6. Start the candidate temporarily at localhost port 3012, verifying the read-only /api/deploy-health endpoint reports the expected SHA.
7. Only after successful staging, stop the verified OJ Next.js process on 3011 and launch the new build there. Confirm its SHA with a live health check.
8. Record a release receipt. If the new server fails, attempt to restart the previous working build.

Each release has its own node_modules directory. This avoids the earlier Windows SWC file-lock problem. The release folders contain copies of your local environment settings: they must remain private. Do not publish or share them. Keep previous release folders until explicitly verified safe to clean up.

## One-time setup on the host PC

Important: your repository currently has an untracked scripts/host-loop.ps1. Inspect and coordinate that existing process supervisor before installing a second one. The updater blocks if an active host-loop process is detected. Do not delete the script or terminate unknown processes blindly.

Use the following PowerShell commands only after this PR is reviewed, merged and its CI is green:

    cd C:\STRATHOS\apps\oj-workspace
    git status
    git pull --ff-only origin main
    Get-Content .\scripts\host-loop.ps1
    Get-CimInstance Win32_Process -Filter "name='powershell.exe' or name='pwsh.exe'" |
        Where-Object { $_.CommandLine -match '[\\/]host-loop\.ps1\b' } |
        Select-Object ProcessId, CommandLine

Do not proceed with installation while the existing host-loop is actively supervising port 3011; coordinate that watcher first.

Read-only check:

    .\scripts\auto-deploy-local.ps1 -Status
    .\scripts\auto-deploy-local.ps1

Try one supervised deployment:

    .\scripts\auto-deploy-local.ps1 -Apply

Once the deploy and live functionality are verified, register a Windows task to check for new green commits every five minutes while the current Windows account is logged in:

    .\scripts\install-auto-deploy-task.ps1 -Install

The installer does nothing unless -Install is explicitly supplied. It refuses to compete with an actively running host-loop watchdog.

## Operations

The task is named OJ Workspace - GitHub Auto Deploy. A local status/receipt/log is stored in C:\STRATHOS\apps\oj-workspace-releases.

Check:

    Get-ScheduledTask -TaskName 'OJ Workspace - GitHub Auto Deploy'
    .\scripts\auto-deploy-local.ps1 -Status
    Get-Content C:\STRATHOS\apps\oj-workspace-releases\logs\deploy.log -Tail 40

Pause immediately, without stopping the currently running application:

    New-Item -ItemType File -Force C:\STRATHOS\apps\oj-workspace-releases\PAUSE

Resume:

    Remove-Item C:\STRATHOS\apps\oj-workspace-releases\PAUSE

Disable the recurring task:

    .\scripts\install-auto-deploy-task.ps1 -Disable

The updater uses no credentials beyond the existing GitHub access for this public repo. The original app .env.local remains local. Source checkout untracked files, including the private Jacob owner SQL and your host-loop, are not deleted or committed.

## Manual release gates and limitations

- Only merged main commits with passing GitHub Actions checks are eligible. Protect main with reviewed PRs; anyone able to merge into main can trigger a deployment.
- SQL/schema and environment-configuration changes require a manual coordinated deployment. The updater intentionally has no force override.
- The PC must be running and the relevant user logged in. This is not independent cloud hosting.
- The staging probe validates server response and commit identity, not all authenticated paths and external integrations. Review significant releases manually as well.
- The port 3011 process switch can briefly interrupt active users. Rollback is attempted if the new server fails health checks; it cannot guarantee recovery from a PC, database, disk or network failure.
- The scheduled task does not install itself merely because these files were committed. Initial installation is an explicit action on your Windows host.
