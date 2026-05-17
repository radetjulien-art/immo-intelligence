@echo off
setlocal EnableDelayedExpansion

echo.
echo  ==========================================
echo   ImmoIntel  -  Intelligence immobiliere
echo  ==========================================
echo.

:: Definir le dossier racine du projet
set "ROOT=%~dp0"

:: ── 1. Trouver Python ────────────────────────────────────────
echo  [1/4] Verification de Python...

:: Essayer le launcher Windows "py" en premier (plus fiable)
set "PYTHON="
where py >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON=py"
    goto python_ok
)

:: Fallback : verifier si "python" est dans le PATH (sans l'executer)
where python >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON=python"
    goto python_ok
)

:: Ni py ni python trouves
echo.
echo  ERREUR : Python est introuvable.
echo  Installe Python 3.11 depuis : https://www.python.org/downloads/
echo  (Coche bien "Add Python to PATH" pendant l'installation)
echo.
goto fin_erreur

:python_ok
for /f "tokens=*" %%v in ('%PYTHON% --version 2^>^&1') do echo        %%v trouve (commande: %PYTHON%)

:: ── 2. Installer les deps Python si besoin ───────────────────
echo  [2/4] Verification des dependances Python...
%PYTHON% -c "import uvicorn" >nul 2>&1
if %errorlevel% neq 0 (
    echo        Premiere installation - patiente 2-3 minutes...
    %PYTHON% -m pip install -r "%ROOT%backend\requirements-local.txt"
    if %errorlevel% neq 0 (
        echo.
        echo  ERREUR : pip install a echoue.
        echo  Ouvre un terminal et lance :
        echo    cd backend
        echo    pip install -r requirements-local.txt
        echo.
        goto fin_erreur
    )
    echo        Installation terminee.
) else (
    echo        Dependances deja installees.
)

:: ── 3. Demarrer le backend dans une nouvelle fenetre ─────────
echo  [3/4] Demarrage du backend sur :8000 ...
set "CMD_BACKEND=cd /d "%ROOT%backend" && %PYTHON% -m uvicorn main:app --reload --port 8000"
start "ImmoIntel Backend" cmd /k %CMD_BACKEND%

:: Attendre que le backend soit pret
echo        Attente du backend...
set tries=0
:boucle_backend
set /a tries+=1
if %tries% gtr 40 (
    echo        Le backend prend du temps - verifie la fenetre Backend.
    goto lancer_frontend
)
powershell -NoProfile -Command "try{Invoke-WebRequest http://localhost:8000/health -UseBasicParsing -TimeoutSec 1 >$null 2>&1; exit 0}catch{exit 1}" >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 1 /nobreak >nul
    goto boucle_backend
)
echo        Backend pret !

:: ── 4. Demarrer le frontend dans une nouvelle fenetre ────────
:lancer_frontend
echo  [4/4] Demarrage du frontend sur :3000 ...
set "CMD_FRONTEND=cd /d "%ROOT%frontend" && npm run dev"
start "ImmoIntel Frontend" cmd /k %CMD_FRONTEND%

:: Attendre que le frontend soit pret
echo        Attente du frontend (compilation ~30s)...
set tries=0
:boucle_frontend
set /a tries+=1
if %tries% gtr 90 (
    echo        Ouverture du navigateur quand meme...
    goto ouvrir
)
powershell -NoProfile -Command "try{Invoke-WebRequest http://localhost:3000 -UseBasicParsing -TimeoutSec 1 >$null 2>&1; exit 0}catch{exit 1}" >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 1 /nobreak >nul
    goto boucle_frontend
)

:: ── 5. Ouvrir le navigateur ───────────────────────────────────
:ouvrir
echo.
echo  ==========================================
echo   PRET !
echo   http://localhost:3000  (ouvre dans le navigateur)
echo  ==========================================
echo.
start "" "http://localhost:3000"
echo  Garde les fenetres Backend et Frontend ouvertes.
echo.
goto fin_ok

:fin_erreur
echo  Appuie sur une touche pour fermer.
pause >nul
exit /b 1

:fin_ok
echo  Appuie sur une touche pour fermer ce lanceur.
pause >nul
exit /b 0
