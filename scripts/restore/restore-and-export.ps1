# Restore Supabase .backup into local Postgres, then export JSON for Firestore.
#
# Prerequisites:
#   - Docker Desktop running
#   - Place your backup at: scripts\backups\db_cluster-26-01-2026@14-56-15.backup
#
# Usage (PowerShell, from repo root):
#   .\scripts\restore\restore-and-export.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $RepoRoot

$BackupDir = Join-Path $RepoRoot "scripts\backups"
$BackupFile = Get-ChildItem -Path $BackupDir -Filter "*.backup" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$BackupGz = Get-ChildItem -Path $BackupDir -Filter "*.backup.gz" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $BackupFile -and $BackupGz) {
  $decompressed = Join-Path $BackupDir ($BackupGz.BaseName)
  if (-not (Test-Path $decompressed)) {
    Write-Host "Decompressing $($BackupGz.Name)..."
    $inStream = [System.IO.File]::OpenRead($BackupGz.FullName)
    $gzip = New-Object System.IO.Compression.GzipStream($inStream, [System.IO.Compression.CompressionMode]::Decompress)
    $outStream = [System.IO.File]::Create($decompressed)
    $gzip.CopyTo($outStream)
    $outStream.Close(); $gzip.Close(); $inStream.Close()
  }
  $BackupFile = Get-Item $decompressed
}

if (-not $BackupFile) {
  Write-Host "No .backup or .backup.gz file found in $BackupDir"
  exit 1
}

Write-Host "Using backup: $($BackupFile.FullName)"

$ContainerName = "famtree-pg-restore"
$DbName = "famtree"
$DbUser = "postgres"
$DbPass = "postgres"
$HostPort = "5433"

$PgBin = "C:\Program Files\PostgreSQL\17\bin"
$UseDocker = $false
if (Get-Command docker -ErrorAction SilentlyContinue) {
  $UseDocker = $true
}

if ($UseDocker) {
  docker rm -f $ContainerName 2>$null | Out-Null
  docker run -d --name $ContainerName -e POSTGRES_PASSWORD=$DbPass -p "${HostPort}:5432" postgres:15
  Write-Host "Waiting for Postgres (Docker)..."
  Start-Sleep -Seconds 6
  docker exec $ContainerName psql -U $DbUser -c "CREATE DATABASE $DbName;" | Out-Null
  Write-Host "Restoring backup..."
  docker cp $BackupFile.FullName "${ContainerName}:/tmp/restore.backup"
  docker exec $ContainerName pg_restore -U $DbUser -d $DbName --no-owner --no-acl /tmp/restore.backup 2>&1 | Out-Host
  $env:DATABASE_URL = "postgresql://${DbUser}:${DbPass}@localhost:${HostPort}/${DbName}"
} elseif (Test-Path "$PgBin\psql.exe") {
  $env:PGPASSWORD = $DbPass
  Write-Host "Restoring SQL dump into local Postgres (database: postgres)..."
  & "$PgBin\psql.exe" -U $DbUser -h localhost -d postgres -v ON_ERROR_STOP=0 -f $BackupFile.FullName 2>&1 | Out-Null
  $env:DATABASE_URL = "postgresql://${DbUser}:${DbPass}@localhost:5432/postgres"
} else {
  Write-Host "Install PostgreSQL 17 or Docker Desktop, then run again."
  exit 1
}
Write-Host "Exporting to JSON..."
node scripts/migrate/export-from-postgres.mjs

Write-Host ""
Write-Host "Next: configure Firebase service account, then run:"
Write-Host "  `$env:GOOGLE_APPLICATION_CREDENTIALS = 'path\to\service-account.json'"
Write-Host "  node scripts/migrate/import-to-firestore.mjs"
