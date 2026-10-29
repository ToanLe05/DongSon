"""Agent selection is read-only; only the bridge may commit its proposed move."""
import copy
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))
from bot_agent import BotAgent
from browser_bridge import BrowserSession, RuleError
from test_rules_contract import DATA, position


def context(session, **extra):
    return {"gameId": session.game_id, "revision": session.revision, **extra}


def test_selection_returns_a_legal_move_without_changing_any_game_state():
    session = BrowserSession()
    session.dispatch("/new_game", context(session, mode="human_vs_bot", humanColor="son", botId="random"))
    before = session.checkpoint()
    chosen = BotAgent().select_move(session.game)
    assert chosen in session.game.legal_moves()
    assert session.checkpoint() == before


def test_no_legal_moves_returns_none_and_preserves_the_position():
    case = next(case for case in DATA["cases"] if case["id"] == "stalemate")
    session = BrowserSession()
    session.game = position(case["pieces"], case["turn"])
    before = session.checkpoint()
    assert not session.game.legal_moves()
    assert BotAgent().select_move(session.game) is None
    assert session.checkpoint() == before


@pytest.mark.parametrize("kind", ["none", "wrong_type", "illegal"])
def test_bridge_rejects_invalid_agent_proposals_without_committing(kind, monkeypatch):
    session = BrowserSession()
    session.dispatch("/new_game", context(session, mode="human_vs_bot", humanColor="son", botId="random"))
    chosen = copy.deepcopy(session.game.legal_moves()[0])
    chosen.end = chosen.start
    proposal = {"none": None, "wrong_type": "a2-a3", "illegal": chosen}[kind]
    monkeypatch.setattr(session.bot_agent, "select_move", lambda game: proposal)
    before = session.checkpoint()
    with pytest.raises(RuleError) as error:
        session.dispatch("/ai_move", context(session))
    assert error.value.detail["code"] == "no_bot_move"
    assert session.checkpoint() == before


def test_bridge_checks_actor_and_terminal_state_before_calling_agent(monkeypatch):
    session = BrowserSession()
    session.dispatch("/new_game", context(session, mode="human_vs_bot", humanColor="thuy", botId="random"))
    def must_not_run(game):
        pytest.fail("Agent called outside its turn")
    monkeypatch.setattr(session.bot_agent, "select_move", must_not_run)
    with pytest.raises(RuleError) as error:
        session.dispatch("/ai_move", context(session))
    assert error.value.detail["code"] == "human_turn"
    session.dispatch("/resign", context(session))
    with pytest.raises(RuleError) as error:
        session.dispatch("/ai_move", context(session))
    assert error.value.detail["code"] == "game_over"
