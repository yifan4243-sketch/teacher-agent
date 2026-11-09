param(
    [ValidatePattern('^[a-z0-9][a-z0-9-]{0,39}$')]
    [string]$ProfileName = 'teacher-pro'
)
$ErrorActionPreference = 'Stop'
$extensionRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$repoRoot = [IO.Path]::GetFullPath((Join-Path $extensionRoot '../..'))
Push-Location $repoRoot
try {
    node (Join-Path $PSScriptRoot 'build_desktop.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Teacher Desktop build failed' }
    $hermesRoot = (& python -c 'from hermes_constants import get_default_hermes_root; print(get_default_hermes_root())') -join "`n"
    if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve Hermes profile root' }
    $profileHome = Join-Path (Join-Path $hermesRoot.Trim() 'profiles') $ProfileName
    if (-not (Test-Path -LiteralPath $profileHome)) {
        python .\hermes profile create $ProfileName --no-alias --description '教师专业工作台，课程、教材、教学成果及学生记录管理'
        if ($LASTEXITCODE -ne 0) { throw 'Teacher profile creation failed' }
    }
    $pluginsRoot = Join-Path $profileHome 'plugins'
    New-Item -ItemType Directory -Path $pluginsRoot -Force | Out-Null
    $pluginPath = Join-Path $pluginsRoot 'teacher-assistant'
    if (Test-Path -LiteralPath $pluginPath) {
        $existing = Get-Item -LiteralPath $pluginPath
        if (-not $existing.Target -or [IO.Path]::GetFullPath([string]$existing.Target) -ne $extensionRoot) {
            throw "The profile already has another teacher-assistant installation at $pluginPath"
        }
    } else {
        New-Item -ItemType Junction -Path $pluginPath -Value $extensionRoot | Out-Null
    }
    python .\hermes --profile $ProfileName plugins enable teacher-assistant
    if ($LASTEXITCODE -ne 0) { throw 'Teacher plugin activation failed' }
    Write-Output "Teacher profile ready at $profileHome"
    Write-Output 'Desktop 首次使用时，在“技能与工具 → 插件”中启用“教师专业工作台”。'
} finally {
    Pop-Location
}
