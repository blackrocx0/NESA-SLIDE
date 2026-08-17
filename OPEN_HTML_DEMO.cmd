@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "demos\html\street-revival\street-revival.html" (
  echo 找不到 HTML Demo。請先執行 CHECK_SYSTEM.cmd。
  pause
  exit /b 1
)
start "" "%~dp0demos\html\street-revival\street-revival.html"

