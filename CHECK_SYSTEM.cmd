@echo off
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 scripts\release_doctor.py --report workspace\system-check.json
) else (
  where python >nul 2>nul
  if %errorlevel%==0 (
    python scripts\release_doctor.py --report workspace\system-check.json
  ) else (
    echo 找不到 Python。請用 Codex Desktop 開啟此資料夾後輸入：幫我檢查 NESA Slide 系統。
    pause
    exit /b 1
  )
)

echo.
if errorlevel 1 (
  echo 系統檢查未通過，請查看上方 FAIL 項目。
) else (
  echo 系統檢查完成，報告已寫入 workspace\system-check.json。
)
pause

