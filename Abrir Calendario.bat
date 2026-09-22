@echo off
setlocal enabledelayedexpansion
title Calendario Digital de Visitas - ABB

:: Garante suporte a caminhos de rede UNC (\\servidor\pasta)
pushd "%~dp0"

:: 1. Inicia o micro-servidor local em segundo plano garantindo porta diferente de 3000
set "PORT_FILE=%TEMP%\calendario_abb_port.txt"
if exist "%PORT_FILE%" del /f /q "%PORT_FILE%"

start /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0server.ps1" -Port 3050

:: 2. Aguarda a confirmação da porta ativa (até 3 segundos)
set "APP_PORT=3050"
for /L %%i in (1,1,15) do (
    if exist "%PORT_FILE%" (
        goto :got_port
    )
    timeout /t 1 /nobreak >nul 2>&1
)

:got_port
if exist "%PORT_FILE%" (
    set /p APP_PORT=<"%PORT_FILE%"
)

:: Trava de segurança: NUNCA abrir na porta 3000
if "!APP_PORT!"=="3000" set "APP_PORT=3050"
if "!APP_PORT!"=="" set "APP_PORT=3050"

:: 3. Define URL da aplicacao na porta confirmada
set "APP_URL=http://localhost:!APP_PORT!"

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
