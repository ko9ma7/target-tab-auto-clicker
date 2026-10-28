@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
rem Push only local main with fast-forward semantics; never use --force.
set "GIT_TOP="
for /f "usebackq delims=" %%G in (`git rev-parse --show-toplevel 2^>nul`) do set "GIT_TOP=%%G"
if not defined GIT_TOP (echo ERROR: Cannot identify Git root. & exit /b 1)
for %%G in ("!GIT_TOP!") do set "GIT_TOP=%%~fG"
if /i not "!GIT_TOP!"=="%CD%" (echo ERROR: Git root is not this project. & exit /b 1)
git remote get-url origin >nul 2>nul || (echo ERROR: No origin remote. & exit /b 1)
git rev-parse --verify HEAD >nul 2>nul || (echo ERROR: No local commit. & exit /b 1)

rem Exit status 2 means the remote main branch does not exist yet.
git ls-remote --exit-code --heads origin main >nul
set "REMOTE_CODE=!errorlevel!"
if "!REMOTE_CODE!"=="2" goto push
if not "!REMOTE_CODE!"=="0" (echo ERROR: Failed to read remote. Check network or gh auth status. & exit /b 1)

git fetch --no-tags origin main || exit /b 1
git merge-base HEAD origin/main >nul 2>nul
if errorlevel 1 (
  echo ERROR: Local and GitHub main have unrelated histories.
  echo This script will not overwrite GitHub's existing commits.
  echo Use a fresh empty repository, or reconcile the histories manually.
  exit /b 1
)
git merge-base --is-ancestor origin/main HEAD >nul 2>nul
if not errorlevel 1 goto push
rem If the server only advanced, fast-forward; if histories diverged, stop.
git merge-base --is-ancestor HEAD origin/main >nul 2>nul
if not errorlevel 1 (
  git merge --ff-only origin/main || exit /b 1
  goto push
)
echo ERROR: GitHub and local main both have new commits.
echo No force push or automatic rebase was attempted.
echo Review the history and merge or rebase manually before retrying.
exit /b 1
:push
git push -u origin main
exit /b %errorlevel%
