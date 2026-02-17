# Test SePay Webhook with ngrok
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   TEST SE PAY WEBHOOK WITH NGROK" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$ngrokUrl = "https://amia-canelike-exhibitively.ngrok-free.dev/api/sepay-webhook"

Write-Host "Testing URL: $ngrokUrl" -ForegroundColor Yellow
Write-Host ""

# Test 1: GET request with ngrok-skip-browser-warning header
Write-Host "[1] Testing GET request..." -ForegroundColor Green
try {
    $headers = @{
        "ngrok-skip-browser-warning" = "true"
        "User-Agent" = "SePay-Webhook-Tester/1.0"
    }
    
    $response = Invoke-WebRequest -Uri $ngrokUrl -Headers $headers -Method GET
    Write-Host "✓ GET request successful" -ForegroundColor Green
    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor White
    Write-Host "Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "✗ GET request failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: POST request with sample data
Write-Host "[2] Testing POST request with sample data..." -ForegroundColor Green
try {
    $headers = @{
        "ngrok-skip-browser-warning" = "true"
        "User-Agent" = "SePay-Webhook-Tester/1.0"
        "Content-Type" = "application/json"
    }
    
    $body = @{
        amount = 6000
        description = "NAPtest1234"
        transaction_id = "sepay_test_$(Get-Random)"
        status = "success"
        bank_account = "0123456789"
        bank_name = "MB Bank"
        timestamp = "2024-01-01T12:00:00Z"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri $ngrokUrl -Headers $headers -Method POST -Body $body
    Write-Host "✓ POST request successful" -ForegroundColor Green
    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor White
    Write-Host "Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "✗ POST request failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Error Details: $($_.ErrorDetails.Message)" -ForegroundColor DarkRed
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   TEST COMPLETED" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Check server console for webhook logs" -ForegroundColor White
Write-Host "2. Check ngrok terminal for connection logs" -ForegroundColor White
Write-Host "3. Configure SePay Dashboard with the URL above" -ForegroundColor White
Write-Host ""

Write-Host "Note: SePay will send requests with proper headers," -ForegroundColor Magenta
Write-Host "      so it won't see the ngrok warning page." -ForegroundColor Magenta

Read-Host "Press Enter to continue..."