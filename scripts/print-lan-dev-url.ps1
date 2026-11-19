#Requires -Version 5.1
param([int]$Port = 3000)

$ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -like '192.168.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Select-Object -First 1 -ExpandProperty IPAddress

Write-Host "      May nay:    http://localhost:$Port"
if ($ip) {
  Write-Host "      Dien thoai: http://${ip}:$Port"
  Write-Host "      Cung Wi-Fi. Ma QR dung dia chi nay, khong mo ngrok."
} else {
  Write-Host "      Khong thay IP Wi-Fi 192.168. Dien thoai cung mang chua vao duoc."
}
exit 0
