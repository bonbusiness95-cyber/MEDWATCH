# Deploy MedWatch to Hostinger via SSH/SCP
# Usage:
#   $env:HOSTINGER_SSH_HOST = "example.hostinger.com"
#   $env:HOSTINGER_SSH_USER = "username"
#   $env:HOSTINGER_SSH_PORT = "22"
#   $env:HOSTINGER_SERVER_PATH = "/home/username/medwatch"
#   $env:HOSTINGER_SSH_KEY_PATH = "C:\Users\User\.ssh\id_rsa"  # optional
#   $env:HOSTINGER_REMOTE_START_COMMAND = "node dist/server.js"  # optional
#   npm run deploy:hostinger

function Fail($message) {
    Write-Host "ERROR: $message" -ForegroundColor Red
    exit 1
}

if (Test-Path ".env.hostinger") {
    Write-Host "🔐 Loading Hostinger environment variables from .env.hostinger"
    Get-Content ".env.hostinger" | ForEach-Object {
        if ($_ -match '^(\s*#|\s*$)') { return }
        $parts = $_ -split '=', 2
        if ($parts.Length -eq 2) {
            $name = $parts[0].Trim()
            $value = $parts[1].Trim()
            if ($name -and $value) {
                $env:$name = $value
            }
        }
    }
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Fail "npm is not installed or not available in PATH."
}
if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
    Fail "scp is required. Enable OpenSSH client or install an SSH client."
}
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    Fail "ssh is required. Enable OpenSSH client or install an SSH client."
}

$required = @("HOSTINGER_SSH_HOST", "HOSTINGER_SSH_USER", "HOSTINGER_SERVER_PATH")
foreach ($name in $required) {
    if (-not $env:$name -or $env:$name.Trim().Length -eq 0) {
        Fail "Environment variable $name is required."
    }
}

$host = $env:HOSTINGER_SSH_HOST.Trim()
$user = $env:HOSTINGER_SSH_USER.Trim()
$port = if ($env:HOSTINGER_SSH_PORT) { $env:HOSTINGER_SSH_PORT.Trim() } else { "22" }
$remotePath = $env:HOSTINGER_SERVER_PATH.Trim()
$keyOption = if ($env:HOSTINGER_SSH_KEY_PATH) { "-i `"$($env:HOSTINGER_SSH_KEY_PATH.Trim())`"" } else { "" }
$remoteTarget = "$user@$host:$remotePath"
$remoteHost = "$user@$host"

Write-Host "🚀 Building MedWatch for production..."
$buildResult = npm run build
if ($LASTEXITCODE -ne 0) {
    Fail "Build failed. Fix errors locally before deploying."
}

Write-Host "📦 Uploading files to Hostinger: $remoteTarget"
$uploadItems = @("dist", "package.json", "package-lock.json")
if (Test-Path "firebase-applet-config.json") { $uploadItems += "firebase-applet-config.json" }
if (Test-Path ".env.production") { $uploadItems += ".env.production" }

foreach ($item in $uploadItems) {
    if (-not (Test-Path $item)) {
        Write-Host "⚠️  Skipping missing item: $item"
        continue
    }
    $scpArgs = @("-P", $port) + ($keyOption -split ' ' | Where-Object { $_ -ne '' }) + @("-r", $item, $remoteTarget)
    Write-Host "  - Uploading $item"
    $process = Start-Process scp -ArgumentList $scpArgs -NoNewWindow -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        Fail "scp failed for $item"
    }
}

Write-Host "🔧 Running remote install on Hostinger"
$installCommand = if ($env:HOSTINGER_REMOTE_INSTALL_COMMAND) { $env:HOSTINGER_REMOTE_INSTALL_COMMAND } else { "npm install --production" }
$remoteCommands = @(
    "mkdir -p $remotePath",
    "cd $remotePath",
    $installCommand
)
if ($env:HOSTINGER_REMOTE_START_COMMAND) {
    $remoteCommands += $env:HOSTINGER_REMOTE_START_COMMAND
}

$joinedCommand = $remoteCommands -join " && "
$sshArgs = @("-p", $port) + ($keyOption -split ' ' | Where-Object { $_ -ne '' }) + @($remoteHost, $joinedCommand)
$process = Start-Process ssh -ArgumentList $sshArgs -NoNewWindow -Wait -PassThru
if ($process.ExitCode -ne 0) {
    Fail "Remote SSH command failed. Check your Hostinger SSH access and remote path."
}

Write-Host "✅ Déploiement Hostinger terminé."
if (-not $env:HOSTINGER_REMOTE_START_COMMAND) {
    Write-Host "Note: le script n'a pas démarré le serveur remote automatiquement. Configurez votre application Node.js dans Hostinger ou ajoutez HOSTINGER_REMOTE_START_COMMAND."
}
