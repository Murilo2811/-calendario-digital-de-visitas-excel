@echo off
setlocal
pushd "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $desktop = [System.Environment]::GetFolderPath('Desktop'); $s = $WshShell.CreateShortcut((Join-Path $desktop 'Calendario Digital ABB.lnk')); $s.TargetPath = (Join-Path (Get-Location).Path 'Abrir Calendario.bat'); $s.WorkingDirectory = (Get-Location).Path; $s.IconLocation = (Join-Path (Get-Location).Path 'abb.ico') + ',0'; $s.Description = 'Calendario Digital de Visitas - ABB'; $s.Save();"

echo =======================================================
echo   Atalho criado com sucesso na sua Area de Trabalho!
echo =======================================================
timeout /t 3 >nul
popd
exit
