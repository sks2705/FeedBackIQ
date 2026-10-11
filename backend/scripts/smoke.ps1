$ErrorActionPreference = "Stop"

$BaseUrl = $env:BASE_URL
if (-not $BaseUrl) { $BaseUrl = "http://localhost:3000" }

$AdminEmail = $env:SEED_ADMIN_EMAIL
if (-not $AdminEmail) { $AdminEmail = "admin@feedbackiq.local" }

$AdminPassword = $env:SEED_ADMIN_PASSWORD
if (-not $AdminPassword) { $AdminPassword = "AdminPassword123!" }

$ViewerEmail = $env:SEED_VIEWER_EMAIL
if (-not $ViewerEmail) { $ViewerEmail = "viewer@feedbackiq.local" }

$ViewerPassword = $env:SEED_VIEWER_PASSWORD
if (-not $ViewerPassword) { $ViewerPassword = "ViewerPassword123!" }

Write-Host "=========================================="
Write-Host " FeedbackIQ Smoke Test Suite (PowerShell) "
Write-Host "=========================================="

# Step 1: Admin Login
Write-Host -NoNewline "[1/8] Admin Login... "
$AdminWebSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$LoginBody = @{ email = $AdminEmail; password = $AdminPassword } | ConvertTo-Json
$LoginResp = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -Body $LoginBody -ContentType "application/json" -WebSession $AdminWebSession

if ($LoginResp.data.role -eq "ADMIN") {
    Write-Host "PASS" -ForegroundColor Green
} else {
    Write-Host "FAIL" -ForegroundColor Red
    exit 1
}

# Step 2: Unauthenticated /api/feedback read blocked (401)
Write-Host -NoNewline "[2/8] Public read access blocked (401)... "
try {
    Invoke-RestMethod -Uri "$BaseUrl/api/feedback" -Method Get | Out-Null
    Write-Host "FAIL (Expected 401, request succeeded)" -ForegroundColor Red
    exit 1
} catch {
    if ($_.Exception.Response.StatusCode -eq [System.Net.HttpStatusCode]::Unauthorized) {
        Write-Host "PASS" -ForegroundColor Green
    } else {
        Write-Host "FAIL (Unexpected status code)" -ForegroundColor Red
        exit 1
    }
}

# Step 3: Create Feedback (Public POST)
Write-Host -NoNewline "[3/8] Create Feedback (Public)... "
$CreateBody = @{
    message = "Smoke test message for automated verification in PowerShell"
    productName = "PowerShell Smoke"
    source = "web"
} | ConvertTo-Json

$CreateResp = Invoke-RestMethod -Uri "$BaseUrl/api/feedback" -Method Post -Body $CreateBody -ContentType "application/json"
$FeedbackId = $CreateResp.data.id

if ($FeedbackId) {
    Write-Host "PASS (ID: $FeedbackId)" -ForegroundColor Green
} else {
    Write-Host "FAIL" -ForegroundColor Red
    exit 1
}

# Step 4: List Feedback as Admin
Write-Host -NoNewline "[4/8] List Feedback as Admin... "
$ListResp = Invoke-RestMethod -Uri "$BaseUrl/api/feedback?pageSize=5" -Method Get -WebSession $AdminWebSession
if ($ListResp.meta.total -ge 1) {
    Write-Host "PASS" -ForegroundColor Green
} else {
    Write-Host "FAIL" -ForegroundColor Red
    exit 1
}

# Step 5: Viewer Login & Forbidden Action Check (403)
Write-Host -NoNewline "[5/8] Viewer Forbidden Action (403)... "
$ViewerWebSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$ViewerLoginBody = @{ email = $ViewerEmail; password = $ViewerPassword } | ConvertTo-Json
Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -Body $ViewerLoginBody -ContentType "application/json" -WebSession $ViewerWebSession | Out-Null

$PatchBody = @{ status = "RESOLVED" } | ConvertTo-Json
try {
    Invoke-RestMethod -Uri "$BaseUrl/api/feedback/$FeedbackId/status" -Method Patch -Body $PatchBody -ContentType "application/json" -WebSession $ViewerWebSession | Out-Null
    Write-Host "FAIL (Expected 403, request succeeded)" -ForegroundColor Red
    exit 1
} catch {
    if ($_.Exception.Response.StatusCode -eq [System.Net.HttpStatusCode]::Forbidden) {
        Write-Host "PASS" -ForegroundColor Green
    } else {
        Write-Host "FAIL (Unexpected status code)" -ForegroundColor Red
        exit 1
    }
}

# Step 6: Admin Patch Status
Write-Host -NoNewline "[6/8] Admin Update Status (PATCH)... "
$PatchResp = Invoke-RestMethod -Uri "$BaseUrl/api/feedback/$FeedbackId/status" -Method Patch -Body $PatchBody -ContentType "application/json" -WebSession $AdminWebSession
if ($PatchResp.data.status -eq "RESOLVED") {
    Write-Host "PASS" -ForegroundColor Green
} else {
    Write-Host "FAIL" -ForegroundColor Red
    exit 1
}

# Step 7: Analytics Summary as Admin
Write-Host -NoNewline "[7/8] Analytics Summary... "
$AnalyticsResp = Invoke-RestMethod -Uri "$BaseUrl/api/analytics/summary?days=30" -Method Get -WebSession $AdminWebSession
if ($AnalyticsResp.data.total -ge 1) {
    Write-Host "PASS" -ForegroundColor Green
} else {
    Write-Host "FAIL" -ForegroundColor Red
    exit 1
}

# Step 8: Export CSV
Write-Host -NoNewline "[8/8] Export CSV... "
$ExportResp = Invoke-WebRequest -Uri "$BaseUrl/api/feedback/export" -Method Get -WebSession $AdminWebSession
if ($ExportResp.Headers["Content-Type"] -match "text/csv") {
    Write-Host "PASS" -ForegroundColor Green
} else {
    Write-Host "FAIL" -ForegroundColor Red
    exit 1
}

Write-Host "=========================================="
Write-Host " ALL SMOKE TESTS PASSED SUCCESSFULLY! " -ForegroundColor Green
Write-Host "=========================================="
