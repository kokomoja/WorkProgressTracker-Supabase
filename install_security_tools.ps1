# install_security_tools.ps1
# เทียบเท่า install_security_tools.sh สำหรับ Windows

$ErrorActionPreference = "Stop"

Write-Host "🔧 Installing dev tools (husky, gitleaks)..." -ForegroundColor Cyan
npm install --save-dev husky gitleaks

# เพิ่มสคริปต์ prepare ใน package.json ถ้ายังไม่มี
Write-Host "📝 Ensuring package.json has prepare script..." -ForegroundColor Cyan
$pkg = Get-Content package.json -Raw | ConvertFrom-Json
if (-not $pkg.scripts) { $pkg | Add-Member -MemberType NoteProperty -Name scripts -Value (@{}) }
if (-not $pkg.scripts.prepare) { $pkg.scripts | Add-Member -MemberType NoteProperty -Name prepare -Value "husky" }
($pkg | ConvertTo-Json -Depth 100) | Out-File package.json -Encoding UTF8

Write-Host "🐶 Installing husky hooks..." -ForegroundColor Cyan
npm run prepare | Out-Null
npx husky install
npx husky add .husky/pre-commit "npx gitleaks protect --staged --redact"

# สร้างกติกา gitleaks ถ้าไม่มี
if (!(Test-Path "gitleaks.toml")) {
@'
title = "Repo secret scan rules"
[extend]
useDefault = true
[allowlist]
description = "Allow common false positives"
paths = [ '''^tests?/''', '''^fixtures?/''' ]
'@ | Out-File -Encoding utf8 "gitleaks.toml"
}

Write-Host "✅ Done. Try committing to see Gitleaks in action." -ForegroundColor Green
