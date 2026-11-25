# MC-14: PowerShell Database Backup Script
Param(
    [string]$BackupDir = ".\backups"
)

$ErrorActionPreference = "Stop"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}
$BackupFile = Join-Path $BackupDir "medicore_backup_$Timestamp.sql"

Write-Host "[$((Get-Date).ToString('o'))] Starting MediCore PostgreSQL database backup..." -ForegroundColor Cyan
docker exec medicore-postgres pg_dump -U medicore_user -d medicore_db > $BackupFile

if (Test-Path $BackupFile) {
    $Size = (Get-Item $BackupFile).Length / 1KB
    Write-Host "[$((Get-Date).ToString('o'))] Backup completed successfully: $BackupFile ($([math]::Round($Size, 2)) KB)" -ForegroundColor Green

    # Retention policy: delete backups older than 30 days
    Get-ChildItem -Path $BackupDir -Filter "medicore_backup_*.sql" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item -Force
    Write-Host "Audit retention policy verified (backups > 30 days cleaned)." -ForegroundColor DarkGray
} else {
    Write-Error "Backup creation failed!"
}
