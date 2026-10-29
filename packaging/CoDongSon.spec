# Build with the dedicated .venv-desktop; no development test packages in the app.
from pathlib import Path
from PyInstaller.utils.hooks import copy_metadata

root = Path(SPECPATH).parent
web = root / ".desktop-build" / "web"
if not (web / "index.html").is_file():
    raise SystemExit("Build the desktop frontend first: npm run build:exe")

a = Analysis(
    [str(root / "src" / "desktop.py")],
    pathex=[str(root / "src")],
    binaries=[],
    datas=[(str(web), "web")] + copy_metadata("pywebview") + copy_metadata("pyinstaller"),
    hiddenimports=[
        "uvicorn.logging", "uvicorn.loops.asyncio",
        "uvicorn.protocols.http.h11_impl", "uvicorn.lifespan.on",
        "webview.platforms.edgechromium", "webview.platforms.winforms",
    ],
    hookspath=[], hooksconfig={}, runtime_hooks=[],
    excludes=["pytest", "httpx", "IPython", "PyQt5", "PyQt6", "PySide2", "PySide6", "webview.platforms.cef"],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz, a.scripts, a.binaries, a.datas, [],
    name="CoDongSon", debug=False, bootloader_ignore_signals=False,
    strip=False, upx=False, console=False, disable_windowed_traceback=False,
    icon="NONE",
)
