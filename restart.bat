@echo off
echo.
echo ========================================
echo   Restarting HireFlow Backend
echo ========================================
echo.

REM Kill any existing Node processes on port 3001
echo Checking for existing processes on port 3001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do (
    echo Killing process %%a
    taskkill /F /PID %%a 2>nul
)

echo.
echo Starting backend server...
echo.

npm start
