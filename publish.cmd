@echo off
rem Legacy shortcut: keep compatibility with users of publish.cmd.
call "%~dp0github-bootstrap.cmd" %*
exit /b %errorlevel%
