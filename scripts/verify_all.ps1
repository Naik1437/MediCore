# MediCore - Consolidated 6-Container Live Platform Verification Script (MC-09 to MC-15)
# Run this script directly in your normal PowerShell terminal where Docker is running.
# Exits nonzero if any mandatory check fails.

$ErrorActionPreference = "Continue"
$script:failures = 0
$script:warnings = 0

function Pass  { param($msg) Write-Host "  [PASS] $msg" -ForegroundColor Green }
function Fail  { param($msg) Write-Host "  [FAIL] $msg" -ForegroundColor Red;    $script:failures++ }
function Warn  { param($msg) Write-Host "  [WARN] $msg" -ForegroundColor Yellow; $script:warnings++ }

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  MediCore Consolidated Live Container & Platform Verification" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# â”€â”€ 1. Docker Container Status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[1/6] Verifying Docker Container Health..." -ForegroundColor Yellow
$containers = @("medicore-frontend","medicore-backend","medicore-analytics","medicore-notification-worker","medicore-postgres","medicore-redis")

foreach ($c in $containers) {
    $state = docker inspect -f '{{.State.Status}}' $c 2>$null
    if ($state -eq "running") { Pass "Container '$c' is RUNNING" }
    else                       { Fail "Container '$c' status: '$state'" }
}

# â”€â”€ 2. Database Schema & Migration Verification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[2/6] Verifying PostgreSQL 16 Schema (17 Relational Entities)..." -ForegroundColor Yellow
try {
    # docker exec returns Object[]; join lines then trim to get a plain string integer
    $raw   = docker exec medicore-postgres psql -U medicore_user -d medicore_db -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>$null
    $count = [int]([string]$raw -replace '\s','')
    if ($count -ge 17) { Pass "Public schema tables: $count (>= 17 required)" }
    else                { Fail "Public schema tables: $count (< 17 required)" }
} catch {
    Fail "Database query failed: $_"
}

# â”€â”€ 3. Backend Express API & FHIR Probe â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[3/6] Probing Backend API (Port 4002) & FHIR R4 Metadata..." -ForegroundColor Yellow

try {
    $backendLive = Invoke-RestMethod -Uri "http://localhost:4002/api/v1/health/live" -TimeoutSec 5 -ErrorAction Stop
    Pass "Backend liveness: status = '$($backendLive.status)'"
} catch {
    Fail "Backend /api/v1/health/live probe: $_"
}

try {
    $fhirMeta = Invoke-RestMethod -Uri "http://localhost:4002/api/v1/fhir/r4/metadata" -TimeoutSec 5 -ErrorAction Stop
    Pass "FHIR R4 CapabilityStatement: resourceType=$($fhirMeta.resourceType), fhirVersion=$($fhirMeta.fhirVersion)"
} catch {
    Warn "FHIR metadata probe: $_"
}

# â”€â”€ 4. FastAPI Analytics & Notification DLQ Probe â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[4/6] Probing FastAPI Analytics Engine (Port 8002)..." -ForegroundColor Yellow

try {
    $analyticsLive = Invoke-RestMethod -Uri "http://localhost:8002/health/live" -TimeoutSec 5 -ErrorAction Stop
    Pass "Analytics liveness: service = '$($analyticsLive.service)'"
} catch {
    Fail "Analytics /health/live probe: $_"
}

try {
    # Resolve .env relative to the script file, with fallback to current working directory.
    # $PSScriptRoot is empty when invoked without -File; use $MyInvocation as the primary source.
    $scriptDir = if ($MyInvocation.MyCommand.Path) {
        Split-Path -Parent $MyInvocation.MyCommand.Path
    } elseif ($PSScriptRoot) {
        $PSScriptRoot
    } else {
        $PWD.Path
    }
    # scripts/ lives one level below the repo root where .env sits
    $envFile = Join-Path (Join-Path $scriptDir "..") ".env" | Resolve-Path -ErrorAction Stop
    $sharedSecret = (Get-Content $envFile.Path -ErrorAction Stop |
        Where-Object { $_ -match '^ANALYTICS_SHARED_SECRET=' } |
        Select-Object -First 1).Split('=', 2)[1].Trim()

    if (-not $sharedSecret) { throw "ANALYTICS_SHARED_SECRET not found in .env" }

    $dlqHeaders = @{ "x-internal-key" = $sharedSecret }
    $dlq = Invoke-RestMethod -Uri "http://localhost:8002/api/v1/notifications/dlq" `
        -Headers $dlqHeaders -TimeoutSec 5 -ErrorAction Stop
    Pass "Notification DLQ: status=$($dlq.status), total_failed=$($dlq.total_failed)"
} catch {
    Warn "Notification DLQ probe: $_"
} finally {
    Remove-Variable sharedSecret -ErrorAction SilentlyContinue
    Remove-Variable dlqHeaders   -ErrorAction SilentlyContinue
}

# â”€â”€ 5. Frontend UI Availability â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[5/6] Probing Next.js Frontend Portal (Port 3002)..." -ForegroundColor Yellow
try {
    $frontend = Invoke-WebRequest -Uri "http://localhost:3002" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    if ($frontend.StatusCode -lt 500) { Pass "Frontend portal: HTTP $($frontend.StatusCode)" }
    else                               { Fail "Frontend portal returned HTTP $($frontend.StatusCode)" }
} catch {
    Fail "Frontend portal probe: $_"
}

# â”€â”€ 6. Summary Scorecard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n======================================================================" -ForegroundColor Cyan
Write-Host "  MediCore Verification Summary" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  - Frontend Portal:    http://localhost:3002"            -ForegroundColor White
Write-Host "  - Backend API:        http://localhost:4002/api/v1"     -ForegroundColor White
Write-Host "  - OpenAPI / Swagger:  http://localhost:4002/docs"       -ForegroundColor White
Write-Host "  - FHIR R4 Metadata:   http://localhost:4002/api/v1/fhir/r4/metadata" -ForegroundColor White
Write-Host "  - Analytics API:      http://localhost:8002/docs"       -ForegroundColor White
Write-Host ""
Write-Host "  Mandatory failures : $($script:failures)" -ForegroundColor $(if ($script:failures -gt 0) { "Red" } else { "Green" })
Write-Host "  Warnings           : $($script:warnings)" -ForegroundColor $(if ($script:warnings -gt 0) { "Yellow" } else { "Green" })

if ($script:failures -gt 0) {
    Write-Host "`n  RESULT: FAILED ($($script:failures) mandatory check(s) did not pass)" -ForegroundColor Red
    exit 1
} else {
    Write-Host "`n  RESULT: ALL MANDATORY CHECKS PASSED" -ForegroundColor Green
    exit 0
}
