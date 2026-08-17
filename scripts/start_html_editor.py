#!/usr/bin/env python3
"""Open the packaged HTML demo through the writable local server."""

from __future__ import annotations

import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "artifacts" / "html-test" / "dev_server.py"
DEMO = ROOT / "demos" / "html" / "street-revival" / "street-revival.html"


def choose_port(preferred: int = 7394) -> int:
    for port in range(preferred, preferred + 30):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            try:
                probe.bind(("127.0.0.1", port))
            except OSError:
                continue
            return port
    raise SystemExit("找不到可用的 localhost port，請關閉其他本機伺服器後再試。")


def wait_ready(port: int, process: subprocess.Popen[bytes]) -> None:
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise SystemExit("HTML 本機伺服器啟動失敗。")
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.settimeout(0.2)
            if probe.connect_ex(("127.0.0.1", port)) == 0:
                return
        time.sleep(0.1)
    process.terminate()
    raise SystemExit("HTML 本機伺服器啟動逾時。")


def main() -> int:
    if not SERVER.is_file() or not DEMO.is_file():
        raise SystemExit("找不到 HTML Demo 或本機伺服器。請先執行 CHECK_SYSTEM.cmd。")
    port = choose_port()
    process = subprocess.Popen([sys.executable, str(SERVER), str(port), "--directory", str(ROOT)], cwd=ROOT)
    try:
        wait_ready(port, process)
        url = f"http://127.0.0.1:{port}/demos/html/street-revival/street-revival.html"
        print(f"可儲存的 HTML Demo：{url}")
        print("請保持此視窗開啟；完成後按 Ctrl+C 停止。")
        webbrowser.open(url)
        process.wait()
    except KeyboardInterrupt:
        print("\n正在停止 NESA Slide HTML 編輯環境……")
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

