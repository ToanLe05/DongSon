import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))
from browser_bridge import BrowserSession, RuleError, inspect_file
from dongson_engine import Color
from bot_positions import promotion_capture


def context(s, **extra):
    return {"gameId": s.game_id, "revision": s.revision, **extra}


def bot_game(side):
    s = BrowserSession()
    s.dispatch("/new_game", context(s, mode="human_vs_bot", humanColor=side, botId="random"))
    return s


@pytest.mark.parametrize("side", ["thuy", "son"])
@pytest.mark.parametrize("bot_turn", [False, True])
def test_resignation_always_belongs_to_human_and_survives_file_transfer(side, bot_turn):
    s = bot_game(side)
    if (s.game.turn.value != side) != bot_turn:
        if s.game.turn.value == side:
            s.dispatch("/move", context(s, **{"from": "a2", "to": "a3"}))
        else:
            s.dispatch("/ai_move", context(s))
    before = s.state()
    final = s.dispatch("/resign", context(s))
    assert final["winner"] == Color(side).opposite().value and final["result"] == "resignation"
    assert final["pieces"] == before["pieces"] and final["movesPlayed"] == before["movesPlayed"]
    text = s.dispatch("/export", context(s))["file"]
    assert inspect_file(text).state() == final
    with pytest.raises(RuleError, match="kết thúc"):
        s.dispatch("/ai_move", context(s))


@pytest.mark.parametrize("side", ["thuy", "son"])
def test_only_human_pieces_are_available_to_the_public_move_commands(side):
    s = bot_game(side)
    if side == "son":
        assert s.dispatch("/legal_moves", {"square": "a2"}) == []
        assert s.dispatch("/legal_moves", {"square": "a8"}) == []
        s.dispatch("/ai_move", context(s))
    opponent = "a8" if side == "thuy" else next(p["square"] for p in s.state()["pieces"] if p["color"] == "thuy")
    before = s.checkpoint()
    assert s.dispatch("/legal_moves", {"square": opponent}) == []
    with pytest.raises(RuleError) as error:
        s.dispatch("/move", context(s, **{"from": opponent, "to": "e5"}))
    assert error.value.detail["code"] == "not_human"
    assert s.checkpoint() == before


@pytest.mark.parametrize("endpoint,extra", [("/resign", {}), ("/draw", {"action": "offer"}), ("/draw", {"action": "claim_fifty"})])
def test_bot_actor_cannot_offer_draw_claim_draw_or_resign(endpoint, extra):
    s = bot_game("thuy")
    before = s.checkpoint()
    with pytest.raises(RuleError) as error:
        s.dispatch(endpoint, context(s, color="son", **extra))
    assert error.value.detail["code"] == "not_human"
    assert s.checkpoint() == before


@pytest.mark.parametrize("proposal", [{"action": "offer_draw"}, {"action": "resign"}, "resign"])
def test_agent_actions_are_not_moves(proposal, monkeypatch):
    s = bot_game("son")
    before = s.checkpoint()
    monkeypatch.setattr(s.bot_agent, "select_move", lambda game: proposal)
    with pytest.raises(RuleError) as error:
        s.dispatch("/ai_move", context(s))
    assert error.value.detail["code"] == "no_bot_move"
    assert s.checkpoint() == before


@pytest.mark.parametrize("raises", [False, True])
def test_agent_mutations_and_exceptions_cannot_touch_the_live_game(raises, monkeypatch):
    s = bot_game("son")
    before = s.checkpoint()
    def broken(game):
        assert game is not s.game
        game.board.grid[0][0] = None
        game.turn = game.turn.opposite()
        game.agreed_draw = True
        game.history.clear()
        if raises:
            raise RuntimeError("inference failed")
        return None
    monkeypatch.setattr(s.bot_agent, "select_move", broken)
    with pytest.raises(RuleError) as error:
        s.dispatch("/ai_move", context(s))
    assert error.value.detail["code"] == ("bot_error" if raises else "no_bot_move")
    assert s.checkpoint() == before


@pytest.mark.parametrize("color", ["thuy", "son"])
def test_real_agent_captures_and_chooses_its_promotion(color):
    s = bot_game(Color(color).opposite().value)
    s.game = promotion_capture(color)
    options = s.game.legal_moves()
    assert len(options) == 3 and all(m.promotion and m.is_capture() for m in options)
    before = s.state()
    after = s.dispatch("/ai_move", context(s))
    assert after["lastMove"]["capture"] and after["lastMove"]["promotion"] in ("Ngua", "Voi", "Ga")
    assert len(after["pieces"]) == len(before["pieces"]) - 1 and after["movesPlayed"] == 1
    assert inspect_file(s.dispatch("/export", context(s))["file"]).state() == after
