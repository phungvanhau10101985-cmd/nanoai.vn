#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

Set-Location -LiteralPath $PSScriptRoot

$KillAllNode = $false
$NoNgrok = $false
$OnlyClean = $false
$AllowOverlapWithThuDoPorts = $false
$Bypass188MarkerCheck = $false

for ($i = 0; $i -lt $args.Count; $i++) {
  switch ($args[$i]) {
    '-KillAllNode' { $KillAllNode = $true; break }
    '-NoNgrok' { $NoNgrok = $true; break }
    '-OnlyClean' { $OnlyClean = $true; break }
    '-AllowOverlapWithThuDoPorts' { $AllowOverlapWithThuDoPorts = $true; break }
    '-Bypass188MarkerCheck' { $Bypass188MarkerCheck = $true; break }
    default {}
  }
}

$marker188 = Join-Path $PSScriptRoot '.dev-clear-start-marker-188'
if (!$Bypass188MarkerCheck -and ![System.IO.File]::Exists($marker188)) {
  Write-Error @"
[dev-clear-start] Chặn để không ảnh hưởng repo Thu-do-online nhầm chỗ.

Tại repo LOCAL 188: tạo file rỗng cạnh dev-clear-start.bat tên `.dev-clear-start-marker-188` rồi chạy lại.
Tuỳ chọn (chỉ khi hiểu rủi ro): `-Bypass188MarkerCheck`
"@
  exit 99
}
# --- Cổng mặc định của Thu-do-online khi làm LOCAL (Next 3000, ngrok UI 4040) — không được dùng làm Backend/Frontend 188 ---
# Nếu bạn đặt Thu-do sang port khác: set THU_DO_BLOCK_PORTS=3001,5173
$ThuDoRiskPorts = @(3000, 4040)

if ($env:THU_DO_BLOCK_PORTS) {
  $extraInts = foreach ($segment in ($env:THU_DO_BLOCK_PORTS -split ',')) {
    try { [int]($segment.Trim()) } catch { }
  }
  $ThuDoRiskPorts = @($ThuDoRiskPorts + @($extraInts)) | Sort-Object -Unique
}

function Stop-ProcessesListeningOnPorts {
  param([int[]]$Ports)
  foreach ($po in $Ports) {
    try {
      $conns = Get-NetTCPConnection -LocalPort $po -ErrorAction SilentlyContinue |
        Where-Object { $_.State -eq 'Listen' }
      $pids = @($conns | Select-Object -ExpandProperty OwningProcess -Unique)
      foreach ($pid in $pids) {
        if ($pid -gt 0) {
          Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
          Write-Host "  Closed LISTEN on port $po (PID $pid)"
        }
      }
    }
    catch {
      Write-Host "  [warn] Kill port $po : $($_.Exception.Message)"
    }
  }
}

function Stop-NgrokForwardingPort {
  param([int]$ForwardPort)

  Get-CimInstance Win32_Process -Filter "Name = 'ngrok.exe'" -ErrorAction SilentlyContinue |
    ForEach-Object {
      $ngPid = $_.ProcessId
      $line = "$($_.CommandLine)"
      if (!$line -or ![regex]::IsMatch($line, "(:|localhost|\\b)$ForwardPort(\\b|'""|\s|$)")) {
        return
      }
      try {
        Stop-Process -Id $ngPid -Force -ErrorAction Stop
        Write-Host "  Stopped ngrok.exe PID $ngPid (forwards ~$ForwardPort)"
      }
      catch {
        Write-Host "  [warn] Could not stop ngrok PID $ngPid : $($_.Exception.Message)"
      }
    }
}

Write-Host '[dev-clear-start] Repo 188 local — không quét/kill cổng ngoài BACKEND_PORT + FRONTEND_PORT (+ ngrok khớp forward).'

if ($env:BACKEND_PORT) {
  try { [int]$BackendPort = $env:BACKEND_PORT.Trim() }
  catch { Write-Error 'BACKEND_PORT not an integer'; exit 2 }
}
else { [int]$BackendPort = 8001 }

if ($env:FRONTEND_PORT) {
  try { [int]$FrontendPort = $env:FRONTEND_PORT.Trim() }
  catch { Write-Error 'FRONTEND_PORT not an integer'; exit 2 }
}
else { [int]$FrontendPort = 3001 }

$portsProject = @($BackendPort, $FrontendPort)

if (!$AllowOverlapWithThuDoPorts) {
  $overlap = @($portsProject | Where-Object { $ThuDoRiskPorts -contains $_ })
  if ($overlap.Count -gt 0) {
    Write-Error @"
[dev-clear-start] BACKEND_PORT hoặc FRONTEND_PORT trùng cổng bị chặn (Thu-do-online / block list): $($overlap -join ', ').
Đổi port hoặc thêm `-AllowOverlapWithThuDoPorts` nếu bạn chấp nhận rủi ro có thể tắt nhầm dự án đang làm LOCAL trên cổng đó.
"@
    exit 3
  }
}

Write-Host "  Ports: backend=$BackendPort frontend=$FrontendPort"

if (!$OnlyClean -and !$NoNgrok) {
  Stop-NgrokForwardingPort -ForwardPort $FrontendPort
}

Stop-ProcessesListeningOnPorts -Ports $portsProject

if ($KillAllNode) {
  Write-Host '[dev-clear-start] -KillAllNode: stopping all node.exe (can kill other apps — **not** Thu-do-safe).'
  Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

# ----- Optional cache clean — mirror intent of “clear” -----
$cleanPaths = @(
  (Join-Path $PSScriptRoot 'frontend\.next'),
  (Join-Path $PSScriptRoot 'web\.next'),
  (Join-Path $PSScriptRoot '.next'),
  (Join-Path $PSScriptRoot 'node_modules\.cache')
)
foreach ($p in $cleanPaths) {
  if (Test-Path -LiteralPath $p) {
    try {
      Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction Stop
      Write-Host "  Removed $p"
    }
    catch { Write-Host "  [warn] Cannot remove ${p}: $($_.Exception.Message)" }
  }
}

if ($OnlyClean) {
  Write-Host '[dev-clear-start] -OnlyClean: done.'
  exit 0
}

# ----- Starts (adapt paths/commands to repo 188) -----
Write-Host '[dev-clear-start] Starting backend + frontend... (sửa START bên dưới đúng cây thư mục uvicorn/next của repo 188)'

#
# Cau hinh START: sua duong dan venv/backend/frontend trong repo 188.
#

Start-Process cmd.exe -WorkingDirectory $PSScriptRoot -ArgumentList @(
  '/k',
  "`"cd /d `"$PSScriptRoot`"`" && .\venv\Scripts\activate && uvicorn app.main:app --reload --host 127.0.0.1 --port $BackendPort"
) -WindowStyle Normal

Start-Sleep -Seconds 2

# Frontend Next.js (tat PORT trung FrontendPort — Next doc theo bien PORT hoac doi port trong lenh duoi)
$env:PORT = "$FrontendPort"
Start-Process cmd.exe -WorkingDirectory $PSScriptRoot -ArgumentList @(
  '/k',
  "`"cd /d `"$(Join-Path $PSScriptRoot 'frontend')`"`" && set PORT=$FrontendPort && npm run dev"
) -WindowStyle Normal

Start-Sleep -Seconds 4

if (!$NoNgrok) {
  $exe = Get-Command ngrok.exe -CommandType Application -ErrorAction SilentlyContinue
  if (!$exe) {
    Write-Host '  ngrok không có trong PATH — bỏ qua.'
  }
  else {
    Start-Process cmd.exe -WorkingDirectory $PSScriptRoot -ArgumentList @('/k', "ngrok http $FrontendPort") -WindowStyle Normal
    Write-Host "  Started ngrok -> http localhost:$FrontendPort"
  }
}

Write-Host '[dev-clear-start] OK.'
exit 0
