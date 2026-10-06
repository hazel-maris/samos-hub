$source = "C:\Projects\samos-hub"
$dest   = "C:\Projects\samos-hub\android\app\src\main\assets\web"

Write-Host ""
Write-Host "Syncing SamOS web files..." -ForegroundColor Cyan


# ============================================================
# CLEAN OLD WEB ASSETS
# ============================================================

if (Test-Path $dest) {
    Remove-Item $dest -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $dest | Out-Null


# ============================================================
# ROOT FILES
# ============================================================

$files = @(
    "index.html",
    "config.js",
    "manifest.json",
    "manifest.webmanifest",
    "service-worker.js",
    "icon-192.png",
    "icon-512.png"
)


foreach ($file in $files) {
    $sourceFile =
        Join-Path $source $file

    if (Test-Path $sourceFile) {
        Copy-Item `
            $sourceFile `
            (Join-Path $dest $file) `
            -Force

        Write-Host "  copied $file"
    }
    else {
        Write-Host "  missing $file" -ForegroundColor Yellow
    }
}


# ============================================================
# WEB FOLDERS
# ============================================================

$folders = @(
    "components",
    "html",
    "scripts",
    "styles",
    "icons",
    "fonts"
)


foreach ($folder in $folders) {
    $sourceFolder =
        Join-Path $source $folder

    $destFolder =
        Join-Path $dest $folder


    if (Test-Path $sourceFolder) {
        Copy-Item `
            $sourceFolder `
            $destFolder `
            -Recurse `
            -Force

        Write-Host "  copied $folder\"
    }
    else {
        Write-Host "  missing $folder\" -ForegroundColor Yellow
    }
}


Write-Host ""
Write-Host "SamOS web sync complete." -ForegroundColor Green
Write-Host ""