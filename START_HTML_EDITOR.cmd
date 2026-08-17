@echo off
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 scripts\start_html_editor.py
) else (
  where python >nul 2>nul
  if %errorlevel%==0 (
    python scripts\start_html_editor.py
  ) else (
    echo 找不到 Python。請用 Codex Desktop 開啟此資料夾，並輸入：開啟可儲存的 HTML Demo。
    pause
    exit /b 1
  )
)

if errorlevel 1 pause

