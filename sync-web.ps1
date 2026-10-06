$source = "C:\Projects\SamOS Hub\samos-hub"
$dest   = "C:\Projects\SamOS Hub\samos-hub\android\app\src\main\assets\web"

Write-Host ""
Write-Host "Syncing SamOS web files..." -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path $dest | Out-Null

$files = @(
    "index.html",
    "style.css",
    "script.js",
    "config.js",
    "manifest.json",
    "manifest.webmanifest",
    "service-worker.js",
    "icon-192.png",
    "icon-512.png"
)

foreach ($file in $files) {
    $sourceFile = Join-Path $source $file

    if (Test-Path $sourceFile) {
        Copy-Item $sourceFile (Join-Path $dest $file) -Force
        Write-Host "  copied $file"
    }
}

$folders = @(
    "icons",
    "fonts"
)

foreach ($folder in $folders) {
    $sourceFolder = Join-Path $source $folder
    $destFolder   = Join-Path $dest $folder

    if (Test-Path $sourceFolder) {
        Remove-Item $destFolder -Recurse -Force -ErrorAction SilentlyContinue
        Copy-Item $sourceFolder $destFolder -Recurse -Force
        Write-Host "  copied $folder\"
    }
}

Write-Host ""
Write-Host "SamOS web sync complete." -ForegroundColor Green
Write-Host ""