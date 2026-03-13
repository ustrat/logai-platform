@echo off
echo ============================================
echo   LogAI Web App - Quick Start
echo ============================================
echo.

cd /d "%~dp0"

IF NOT EXIST "node_modules" (
    echo Installing dependencies...
    npm install
)

echo.
echo Starting web app on http://localhost:3000
echo Press Ctrl+C to stop.
echo.

npm run dev