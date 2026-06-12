$ErrorActionPreference = "Stop"

$ProjectDir = "D:\ERP-BUMDES"
$VpsHost = "31.97.110.246"
$VpsPort = 2222
$VpsUser = "root"
$KeyPath = "$env:USERPROFILE\.ssh\erp_bumdes_vps_ed25519"
$RemoteArchive = "/root/erp-bumdes-deploy.tar.gz"
$RemoteDeployScript = "/root/deploy-erp-bumdes.sh"
$LocalArchive = Join-Path $env:TEMP "erp-bumdes-deploy.tar.gz"
$LocalRemoteScript = Join-Path $env:TEMP "deploy-erp-bumdes-remote.sh"

function Stop-IfFailed {
  param([string]$Message)
  if ($LASTEXITCODE -ne 0) {
    throw $Message
  }
}

Write-Host "---- PRECHECK LOKAL ----"
if (!(Test-Path $ProjectDir)) { throw "Project tidak ditemukan: $ProjectDir" }
if (!(Test-Path $KeyPath)) { throw "SSH key tidak ditemukan: $KeyPath" }

Push-Location $ProjectDir
try {
  Write-Host "---- BUAT ARCHIVE ----"
  if (Test-Path $LocalArchive) {
    Remove-Item $LocalArchive -Force
  }

  tar.exe -czf $LocalArchive `
    --exclude=.git `
    --exclude=.next `
    --exclude=node_modules `
    --exclude=.env `
    --exclude=.env.local `
    --exclude=.env.production `
    --exclude=postgres.sql `
    .
  Stop-IfFailed "Gagal membuat archive deploy."

  Write-Host "Archive dibuat: $LocalArchive"
}
finally {
  Pop-Location
}

$remoteLines = @(
  'set -Eeuo pipefail',
  'export PATH="/opt/erp-bumdes-node/node_modules/node/bin:$PATH"',
  'TS=$(date +%Y%m%d_%H%M%S)',
  'APP_DIR="/var/www/erp-bumdes"',
  'NEW_DIR="/var/www/erp-bumdes.new_$TS"',
  'OLD_DIR="/var/www/erp-bumdes.previous_$TS"',
  'ARCHIVE="/root/erp-bumdes-deploy.tar.gz"',
  'echo "---- PRECHECK VPS ----"',
  'node -v',
  'npm -v',
  'systemctl is-active erp-bumdes || true',
  'echo "---- SIAPKAN FOLDER BARU ----"',
  'rm -rf "$NEW_DIR"',
  'mkdir -p "$NEW_DIR"',
  'tar -xzf "$ARCHIVE" -C "$NEW_DIR"',
  'if [ -f "$APP_DIR/.env.local" ]; then',
  '  cp "$APP_DIR/.env.local" "$NEW_DIR/.env.local"',
  '  chmod 600 "$NEW_DIR/.env.local"',
  'else',
  '  echo "ERROR: .env.local VPS tidak ditemukan di $APP_DIR"',
  '  exit 1',
  'fi',
  'cd "$NEW_DIR"',
  'echo "---- INSTALL DEPENDENCY ----"',
  'npm ci',
  'echo "---- BUILD ----"',
  'npm run build',
  'echo "---- SWITCH RELEASE ----"',
  'systemctl stop erp-bumdes',
  'mv "$APP_DIR" "$OLD_DIR"',
  'mv "$NEW_DIR" "$APP_DIR"',
  'systemctl start erp-bumdes',
  'sleep 5',
  'echo "---- STATUS ----"',
  'systemctl is-active erp-bumdes',
  'curl -I https://inovasigorut.online/login | head -20',
  'echo "---- BACKUP LAMA ----"',
  'echo "$OLD_DIR"',
  'echo "DEPLOY_DONE"'
)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($LocalRemoteScript, (($remoteLines -join "`n") + "`n"), $utf8NoBom)

Write-Host "---- UPLOAD ARCHIVE ----"
scp -i $KeyPath -P $VpsPort $LocalArchive "${VpsUser}@${VpsHost}:$RemoteArchive"
Stop-IfFailed "Gagal upload archive ke VPS."

Write-Host "---- UPLOAD REMOTE DEPLOY SCRIPT ----"
scp -i $KeyPath -P $VpsPort $LocalRemoteScript "${VpsUser}@${VpsHost}:$RemoteDeployScript"
Stop-IfFailed "Gagal upload remote deploy script ke VPS."

Write-Host "---- JALANKAN DEPLOY DI VPS ----"
ssh -i $KeyPath -p $VpsPort "${VpsUser}@${VpsHost}" "chmod 700 $RemoteDeployScript && bash $RemoteDeployScript"
Stop-IfFailed "Deploy VPS gagal."

Write-Host "---- SELESAI ----"