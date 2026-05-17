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

set "PYTHON="
where py >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON=py"
    goto python_ok
)
where python >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON=python"
    goto python_ok
)

echo.
echo  ERREUR : Python est introuvable.
echo  Installe Python 3.11 depuis : https://www.python.org/downloads/
echo  (Coche bien "Add Python to PATH" pendant l'installation)
echo.
goto fin_erreur

:python_ok
for /f "tokens=*" %%v in ('%PYTHON% --version 2^>^&1') do echo        %%v trouve

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
        echo    cd "%ROOT%backend"
        echo    pip install -r requirements-local.txt
        echo.
        goto fin_erreur
    )
    echo        Installation terminee.
) else (
    echo        Dependances deja installees.
)

:: ── 3. Demarrer le backend ────────────────────────────────────
:: /d fixe le repertoire de travail — pas besoin de cd
echo  [3/4] Demarrage du backend sur :8000 ...
start "ImmoIntel Backend" /d "%ROOT%backend" cmd /k "%PYTHON% -m uvicorn main:app --reload --port 8000"

:: Attendre que le backend soit pret (max 40s)
echo        Attente du backend...
set tries=0
:boucle_backend
set /a tries+=1
if %tries% gtr 40 (
    echo        Le backend prend du temps - verifie la fenetre Backend.
    goto lancer_frontend
)
powershell -NoProfile -Command "$r=$null;try{$r=Invoke-WebRequest -Uri 'http://localhost:8000/health' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop}catch{};if($r -and $r.StatusCode -eq 200){exit 0}else{exit 1}" >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 1 /nobreak >nul
    goto boucle_backend
)
echo        Backend pret !

:: ── 4. Demarrer le frontend ───────────────────────────────────
:lancer_frontend
echo  [4/4] Demarrage du frontend sur :3000 ...
start "ImmoIntel Frontend" /d "%ROOT%frontend" cmd /k "npm run dev"

:: Attendre que le frontend soit pret (max 120s - compilation Next.js)
echo        Attente du frontend (compilation ~30s)...
set tries=0
:boucle_frontend
set /a tries+=1
if %tries% gtr 120 (
    echo        Ouverture du navigateur quand meme...
    goto ouvrir
)
powershell -NoProfile -Command "$r=$null;try{$r=Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop}catch{};if($r -and $r.StatusCode -lt 500){exit 0}else{exit 1}" >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 1 /nobreak >nul
    goto boucle_frontend
)

:: ── 5. Ouvrir le navigateur ───────────────────────────────────
:ouvrir
echo.
echo  ==========================================
echo   PRET !
echo   http://localhost:3000
echo  ==========================================
echo.
powershell -NoProfile -Command "Start-Process 'http://localhost:3000'"
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
