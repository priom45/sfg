param(
  [string]$OutputFile = "new-project-bootstrap.sql"
)

$migrationsDir = Join-Path $PSScriptRoot "migrations"
$outputPath = Join-Path $PSScriptRoot $OutputFile

$migrationFiles = Get-ChildItem -Path $migrationsDir -Filter "*.sql" | Sort-Object Name

if (-not $migrationFiles) {
  throw "No migration files found in $migrationsDir"
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("-- Auto-generated bootstrap file for a fresh Supabase project")
$lines.Add("-- Generated from supabase/migrations in chronological order")
$lines.Add("")

foreach ($file in $migrationFiles) {
  $lines.Add("-- ===============================================")
  $lines.Add("-- BEGIN MIGRATION: $($file.Name)")
  $lines.Add("-- ===============================================")
  $lines.Add("")
  foreach ($line in Get-Content -Path $file.FullName) {
    $lines.Add($line)
  }
  $lines.Add("")
  $lines.Add("-- END MIGRATION: $($file.Name)")
  $lines.Add("")
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($outputPath, ($lines -join [Environment]::NewLine), $utf8NoBom)

Write-Output "Generated $outputPath"
