# octodev-cli Windows Installer
param(
    [string]$Version = "latest",
    [string]$InstallDir = "$env:LOCALAPPDATA\octodev\bin"
)

# Colors
$Green = "Green"
$Yellow = "Yellow"
$Red = "Red"
$Blue = "Cyan"

Write-Host "octodev-cli Installer for Windows" -ForegroundColor $Blue
Write-Host "=================================" -ForegroundColor $Blue
Write-Host "Version: $Version"
Write-Host "Install Directory: $InstallDir"
Write-Host ""

# Detect if already installed
$ExePath = Join-Path $InstallDir "octodev.exe"
if (Test-Path $ExePath) {
    Write-Host "octodev is already installed." -ForegroundColor $Yellow
    $upgrade = Read-Host "Do you want to upgrade? (y/n)"
    if ($upgrade -eq "y") {
        Write-Host "Backing up current installation..."
        $backupPath = "$ExePath.backup.$([DateTimeOffset]::Now.ToUnixTimeSeconds())"
        Copy-Item $ExePath $backupPath
    } else {
        Write-Host "Installation cancelled."
        exit 0
    }
}

# Create directories
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
$ConfigDir = "$env:USERPROFILE\.octodev"
New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null

# Download binary
$RepoUrl = "https://github.com/khulnasoft-bot/octodev/releases/download"
$BinaryName = "octodev-win-x64.exe"
$DownloadUrl = "$RepoUrl/v$Version/$BinaryName"

Write-Host "Downloading octodev..." -ForegroundColor $Yellow
try {
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $ExePath
    Write-Host "Download complete." -ForegroundColor $Green
} catch {
    Write-Host "Error downloading: $_" -ForegroundColor $Red
    exit 1
}

# Add to PATH
$CurrentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($CurrentPath -notlike "*$InstallDir*") {
    Write-Host "Adding to PATH..." -ForegroundColor $Yellow
    [Environment]::SetEnvironmentVariable(
        "Path",
        "$CurrentPath;$InstallDir",
        "User"
    )
    $env:Path += ";$InstallDir"
}

# Initialize configuration
$ConfigFile = Join-Path $ConfigDir ".octodevrc"
if (-not (Test-Path $ConfigFile)) {
    Write-Host "Initializing configuration..." -ForegroundColor $Yellow
    @"
version: '1.0'
profile: default
projectDir: $env:USERPROFILE\projects

execution:
  defaultTimeout: 30000

ai:
  enabled: true
  provider: openai

security:
  enableAuditLogging: true
"@ | Out-File -FilePath $ConfigFile -Encoding UTF8
}

Write-Host "Installation complete!" -ForegroundColor $Green
Write-Host "You can now use octodev:" -ForegroundColor $Green
Write-Host "  octodev --help"
Write-Host "  octodev --version"
Write-Host ""
Write-Host "Configuration directory: $ConfigDir" -ForegroundColor $Blue
Write-Host ""
Write-Host "Note: Restart your PowerShell or Command Prompt for PATH changes to take effect." -ForegroundColor $Yellow
