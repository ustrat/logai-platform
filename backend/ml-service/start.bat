@echo off
echo ============================================
echo   LogAI ML Service - Quick Start
echo ============================================
echo.

cd /d "%~dp0"

IF NOT EXIST ".venv" (
    echo Creating virtual environment...
    python -m venv .venv
)

echo Activating virtual environment...
call .venv\Scripts\activate.bat

echo Installing dependencies...
pip install -r requirements.txt --quiet

echo.
echo Starting ML service on http://localhost:8000
echo API docs at http://localhost:8000/docs
echo Press Ctrl+C to stop.
echo.

uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
