@echo off
title QWARDDLE LAN
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  py lan_server.py
  goto :end
)

where python >nul 2>nul
if %errorlevel%==0 (
  python lan_server.py
  goto :end
)

echo.
echo Python was not found.
echo Install Python or run lan_server.py with your Python installation.
echo.
pause

:end
