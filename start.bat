@echo off
echo.
echo  ImmoIntel - Demarrage local
echo  ============================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERREUR] Python non trouve. Installe Python 3.11 : https://python.org
    pause & exit /b 1
)

echo  [1/3] Installation des dependances Python...
cd /d %~dp0backend
pip install -r requirements-local.txt -q
if errorlevel 1 ( echo  [ERREUR] pip install echoue & pause & exit /b 1 )
echo       OK

echo  [2/3] Demarrage du backend sur http://localhost:8000 ...
start "ImmoIntel - Backend" cmd /k "cd /d %~dp0backend && uvicorn main:app --reload --port 8000"

timeout /t 3 /nobreak >nul

echo  [3/3] Demarrage du frontend sur http://localhost:3000 ...
start "ImmoIntel - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo  ============================================
echo   Frontend  : http://localhost:3000
echo   Backend   : http://localhost:8000
echo   Swagger   : http://localhost:8000/docs
echo  ============================================
echo.
echo  Syncs automatiques (optionnel - 3e terminal) :
echo    cd backend
echo    celery -A tasks.celery_app worker --loglevel=info
echo.
pause
