@echo off
cd /d "%~dp0"
if not exist node_modules\vite\bin\vite.js (
  echo Please run npm ci first. See README.md.
  pause
  exit /b 1
)
echo Echo: http://127.0.0.1:4173/
call npm run dev
pause
