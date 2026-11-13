@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required to launch the local preview.
  echo You can also open index.html directly, or deploy the folder to GitHub Pages.
  pause
  exit /b 1
)
start "" http://127.0.0.1:38740
node server.js
