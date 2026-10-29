"""One-click Windows host: bundled board + API, with no console or external Python."""
from __future__ import annotations

import ctypes
import json
import logging
import os
from pathlib import Path
import socket
import sys
import threading
import time
import webbrowser

TITLE = "Cờ Đông Sơn"


def user_data_dir() -> Path:
    override = os.environ.get("DONGSON_DATA_DIR")
    if override:
        return Path(override).resolve()
    return Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "DongSon"


def web_directory() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS) / "web"
    return Path(__file__).resolve().parents[1] / ".desktop-build" / "web"


def create_app(web_root: Path):
    from fastapi import FastAPI
    from fastapi.staticfiles import StaticFiles
    from server import app as game_api

    if not (web_root / "index.html").is_file():
        raise FileNotFoundError("Chưa có giao diện đóng gói.")
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    app.mount("/api", game_api)
    app.mount("/", StaticFiles(directory=str(web_root), html=True))
    return app


def single_instance():
    """Keep the mutex handle alive; a second double-click focuses the current game."""
    if os.name != "nt":
        return None, True
    from ctypes import wintypes
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.CreateMutexW.argtypes = [ctypes.c_void_p, wintypes.BOOL, wintypes.LPCWSTR]
    kernel.CreateMutexW.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    ctypes.set_last_error(0)
    handle = kernel.CreateMutexW(None, False, "Local\\DongSonDesktop-v1")
    if not handle:
        raise ctypes.WinError(ctypes.get_last_error())
    if ctypes.get_last_error() == 183:
        user = ctypes.WinDLL("user32", use_last_error=True)
        user.FindWindowW.argtypes = [wintypes.LPCWSTR, wintypes.LPCWSTR]
        user.FindWindowW.restype = wintypes.HWND
        user.ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]
        user.SetForegroundWindow.argtypes = [wintypes.HWND]
        window = user.FindWindowW(None, TITLE)
        if window:
            user.ShowWindow(window, 9)
            user.SetForegroundWindow(window)
        kernel.CloseHandle(handle)
        return None, False
    return handle, True


def release_instance(handle):
    if handle:
        from ctypes import wintypes
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        kernel.CloseHandle(handle)


def start_server(web_root: Path):
    import uvicorn
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    config = uvicorn.Config(
        create_app(web_root), host="127.0.0.1", port=port, workers=1,
        loop="asyncio", http="h11", ws="none", log_config=None,
        access_log=False, use_colors=False,
    )
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
    thread.start()
    deadline = time.monotonic() + 25
    while not server.started:
        if not thread.is_alive() or time.monotonic() >= deadline:
            server.should_exit = True
            sock.close()
            raise RuntimeError("Không khởi động được máy chủ luật.")
        time.sleep(0.05)
    return server, thread, sock, f"http://127.0.0.1:{port}"


def browser_fallback(url: str):
    """A machine without WebView2 can still play using its default browser."""
    import tkinter as tk
    from tkinter import ttk
    root = tk.Tk()
    root.title(TITLE)
    root.geometry("470x190")
    root.resizable(False, False)
    ttk.Label(root, text="Cờ Đông Sơn đã mở trong trình duyệt.", font=("Segoe UI", 13)).pack(pady=(24, 12))
    ttk.Label(root, text="Giữ cửa sổ này trong lúc chơi. Đóng cửa sổ để thoát trò chơi.").pack(pady=6)
    buttons = ttk.Frame(root)
    buttons.pack(pady=16)
    ttk.Button(buttons, text="Mở lại bàn cờ", command=lambda: webbrowser.open(url)).pack(side="left", padx=8)
    ttk.Button(buttons, text="Thoát trò chơi", command=root.destroy).pack(side="left", padx=8)
    webbrowser.open(url)
    root.mainloop()


def open_window(url: str, data: Path):
    try:
        import webview
        screen_w = ctypes.windll.user32.GetSystemMetrics(0)
        screen_h = ctypes.windll.user32.GetSystemMetrics(1)
        webview.create_window(
            TITLE, url, width=max(400, min(1100, screen_w - 100)),
            height=max(600, min(850, screen_h - 100)), min_size=(400, 600),
            background_color="#10160f",
        )
        webview.start(gui="edgechromium", debug=False, private_mode=False,
                      storage_path=str(data / "webview"))
    except (Exception, SystemExit):
        logging.exception("Embedded window unavailable; opening the browser instead")
        browser_fallback(url)


def main() -> int:
    handle = None
    running = None
    data = None
    try:
        handle, first = single_instance()
        if not first:
            return 0
        data = user_data_dir()
        data.mkdir(parents=True, exist_ok=True)
        os.environ["DONGSON_SAVE_DIR"] = str(data / "saves")
        logging.basicConfig(filename=data / "desktop.log", encoding="utf-8", level=logging.INFO,
                            format="%(asctime)s %(levelname)s %(message)s")
        running = start_server(web_directory())
        url = running[3]
        (data / "instance.json").write_text(json.dumps({
            "pid": os.getpid(), "url": url, "title": TITLE,
        }, ensure_ascii=False), encoding="utf-8")
        logging.info("Game ready at %s; bundle=%s", url, getattr(sys, "frozen", False))
        open_window(url, data)
        return 0
    except Exception:
        logging.exception("Could not launch game")
        message = "Không mở được Cờ Đông Sơn. Hãy đóng trò chơi rồi mở lại."
        if data:
            message += f"\nChi tiết được lưu tại: {data / 'desktop.log'}"
        if os.name == "nt":
            ctypes.windll.user32.MessageBoxW(None, message, TITLE, 0x10)
        return 1
    finally:
        if running:
            server, thread, sock, _ = running
            server.should_exit = True
            thread.join(timeout=8)
            sock.close()
        if data:
            (data / "instance.json").unlink(missing_ok=True)
        release_instance(handle)


if __name__ == "__main__":
    raise SystemExit(main())
