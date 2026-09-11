$desktop = [System.Environment]::GetFolderPath('Desktop')
$targetDir = Join-Path $desktop 'Calendario Digital ABB - Rede'
$sourceDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host "Criando pasta de producao em: $targetDir" -ForegroundColor Cyan

# Cria ou limpa pasta de destino
if (Test-Path $targetDir) {
    Remove-Item -Path $targetDir -Recurse -Force
}
New-Item -Path $targetDir -ItemType Directory -Force | Out-Null

# 1. Copia pasta dist/
$distSource = Join-Path $sourceDir "dist"
$distTarget = Join-Path $targetDir "dist"
if (Test-Path $distTarget) {
    Get-ChildItem -Path $distTarget -Recurse | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
}
Copy-Item -Path $distSource -Destination $targetDir -Recurse -Force

# 2. Copia arquivos essenciais
$filesToCopy = @(
    "Abrir Calendario.bat",
    "Criar Atalho na Area de Trabalho.bat",
    "server.ps1",
    "abb.ico",
    "abb_logo.png",
    "Calendario_Digital_Base.xlsx",
    "COMO_USAR_NA_REDE.md"
)

foreach ($item in $filesToCopy) {
    $src = Join-Path $sourceDir $item
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination (Join-Path $targetDir $item) -Force
        Write-Host "Copiado: $item" -ForegroundColor Gray
    }
}

# 3. Cria o atalho com o ícone da ABB apontando para o Abrir Calendario.bat
$WshShell = New-Object -ComObject WScript.Shell
$shortcutPath = Join-Path $targetDir "Calendario Digital ABB.lnk"
$shortcut = $WshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $targetDir "Abrir Calendario.bat"
$shortcut.WorkingDirectory = $targetDir
$shortcut.IconLocation = "$(Join-Path $targetDir 'abb.ico'),0"
$shortcut.Description = "Calendario Digital de Visitas e Calibracao - ABB"
$shortcut.Save()

# 4. Cria arquivo ZIP para facilidade de envio/cópia
$zipPath = Join-Path $desktop "Calendario_Digital_ABB_Rede.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}
try {
    Write-Host "Compactando em arquivo ZIP..." -ForegroundColor Cyan
    Compress-Archive -Path "$targetDir\*" -DestinationPath $zipPath -Force
    Write-Host "Arquivo ZIP gerado em: $zipPath" -ForegroundColor Green
} catch {
    Write-Host "Aviso: Nao foi possivel gerar o ZIP: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "=========================================================" -ForegroundColor Green
Write-Host " Pacote de producao criado com sucesso na Area de Trabalho!" -ForegroundColor Green
Write-Host " Pasta: $targetDir" -ForegroundColor Green
Write-Host " ZIP:   $zipPath" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green
