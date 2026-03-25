$exclusionPaths = @("database", "config")
$extensions = @("*.tmp", "*.log", "sess_*")

Write-Host "Searching for files..." -ForegroundColor Cyan

# Find files recursively
$files = Get-ChildItem -Path . -Include $extensions -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
    $path = $_.FullName
    # Check if path contains any exclusion folder
    $excluded = $false
    foreach ($ex in $exclusionPaths) {
        if ($path -match "[\\/]$ex[\\/]") {
            $excluded = $true
            break
        }
    }
    return -not $excluded
}

if ($files.Count -eq 0) {
    Write-Host "No files found to clean." -ForegroundColor Green
    exit
}

# List files
Write-Host "The following files will be DELETED:" -ForegroundColor Yellow
foreach ($file in $files) {
    Write-Host " - $($file.FullName)"
}

# Confirm
$confirmation = Read-Host "Are you sure you want to delete these files? (Y/N)"
if ($confirmation -eq 'Y' -or $confirmation -eq 'y') {
    foreach ($file in $files) {
        Remove-Item $file.FullName -Force
        Write-Host "Deleted: $($file.Name)" -ForegroundColor DarkGray
    }
    Write-Host "Cleanup complete." -ForegroundColor Green
} else {
    Write-Host "Operation cancelled." -ForegroundColor Red
}
