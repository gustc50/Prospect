@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo   Prospect - Sistema de Prospeccao com IA
echo ============================================
echo.

REM Verifica se o Node.js esta instalado
where node >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Node.js nao foi encontrado neste computador.
    echo Baixe e instale em https://nodejs.org/ e execute este arquivo novamente.
    echo.
    pause
    exit /b 1
)

REM Cria o arquivo de configuracao do servidor caso ainda nao exista
if not exist "server\.env" (
    copy "server\.env.example" "server\.env" >nul
    echo [INFO] Arquivo server\.env criado a partir do exemplo.
    echo [INFO] Para as respostas automaticas funcionarem, abra server\.env
    echo        e preencha o campo ANTHROPIC_API_KEY com sua chave da Anthropic.
    echo.
)

REM Instala as dependencias do servidor, se necessario
if not exist "server\node_modules" (
    echo [INFO] Instalando dependencias do servidor pela primeira vez...
    pushd server
    call npm install
    popd
    echo.
)

REM Instala as dependencias do painel, se necessario
if not exist "client\node_modules" (
    echo [INFO] Instalando dependencias do painel pela primeira vez...
    pushd client
    call npm install
    popd
    echo.
)

echo [INFO] Iniciando o servidor (API)...
start "Prospect - API" cmd /k "cd /d "%~dp0server" && npm run dev"

timeout /t 4 /nobreak >nul

echo [INFO] Iniciando o painel (interface)...
start "Prospect - Painel" cmd /k "cd /d "%~dp0client" && npm run dev"

timeout /t 5 /nobreak >nul

echo [INFO] Abrindo o navegador...
start "" http://localhost:5173

echo.
echo ============================================
echo  Sistema iniciado com sucesso!
echo  Duas janelas foram abertas: API e Painel.
echo  NAO feche essas janelas enquanto estiver usando o sistema.
echo  Para encerrar, basta fechar as duas janelas.
echo ============================================
echo.
pause
