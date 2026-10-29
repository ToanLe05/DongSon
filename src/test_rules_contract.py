"""Concrete positive/negative rule positions; see RULES.md and rule_positions.json."""
import json
from pathlib import Path

import pytest

from dongson_engine import (
    Board, Color, DongSonGame, GameResult, MoveGenerator, Piece, PieceType,
)

DATA = json.loads((Path(__file__).parents[1] / "tests/rule_positions.json").read_text(encoding="utf-8"))


def square(name):
    return int(name[1:]) - 1, "abcdefghk".index(name[0])


def position(changes=None, turn="thuy"):
    game = DongSonGame()
    game.board = Board(empty=True)
    for name, data in (DATA["base"] | (changes or {})).items():
        if data:
            game.board.set(square(name), Piece(
                Color(data["color"]), PieceType(data["type"]),
                **{key: value for key, value in data.items() if key not in ("color", "type")},
            ))
    game.turn = Color(turn)
    game.position_history = [game.position_key()]
    return game


@pytest.mark.parametrize("case", DATA["cases"], ids=lambda case: case["id"])
def test_named_rule_position(case):
    game = position(case["pieces"], case["turn"])
    for check in case["checks"]:
        kind = check["kind"]
        if kind == "move":
            actual = any(move.end == square(check["to"]) for move in game.legal_moves(square(check["from"])))
        elif kind == "attack":
            actual = square(check["to"]) in MoveGenerator.attack_squares_for_piece(game.board, square(check["from"]))
            source = game.board.get(square(check["from"]))
            assert actual == game.validator.is_square_attacked(game.board, square(check["to"]), source.color) or any(
                square(check["to"]) in MoveGenerator.attack_squares_for_piece(game.board, pos)
                for pos, other in game.board.all_pieces(source.color) if pos != square(check["from"])
            )
        elif kind == "stalemate":
            actual = game.endgame.is_stalemate(game.board, Color(check["color"]))
        elif kind == "tribute":
            actual = game.endgame.check_tien_cung(game.board, Color(check["color"]))
        else:
            actual = game.result().value
        assert actual == check["expected"], (case["description"], check, actual)


@pytest.mark.parametrize("color", list(Color))
@pytest.mark.parametrize("piece_type", [PieceType.NGUA, PieceType.VOI, PieceType.GA])
def test_control_and_pseudo_capture_share_every_zone_boundary(color, piece_type):
    """All 81 origins: each geometric target permits an enemy capture, never a friendly move."""
    game = DongSonGame()
    for r in range(9):
        for c in range(9):
            board = Board(empty=True)
            piece = Piece(color, piece_type)
            board.set((r, c), piece)
            attacks = MoveGenerator.attack_squares_for_piece(board, (r, c))
            empty_moves = {move.end for move in MoveGenerator.pseudo_legal_moves_for_piece(board, (r, c))}
            assert attacks == empty_moves
            for end in attacks:
                board.set(end, Piece(color.opposite(), PieceType.DINH))
                captures = MoveGenerator.pseudo_legal_moves_for_piece(board, (r, c))
                assert any(move.end == end and move.is_capture() for move in captures)
                board.set(end, Piece(color, PieceType.DINH))
                assert end in MoveGenerator.attack_squares_for_piece(board, (r, c))
                assert all(move.end != end for move in MoveGenerator.pseudo_legal_moves_for_piece(board, (r, c)))
                board.set(end, None)


@pytest.mark.parametrize("source_type", ["Bo", "Dinh"])
@pytest.mark.parametrize("promotion,code,target", [("Ngua", "n", "b7"), ("Voi", "v", "c7"), ("Ga", "g", "c9")])
def test_promotion_immediate_and_uses_far_corner(source_type, promotion, code, target):
    game = position({"a8": {"color": "thuy", "type": source_type}, "h8": {"color": "son", "type": "Dinh"}})
    assert not game.make_move_named("a8", "a9")
    assert game.make_move_named("a8", "a9", code)
    piece = game.board.get(square("a9"))
    assert piece.type.value == promotion and piece.promoted
    assert square(target) in MoveGenerator.attack_squares_for_piece(game.board, square("a9"))


@pytest.mark.parametrize("kind,promoted,source,frozen", [
    ("Ngua", False, "d3", True),
    ("Ga", True, "e3", True),
    ("Ga", False, "e3", False),
    ("Voi", False, "c3", False),
])
def test_enter_palace_freeze_and_undo(kind, promoted, source, frozen):
    game = position({source: {"color": "thuy", "type": kind, "promoted": promoted}})
    before = game.position_key()
    assert game.make_move_named(source, "e5")
    piece = game.board.get(square("e5"))
    assert piece.entered_palace
    assert piece.frozen is frozen
    if frozen:
        assert MoveGenerator.attack_squares_for_piece(game.board, square("e5")) == set()
    assert game.undo_move()
    assert game.position_key() == before


def test_fifty_move_threshold_is_claimed_not_automatic():
    game = position()
    game.halfmove_clock = 99
    assert not game.endgame.is_fifty_move_draw()
    assert not game.claim_fifty_move_draw(game.turn)
    game.halfmove_clock = 100
    assert game.endgame.is_fifty_move_draw()
    assert game.result() is GameResult.ONGOING
    assert not game.claim_fifty_move_draw(game.turn.opposite())
    assert game.claim_fifty_move_draw(game.turn)
    assert game.result() is GameResult.FIFTY_MOVE_RULE
    assert not game.make_move_named("a1", "a2")


def test_clock_resets_on_bo_dinh_and_capture():
    for changes, start, end in [
        ({"b3": {"color": "thuy", "type": "Bo"}}, "b3", "b4"),
        ({"b3": {"color": "thuy", "type": "Dinh"}}, "b3", "b4"),
        ({"b3": {"color": "thuy", "type": "Lac"}, "b4": {"color": "son", "type": "Dinh"}}, "b3", "b4"),
    ]:
        game = position(changes)
        game.halfmove_clock = 99
        assert game.make_move_named(start, end)
        assert game.halfmove_clock == 0
    game = position()
    game.halfmove_clock = 99
    assert game.make_move_named("a1", "a2")
    assert game.halfmove_clock == 100
    assert game.result() is GameResult.ONGOING


def test_agreement_requires_both_sides_to_have_moved_and_other_side_acceptance():
    game = DongSonGame()
    assert not game.offer_draw(Color.THUY)
    assert game.make_move_named("a2", "a3")
    assert not game.offer_draw(Color.SON)
    assert game.make_move_named("a8", "a7")
    assert not game.offer_draw(Color.SON)  # not the side to move
    assert game.offer_draw(Color.THUY)
    assert not game.accept_draw()
    assert not game.accept_draw(Color.THUY)
    assert game.result() is GameResult.ONGOING
    assert game.accept_draw(Color.SON)
    assert game.result() is GameResult.AGREED_DRAW
    assert not game.make_move_named("c2", "c3")
    assert game.undo_move()
    assert game.result() is GameResult.ONGOING


def test_offer_expires_on_move_and_undo_restores_it():
    game = DongSonGame()
    assert game.make_move_named("a2", "a3")
    assert game.make_move_named("a8", "a7")
    assert game.offer_draw(Color.THUY)
    assert game.make_move_named("c2", "c3")
    assert game.draw_offer_pending is None
    assert game.undo_move()
    assert game.draw_offer_pending is Color.THUY


def test_threefold_uses_actual_cycle_and_undo_removes_last_occurrence():
    game = position()
    cycle = [("a1", "a2"), ("k8", "k7"), ("a2", "a1"), ("k7", "k8")]
    for start, end in cycle:
        assert game.make_move_named(start, end)
    assert not game.endgame.is_threefold_repetition()
    for start, end in cycle:
        assert game.make_move_named(start, end)
    assert game.result() is GameResult.THREEFOLD_REPETITION
    assert not game.make_move_named("a1", "a2")
    assert game.undo_move()
    assert not game.endgame.is_threefold_repetition()


def test_repetition_key_includes_turn_promotion_palace_freeze_and_swap_rights():
    game = position({"b1": {"color": "thuy", "type": "Voi"},
                     "e1": {"color": "thuy", "type": "Than"}, "a1": None})
    key = game.position_key()
    game.turn = Color.SON
    assert key != game.position_key()
    game.turn = Color.THUY
    voi = game.board.get(square("b1"))
    for flag in ["promoted", "entered_palace", "frozen", "has_moved"]:
        setattr(voi, flag, True)
        assert key != game.position_key(), flag
        setattr(voi, flag, False)
    # Non-rights movement flags do not create false distinctions.
    game.board.get(square("k2")).has_moved = True
    assert key == game.position_key()
    voi.id = "replacement-id"
    assert key == game.position_key()


def test_than_is_checked_not_captured():
    game = position({"c3": {"color": "thuy", "type": "Lac"},
                     "k8": None, "c8": {"color": "son", "type": "Than"}})
    assert game.validator.is_in_check(game.board, Color.SON)
    assert all(not move.captured or move.captured.type is not PieceType.THAN
               for move in game.legal_moves())

def test_tribute_mate_in_one_has_a_concrete_legal_witness():
    case = next(case for case in DATA["cases"] if case["id"] == "tribute-mate-next")
    game = position(case["pieces"], "son")
    assert not game.validator.is_in_check(game.board, Color.THUY)
    replies = game.validator.generate_legal_moves(game.board, Color.SON)
    assert all(move.captured_pos != square("d4") for move in replies)
    reply = next(move for move in replies if move.start == square("e7") and move.end == square("e6"))
    after = game.validator._simulate(game.board, reply)
    assert game.endgame.is_chieu_ha(after, Color.THUY)
    # Without the knight guarding e6, Than can capture the checking Dinh.
    after.set(square("c7"), None)
    assert not game.endgame.is_chieu_ha(after, Color.THUY)

def test_tribute_result_is_only_for_the_side_that_just_moved():
    case = next(case for case in DATA["cases"] if case["id"] == "tribute-safe")
    game = position(case["pieces"], "son")
    assert game.result() is GameResult.TIEN_CUNG_THUY_WINS
    game.turn = Color.THUY
    assert game.result() is GameResult.ONGOING


def test_checkmate_reply_ends_game_and_precedes_draw_clock():
    case = next(case for case in DATA["cases"] if case["id"] == "tribute-mate-next")
    game = position(case["pieces"], "son")
    assert game.make_move_named("e7", "e6")
    game.halfmove_clock = 100
    assert game.result() is GameResult.CHIEU_HA_SON_WINS
    assert not game.claim_fifty_move_draw(Color.THUY)


def test_swap_uses_control_not_opponents_legal_move_list():
    game = DongSonGame()
    game.board.set(square("c1"), None)
    game.board.set(square("d1"), None)
    assert any(move.is_hoan_quan for move in game.legal_moves(square("e1")))
    # A Gà at c3 protects c1 by jumping over c2; c1 is a crossed square.
    game.board.set(square("c3"), Piece(Color.SON, PieceType.GA))
    assert not any(move.is_hoan_quan and move.end == square("b1")
                   for move in game.legal_moves(square("e1")))


