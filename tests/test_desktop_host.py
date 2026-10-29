"""Same-origin hosting and shutdown, independently of the installed desktop renderer."""
from contextlib import contextmanager
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import urllib.error
import urllib.request

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))
from desktop import create_app, start_server


@contextmanager
def web_root():
    base = (Path(__file__).parents[1] / ".test-artifacts").resolve()
    base.mkdir(exist_ok=True)
    with TemporaryDirectory(prefix="desktop-host-", dir=base) as folder:
        root = Path(folder).resolve()
        assert root.is_relative_to(base)
        (root / "index.html").write_text("<title>DongSon desktop</title>", encoding="utf-8")
        yield root


def test_packaged_ui_and_game_api_share_one_origin():
    with web_root() as root, TestClient(create_app(root)) as client:
        assert "DongSon desktop" in client.get("/").text
        assert client.get("/api/ping").json() == {"ok": True}
        start = client.post("/api/new_game").json()
        assert len(start["pieces"]) == 36
        moved = client.post("/api/move", json={
            "from": "a2", "to": "a3", "gameId": start["gameId"], "revision": start["revision"],
        }).json()
        assert moved["turn"] == "son" and moved["movesPlayed"] == 1
        assert client.post("/api/resign").json()["winner"] == "thuy"
        assert client.post("/api/undo").status_code == 409
        assert client.post("/api/new_game").json()["movesPlayed"] == 0
        assert client.post("/api/__test__/position", json={}).status_code == 404
        assert client.get("/missing-asset.png").status_code == 404


def test_closing_the_host_releases_its_port_and_thread():
    with web_root() as root:
        server, thread, sock, url = start_server(root)
        try:
            with urllib.request.urlopen(url + "/api/ping", timeout=3) as response:
                assert response.status == 200
        finally:
            server.should_exit = True
            thread.join(timeout=8)
            sock.close()
        assert not thread.is_alive()
        with pytest.raises(urllib.error.URLError):
            urllib.request.urlopen(url + "/api/ping", timeout=1)
