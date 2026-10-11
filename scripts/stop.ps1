$ErrorActionPreference = "Continue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = Split-Path -Parent $ScriptDir

Write-Host "=========================================="
Write-Host " FeedbackIQ - Shutting Down Services    "
Write-Host "=========================================="

$PidFile = Join-Path $ScriptDir ".ai_service.pid"
if (Test-Path $PidFile) {
    $AiPid = Get-Content $PidFile
    if ($AiPid) {
        Write-Host "Stopping AI Service (PID: $AiPid)..."
        Stop-Process -Id $AiPid -Force ErrorAction SilentlyContinue
    }
    Remove-Item $PidFile -Force ErrorAction SilentlyContinue
}

# Stop Uvicorn processes if any lingering
Get-Process -Name "uvicorn" -ErrorAction SilentlyContinue | Stop-Process -Force ErrorAction SilentlyContinue

Write-Host "Stopping PostgreSQL Docker container..."
docker compose -f "$RepoRoot\docker-compose.yml" stop postgres

Write-Host "Services shut down cleanly." -ForegroundColor Green
