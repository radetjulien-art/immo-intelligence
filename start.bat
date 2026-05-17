@echo off
title ImmoIntel — Demarrage
color 0F
echo.
echo  ==========================================
echo   ImmoIntel  -  Intelligence immobiliere
echo  ==========================================
echo.

:: ── 1. Verifier Python ───────────────────────────────────────
echo  [1/4] Verification de Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [ERREUR] Python est introuvable sur ce PC.
    echo  Telecharge et installe Python 3.11 :
    echo  https://www.python.org/downloads/
    echo.
    echo  Appuie sur une touche pour fermer...
    pause >nul
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo        %%v detecte

:: ── 2. Installer les deps Python si besoin ───────────────────
echo  [2/4] Verification des dependances Python...
python -c "import uvicorn" >nul 2>&1
if errorlevel 1 (
    echo        Installation en cours (premiere fois, ~2 min)...
    cd /d "%~dp0backend"
    pip install -r requirements-local.txt
    if errorlevel 1 (
        echo.
        echo  [ERREUR] L'installation des packages Python a echoue.
        echo  Essaie de lancer manuellement dans un terminal :
        echo    cd backend
        echo    pip install -r requirements-local.txt
        echo.
        pause
        exit /b 1
    )
) else (
    echo        Dependances OK
)

:: ── 3. Demarrer le backend ────────────────────────────────────
echo  [3/4] Demarrage du backend...
start "ImmoIntel - Backend (ne pas fermer)" cmd /k "cd /d "%~dp0backend" && echo Backend demarre sur http://localhost:8000 && uvicorn main:app --reload --port 8000"

:: Attendre que le backend soit pret (polling via PowerShell, max 40s)
echo        En attente du backend (max 40s)...
set /a tries=0
:wait_backend
set /a tries+=1
if %tries% gtr 40 (
    echo.
    echo  [AVERTISSEMENT] Le backend ne repond pas apres 40s.
    echo  Verifie la fenetre "ImmoIntel - Backend" pour voir l'erreur.
    echo.
    goto start_frontend
)
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:8000/health' -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto wait_backend
)
echo        Backend pret !

:: ── 4. Demarrer le frontend ───────────────────────────────────
:start_frontend
echo  [4/4] Demarrage du frontend...
start "ImmoIntel - Frontend (ne pas fermer)" cmd /k "cd /d "%~dp0frontend" && echo Frontend demarre sur http://localhost:3000 && npm run dev"

:: Attendre que le frontend soit pret (max 90s - Next.js compile)
echo        En attente du frontend (compilation Next.js, max 90s)...
set /a tries=0
:wait_frontend
set /a tries+=1
if %tries% gtr 90 (
    echo        Timeout - ouverture quand meme...
    goto open_browser
)
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3000' -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto wait_frontend
)

:: ── 5. Ouvrir le navigateur ───────────────────────────────────
:open_browser
echo.
echo  ==========================================
echo   Tout est pret !
echo.
echo   Application : http://localhost:3000
echo   API Swagger  : http://localhost:8000/docs
echo  ==========================================
echo.
echo  Ouverture du navigateur...
start "" "http://localhost:3000"

echo.
echo  Les deux fenetres "Backend" et "Frontend" doivent
echo  rester ouvertes pour que l'application fonctionne.
echo.
echo  Appuie sur une touche pour fermer ce lanceur.
pause >nul
