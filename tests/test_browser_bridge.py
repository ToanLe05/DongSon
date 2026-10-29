"""Same local adapter under native Python; no HTTP framework dependencies."""
import json
from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))
from browser_bridge import BrowserSession, RuleError
from dongson_engine import Color
from test_rules_contract import DATA, position


def context(s, **extra):
    return {"gameId": s.game_id, "revision": s.revision, **extra}


def started():
    s = BrowserSession()
    s.dispatch("/new_game", context(s))
    return s


def test_start_reload_moves_terminal_lock_and_rematch():
    s = started()
    before = s.state()
    s = BrowserSession.restore(s.checkpoint())
    assert s.state() == before and s.started
    for source, target in [("a2", "a3"), ("a8", "a7")]:
        s.dispatch("/move", context(s, **{"from": source, "to": target}))
    moved = s.state()
    s = BrowserSession.restore(s.checkpoint())
    assert s.state() == moved
    assert s.game.position_history[-1] == s.game.position_key()
    assert s.game.history[-1].board_before is not s.game.board
    s.dispatch("/resign", context(s))
    final = s.state()
    s = BrowserSession.restore(s.checkpoint())
    assert s.state() == final and final["winner"] == "son"
    for path in ["/move", "/draw", "/resign"]:
        with pytest.raises(RuleError) as error:
            s.dispatch(path, context(s, **{"from": "c2", "to": "c3"}))
        assert error.value.detail["code"] == "game_over"
    fresh = s.dispatch("/new_game", context(s))
    assert fresh["gameId"] != final["gameId"] and len(fresh["pieces"]) == 36


def test_draw_pending_and_final_roundtrip():
    s = started()
    for a, b in [("a2", "a3"), ("a8", "a7")]:
        s.dispatch("/move", context(s, **{"from": a, "to": b}))
    s.dispatch("/draw", context(s, action="offer"))
    s = BrowserSession.restore(s.checkpoint())
    assert s.state()["drawOfferPending"] == "thuy"
    with pytest.raises(RuleError):
        s.dispatch("/draw", context(s, action="accept", color="thuy"))
    s.dispatch("/draw", context(s, action="decline", color="son"))
    s.dispatch("/draw", context(s, action="offer"))
    s.dispatch("/draw", context(s, action="accept", color="son"))
    final = BrowserSession.restore(s.checkpoint()).state()
    assert final["result"] == "draw_by_agreement"


def test_duplicate_and_old_generation_requests_change_nothing():
    s = started()
    old = context(s, **{"from": "a2", "to": "a3"})
    s.dispatch("/move", old)
    saved = s.checkpoint()
    for path in ["/move", "/new_game", "/resign", "/draw"]:
        with pytest.raises(RuleError) as error:
            s.dispatch(path, old)
        assert error.value.detail["code"] == "stale_state"
        assert s.checkpoint() == saved


@pytest.mark.parametrize("source,target,promotion", [
    ("a0", "a1", None), ("i2", "i3", None), ("a2", "a10", None),
    ("a2", "a3", "Than"), ("a2", "a4", None),
])
def test_invalid_moves_do_not_change_checkpoint(source, target, promotion):
    s = started()
    before = s.checkpoint()
    with pytest.raises(RuleError):
        s.dispatch("/move", context(s, **{"from": source, "to": target, "promotion": promotion}))
    assert s.checkpoint() == before


@pytest.mark.parametrize("kind", ["Ngua", "Voi", "Ga"])
@pytest.mark.parametrize("color", ["thuy", "son"])
def test_promotions_and_piece_identity_survive_reload(kind, color):
    s = started()
    changes = {"a8": {"color": "thuy", "type": "Bo"}, "h8": {"color": "son", "type": "Dinh"}}
    source, target = "a8", "a9"
    if color == "son":
        changes = {"a1": None, "k1": {"color": "thuy", "type": "Than"}, "a2": {"color": "son", "type": "Bo"}}
        source, target = "a2", "a1"
    s.game = position(changes, color)
    state = s.dispatch("/move", context(s, **{"from": source, "to": target, "promotion": kind}))
    assert next(p for p in state["pieces"] if p["square"] == target)["type"] == kind
    restored = BrowserSession.restore(s.checkpoint())
    assert restored.state() == state
    assert restored.game.history[-1].move.piece.type.value == "Bo"


@pytest.mark.parametrize("name", ["tribute-safe", "tribute-mate-next", "bare-one", "stalemate"])
def test_special_results_use_the_existing_engine(name):
    case = next(c for c in DATA["cases"] if c["id"] == name)
    s = started()
    s.game = position(case["pieces"], case["turn"])
    expected = s.state()
    assert BrowserSession.restore(s.checkpoint()).state() == expected


def test_repetition_history_and_fifty_move_claim_survive_reload():
    s = started()
    s.game = position()
    s.game.halfmove_clock = 100
    s = BrowserSession.restore(s.checkpoint())
    assert s.state()["canClaimFiftyMoveDraw"]
    assert s.dispatch("/draw", context(s, action="claim_fifty"))["state"]["result"] == "draw_fifty_move_rule"
    s = started()
    s.game.position_history *= 3
    restored = BrowserSession.restore(s.checkpoint())
    assert restored.state()["result"] == "draw_threefold_repetition"


def test_checkpoint_is_json_with_an_explicit_type_allowlist():
    s = started()
    data = json.loads(s.checkpoint())
    data["game"]["board"] = {"type": "exec", "fields": {}}
    with pytest.raises(KeyError):
        BrowserSession.restore(json.dumps(data))
