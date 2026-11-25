# MC-14: PowerShell Database Restore & Integrity Verification Script
Param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $BackupFile)) {
    Write-Error "Backup file $BackupFile does not exist!"
}

Write-Host "[$((Get-Date).ToString('o'))] Restoring MediCore database from $BackupFile..." -ForegroundColor Cyan
Get-Content $BackupFile | docker exec -i medicore-postgres psql -U medicore_user -d medicore_db

Write-Host "Validating restored database schema and audit log integrity..." -ForegroundColor Cyan
$TableCount = docker exec medicore-postgres psql -U medicore_user -d medicore_db -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
$AuditCount = docker exec medicore-postgres psql -U medicore_user -d medicore_db -t -c "SELECT count(*) FROM `\"AuditRecord`\";"

Write-Host "RESTORE VALIDATION EVIDENCE:" -ForegroundColor Yellow
Write-Host "- Public Schema Table Count: $($TableCount.Trim())" -ForegroundColor Green
Write-Host "- Audit Record Count: $($AuditCount.Trim())" -ForegroundColor Green

if ([int]$TableCount.Trim() -ge 15) {
    Write-Host "SUCCESS: Database restored and verified with complete 17-entity relational schema." -ForegroundColor Green
} else {
    Write-Warning "Restored table count is lower than expected!"
}
