# Windows-only, disposable empty folder; no settings, credentials or archives.
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Windows ACL verification requires Windows.' }
$source = Join-Path $PSScriptRoot '..\backup-supabase-windows.ps1'
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $source),[ref]$tokens,[ref]$errors)
if ($errors.Count) { throw 'Backup script did not parse.' }
$definition = $ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'ProtectDirectory'},$true)
if (-not $definition) { throw 'Private directory guard not found.' }
Invoke-Expression $definition.Extent.Text
$target = Join-Path $env:TEMP ('oj-private-acl-test-'+[guid]::NewGuid().ToString('N'))
try {
  ProtectDirectory $target
  $acl = [IO.Directory]::GetAccessControl($target,[Security.AccessControl.AccessControlSections]::Access)
  if (-not $acl.AreAccessRulesProtected) { throw 'Permission inheritance was not disabled.' }
  $actual = @($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]) | ForEach-Object {$_.IdentityReference.Value} | Sort-Object)
  $expected = @([Security.Principal.WindowsIdentity]::GetCurrent().User.Value,'S-1-5-18','S-1-5-32-544') | Sort-Object -Unique
  if (@(Compare-Object $expected $actual).Count) { throw 'Unexpected private folder identities.' }
  ProtectDirectory $target
  Write-Output 'PRIVATE_BACKUP_DACL=PASS; REPEATED_VERIFICATION=PASS'
} finally {
  # Only this newly created empty test directory, never a real backup folder.
  if ([IO.Directory]::Exists($target)) { [IO.Directory]::Delete($target) }
}
