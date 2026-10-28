@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title Target Tab Auto Clicker - GitHub Update

echo.
echo ================================================
echo   Target Tab Auto Clicker - GitHub Update
echo ================================================
if not exist ".git" (
  echo ERROR: No local .git found. First run github-bootstrap.cmd.
  pause
  exit /b 1
)
git remote get-url origin >nul 2>nul
if errorlevel 1 (
  echo ERROR: No origin remote. First run github-bootstrap.cmd.
  pause
  exit /b 1
)
rem Reuse the same safety, About, and Pages configuration as first publish.
call "%~dp0github-bootstrap.cmd" %*
exit /b %errorlevel%
