#Requires -Version 5.1
<#
  Stop dev processes for this repo only (does not affect 188-com-vn 8001/3001).

  Closes every LISTEN port owned by this project's dev server, worker, esbuild,
  or ngrok, including a second Next that moved off PORT, then the caller
  starts the project port and ngrok again.

  Usage:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/restart-server-stop-dev.ps1
    powershell ... -File scripts/restart-server-stop-dev.ps1 -DevPort 3000 -ProjectRoot "E:\python-code\nanoai.vn"
#>

param(
  [int]$DevPort = 3000,
  [string]$ProjectRoot = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = Split-Path -Parent $PSScriptRoot
}

# CMD often passes a ProjectRoot with a trailing backslash, which escapes the closing quote.
# PowerShell then sees a path ending with a literal quote and Resolve-Path fails.
$ProjectRoot = $ProjectRoot.Trim().Trim('"').TrimEnd('\', '/')

try {
  $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot -ErrorAction Stop).Path
}
catch {
  Write-Error "ProjectRoot not found: $ProjectRoot"
  exit 1
}

$Blocked188Ports = @(8001, 3001)

if ($Blocked188Ports -contains $DevPort) {
  Write-Error "[restart-server] DEV_PORT=$DevPort overlaps 188-com-vn ports ($($Blocked188Ports -join ', ')). Change PORT in .env.local."
  exit 2
}

function Normalize-PathForMatch([string]$Path) {
  if ([string]::IsNullOrWhiteSpace($Path)) { return '' }
  try { $x = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path }
  catch { $x = $Path }
  return ($x.TrimEnd('\', '/')).Replace('\', '/').ToLowerInvariant()
}

$script:ProjectNeedles = @()
$needle = Normalize-PathForMatch $ProjectRoot
if ($needle) { $script:ProjectNeedles += $needle }
$rawNeedle = $ProjectRoot.Replace('\', '/').ToLowerInvariant().TrimEnd('/')
if ($rawNeedle -and $script:ProjectNeedles -notcontains $rawNeedle) {
  $script:ProjectNeedles += $rawNeedle
}

if (-not ('RestartServerProcCwd' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class RestartServerProcCwd {
  [DllImport("kernel32.dll")]
  public static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
  [DllImport("kernel32.dll")]
  public static extern bool CloseHandle(IntPtr h);
  [DllImport("ntdll.dll")]
  public static extern int NtQueryInformationProcess(IntPtr h, int cls, ref PROCESS_BASIC_INFORMATION pbi, int len, out int ret);
  [DllImport("kernel32.dll")]
  public static extern bool ReadProcessMemory(IntPtr h, IntPtr addr, byte[] buf, int size, out IntPtr read);
  [StructLayout(LayoutKind.Sequential)]
  public struct PROCESS_BASIC_INFORMATION {
    public IntPtr Reserved1;
    public IntPtr PebBaseAddress;
    public IntPtr Reserved2_0;
    public IntPtr Reserved2_1;
    public IntPtr UniqueProcessId;
    public IntPtr InheritedFromUniqueProcessId;
  }
  public static string Cwd(int pid) {
    IntPtr h = OpenProcess(0x0410, false, pid);
    if (h == IntPtr.Zero) return "";
    try {
      var pbi = new PROCESS_BASIC_INFORMATION();
      int ret;
      if (NtQueryInformationProcess(h, 0, ref pbi, Marshal.SizeOf(typeof(PROCESS_BASIC_INFORMATION)), out ret) != 0) return "";
      bool x64 = IntPtr.Size == 8;
      int ppOffset = x64 ? 0x20 : 0x10;
      byte[] ptrBuf = new byte[IntPtr.Size];
      IntPtr nread;
      IntPtr pebField = new IntPtr(pbi.PebBaseAddress.ToInt64() + ppOffset);
      if (!ReadProcessMemory(h, pebField, ptrBuf, ptrBuf.Length, out nread)) return "";
      long pp = x64 ? BitConverter.ToInt64(ptrBuf, 0) : BitConverter.ToInt32(ptrBuf, 0);
      int curDir = x64 ? 0x38 : 0x24;
      byte[] us = new byte[16];
      if (!ReadProcessMemory(h, new IntPtr(pp + curDir), us, x64 ? 16 : 8, out nread)) return "";
      int len = BitConverter.ToUInt16(us, 0);
      long bufPtr = x64 ? BitConverter.ToInt64(us, 8) : BitConverter.ToInt32(us, 4);
      if (len <= 0 || len > 2048) return "";
      byte[] chars = new byte[len];
      if (!ReadProcessMemory(h, new IntPtr(bufPtr), chars, len, out nread)) return "";
      return Encoding.Unicode.GetString(chars);
    } catch {
      return "";
    } finally {
      CloseHandle(h);
    }
  }
}
'@
}

function Test-TextHasProject([string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { return $false }
  $norm = $Text.Replace('\', '/').ToLowerInvariant()
  foreach ($projectNeedle in $script:ProjectNeedles) {
    if ([string]::IsNullOrWhiteSpace($projectNeedle)) { continue }
    $idx = $norm.IndexOf($projectNeedle)
    while ($idx -ge 0) {
      $after = $idx + $projectNeedle.Length
      $boundaryOk = $after -ge $norm.Length
      if (-not $boundaryOk) {
        $ch = $norm[$after]
        $boundaryOk = ($ch -eq '/') -or ($ch -eq ' ') -or ($ch -eq '"') -or ($ch -eq "'") -or ($ch -eq '`')
      }
      if ($boundaryOk) { return $true }
      $idx = $norm.IndexOf($projectNeedle, $idx + 1)
    }
  }
  return $false
}

function Test-Is188Text([string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { return $false }
  return $Text -match '(?i)188-com-vn'
}

function Test-IsEditorToolText([string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { return $false }
  return $Text -match '(?i)([\\/]cursor[\\/]|[\\/]resources[\\/]app[\\/]|tsserver|typingsInstaller|eslintServer|vscode-eslint|copilot)'
}

function Test-DevSignature([string]$Blob) {
  if ([string]::IsNullOrWhiteSpace($Blob)) { return $false }
  $norm = $Blob.Replace('\', '/').ToLowerInvariant()
  if ($norm -match 'next/dist/bin/next') { return $true }
  if ($norm -match '(^|[\s/])next(\.js)?\s+dev(\s|$)') { return $true }
  if ($norm -match 'worksheet-job-worker') { return $true }
  if ($norm -match 'npm-cli\.js\s+run\s+(dev|worker)(\s|$)') { return $true }
  if ($norm -match 'npm(\.cmd)?\s+run\s+(dev|worker)(\s|$)') { return $true }
  if ($norm -match '/@esbuild/|/node_modules/esbuild/') { return $true }
  return $false
}

function Get-ListenRows {
  $rows = New-Object System.Collections.Generic.List[object]
  try {
    $conns = @(Get-NetTCPConnection -State Listen -ErrorAction Stop)
    foreach ($conn in $conns) {
      $rows.Add([pscustomobject]@{
          Port      = [int]$conn.LocalPort
          ProcessId = [int]$conn.OwningProcess
        })
    }
    return $rows
  }
  catch {
    Write-Host "  [warn] Get-NetTCPConnection: $($_.Exception.Message) - using netstat"
  }

  $lines = @(& netstat.exe -ano -p tcp)
  foreach ($line in $lines) {
    if ($line -notmatch '^\s*TCP\s+(\S+)\s+\S+\s+(\S+)\s+(\d+)\s*$') { continue }
    $localAddr = $Matches[1]
    $state = $Matches[2]
    $listenPid = [int]$Matches[3]
    if ($state -notmatch 'LISTENING|LISTEN') { continue }
    if ($localAddr -notmatch ':(\d+)$') { continue }
    $rows.Add([pscustomobject]@{
        Port      = [int]$Matches[1]
        ProcessId = $listenPid
      })
  }
  return $rows
}

function Get-ForwardPortsFromText([string]$Text) {
  $set = New-Object 'System.Collections.Generic.HashSet[int]'
  if ([string]::IsNullOrWhiteSpace($Text)) { return }
  foreach ($m in [regex]::Matches($Text, '(?i)(?:localhost|127\.0\.0\.1):(\d{2,5})')) {
    [void]$set.Add([int]$m.Groups[1].Value)
  }
  foreach ($m in [regex]::Matches($Text, '(?i)\bhttps?\s+(?:--\S+\s+)*(\d{2,5})\b')) {
    [void]$set.Add([int]$m.Groups[1].Value)
  }
  foreach ($port in $set) { Write-Output $port }
}

function Get-NgrokApiPorts([int]$ProcessId) {
  $set = New-Object 'System.Collections.Generic.HashSet[int]'
  $listenPorts = @($script:ListenRows | Where-Object { $_.ProcessId -eq $ProcessId } | Select-Object -ExpandProperty Port -Unique)
  foreach ($apiPort in $listenPorts) {
    if ($apiPort -lt 4040 -or $apiPort -gt 4055) { continue }
    try {
      $resp = Invoke-RestMethod -Uri "http://127.0.0.1:$apiPort/api/tunnels" -TimeoutSec 2
    }
    catch { continue }
    $tunnelList = @()
    $tunnelsProp = $resp.PSObject.Properties['tunnels']
    if ($null -ne $tunnelsProp -and $null -ne $tunnelsProp.Value) {
      $tunnelList = @($tunnelsProp.Value)
    }
    foreach ($tunnel in $tunnelList) {
      if ($null -eq $tunnel) { continue }
      $addr = ''
      $configProp = $tunnel.PSObject.Properties['config']
      if ($null -ne $configProp -and $null -ne $configProp.Value) {
        $addrProp = $configProp.Value.PSObject.Properties['addr']
        if ($null -ne $addrProp -and $null -ne $addrProp.Value) { $addr = [string]$addrProp.Value }
      }
      foreach ($port in @(Get-ForwardPortsFromText $addr)) {
        if ($port -gt 0) { [void]$set.Add([int]$port) }
      }
      if ($addr -match '^\d{2,5}$') { [void]$set.Add([int]$addr) }
    }
  }
  foreach ($port in $set) { Write-Output $port }
}

$script:CwdCache = @{}
function Get-CachedCwd([int]$ProcessId) {
  if ($script:CwdCache.ContainsKey($ProcessId)) { return [string]$script:CwdCache[$ProcessId] }
  $cwd = ''
  try { $cwd = [string][RestartServerProcCwd]::Cwd($ProcessId) }
  catch { $cwd = '' }
  $script:CwdCache[$ProcessId] = $cwd
  return $cwd
}

function Get-ProcessBlob($Proc) {
  return (([string]$Proc.CommandLine) + ' ' + ([string]$Proc.ExecutablePath))
}

$byId = @{}
$byParent = @{}
$allProcs = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
foreach ($proc in $allProcs) {
  $procId = [int]$proc.ProcessId
  $byId[$procId] = $proc
  $parentId = [int]$proc.ParentProcessId
  if (-not $byParent.ContainsKey($parentId)) {
    $byParent[$parentId] = New-Object System.Collections.Generic.List[int]
  }
  [void]$byParent[$parentId].Add($procId)
}

$KeepPids = @{}
$cursorPid = [int]$PID
for ($i = 0; $i -lt 8 -and $cursorPid -gt 0; $i++) {
  $KeepPids[$cursorPid] = $true
  if (-not $byId.ContainsKey($cursorPid)) { break }
  $cursorPid = [int]$byId[$cursorPid].ParentProcessId
}

function Test-ChainHasProject([int]$StartId) {
  $id = $StartId
  for ($i = 0; $i -lt 8 -and $id -gt 0; $i++) {
    if (-not $byId.ContainsKey($id)) { break }
    $proc = $byId[$id]
    $blob = Get-ProcessBlob $proc
    if (Test-Is188Text $blob) { return $false }
    if (Test-TextHasProject $blob) { return $true }
    $name = [string]$proc.Name
    if ($name -eq 'node.exe' -or $name -eq 'esbuild.exe' -or $name -eq 'ngrok.exe') {
      if (Test-TextHasProject (Get-CachedCwd $id)) { return $true }
    }
    $id = [int]$proc.ParentProcessId
  }
  return $false
}

function Get-DescendantIds([int]$RootId) {
  $found = New-Object System.Collections.Generic.List[int]
  $queue = New-Object System.Collections.Generic.Queue[int]
  $queue.Enqueue($RootId)
  $seen = @{}
  while ($queue.Count -gt 0) {
    $current = $queue.Dequeue()
    if ($seen.ContainsKey($current)) { continue }
    $seen[$current] = $true
    if (-not $byParent.ContainsKey($current)) { continue }
    foreach ($childId in @($byParent[$current])) {
      if ($childId -eq $RootId) { continue }
      [void]$found.Add([int]$childId)
      $queue.Enqueue([int]$childId)
    }
  }
  foreach ($id in $found) { Write-Output $id }
}

function Stop-PidSafe([int]$ProcessId, [string]$Reason) {
  if ($ProcessId -le 4) { return $false }
  if ($KeepPids.ContainsKey($ProcessId)) {
    Write-Host "  [skip] PID $ProcessId is the restart process"
    return $false
  }
  try {
    Stop-Process -Id $ProcessId -Force -ErrorAction Stop
    Write-Host "  Stopped PID $ProcessId ($Reason)"
    return $true
  }
  catch {
    Write-Host "  [warn] Could not stop PID ${ProcessId}: $($_.Exception.Message)"
    return $false
  }
}

function Get-ListenPortsForPid([int]$ProcessId) {
  $ports = New-Object System.Collections.Generic.List[int]
  foreach ($row in @($script:ListenRows)) {
    if ($null -eq $row) { continue }
    if ([int]$row.ProcessId -ne $ProcessId) { continue }
    $port = [int]$row.Port
    if ($port -gt 0 -and -not $ports.Contains($port)) { [void]$ports.Add($port) }
  }
  foreach ($port in $ports) { Write-Output $port }
}

function Test-PidListensOn188([int]$ProcessId) {
  foreach ($port in @(Get-ListenPortsForPid $ProcessId)) {
    if ($Blocked188Ports -contains [int]$port) { return $true }
  }
  return $false
}

$script:ListenRows = @(Get-ListenRows)
$closedPorts = New-Object 'System.Collections.Generic.HashSet[int]'
$stoppedPids = @{}

function Stop-ProjectDevProcesses {
  $roots = New-Object System.Collections.Generic.List[int]
  foreach ($proc in $allProcs) {
    $procId = [int]$proc.ProcessId
    if ($KeepPids.ContainsKey($procId)) { continue }
    $name = [string]$proc.Name
    $blob = Get-ProcessBlob $proc
    if (Test-Is188Text $blob) { continue }
    if (Test-IsEditorToolText $blob) { continue }

    $owned = $false
    if ($name -eq 'esbuild.exe') {
      $exeNorm = ([string]$proc.ExecutablePath).Replace('\', '/').ToLowerInvariant()
      if ((Test-TextHasProject $exeNorm) -and ($exeNorm -match '/esbuild')) { $owned = $true }
    }
    elseif ($name -eq 'node.exe') {
      if ((Test-DevSignature $blob) -and (Test-ChainHasProject $procId)) { $owned = $true }
    }
    if ($owned) { [void]$roots.Add($procId) }
  }

  $kill = New-Object System.Collections.Generic.List[int]
  foreach ($rootId in @($roots)) {
    if (Test-PidListensOn188 $rootId) {
      Write-Host "  [skip] PID $rootId listens on an 188 port ($($Blocked188Ports -join '/'))"
      continue
    }
    $blockedFamily = $false
    $family = New-Object System.Collections.Generic.List[int]
    [void]$family.Add($rootId)
    foreach ($childId in @(Get-DescendantIds $rootId)) {
      if ($null -eq $childId -or [int]$childId -le 0) { continue }
      [void]$family.Add([int]$childId)
      if (Test-PidListensOn188 ([int]$childId)) { $blockedFamily = $true }
    }
    if ($blockedFamily) {
      Write-Host "  [skip] PID $rootId family listens on an 188 port"
      continue
    }
    foreach ($memberId in @($family)) {
      if (-not $kill.Contains([int]$memberId)) { [void]$kill.Add([int]$memberId) }
    }
  }

  $ordered = @($kill)
  if ($ordered.Count -gt 1) { [array]::Reverse($ordered) }
  foreach ($procId in $ordered) {
    if ($null -eq $procId -or $stoppedPids.ContainsKey([int]$procId)) { continue }
    $ports = @(Get-ListenPortsForPid ([int]$procId))
    $reason = 'project dev'
    if ($ports.Count -gt 0) { $reason = "project listen port $($ports -join ',')" }
    if (Stop-PidSafe ([int]$procId) $reason) {
      $stoppedPids[[int]$procId] = $true
      foreach ($port in $ports) {
        if ($port -gt 0 -and ($Blocked188Ports -notcontains [int]$port)) {
          [void]$closedPorts.Add([int]$port)
        }
      }
    }
  }
}

function Stop-DevPortSquatters {
  foreach ($row in @($script:ListenRows | Where-Object { $_.Port -eq $DevPort })) {
    $procId = [int]$row.ProcessId
    if ($stoppedPids.ContainsKey($procId)) { continue }
    if ($KeepPids.ContainsKey($procId)) { continue }
    if (Test-PidListensOn188 $procId) {
      Write-Host "  [skip] PID $procId holds port $DevPort but also listens on an 188 port"
      continue
    }
    if ($byId.ContainsKey($procId) -and (Test-Is188Text (Get-ProcessBlob $byId[$procId]))) {
      Write-Host "  [skip] PID $procId on port $DevPort belongs to 188-com-vn"
      continue
    }
    if (Stop-PidSafe $procId "LISTEN on project port $DevPort") {
      $stoppedPids[$procId] = $true
      [void]$closedPorts.Add($DevPort)
    }
  }
}

function Stop-ProjectNgrok {
  $ngrokProcs = @($allProcs | Where-Object { [string]$_.Name -eq 'ngrok.exe' })
  foreach ($proc in $ngrokProcs) {
    $procId = [int]$proc.ProcessId
    if ($KeepPids.ContainsKey($procId) -or $stoppedPids.ContainsKey($procId)) { continue }
    $cmd = [string]$proc.CommandLine
    if (Test-Is188Text $cmd) {
      Write-Host "  [skip] ngrok PID $procId (188-com-vn)"
      continue
    }

    $targets = New-Object 'System.Collections.Generic.HashSet[int]'
    foreach ($port in @(Get-ForwardPortsFromText $cmd)) { [void]$targets.Add([int]$port) }
    foreach ($port in @(Get-NgrokApiPorts $procId)) { [void]$targets.Add([int]$port) }

    $hits188 = $false
    $hitsProject = $false
    foreach ($port in @($targets)) {
      if ($Blocked188Ports -contains [int]$port) { $hits188 = $true }
      if ([int]$port -eq $DevPort -or $closedPorts.Contains([int]$port)) { $hitsProject = $true }
    }
    $usesProjectConfig = (Test-TextHasProject $cmd) -and ($cmd -match '(?i)ngrok\.yml')
    $usesProjectDomain = $cmd -match '(?i)amia-canelike-exhibitively\.ngrok-free\.dev'
    if ($hits188) {
      Write-Host "  [skip] ngrok PID $procId forwards an 188 port ($($Blocked188Ports -join '/'))"
      continue
    }
    if (-not $hitsProject -and -not $usesProjectConfig -and -not $usesProjectDomain) { continue }

    $shown = @($targets | Where-Object { $_ -gt 0 }) -join ','
    if (-not $shown) { $shown = 'config' }
    $listenPorts = @(Get-ListenPortsForPid $procId)
    if (Stop-PidSafe $procId "ngrok forward $shown") {
      $stoppedPids[$procId] = $true
      foreach ($port in $listenPorts) {
        if ($port -gt 0 -and ($Blocked188Ports -notcontains [int]$port)) { [void]$closedPorts.Add([int]$port) }
      }
      foreach ($port in @($targets)) {
        if ($port -gt 0 -and ($Blocked188Ports -notcontains [int]$port)) { [void]$closedPorts.Add([int]$port) }
      }
    }
  }
}

function Stop-ProjectWindows {
  $procs = @()
  try { $procs = @(Get-Process -ErrorAction SilentlyContinue) }
  catch { return }
  foreach ($proc in $procs) {
    $procId = [int]$proc.Id
    if ($KeepPids.ContainsKey($procId) -or $stoppedPids.ContainsKey($procId)) { continue }
    $title = ''
    try { $title = [string]$proc.MainWindowTitle }
    catch { $title = '' }
    if ([string]::IsNullOrWhiteSpace($title)) { continue }

    $ours = $false
    if ($title.StartsWith('Next.js Dev Server')) { $ours = $true }
    elseif ($title.StartsWith('Worksheet Worker')) { $ours = $true }
    elseif ($title.StartsWith('NGROK Thu-do')) { $ours = $true }
    elseif ($title -match '(?i)amia-canelike-exhibitively\.ngrok-free\.dev') { $ours = $true }
    elseif ($title -match '(?i)^ngrok http .*?(\d{2,5})\s*$') {
      $forward = [int]$Matches[1]
      if (($forward -eq $DevPort) -and ($Blocked188Ports -notcontains $forward)) { $ours = $true }
    }
    if (-not $ours) { continue }
    $tree = New-Object System.Collections.Generic.List[int]
    [void]$tree.Add($procId)
    foreach ($childId in @(Get-DescendantIds $procId)) {
      if ($null -ne $childId -and [int]$childId -gt 0) { [void]$tree.Add([int]$childId) }
    }
    foreach ($treeId in @($tree)) {
      foreach ($port in @(Get-ListenPortsForPid ([int]$treeId))) {
        if ($port -gt 0 -and ($Blocked188Ports -notcontains [int]$port)) { [void]$closedPorts.Add([int]$port) }
      }
    }
    Write-Host "  Stopped window '$title' (PID $procId)"
    & taskkill.exe /F /T /PID $procId 2>$null | Out-Null
    foreach ($treeId in @($tree)) { $stoppedPids[[int]$treeId] = $true }
  }
}

Write-Host "[restart-server] Closing this project's listen ports (canonical $DevPort and duplicates). 188-com-vn 8001/3001 stays up."

Stop-ProjectDevProcesses
Stop-DevPortSquatters
Stop-ProjectNgrok
Stop-ProjectWindows

Start-Sleep -Milliseconds 400
$script:ListenRows = @(Get-ListenRows)
Stop-DevPortSquatters
Stop-ProjectNgrok

$still = @($script:ListenRows | Where-Object { $_.Port -eq $DevPort -and -not $stoppedPids.ContainsKey([int]$_.ProcessId) })
if ($closedPorts.Count -eq 0) {
  if ($stoppedPids.Count -eq 0) {
    Write-Host "[restart-server] No duplicate project port was listening."
  }
  else {
    Write-Host "[restart-server] Stopped project processes that were not listening."
  }
}
else {
  $listed = @($closedPorts | Sort-Object) -join ', '
  Write-Host "[restart-server] Closed project ports: $listed"
}
Write-Host "[restart-server] 188-com-vn ports $($Blocked188Ports -join '/') were not stopped."

if ($still.Count -gt 0) {
  $pids = @($still | Select-Object -ExpandProperty ProcessId -Unique) -join ', '
  Write-Host "[restart-server] Port $DevPort is still listening (PID $pids)."
  exit 3
}

exit 0
