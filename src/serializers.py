"""
serializers.py
==============
Converts DongSonGame's internal Python objects (Piece, Move, Board, enums)
into the plain JSON shapes the frontend already expects.

The frontend's expected shapes are defined by example in MockApiClient.js —
that file IS the contract. Every function here targets exactly the shape
MockApiClient produces, field for field:

    state = {
        turn: "thuy" | "son",
        winner: "thuy" | "son" | "draw" | null,
        check: bool,
        checkSquare: "<square>" | null,
        lastMove: { from, to, id, color, type, capture, promotion } | null,
        pieces: [ { id, type, color, square, promoted, frozen } ]
    }

    move (as used by InputManager / HighlightLayer) = {
        from, to, capture, promotion
    }
"""

from typing import Optional, List, Dict, Any

from dongson_engine import (
    Board,
    Move,
    GameResult,
    DongSonGame,
    FILES,
)


# --------------------------------------------------------------------------- #
# Small helpers
# --------------------------------------------------------------------------- #

def square_name(pos) -> str:
    r, c = pos
    return f"{FILES[c]}{r + 1}"


# --------------------------------------------------------------------------- #
# Piece
# --------------------------------------------------------------------------- #

def serialize_piece(pos, piece) -> Dict[str, Any]:
    return {
        "id": piece.id,
        "type": piece.type.value,
        "color": piece.color.value,
        "square": square_name(pos),
        "promoted": piece.promoted,
        "frozen": piece.frozen,
        "enteredPalace": piece.entered_palace,
    }


def serialize_pieces(board: Board) -> List[Dict[str, Any]]:
    return [serialize_piece(pos, piece) for pos, piece in board.all_pieces()]


# --------------------------------------------------------------------------- #
# Move
# --------------------------------------------------------------------------- #

def serialize_move(move: Optional[Move]) -> Optional[Dict[str, Any]]:
    """Full move shape used for `lastMove` (drives HighlightLayer.showLastMove
    and PieceLayer.animateMove — those need `id`/`color`/`type` to find the
    right sprite, plus `capture`/`promotion` to know how to animate it)."""

    if move is None:
        return None

    return {
        "from": square_name(move.start),
        "to": square_name(move.end),
        "id": move.piece.id,
        "color": move.piece.color.value,
        "type": move.piece.type.value,
        "capture": move.is_capture(),
        "promotion": move.promotion.value if move.promotion else None,
        "isHoanQuan": move.is_hoan_quan,
    }


def serialize_legal_move(move: Move) -> Dict[str, Any]:
    """Lighter shape for the /legal_moves list — this is what
    HighlightLayer.showLegalMoves and InputManager's `legalMoves` array
    consume. Only `to`/`capture` are read for rendering; `from`/`promotion`
    round-trip back through ApiClient.makeMove() as the request body."""

    return {
        "from": square_name(move.start),
        "to": square_name(move.end),
        "capture": move.is_capture(),
        "promotion": move.promotion.value if move.promotion else None,
        "isHoanQuan": move.is_hoan_quan,
    }


def serialize_legal_moves(moves: List[Move]) -> List[Dict[str, Any]]:
    return [serialize_legal_move(m) for m in moves]


# --------------------------------------------------------------------------- #
# Result / winner
# --------------------------------------------------------------------------- #

# GameResult -> the "thuy" | "son" | "draw" | None the frontend understands.
# GameSync.applyState() only checks `if (state.winner)`, so any of these
# three strings triggers the victory effect; distinguishing win vs draw is
# preserved separately in `result` below for anything that wants more detail.
_RESULT_WINNER = {
    GameResult.CHIEU_HA_THUY_WINS: "thuy",
    GameResult.TIEN_CUNG_THUY_WINS: "thuy",
    GameResult.CHIEU_HA_SON_WINS: "son",
    GameResult.TIEN_CUNG_SON_WINS: "son",
    GameResult.STALEMATE: "draw",
    GameResult.INSUFFICIENT_MATERIAL: "draw",
    GameResult.FIFTY_MOVE_RULE: "draw",
    GameResult.THREEFOLD_REPETITION: "draw",
    GameResult.AGREED_DRAW: "draw",
}


def winner_from_result(result: GameResult) -> Optional[str]:
    return _RESULT_WINNER.get(result)


# --------------------------------------------------------------------------- #
# Full game state (the `state` object GameBoard.updateBoard /
# GameSync.applyState expect)
# --------------------------------------------------------------------------- #

def serialize_state(
    game: DongSonGame,
    resigned_winner: Optional[str] = None,
) -> Dict[str, Any]:
    """
    `resigned_winner` lets the server layer override the engine's own
    result computation — DongSonGame has no concept of resignation, only
    checkmate/tribute/draws, so /resign has to be tracked outside the
    engine and folded in here.
    """

    to_move = game.turn
    in_check = game.is_in_check(to_move)
    than_pos = game.board.find_than(to_move) if in_check else None

    result = game.result()
    last_move = game.history[-1].move if game.history else None
    game_over = bool(resigned_winner) or result is not GameResult.ONGOING

    return {
        "turn": game.turn.value,
        "gameOver": game_over,
        "movesPlayed": game.moves_played,
        "winner": resigned_winner or winner_from_result(result),
        "result": ("resignation" if resigned_winner else result.value),
        "check": in_check,
        "checkSquare": square_name(than_pos) if than_pos else None,
        "lastMove": serialize_move(last_move),
        "pieces": serialize_pieces(game.board),
        "fullmoveNumber": game.fullmove_number,
        "halfmoveClock": game.halfmove_clock,
        "drawOfferPending": game.draw_offer_pending.value if game.draw_offer_pending and not game_over else None,
        "canOfferDraw": not game_over and game.moves_played >= 2 and game.draw_offer_pending is None,
        "canClaimFiftyMoveDraw": game.endgame.is_fifty_move_draw() and not game_over,
    }


# --------------------------------------------------------------------------- #
# Read-only board snapshot (for /replay — does not include turn/check/lastMove
# context, since history entries don't record whose turn a snapshot belongs
# to; good enough for visually scrubbing through past positions)
# --------------------------------------------------------------------------- #

def serialize_board_snapshot(board: Board) -> Dict[str, Any]:
    return {
        "pieces": serialize_pieces(board),
    }
