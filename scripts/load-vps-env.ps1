# Load VPS SSH env from repo root .env.local.server (gitignored).
param(
  [string]$ProjectRoot = ''
)

if (-not $ProjectRoot) {
  $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
  $ProjectRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
}
$envFile = Join-Path $ProjectRoot '.env.local.server'
if (-not (Test-Path $envFile)) {
  throw "Missing $envFile - copy from .env.local.server.example and fill in VPS credentials."
}

Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith('#')) { return }
  $eq = $line.IndexOf('=')
  if ($eq -lt 1) { return }
  $key = $line.Substring(0, $eq).Trim()
  $value = $line.Substring($eq + 1).Trim()
  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  Set-Item -Path "Env:$key" -Value $value
}

if (-not $env:VPS_HOST) { throw 'VPS_HOST is required in .env.local.server' }
if (-not $env:VPS_USER) { $env:VPS_USER = 'root' }
if (-not $env:VPS_PORT) { $env:VPS_PORT = '22' }
if (-not $env:VPS_APP_DIR) { $env:VPS_APP_DIR = '/var/www/Thu-do-online' }
if (-not $env:VPS_SSH_ALIAS) { $env:VPS_SSH_ALIAS = 'nanoai-vps' }

function Get-VpsSshTarget {
  $aliasPath = Join-Path (Join-Path $HOME '.ssh') 'config'
  if (Test-Path $aliasPath) {
    $cfg = Get-Content $aliasPath -Raw
    if ($cfg -match "(?ms)^Host\s+$([regex]::Escape($env:VPS_SSH_ALIAS))\s*$.*?^\s*HostName\s+\S+") {
      return $env:VPS_SSH_ALIAS
    }
  }
  return "$($env:VPS_USER)@$($env:VPS_HOST)"
}

function Test-VpsSshKeyReady {
  $target = Get-VpsSshTarget
  if ($target -eq $env:VPS_SSH_ALIAS) { return $true }
  $batch = "echo __VPS_KEY_OK__"
  $out = & ssh -p $env:VPS_PORT -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new $target $batch 2>&1
  return ($LASTEXITCODE -eq 0 -and ($out -join ' ') -match '__VPS_KEY_OK__')
}

function Invoke-VpsSshCommand {
  param(
    [Parameter(Mandatory = $true)][string]$RemoteCommand,
    [switch]$Interactive
  )

  $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
  . (Join-Path $scriptDir 'load-vps-env.ps1') -ProjectRoot $ProjectRoot | Out-Null
  $target = Get-VpsSshTarget

  if ($Interactive) {
    & ssh -p $env:VPS_PORT $target
    return
  }

  $plink = Get-Command plink -ErrorAction SilentlyContinue
  if ($plink -and $env:VPS_PASSWORD) {
    & plink -batch -P $env:VPS_PORT -pw $env:VPS_PASSWORD "$($env:VPS_USER)@$($env:VPS_HOST)" $RemoteCommand
    return
  }

  if (-not (Test-VpsSshKeyReady)) {
    throw @"
Non-interactive SSH needs PuTTY plink or an SSH key.
Run once: powershell -File scripts/vps-install-ssh-key.ps1
Or use: powershell -File scripts/vps-ssh.ps1 (interactive password)
"@
  }

  & ssh -p $env:VPS_PORT $target $RemoteCommand
}
