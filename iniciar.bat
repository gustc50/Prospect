@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set PORT=3001
set URL=http://localhost:%PORT%

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

REM Compila o painel para que o servidor sirva tudo em um unico endereco
echo [INFO] Preparando o painel...
pushd client
call npm run build
popd
echo.

REM Verifica se a porta ja esta em uso por outro processo antes de iniciar
for /f "tokens=5" %%P in ('netstat -aon ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    echo [ERRO] A porta %PORT% ja esta em uso por outro programa ^(PID %%P^).
    echo Fecha o programa que estiver usando essa porta, ou edite server\.env
    echo e mude o valor de PORT para outra porta livre, e execute novamente.
    echo.
    pause
    exit /b 1
)

echo [INFO] Iniciando o sistema...
start "Prospect" cmd /k "cd /d "%~dp0server" && npm run dev"

echo [INFO] Aguardando o sistema ficar pronto...
set /a tries=0

:waitloop
set /a tries+=1
set STATUS=
for /f "delims=" %%S in ('curl -s -o nul -w "%%{http_code}" %URL%/api/health 2^>nul') do set STATUS=%%S

if "!STATUS!"=="200" goto ready
if !tries! GEQ 40 goto slow

timeout /t 1 /nobreak >nul
goto waitloop

:ready
echo [INFO] Sistema pronto! Abrindo o navegador...
start "" "%URL%"
goto fim

:slow
echo [AVISO] O sistema esta demorando mais que o normal para iniciar.
echo Abrindo o navegador mesmo assim - se a pagina nao carregar, aguarde
echo alguns segundos e atualize ^(F5^).
start "" "%URL%"

:fim
echo.
echo ============================================
echo  O sistema esta rodando em %URL%
echo  Uma janela chamada "Prospect" foi aberta com o servidor.
echo  NAO feche essa janela enquanto estiver usando o sistema.
echo  Para encerrar, basta fechar essa janela.
echo ============================================
echo.
pause
