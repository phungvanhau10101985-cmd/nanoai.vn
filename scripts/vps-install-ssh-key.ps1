# Cài SSH key một lần → sau đó không cần gõ password mỗi lần deploy.
# Chạy: powershell -ExecutionPolicy Bypass -File scripts/vps-install-ssh-key.ps1
param(
  [string]$ProjectRoot = ''
)

if (-not $ProjectRoot) {
  $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
  $ProjectRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
}

. (Join-Path $PSScriptRoot 'load-vps-env.ps1') -ProjectRoot $ProjectRoot

$sshDir = Join-Path $HOME '.ssh'
$keyPath = Join-Path $sshDir 'id_ed25519_nanoai_vps'
$configPath = Join-Path $sshDir 'config'

if (-not (Test-Path $sshDir)) {
  New-Item -ItemType Directory -Path $sshDir -Force | Out-Null
}

if (-not (Test-Path $keyPath)) {
  Write-Host "Creating SSH key: $keyPath" -ForegroundColor Cyan
  & ssh-keygen -t ed25519 -f $keyPath -N '""' -C "nanoai-vps-$($env:VPS_HOST)"
}

Write-Host "Copy public key to VPS (nhập password một lần — xem VPS_PASSWORD trong .env.local.server)" -ForegroundColor Yellow
Get-Content "$keyPath.pub" | & ssh -p $env:VPS_PORT "$($env:VPS_USER)@$($env:VPS_HOST)" "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"

$block = @"

Host $($env:VPS_SSH_ALIAS)
  HostName $($env:VPS_HOST)
  User $($env:VPS_USER)
  Port $($env:VPS_PORT)
  IdentityFile $keyPath
  IdentitiesOnly yes

"@

$config = if (Test-Path $configPath) { Get-Content $configPath -Raw } else { '' }
if ($config -notmatch "(?m)^Host\s+$([regex]::Escape($env:VPS_SSH_ALIAS))\s*$") {
  Add-Content -Path $configPath -Value $block
  Write-Host "Added SSH config alias: $($env:VPS_SSH_ALIAS)" -ForegroundColor Green
} else {
  Write-Host "SSH alias $($env:VPS_SSH_ALIAS) already exists in $configPath" -ForegroundColor DarkYellow
}

Write-Host "Test: ssh -p $env:VPS_PORT $($env:VPS_SSH_ALIAS)" -ForegroundColor Green
