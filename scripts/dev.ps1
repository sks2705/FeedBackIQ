$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = Split-Path -Parent $ScriptDir

Write-Host "=========================================="
Write-Host " FeedbackIQ - Local Development Startup  "
Write-Host "=========================================="

# 1. Ensure web/.env exists
$WebEnv = Join-Path $RepoRoot "web\.env"
$WebEnvExample = Join-Path $RepoRoot "web\.env.example"
if (-not (Test-Path $WebEnv)) {
    Write-Host "Copying web\.env.example to web\.env..."
    Copy-Item $WebEnvExample $WebEnv
}

# 2. Start PostgreSQL via Docker Compose
Write-Host "[1/5] Starting PostgreSQL container..."
docker compose -f "$RepoRoot\docker-compose.yml" up -d postgres

Write-Host "Waiting for PostgreSQL to be ready..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    $check = docker compose -f "$RepoRoot\docker-compose.yml" exec -T postgres pg_isready -U feedbackiq -d feedbackiq 2>$null
    if ($LASTEXITCODE -eq 0) {
        $ready = $true
        break
    }
    Start-Sleep -Seconds 1
}

if (-not $ready) {
    Write-Host "ERROR: PostgreSQL failed to become ready in 30 seconds." -ForegroundColor Red
    exit 1
}
Write-Host "PostgreSQL is ready!" -ForegroundColor Green

# 3. Run Prisma Migrations
Write-Host "[2/5] Running Prisma migrations..."
Set-Location "$RepoRoot\web"
npx prisma migrate deploy

# 4. Setup & Start AI service in venv
Write-Host "[3/5] Checking AI Service virtualenv..."
$AiDir = Join-Path $RepoRoot "ai-service"
$VenvDir = Join-Path $AiDir "venv"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"

if (-not (Test-Path $VenvDir)) {
    Write-Host "Creating virtualenv in $VenvDir..."
    python -m venv $VenvDir
    & $VenvPython -m pip install --upgrade pip
    & $VenvPython -m pip install --extra-index-url https://download.pytorch.org/whl/cpu -r "$AiDir\requirements.txt"
}

Write-Host "[4/5] Starting AI Service in background..."
$UvicornExe = Join-Path $VenvDir "Scripts\uvicorn.exe"
$AiProcess = Start-Process -FilePath $UvicornExe -ArgumentList "main:app --app-dir `"$AiDir`" --host 127.0.0.1 --port 8000" -PassThru -NoNewWindow
$AiProcess.Id | Out-File -FilePath "$ScriptDir\.ai_service.pid" -Encoding ascii

Write-Host "Waiting for AI Service GET /health..."
$healthOk = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $res = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get -TimeoutSec 2 ErrorAction SilentlyContinue
        if ($res.status -eq "ok") {
            $healthOk = $true
            break
        }
    } catch {}
    Start-Sleep -Seconds 1
}

if (-not $healthOk) {
    Write-Host "ERROR: AI Service failed to become healthy." -ForegroundColor Red
    exit 1
}
Write-Host "AI Service is healthy!" -ForegroundColor Green

# 5. Start Web App
Write-Host "[5/5] Starting Next.js Web App on http://localhost:3000..."
Set-Location "$RepoRoot\web"
npm run dev
