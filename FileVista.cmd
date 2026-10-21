@echo off
rem Folio launcher - runs the built app without a console window staying open
cd /d "%~dp0"
if not exist "%~dp0dist\index.html" (
  echo FileVista has not been built yet. Run: npm install ^&^& npm run build
  pause
  exit /b 1
)
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0." %*
