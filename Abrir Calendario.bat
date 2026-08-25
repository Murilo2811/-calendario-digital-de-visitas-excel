@echo off
setlocal enabledelayedexpansion
title Calendario Digital de Visitas - ABB

:: Garante suporte a caminhos de rede UNC (\\servidor\pasta)
pushd "%~dp0"

:: 1. Inicia o micro-servidor local em segundo plano
start /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0server.ps1" -Port 3000

:: 2. Pequeno delay para o listener iniciar
timeout /t 1 /nobreak >nul

:: 3. Tenta abrir no Microsoft Edge em modo Janela de Aplicativo (sem barra de URL)
set "APP_URL=http://localhost:3000"

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=%APP_URL% --window-size=1440,900
    goto :done
)

if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app=%APP_URL% --window-size=1440,900
    goto :done
)

:: 4. Fallback para Google Chrome
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=%APP_URL% --window-size=1440,900
    goto :done
)

if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app=%APP_URL% --window-size=1440,900
    goto :done
)

:: 5. Fallback para Navegador Padrao do Sistema
start %APP_URL%

:done
popd
exit
