@echo off
REM ASCII only - Korean messages are printed by tools/acerent-to-data.js
REM Source: ..\acerent\src\data\quote-data.json
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js is not installed.
  echo         Install the LTS version from https://nodejs.org and run again.
  echo.
  pause
  exit /b 1
)

node tools\acerent-to-data.js
if errorlevel 1 (
  pause
  exit /b 1
)

pause
