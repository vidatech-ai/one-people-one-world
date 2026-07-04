@echo off
echo Starting backend...
start "OPOW Backend" cmd /k "cd /d %~dp0\..\backend && pip install flask flask-cors --quiet && python run.py"
timeout /t 3 /nobreak >nul
echo Starting frontend...
start "OPOW Frontend" cmd /k "cd /d %~dp0\..\frontend && npm install --quiet && npm start"
pause