# 发布.ps1 — 一键发布：把本地内容推送到 GitHub（由 发布.cmd 调用，也可以直接运行）
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "[X] 本机还没有安装 Git。" -ForegroundColor Red
    Write-Host "    请先安装 Git for Windows：https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host "    安装时一路点 Next 即可，装完再重新双击「发布.cmd」。"
    Read-Host "`n按回车退出"
    exit 1
}

$configFile = Join-Path $PSScriptRoot ".deploy-config"

# 首次运行：初始化仓库
if (-not (Test-Path (Join-Path $PSScriptRoot ".git"))) {
    git init *> $null
    git branch -M main
    Write-Host "[OK] 仓库初始化完成" -ForegroundColor Green
}

# 读取 / 询问仓库名
if (Test-Path $configFile) {
    $repo = (Get-Content -LiteralPath $configFile -Raw).Trim()
    Write-Host "目标仓库：ADRIAN-sheng/$repo"
} else {
    Write-Host ""
    Write-Host "（如果还没建仓库，先打开 https://github.com/new 建一个 Public 仓库）"
    $repo = (Read-Host "请输入 GitHub 仓库名（例如 homepage）").Trim()
    if (-not $repo) { Write-Host "[X] 仓库名不能为空" -ForegroundColor Red; Read-Host "按回车退出"; exit 1 }
    Set-Content -LiteralPath $configFile -Value $repo -Encoding UTF8
}

git remote remove origin *> $null
git remote add origin "https://github.com/ADRIAN-sheng/$repo.git"

git add -A
$null = git commit -m "更新内容"

git push -u origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[OK] 发布完成！" -ForegroundColor Green
    Write-Host "页面地址：https://adrian-sheng.github.io/$repo/（首次部署等 1-2 分钟生效）" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[X] 推送失败。" -ForegroundColor Yellow
    Write-Host "    首次推送需要登录：用户名填 ADRIAN-sheng，密码填 Personal Access Token（ghp_ 开头，不是账号密码）。" -ForegroundColor Yellow
    Write-Host "    如果已登录过仍失败，检查网络或重新生成一个 Token（见 README 第五节）。"
}
Read-Host "`n按回车关闭"
