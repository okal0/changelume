$ErrorActionPreference = 'Stop'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodeExecutable = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' }
if (-not (Test-Path -LiteralPath $nodeExecutable)) { throw 'Install Node.js 24 and reopen PowerShell, then run this script again.' }
$env:PATH = (Split-Path $nodeExecutable) + [IO.Path]::PathSeparator + $env:PATH
Push-Location (Split-Path $PSScriptRoot)
try { & $nodeExecutable scripts/demo.mjs; if ($LASTEXITCODE -ne 0) { throw 'Demo failed; inspect the output above.' } } finally { Pop-Location }
