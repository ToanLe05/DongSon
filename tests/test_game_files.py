"""Portable JSON imports are validated before replacing the live browser session."""
import copy
import json
from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))
from browser_bridge import BrowserSession, RuleError, inspect_file
from test_rules_contract import position


def context(session, **extra):
    return {"gameId": session.game_id, "revision": session.revision, **extra}


def started():
    s = BrowserSession()
    s.dispatch("/new_game", context(s))
    return s


def move(s, source, target, **extra):
    return s.dispatch("/move", context(s, **{"from": source, "to": target, **extra}))


def export(s):
    return s.dispatch("/export", context(s))["file"]


@pytest.mark.parametrize("side", ["thuy", "son"])
def test_portable_config_identifies_each_controller_and_survives_terminal_save(side):
    s = BrowserSession()
    config = {"mode": "human_vs_bot", "humanColor": side, "botId": "random"}
    s.dispatch("/new_game", context(s, **config))
    if side == "son":
        s.dispatch("/ai_move", context(s))
    text = export(s)
    assert json.loads(text)["snapshot"]["matchConfig"] == config
    target = started()
    state = target.dispatch("/import", context(target, file=text))
    assert state["matchConfig"] == config and state["turn"] == side
    assert BrowserSession.restore(target.checkpoint()).state() == state
    with pytest.raises(RuleError) as error:
        target.dispatch("/ai_move", context(target))
    assert error.value.detail["code"] == "human_turn"
    state["matchConfig"]["humanColor"] = "bad"
    assert target.state()["matchConfig"] == config
    target.dispatch("/resign", context(target))
    restored = inspect_file(export(target))
    assert restored.state()["matchConfig"] == config
    assert restored.state()["gameOver"]


@pytest.mark.parametrize("old,expected", [
    (None, {"mode": "human_vs_human", "humanColor": None, "botId": None}),
    ({"mode": "pvp", "humanSide": "son"}, {"mode": "human_vs_human", "humanColor": None, "botId": None}),
    ({"mode": "bot", "humanSide": "thuy"}, {"mode": "human_vs_bot", "humanColor": "thuy", "botId": "random"}),
    ({"mode": "bot", "humanSide": "son"}, {"mode": "human_vs_bot", "humanColor": "son", "botId": "random"}),
])
def test_old_config_migrates_in_checkpoint_and_exported_json(old, expected):
    source = started()
    file = json.loads(export(source))
    if old is None:
        file["snapshot"].pop("matchConfig")
    else:
        file["snapshot"]["matchConfig"] = old
    restored = inspect_file(json.dumps(file))
    assert restored.state()["matchConfig"] == expected
    assert json.loads(restored.checkpoint())["matchConfig"] == expected
    assert json.loads(export(restored))["snapshot"]["matchConfig"] == expected


@pytest.mark.parametrize("config", [
    {"mode": "unknown"}, {"mode": "human_vs_bot", "humanColor": "son", "botId": "unknown"},
    {"mode": "human_vs_bot", "humanColor": "bad", "botId": "random"},
    {"mode": "human_vs_bot", "humanColor": None, "botId": "random"},
    {"mode": "human_vs_bot", "humanColor": "thuy"},
    {"mode": "human_vs_human", "botId": "random"},
    {"mode": "human_vs_human", "humanColor": "thuy"}, [], "bot",
])
def test_invalid_controller_config_cannot_replace_current_game(config):
    s = started()
    before = s.checkpoint()
    file = json.loads(export(s))
    file["snapshot"]["matchConfig"] = config
    with pytest.raises(RuleError) as error:
        s.dispatch("/import", context(s, file=json.dumps(file)))
    assert error.value.detail["code"] == "invalid_save"
    assert s.checkpoint() == before


def without_version(state):
    return {k: v for k, v in state.items() if k not in ("gameId", "revision")}


def test_export_import_roundtrip_and_continuation():
    source = started()
    move(source, "a2", "a3")
    move(source, "a8", "a7")
    text = export(source)
    assert json.loads(text)["format"] == "dongson-game"
    preview = source.dispatch("/inspect_save", {"file": text})
    assert preview == source.state()
    target = started()
    old_context = context(target)
    loaded = target.dispatch("/import", context(target, file=text))
    assert without_version(loaded) == without_version(source.state())
    assert loaded["gameId"] not in (old_context["gameId"], source.game_id)
    assert target.game.position_history == source.game.position_history
    assert len(target.game.history) == 2
    with pytest.raises(RuleError):
        target.dispatch("/resign", old_context)
    move(target, "c2", "c3")
    assert target.state()["movesPlayed"] == 3


def test_pending_and_terminal_games_can_be_loaded_without_unlocking_the_original_game():
    s = started()
    move(s, "a2", "a3")
    move(s, "a8", "a7")
    s.dispatch("/draw", context(s, action="offer"))
    pending = export(s)
    s.dispatch("/draw", context(s, action="accept", color="son"))
    terminal = export(s)
    original_id = s.game_id
    s.dispatch("/import", context(s, file=pending))
    assert s.game_id != original_id and s.state()["drawOfferPending"] == "thuy"
    s.dispatch("/draw", context(s, action="decline", color="son"))
    move(s, "c2", "c3")
    s.dispatch("/import", context(s, file=terminal))
    assert s.state()["result"] == "draw_by_agreement"
    with pytest.raises(RuleError) as error:
        move(s, "a2", "a3")
    assert error.value.detail["code"] == "game_over"
    s.dispatch("/new_game", context(s))
    move(s, "a2", "a3")


@pytest.mark.parametrize("kind", ["Ngua", "Voi", "Ga"])
def test_promotions_and_repetition_history_survive_file_transfer(kind):
    s = started()
    s.game = position({"a8": {"color": "thuy", "type": "Bo"},
                       "h8": {"color": "son", "type": "Dinh"}})
    move(s, "a8", "a9", promotion=kind)
    imported = inspect_file(export(s))
    assert imported.state() == s.state()
    assert imported.game.position_history == s.game.position_history


def test_hoan_quan_and_halfmove_history_roundtrip():
    s = started()
    s.game.board.set((0, 2), None)
    s.game.board.set((0, 3), None)
    s.game.position_history = [s.game.position_key()]
    move(s, "e1", "b1")
    assert inspect_file(export(s)).state() == s.state()


def test_resigned_game_roundtrip():
    s = started()
    move(s, "a2", "a3")
    s.dispatch("/resign", context(s))
    assert inspect_file(export(s)).state() == s.state()


def test_file_transfer_preserves_repetition_and_fifty_move_claims():
    s = started()
    s.game = position()
    cycle = [("a1", "a2"), ("k8", "k7"), ("a2", "a1"), ("k7", "k8")]
    for a, b in cycle:
        move(s, a, b)
    saved = export(s)
    s.dispatch("/import", context(s, file=saved))
    for a, b in cycle:
        move(s, a, b)
    assert s.state()["result"] == "draw_threefold_repetition"
    assert inspect_file(export(s)).state() == s.state()
    s = started()
    s.game = position()
    s.game.halfmove_clock = 99
    move(s, "a1", "a2")
    s.dispatch("/import", context(s, file=export(s)))
    assert s.state()["canClaimFiftyMoveDraw"]
    s.dispatch("/draw", context(s, action="claim_fifty"))
    assert inspect_file(export(s)).state()["result"] == "draw_fifty_move_rule"


def test_frozen_center_piece_survives_file_transfer():
    s = started()
    s.game = position({"d3": {"color": "thuy", "type": "Ngua"}})
    move(s, "d3", "e5")
    loaded = inspect_file(export(s))
    assert loaded.state() == s.state()
    assert loaded.game.board.get((4, 4)).frozen


@pytest.mark.parametrize("corrupt", [
    lambda d: d.update(format="other-game"),
    lambda d: d.update(version=2),
    lambda d: d["snapshot"].update(schema=True),
    lambda d: d["snapshot"]["game"].update(turn="son"),
    lambda d: d["snapshot"]["game"].update(halfmove_clock=-1),
    lambda d: d["snapshot"]["game"].update(halfmove_clock=True),
    lambda d: d["snapshot"]["game"].update(halfmove_clock=100),
    lambda d: d["snapshot"]["game"].update(history=[]),
    lambda d: d["snapshot"]["game"].update(position_history=[]),
    lambda d: d["snapshot"]["game"]["board"]["board"][0].__setitem__(4, None),
    lambda d: d["snapshot"]["game"]["board"]["board"][0].__setitem__(0,
        copy.deepcopy(d["snapshot"]["game"]["board"]["board"][0][1])),
    lambda d: d["snapshot"]["game"]["board"]["board"][0][0]["fields"].update(frozen="yes"),
])
def test_invalid_import_keeps_current_game_unchanged(corrupt):
    s = started()
    move(s, "a2", "a3")
    data = json.loads(export(s))
    corrupt(data)
    before = s.checkpoint()
    with pytest.raises(RuleError) as error:
        s.dispatch("/import", context(s, file=json.dumps(data)))
    assert error.value.detail["code"] == "invalid_save"
    assert s.checkpoint() == before


@pytest.mark.parametrize("text", ["", "not json", "null", "[]", "{}", "[" * 2000])
def test_bad_json_is_a_file_error_not_a_worker_failure(text):
    with pytest.raises(RuleError) as error:
        inspect_file(text)
    assert error.value.detail["code"] == "invalid_save"
