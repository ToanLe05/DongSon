"""Rule decisions survive the API and JSON save/load boundaries."""
import json

import pytest
from fastapi.testclient import TestClient

import server
from dongson_engine import Color, GameResult
from test_rules_contract import position


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(server, "game", position())
    monkeypatch.setattr(server, "resigned_winner", None)
    monkeypatch.setattr(server, "redo_stack", [])
    monkeypatch.setattr(server, "finished_state", None)
    monkeypatch.setattr(server, "revision", 0)
    monkeypatch.setattr(server, "game_id", "test-game")
    with TestClient(server.app) as client:
        yield client


def test_draw_api_requires_two_moves_and_other_player_acceptance(client, monkeypatch):
    server.reset_game()
    assert client.post("/draw").status_code == 409
    assert client.post("/move", json={"from": "a2", "to": "a3"}).status_code == 200
    assert client.post("/draw").status_code == 409
    assert client.post("/move", json={"from": "a8", "to": "a7"}).status_code == 200
    response = client.post("/draw").json()
    assert response["pending"] and not response["accepted"]
    assert response["state"]["drawOfferPending"] == "thuy"
    assert client.post("/draw", json={"action": "accept"}).status_code == 400
    assert client.post("/draw", json={"action": "accept", "color": "thuy"}).status_code == 409
    response = client.post("/draw", json={"action": "accept", "color": "son"}).json()
    assert response["accepted"] and not response["pending"]
    assert response["state"]["result"] == "draw_by_agreement"
    assert response["state"]["winner"] == "draw"
    assert client.post("/move", json={"from": "c2", "to": "c3"}).status_code == 409
    assert client.post("/legal_moves", json={"square": "c2"}).json() == []
    assert client.post("/resign").status_code == 409
    assert client.get("/state").json()["result"] == "draw_by_agreement"


def test_fifty_move_claim_api_and_state(client):
    server.game.halfmove_clock = 99
    assert client.get("/state").json()["canClaimFiftyMoveDraw"] is False
    assert client.post("/draw", json={"action": "claim_fifty"}).status_code == 409
    server.game.halfmove_clock = 100
    state = client.get("/state").json()
    assert state["canClaimFiftyMoveDraw"] and state["winner"] is None
    response = client.post("/draw", json={"action": "claim_fifty"}).json()
    assert response["state"]["result"] == "draw_fifty_move_rule"
    assert response["state"]["canClaimFiftyMoveDraw"] is False


@pytest.mark.parametrize("draw", ["offer", "agreement", "fifty"])
def test_json_roundtrip_preserves_draw_and_move_count(client, draw):
    game = position()
    game.moves_played = 2
    if draw == "fifty":
        game.halfmove_clock = 100
        assert game.claim_fifty_move_draw(Color.THUY)
    else:
        assert game.offer_draw(Color.THUY)
        if draw == "agreement":
            assert game.accept_draw(Color.SON)
    restored = server._deserialize_full_game(json.loads(json.dumps(server._serialize_full_game(game))))
    assert restored.position_key() == game.position_key()
    assert restored.position_history == game.position_history
    assert restored.draw_offer_pending == game.draw_offer_pending
    assert restored.moves_played == 2
    assert restored.result() == game.result()


def test_save_load_keeps_repetition_occurrences(client):
    game = position()
    cycle = [("a1", "a2"), ("k8", "k7"), ("a2", "a1"), ("k7", "k8")]
    for start, end in cycle:
        assert game.make_move_named(start, end)
    restored = server._deserialize_full_game(json.loads(json.dumps(server._serialize_full_game(game))))
    for start, end in cycle:
        assert restored.make_move_named(start, end)
    assert restored.result() is GameResult.THREEFOLD_REPETITION


def test_legacy_save_defaults_draw_flags_and_counts(client):
    game = position()
    data = server._serialize_full_game(game)
    for key in ["moves_played", "position_history", "draw_offer_pending", "agreed_draw", "claimed_fifty_move_draw"]:
        data.pop(key)
    data["fullmove_number"] = 2
    restored = server._deserialize_full_game(json.loads(json.dumps(data)))
    assert restored.moves_played == 2
    assert not restored.agreed_draw and not restored.claimed_fifty_move_draw
    assert restored.position_history == [restored.position_key()]


def test_resigned_game_rejects_move_and_ai(client):
    assert client.post("/resign").status_code == 200
    assert client.post("/move", json={"from": "a1", "to": "a2"}).status_code == 409
    assert client.post("/ai_move").status_code == 409
    assert client.post("/legal_moves", json={"square": "a1"}).json() == []

def test_other_player_can_decline_without_changing_turn(client):
    server.game.moves_played = 2
    offer = client.post("/draw").json()
    assert offer["pending"]
    before_turn = offer["state"]["turn"]
    assert client.post("/draw", json={"action": "decline", "color": "thuy"}).status_code == 409
    response = client.post("/draw", json={"action": "decline", "color": "son"}).json()
    assert not response["accepted"] and not response["pending"]
    assert response["state"]["turn"] == before_turn
    assert response["state"]["canOfferDraw"]
    assert not response["state"]["gameOver"]


@pytest.mark.parametrize("ending", [
    "resignation", "agreement", "fifty", "repetition", "tribute", "mate", "material", "stalemate",
])
def test_every_terminal_result_is_frozen_and_blocks_all_mutations(client, ending):
    from test_rules_contract import DATA
    if ending == "resignation":
        assert client.post("/resign").status_code == 200
    elif ending in ("agreement", "fifty"):
        server.game.moves_played = 2
        if ending == "agreement":
            assert server.game.offer_draw(Color.THUY)
            assert server.game.accept_draw(Color.SON)
        else:
            server.game.halfmove_clock = 100
            assert server.game.claim_fifty_move_draw(Color.THUY)
    elif ending == "repetition":
        server.game.position_history = [server.game.position_key()] * 3
    else:
        case_id = {"tribute": "tribute-safe", "mate": "tribute-mate-next",
                   "material": "bare-one", "stalemate": "stalemate"}[ending]
        case = next(case for case in DATA["cases"] if case["id"] == case_id)
        server.game = position(case["pieces"], case["turn"])
        if ending == "mate":
            assert server.game.make_move_named("e7", "e6")
    final = client.get("/state").json()
    assert final["gameOver"] and final["winner"]
    assert not final["canOfferDraw"] and not final["canClaimFiftyMoveDraw"]
    attempts = [
        ("/move", {"from": "a1", "to": "a2"}), ("/undo", {}), ("/redo", {}),
        ("/ai_move", {}), ("/draw", {}), ("/draw", {"action": "accept", "color": "son"}),
        ("/draw", {"action": "claim_fifty"}), ("/resign", {}), ("/load", {"slot": 1}), ("/config", {}),
    ]
    for path, payload in attempts:
        response = client.post(path, json=payload)
        assert response.status_code == 409, (ending, path, response.text)
        assert response.json()["detail"]["code"] == "game_over"
        assert response.json()["detail"]["state"] == final
        assert client.get("/state").json() == final
    # Returning state never hands callers a reference to the frozen object.
    copy = server.current_state()
    copy["pieces"].clear()
    assert client.get("/state").json() == final
    fresh = client.post("/new_game").json()
    assert not fresh["gameOver"] and fresh["winner"] is None
    assert fresh["gameId"] != final["gameId"]
    assert fresh["revision"] == 0 and fresh["movesPlayed"] == 0


def test_state_version_rejects_old_move_after_rematch(client):
    old = client.get("/state").json()
    current = client.post("/new_game").json()
    response = client.post("/move", json={
        "from": "a2", "to": "a3", "gameId": old["gameId"], "revision": old["revision"],
    })
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "stale_state"
    assert client.get("/state").json() == current


def test_simultaneous_moves_share_an_atomic_check_and_mutation(client, monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    import time
    original = server.game.make_move
    def slow_move(move):
        time.sleep(0.03)
        return original(move)
    monkeypatch.setattr(server.game, "make_move", slow_move)
    before = client.get("/state").json()
    payload = {"from": "a1", "to": "a2", "gameId": before["gameId"], "revision": before["revision"]}
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: client.post("/move", json=payload), range(2)))
    assert sorted(response.status_code for response in results) == [200, 409]
    after = client.get("/state").json()
    assert after["revision"] == 1
    assert len(server.game.history) == 1
    assert after["movesPlayed"] == 1


@pytest.mark.parametrize("payload", [
    {"from": "a0", "to": "a2"},
    {"from": "a1", "to": "z99"},
    {"from": "a1", "to": "a2", "promotion": "queen"},
])
def test_bad_move_payload_is_rejected_without_server_error(client, payload):
    before = client.get("/state").json()
    assert client.post("/move", json=payload).status_code == 422
    assert client.get("/state").json() == before


def test_terminal_save_load_is_locked_until_explicit_new_game(client, monkeypatch):
    from pathlib import Path
    savedir = Path(__file__).parents[1] / ".test-artifacts" / "saves"
    savedir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(server, "SAVE_DIR", str(savedir))
    assert client.post("/resign").status_code == 200
    final = client.get("/state").json()
    assert client.post("/save", json={"slot": 1}).status_code == 200
    assert client.post("/load", json={"slot": 1}).status_code == 409
    client.post("/new_game")
    loaded = client.post("/load", json={"slot": 1}).json()
    assert loaded["gameOver"] and loaded["result"] == final["result"]
    assert loaded["winner"] == final["winner"]
    assert client.post("/undo").status_code == 409

