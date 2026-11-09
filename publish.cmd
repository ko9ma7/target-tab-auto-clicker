@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ================================================
echo   Target Tab Auto Clicker - GitHub Publisher
echo ================================================
echo.
where powershell.exe >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Windows PowerShell is required.
  set "RESULT=1"
  goto finish
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publish.ps1" %*
set "RESULT=%ERRORLEVEL%"
:finish
echo.
if "%RESULT%"=="0" (
  echo [OK] Command finished.
) else (
  echo [ERROR] Command failed. Review the message above.
)
echo.
pause
exit /b %RESULT%
