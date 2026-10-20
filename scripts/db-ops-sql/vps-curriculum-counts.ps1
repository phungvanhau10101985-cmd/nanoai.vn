$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
. (Join-Path $root 'scripts\load-vps-env.ps1') -ProjectRoot $root
Import-Module Posh-SSH
$secure = ConvertTo-SecureString $env:VPS_PASSWORD -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($env:VPS_USER, $secure)
$session = New-SSHSession -ComputerName $env:VPS_HOST -Credential $cred -Port ([int]$env:VPS_PORT) -AcceptKey -ConnectionTimeout 30
if (-not $session) { throw 'SSH session failed' }

$remote = @'
cd /var/www/Thu-do-online
DB=$(grep -h '^DATABASE_URL=' .env.local .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r"')
if [ -z "$DB" ]; then echo NO_DATABASE_URL; exit 1; fi
psql "$DB" -v ON_ERROR_STOP=1 -c "select (select count(*) from public.worksheet_curricula) as curricula, (select count(*) from public.worksheet_worksheets where curriculum_id is not null) as ws_linked, (select count(*) from public.worksheet_worksheets where curriculum_id is null) as ws_free, (select count(*) from public.worksheet_questions where curriculum_id is not null) as q_linked, (select count(*) from public.worksheet_questions where curriculum_id is null) as q_free, (select count(*) from public.worksheet_textbook_lessons) as textbook_lessons, (select count(*) from public.worksheet_official_questions) as official;"
'@

$remote = $remote -replace "`r", ''
$result = Invoke-SSHCommand -SessionId $session.SessionId -Command $remote -TimeOut 120
if ($result.Output) { $result.Output | ForEach-Object { Write-Host $_ } }
if ($result.Error) { $result.Error | ForEach-Object { Write-Host $_ } }
Write-Host "exit=$($result.ExitStatus)"
Remove-SSHSession -SessionId $session.SessionId | Out-Null
if ($result.ExitStatus -ne 0) { exit $result.ExitStatus }
