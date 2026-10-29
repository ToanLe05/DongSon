"""Production web hosting: per-browser isolation and authoritative game lifecycle."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))
import server
from web import create_app, COOKIE


def body(state, **extra):
    return {"gameId": state["gameId"], "revision": state["revision"], **extra}


def start(client):
    state = client.get("/api/state").json()
    response = client.post("/api/new_game", json=body(state))
    assert response.status_code == 200
    return response.json()


def move(client, state, source="a2", target="a3"):
    return client.post("/api/move", json=body(state, **{"from": source, "to": target}))


def test_dist_assets_api_and_browser_isolation():
    app = create_app()
    with TestClient(app) as first, TestClient(app) as second:
        assert first.get("/").status_code == 200
        assert first.get("/health").json() == {"ok": True, "frontend": True}
        assert first.get("/api/ping").json() == {"ok": True}
        before = first.get("/api/state").json()
        assert before["started"] is False
        cookie = first.cookies.get(COOKIE)
        assert len(cookie) >= 40
        a, b = start(first), start(second)
        assert a["gameId"] != b["gameId"]
        changed = move(first, a).json()
        assert changed["movesPlayed"] == 1
        assert second.get("/api/state").json() == b
        assert first.get("/api/state").json() == changed
        # A forged/unknown cookie creates a new session, never joins another game.
        with TestClient(app) as unknown:
            unknown.cookies.set(COOKIE, "forged")
            state = unknown.get("/api/state").json()
            assert state["gameId"] not in {a["gameId"], b["gameId"]}
            assert state["started"] is False


def test_reload_before_first_move_and_versioned_rematch():
    with TestClient(create_app()) as client:
        state = start(client)
        assert client.get("/api/state").json()["started"] is True
        assert client.post("/api/new_game", json=body(state)).status_code == 409
        end = client.post("/api/resign", json=body(state)).json()
        assert end["gameOver"] and end["winner"] == "son"
        for path, extra in [("move", {"from": "a2", "to": "a3"}), ("resign", {}),
                            ("draw", {"action": "offer"})]:
            assert client.post("/api/" + path, json=body(end, **extra)).status_code == 409
        rematch = client.post("/api/new_game", json=body(end)).json()
        assert rematch["gameId"] != state["gameId"] and rematch["movesPlayed"] == 0
        assert move(client, state).status_code == 409
        assert client.post("/api/new_game", json=body(end)).status_code == 409
        assert client.get("/api/state").json() == rematch
        assert move(client, rematch).status_code == 200


def test_concurrent_duplicate_moves_commit_once_and_other_sessions_continue():
    app = create_app()
    with TestClient(app) as client, TestClient(app) as other:
        state, other_state = start(client), start(other)
        with ThreadPoolExecutor(max_workers=3) as pool:
            responses = list(pool.map(lambda _: move(client, state), range(3)))
        assert sorted(r.status_code for r in responses) == [200, 409, 409]
        assert client.get("/api/state").json()["movesPlayed"] == 1
        assert move(other, other_state).status_code == 200


def test_web_rejects_missing_versions_and_unstarted_moves():
    with TestClient(create_app()) as client:
        state = client.get("/api/state").json()
        assert move(client, state).json()["detail"]["code"] == "not_started"
        assert client.post("/api/new_game", json={}).status_code == 409
        state = start(client)
        response = client.post("/api/move", json={"from": "a2", "to": "a3"})
        assert response.status_code == 409
        assert response.json()["detail"]["state"] == state


def test_sessions_expire_without_applying_old_moves():
    app = create_app(ttl=100)
    with TestClient(app) as client:
        state = start(client)
        old_entry = next(iter(app.state.sessions.entries.values()))
        old_entry.touched -= 101
        response = move(client, state)
        assert response.status_code == 409
        new_state = response.json()["detail"]["state"]
        assert new_state["gameId"] != state["gameId"] and not new_state["started"]
        assert len(app.state.sessions.entries) == 1


def test_capacity_preserves_active_matches_and_health_stays_available():
    app = create_app(capacity=1)
    with TestClient(app) as first, TestClient(app) as second:
        state = start(first)
        assert second.get("/api/state").status_code == 503
        assert second.get("/health").status_code == 200
        assert second.get("/api/ping").status_code == 200
        assert move(first, state).status_code == 200


def test_public_routes_origin_and_cookie_security():
    app = create_app()
    with TestClient(app, base_url="https://chess.example") as client:
        response = client.get("/api/state")
        assert "HttpOnly" in response.headers["set-cookie"]
        assert "Secure" in response.headers["set-cookie"]
        assert "SameSite=strict" in response.headers["set-cookie"]
        assert response.headers["cache-control"] == "no-store"
        state = response.json()
        for path in ["save", "load", "ai_move", "undo", "redo", "config", "replay", "__test__/position"]:
            assert client.post("/api/" + path, json={}).status_code == 404
        assert client.get("/api/docs").status_code == 404
        assert client.get("/src/server.py").status_code == 404
        assert client.get("/missing.png").status_code == 404
        assert client.post("/api/new_game", json=body(state),
                           headers={"Origin": "https://other.example"}).status_code == 403
        assert client.post("/api/new_game", content="{}",
                           headers={"Content-Type": "text/plain"}).status_code == 415
        assert client.post("/api/new_game", json=body(state),
                           headers={"Origin": "https://chess.example"}).status_code == 200


def test_health_rejects_a_missing_frontend_build():
    root = Path(__file__).parents[1] / ".test-artifacts" / "no-frontend-build"
    assert not (root / "index.html").exists()
    with TestClient(create_app(root)) as client:
        response = client.get("/health")
        assert response.status_code == 503
        assert response.json() == {"ok": False, "frontend": False}
