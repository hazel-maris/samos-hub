
$ErrorActionPreference = "Stop"

# powershell.exe -ExecutionPolicy Bypass -File ./sync-web.ps1

# ============================================================
# SamOS Hub — Web Asset Sync
# ============================================================

$source = "C:\Projects\samos-hub"
$dest = Join-Path $source "android\app\src\main\assets\web"

# Root-level files to include in the APK
$files = @(
    "index.html",
    "config.js",
    "manifest.json",
    "manifest.webmanifest",
    "service-worker.js",
    "icon-192.png",
    "icon-512.png"
)

# Web asset directories
$folders = @(
    "components",
    "data",
    "fonts",
    "html",
    "icons",
    "scripts",
    "styles"
)

Write-Host "`nSyncing SamOS web files..." -ForegroundColor Cyan

# ============================================================
# VALIDATE SOURCE
# ============================================================

if (-not (Test-Path -LiteralPath $source -PathType Container)) {
    throw "Source directory not found: $source"
}

foreach ($file in $files) {
    $path = Join-Path $source $file

    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required file missing: $path"
    }
}

foreach ($folder in $folders) {
    $path = Join-Path $source $folder

    if (-not (Test-Path -LiteralPath $path -PathType Container)) {
        throw "Required folder missing: $path"
    }
}

# ============================================================
# PREPARE STAGING AREA
# ============================================================

$parent = Split-Path $dest -Parent
New-Item -ItemType Directory -Force -Path $parent | Out-Null

$stage = Join-Path $parent ("web-stage-" + [guid]::NewGuid().ToString("N"))
$backup = Join-Path $parent ("web-backup-" + [guid]::NewGuid().ToString("N"))

New-Item -ItemType Directory -Path $stage | Out-Null

try {
    # ========================================================
    # COPY ROOT FILES
    # ========================================================

    foreach ($file in $files) {
        Copy-Item -LiteralPath (Join-Path $source $file) `
            -Destination (Join-Path $stage $file) -Force

        Write-Host "  copied $file"
    }

    # ========================================================
    # COPY WEB FOLDERS
    # ========================================================

    foreach ($folder in $folders) {
        Copy-Item -LiteralPath (Join-Path $source $folder) `
            -Destination (Join-Path $stage $folder) `
            -Recurse -Force

        Write-Host "  copied $folder\"
    }

    # ========================================================
    # REPLACE DESTINATION
    # ========================================================

    $hadPrevious = Test-Path -LiteralPath $dest

    if ($hadPrevious) {
        Move-Item -LiteralPath $dest -Destination $backup
    }

    try {
        Move-Item -LiteralPath $stage -Destination $dest
    }
    catch {
        if ($hadPrevious -and
            (Test-Path -LiteralPath $backup) -and
            -not (Test-Path -LiteralPath $dest)) {

            Move-Item -LiteralPath $backup -Destination $dest
        }

        throw
    }

    # Remove backup after successful replacement
    if (Test-Path -LiteralPath $backup) {
        Remove-Item -LiteralPath $backup -Recurse -Force
    }

    Write-Host "`nSamOS web sync complete." -ForegroundColor Green
}
finally {
    # Clean up unfinished staging
    if (Test-Path -LiteralPath $stage) {
        Remove-Item -LiteralPath $stage -Recurse -Force
    }
}
