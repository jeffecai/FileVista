# Builds the Windows shell context menu bridge.
# Requires .NET Framework 4.x (included with Windows 10/11).

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $csc)) {
  throw "csc.exe not found. Install .NET Framework 4.x Developer Pack."
}

$source = Join-Path $root 'native\ShellMenu.cs'
$output = Join-Path $root 'native\ShellMenu.exe'

if (-not (Test-Path -LiteralPath $source)) {
  throw "Missing source: $source"
}

& $csc /nologo /target:exe "/out:$output" /codepage:65001 `
  /reference:System.Windows.Forms.dll `
  /reference:System.Drawing.dll `
  $source

if ($LASTEXITCODE -ne 0) {
  throw "Compilation failed with exit code $LASTEXITCODE"
}

$launcherSource = Join-Path $root 'native\FileVistaLauncher.cs'
$launcherOutput = Join-Path $root 'FileVista.exe'

if (-not (Test-Path -LiteralPath $launcherSource)) {
  throw "Missing source: $launcherSource"
}

& $csc /nologo /target:winexe "/out:$launcherOutput" /codepage:65001 `
  /reference:System.Windows.Forms.dll `
  $launcherSource

if ($LASTEXITCODE -ne 0) {
  throw "Launcher compilation failed with exit code $LASTEXITCODE"
}

Write-Host "Built $output"
Write-Host "Built $launcherOutput"
