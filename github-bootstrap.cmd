@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title Target Tab Auto Clicker - First GitHub Setup

rem Change this line to choose your default repository name.
set "REPO_NAME=target-tab-auto-clicker"
if not "%~1"=="" set "REPO_NAME=%~1"
set "ABOUT_DESC=Monitor selected Chrome tabs and automatically click Continue buttons when enabled. Multi-URL lists, per-tab controls, local settings."
set "ABOUT_TOPICS=chrome-extension,manifest-v3,browser-automation,auto-clicker,tab-manager,javascript,github-pages,open-source"

echo.
echo ======================================================
echo   Target Tab Auto Clicker - First GitHub Pages Publish
echo ======================================================
echo.
echo Repo name: !REPO_NAME!
echo.
where git >nul 2>nul || (echo ERROR: Install Git: https://git-scm.com/downloads/win & goto fail)
where gh >nul 2>nul || (echo ERROR: Install GitHub CLI: https://cli.github.com/ & goto fail)
if not exist "manifest.json" (echo ERROR: manifest.json is missing. & goto fail)
if not exist "docs\index.html" (echo ERROR: docs\index.html is missing. & goto fail)
if not exist ".github\workflows\pages.yml" (echo ERROR: Pages workflow is missing. & goto fail)
if not exist "git-safe-sync.cmd" (echo ERROR: git-safe-sync.cmd is missing. & goto fail)

rem Always initialize a LOCAL .git before any git add/commit commands.
rem This prevents an ancestor repo such as C:\Users\USERNAME\.git from being uploaded.
if not exist ".git" (
  echo Initializing an independent Git repository in this project...
  git init -b main || goto fail
)
set "GIT_TOP="
for /f "usebackq delims=" %%G in (`git rev-parse --show-toplevel 2^>nul`) do set "GIT_TOP=%%G"
if not defined GIT_TOP (echo ERROR: Cannot determine this project's Git root. & goto fail)
for %%G in ("!GIT_TOP!") do set "GIT_TOP=%%~fG"
if /i not "!GIT_TOP!"=="%CD%" (
  echo ERROR: Git root is !GIT_TOP!
  echo Expected project root: %CD%
  echo Stopped to avoid publishing files from the wrong directory.
  goto fail
)

rem Keep existing local branches intact; do not forcibly rename another branch.
set "CURRENT_BRANCH="
for /f "usebackq delims=" %%B in (`git branch --show-current 2^>nul`) do set "CURRENT_BRANCH=%%B"
if /i not "!CURRENT_BRANCH!"=="main" (
  echo ERROR: Current local branch is !CURRENT_BRANCH!, expected main.
  echo Switch or rename it manually before uploading.
  goto fail
)

rem GitHub CLI uses browser login. No personal token is put in source files.
gh auth status >nul 2>nul || (
  echo GitHub authentication is required.
  gh auth login --web --git-protocol https || goto fail
)
gh auth setup-git || goto fail
git config user.name >nul 2>nul || (echo ERROR: Set git config --global user.name "Your Name" & goto fail)
git config user.email >nul 2>nul || (echo ERROR: Set git config --global user.email "you@example.com" & goto fail)

set "OWNER="
for /f "usebackq delims=" %%O in (`gh api user --jq .login 2^>nul`) do set "OWNER=%%O"
if not defined OWNER (echo ERROR: Cannot read the GitHub account. & goto fail)
set "FULL_REPO=!OWNER!/!REPO_NAME!"
set "REPO_SHORT=!REPO_NAME!"
echo !REPO_NAME! | findstr /c:"/" >nul
if not errorlevel 1 (
  set "FULL_REPO=!REPO_NAME!"
  for /f "tokens=1,2 delims=/" %%A in ("!FULL_REPO!") do (
    set "OWNER=%%A"
    set "REPO_SHORT=%%B"
  )
)
if not defined REPO_SHORT (echo ERROR: Bad repository name. & goto fail)
if /i "!REPO_SHORT!"=="!OWNER!.github.io" (
  set "PAGE_URL=https://!OWNER!.github.io/"
) else (
  set "PAGE_URL=https://!OWNER!.github.io/!REPO_SHORT!/"
)
echo GitHub repository: https://github.com/!FULL_REPO!
echo Website / About: !PAGE_URL!
echo.

rem Refuse an unrelated existing origin.
set "ORIGIN="
for /f "usebackq delims=" %%R in (`git remote get-url origin 2^>nul`) do set "ORIGIN=%%R"
if defined ORIGIN (
  set "ORIGIN_MATCH="
  for %%U in ("https://github.com/!FULL_REPO!.git" "https://github.com/!FULL_REPO!" "git@github.com:!FULL_REPO!.git" "git@github.com:!FULL_REPO!") do (
    if /i "!ORIGIN!"=="%%~U" set "ORIGIN_MATCH=1"
  )
  if not defined ORIGIN_MATCH (echo ERROR: origin points elsewhere: !ORIGIN! & goto fail)
)

rem Show the exact changed files before committing anything.
echo.
echo Files that will be staged for GitHub:
git status --short --untracked-files=all || goto fail
echo.
choice /c YN /n /m "Publish this project to GitHub? [Y/N] "
if errorlevel 2 goto cancelled

echo Adding project files...
git add -A || goto fail
rem Prevent common secret filenames from being accidentally published.
for /f "usebackq delims=" %%F in (`git diff --cached --name-only`) do (
  echo %%F | findstr /i /r /c:"\.pem$" /c:"\.pfx$" /c:"\.p12$" /c:"\.key$" /c:"^\.env$" /c:"^\.env\." /c:"/\.env$" /c:"/\.env\." /c:"credentials.*\.json$" >nul
  if not errorlevel 1 (
    echo ERROR: Potential secret was staged: %%F
    echo Remove it from the project or add it to .gitignore before retrying.
    goto fail
  )
)
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "chore: publish Target Tab Auto Clicker" || goto fail
) else (
  git rev-parse --verify HEAD >nul 2>nul || (echo ERROR: Nothing to publish; first commit is missing. & goto fail)
  echo No new file changes to commit.
)

gh repo view "!FULL_REPO!" >nul 2>nul
if errorlevel 1 (
  echo Creating public repository !FULL_REPO! ...
  gh repo create "!FULL_REPO!" --public --description "!ABOUT_DESC!" --homepage "!PAGE_URL!" || goto fail
) else (
  echo Remote repository already exists. It will not be recreated.
)
if not defined ORIGIN (git remote add origin "https://github.com/!FULL_REPO!.git" || goto fail)

echo.
echo Safely synchronizing main...
call "%~dp0git-safe-sync.cmd" || (echo ERROR: Safe sync stopped. See README recovery section. & goto fail)

echo Updating GitHub About...
gh repo edit "!FULL_REPO!" --description "!ABOUT_DESC!" --homepage "!PAGE_URL!" --add-topic "!ABOUT_TOPICS!" || echo WARNING: About update failed. Check permissions.

echo Configuring GitHub Pages for Actions...
gh api "repos/!FULL_REPO!/pages" >nul 2>nul
if errorlevel 1 (
  gh api -X POST "repos/!FULL_REPO!/pages" -f build_type=workflow >nul 2>nul || echo WARNING: Set Settings - Pages - Source to GitHub Actions manually.
) else (
  gh api -X PUT "repos/!FULL_REPO!/pages" -f build_type=workflow >nul 2>nul || echo WARNING: Set Settings - Pages - Source to GitHub Actions manually.
)
echo.
echo ------------------------------------------------------
echo GitHub: https://github.com/!FULL_REPO!
echo Pages:  !PAGE_URL!
echo Actions: https://github.com/!FULL_REPO!/actions
echo Pages may take time to deploy. Check Actions first.
echo For later updates, run github-update.cmd.
echo Social Preview: Settings - General - Social preview
echo ------------------------------------------------------
pause
exit /b 0
:cancelled
echo Upload cancelled by user.
pause
exit /b 2
:fail
echo.
echo Setup stopped. No force push was attempted.
echo See README.md for recovery instructions.
pause
exit /b 1
