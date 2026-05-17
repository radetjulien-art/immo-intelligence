@echo off
title ImmoIntel — Demarrage
color 0F
echo.
echo  ==========================================
echo   ImmoIntel  —  Intelligence immobiliere
echo  ==========================================
echo.

:: ── 1. Verifier Python ───────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERREUR] Python introuvable.
    echo  Installe Python 3.11 : https://python.org
    echo.
    pause & exit /b 1
)

:: ── 2. Installer les deps Python seulement si manquantes ─────
uvicorn --version >nul 2>&1
if errorlevel 1 (
    echo  [1/4] Installation des dependances Python (premiere fois)...
    cd /d %~dp0backend
    pip install -r requirements-local.txt -q
    if errorlevel 1 (
        echo  [ERREUR] pip install echoue. Lance manuellement :
        echo    cd backend ^&^& pip install -r requirements-local.txt
        pause & exit /b 1
    )
    echo       OK
) else (
    echo  [1/4] Dependances Python deja installees. OK
)

:: ── 3. Demarrer le backend ────────────────────────────────────
echo  [2/4] Demarrage du backend (FastAPI :8000) ...
start "ImmoIntel - Backend" cmd /k "cd /d %~dp0backend && uvicorn main:app --reload --port 8000"

:: Attendre que le backend reponde (max 30s)
echo  [3/4] En attente que le backend soit pret...
set /a tries=0
:wait_backend
set /a tries+=1
if %tries% gtr 30 (
    echo  [AVERTISSEMENT] Le backend met du temps a demarrer.
    echo  Verifie la fenetre "ImmoIntel - Backend" pour les erreurs.
    goto start_frontend
)
curl -s -o nul -w "%%{http_code}" http://localhost:8000/health 2>nul | findstr "200" >nul
if errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto wait_backend
)
echo       Backend pret !

:: ── 4. Demarrer le frontend ───────────────────────────────────
:start_frontend
echo  [4/4] Demarrage du frontend (Next.js :3000) ...
start "ImmoIntel - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

:: Attendre que le frontend reponde (max 60s)
echo       En attente que le frontend compile...
set /a tries=0
:wait_frontend
set /a tries+=1
if %tries% gtr 60 (
    echo  [AVERTISSEMENT] Le frontend met du temps - ouverture quand meme...
    goto open_browser
)
curl -s -o nul -w "%%{http_code}" http://localhost:3000 2>nul | findstr "200" >nul
if errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto wait_frontend
)

:: ── 5. Ouvrir le navigateur ───────────────────────────────────
:open_browser
echo.
echo  ==========================================
echo   Tout est pret !
echo   Frontend  : http://localhost:3000
echo   Backend   : http://localhost:8000/docs
echo  ==========================================
echo.
start "" http://localhost:3000
echo  Navigateur ouvert. Cette fenetre peut etre fermee.
echo.
timeout /t 3 /nobreak >nul
exit
