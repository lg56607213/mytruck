@echo off
REM ASCII only. Builds the "deploy" folder that gets dragged into Netlify.
cd /d "%~dp0"

if not exist "site\index.html" (
  echo [ERROR] site\index.html not found.
  pause
  exit /b 1
)
if not exist "site\truck-data.js" (
  echo [ERROR] site\truck-data.js not found. Run the data-update bat first.
  pause
  exit /b 1
)

if exist "deploy" rmdir /s /q "deploy"
mkdir "deploy"
xcopy "site" "deploy" /E /I /Y /Q >nul
if errorlevel 1 (
  echo [ERROR] copy failed.
  pause
  exit /b 1
)

REM also build deploy.zip (fallback when folder drag-and-drop fails)
where node >nul 2>&1
if not errorlevel 1 node tools\make-zip.js >nul 2>&1

echo.
echo ================================================
echo  deploy folder is ready.
echo ================================================
dir /b /s "deploy" | find /c /v ""  > "%TEMP%\_mt_cnt.txt"
set /p FILECOUNT=<"%TEMP%\_mt_cnt.txt"
del "%TEMP%\_mt_cnt.txt" >nul 2>&1
echo   %FILECOUNT% files copied from "site"
echo.
echo  Drag the "deploy" FOLDER into Netlify.
echo  If that fails, drag "deploy.zip" instead.
echo  (Do NOT drag this whole folder - the xlsx would go public.)
echo.
start "" "%~dp0deploy"
pause
