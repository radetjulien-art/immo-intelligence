@echo off
title ImmoIntel — Lancement
color 0A
cls

echo.
echo  ==========================================
echo    ImmoIntel — Demarrage en cours...
echo  ==========================================
echo.

set PYTHON_SCRIPTS=C:\Users\julie\AppData\Local\Programs\Python\Python311\Scripts
set BACKEND=C:\Users\julie\Documents\Immo\immo-intelligence\backend
set FRONTEND=C:\Users\julie\Documents\Immo\immo-intelligence\frontend

echo  [1/3] Backend FastAPI...
start "ImmoIntel - Backend" cmd /k "set PATH=%PATH%;%PYTHON_SCRIPTS% && cd /d %BACKEND% && uvicorn main:app --reload --port 8000"

timeout /t 4 /nobreak > nul

echo  [2/3] Worker Celery...
start "ImmoIntel - Worker" cmd /k "set PATH=%PATH%;%PYTHON_SCRIPTS% && cd /d %BACKEND% && celery -A tasks.celery_app worker --loglevel=info --pool=solo"

timeout /t 3 /nobreak > nul

echo  [3/3] Frontend Next.js...
start "ImmoIntel - Frontend" cmd /k "cd /d %FRONTEND% && npm run dev"

echo.
echo  Demarrage en cours, attente 8 secondes...
timeout /t 8 /nobreak > nul

echo  Ouverture du navigateur...
start http://localhost:3000

echo.
echo  ==========================================
echo    ImmoIntel est pret !
echo    Frontend  : http://localhost:3000
echo    API Docs  : http://localhost:8000/docs
echo  ==========================================
echo.
echo  Les 3 services tournent dans leurs fenetres.
echo  Pour tout arreter : fermez les 3 fenetres noires.
echo.
pause
