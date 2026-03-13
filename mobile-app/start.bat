@echo off
echo ============================================
echo   LogAI Mobile App - Quick Start
echo ============================================
echo.
echo IMPORTANT: Before running on a real device,
echo update the API_BASE URL in src\services\api.ts
echo with your computer's local IP address.
echo Run 'ipconfig' to find it.
echo.

cd /d "%~dp0"

IF NOT EXIST "node_modules" (
    echo Installing dependencies...
    npm install
)

echo.
echo Starting Expo dev server...
echo Scan the QR code with Expo Go on your phone.
echo Press Ctrl+C to stop.
echo.

npx expo start