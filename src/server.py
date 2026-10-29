"""Local/desktop game API and shared endpoints for the web host.

The local API retains one default game for development tools. web.py binds a
GameSession through a ContextVar per browser request; each session owns its
lock, version, and terminal snapshot. Run one worker while state is in memory.

Only the local API exposes legacy save/load, undo/redo, random AI and replay.
Save/load preserves board/clocks/repetition/draw state but not move history.
"""

import os
import json
import random
import copy
import uuid
from contextvars import ContextVar
from functools import wraps
from threading import RLock
from typing import Optional, List, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from dongson_engine import (
    DongSonGame,
    Color,
    PieceType,
    Piece,
    Board,
    Move,
)
import serializers as ser


# --------------------------------------------------------------------------- #
# App + CORS
# --------------------------------------------------------------------------- #

app = FastAPI(title="Dong Son Chess API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten to your real frontend origin before deploying
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Global game state (single in-memory game)
# --------------------------------------------------------------------------- #

game = DongSonGame()
redo_stack: List[Move] = []
resigned_winner: Optional[str] = None   # "thuy" | "son" | None
game_lock = RLock()
game_id = str(uuid.uuid4())
revision = 0
finished_state = None
started = False


class GameSession:
    """One hotseat match, including its lock and terminal snapshot."""
    def __init__(self):
        self.game = DongSonGame()
        self.redo_stack = []
        self.resigned_winner = None
        self.game_lock = RLock()
        self.game_id = str(uuid.uuid4())
        self.revision = 0
        self.finished_state = None
        self.started = False
        self.strict = False


class LocalSession:
    """Keep the local/desktop API and existing setup tools compatible."""
    def __getattr__(self, name):
        if name == "strict":
            return False
        return globals()["SAVE_DIR" if name == "save_dir" else name]

    def __setattr__(self, name, value):
        globals()["SAVE_DIR" if name == "save_dir" else name] = value


session_context = ContextVar("dongson_session", default=None)
local_session = LocalSession()


def get_session():
    return session_context.get() or local_session


def locked_game(handler):
    """Serialize check-and-mutate operations in this single-process local server."""
    @wraps(handler)
    def locked(*args, **kwargs):
        with get_session().game_lock:
            return handler(*args, **kwargs)
    return locked

SAVE_DIR = os.environ.get("DONGSON_SAVE_DIR", os.path.join(os.path.dirname(__file__), "saves"))
os.makedirs(SAVE_DIR, exist_ok=True)


def current_state():
    if get_session().finished_state is not None:
        return copy.deepcopy(get_session().finished_state)
    state = ser.serialize_state(get_session().game, resigned_winner=get_session().resigned_winner)
    state.update(gameId=get_session().game_id, revision=get_session().revision,
                 started=get_session().started)
    if state["gameOver"]:
        get_session().finished_state = copy.deepcopy(state)
    return state


def changed_state():
    get_session().revision += 1
    return current_state()


def require_current(req=None):
    state = current_state()
    strict = getattr(get_session(), "strict", False)
    if (strict and (req is None or req.gameId is None or req.revision is None)) or (req is not None and (
        (req.gameId is not None and req.gameId != get_session().game_id)
        or (req.revision is not None and req.revision != get_session().revision)
    )):
        raise HTTPException(status_code=409, detail={
            "code": "stale_state", "message": "Thế cờ đã thay đổi. Vui lòng thử lại.",
            "state": state,
        })


def require_active(req=None):
    state = current_state()
    if state["gameOver"]:
        raise HTTPException(status_code=409, detail={
            "code": "game_over", "message": "Ván cờ đã kết thúc. Hãy chọn Chơi lại.",
            "state": state,
        })
    require_current(req)
    if getattr(get_session(), "strict", False) and not get_session().started:
        raise HTTPException(status_code=409, detail={
            "code": "not_started", "message": "Chọn Bắt đầu để chơi.", "state": state,
        })


def reset_game():
    get_session().started = True
    get_session().game = DongSonGame()
    get_session().finished_state = None
    get_session().game_id = str(uuid.uuid4())
    get_session().revision = 0
    get_session().redo_stack = []
    get_session().resigned_winner = None


# --------------------------------------------------------------------------- #
# Request bodies
# --------------------------------------------------------------------------- #

class NewGameConfig(BaseModel):
    model_config = ConfigDict(extra="allow")   # accepted, currently unused
    gameId: Optional[str] = None
    revision: Optional[int] = None


class StateRequest(BaseModel):
    gameId: Optional[str] = None
    revision: Optional[int] = None


class SquareRequest(BaseModel):
    square: str = Field(pattern=r"^[a-hk][1-9]$")


class MoveRequest(StateRequest):
    model_config = ConfigDict(populate_by_name=True)
    from_sq: str = Field(alias="from", pattern=r"^[a-hk][1-9]$")
    to: str = Field(pattern=r"^[a-hk][1-9]$")
    promotion: Optional[Literal["n", "v", "g", "Ngua", "Voi", "Ga"]] = None


class AiMoveRequest(StateRequest):
    level: int = 1   # accepted, currently unused — see /ai_move


class SlotRequest(StateRequest):
    slot: int = 1


class ReplayRequest(BaseModel):
    step: int


class DrawRequest(StateRequest):
    action: Literal["offer", "accept", "decline", "claim_fifty"] = "offer"
    color: Optional[Color] = None


class ConfigRequest(StateRequest):
    model_config = ConfigDict(extra="allow")   # accepted, currently unused


# --------------------------------------------------------------------------- #
# Health
# --------------------------------------------------------------------------- #

@app.get("/ping")
@locked_game
def ping():
    return {"ok": True}


# --------------------------------------------------------------------------- #
# New game / state
# --------------------------------------------------------------------------- #

@app.post("/new_game")
@locked_game
def new_game(config: NewGameConfig = NewGameConfig()):
    require_current(config)
    if (getattr(get_session(), "strict", False) and get_session().started
            and not current_state()["gameOver"]):
        raise HTTPException(status_code=409, detail={
            "code": "active_game", "message": "Ván cờ đang diễn ra.", "state": current_state(),
        })
    reset_game()
    return current_state()


@app.get("/state")
@locked_game
def get_state():
    return current_state()


# --------------------------------------------------------------------------- #
# Legal moves
# --------------------------------------------------------------------------- #

@app.post("/legal_moves")
@locked_game
def legal_moves(req: SquareRequest):
    if current_state()["gameOver"]:
        return []
    pos = _parse_square_or_400(req.square)
    moves = get_session().game.legal_moves(pos)
    return ser.serialize_legal_moves(moves)


# --------------------------------------------------------------------------- #
# Move
# --------------------------------------------------------------------------- #

@app.post("/move")
@locked_game
def make_move(req: MoveRequest):

    require_active(req)
    promotion = {"Ngua": "n", "Voi": "v", "Ga": "g"}.get(req.promotion, req.promotion)
    ok = get_session().game.make_move_named(req.from_sq, req.to, promotion)

    if not ok:
        raise HTTPException(status_code=400, detail="Illegal move")

    get_session().redo_stack = []   # any new move invalidates the redo stack
    return changed_state()


# --------------------------------------------------------------------------- #
# Undo / Redo
# --------------------------------------------------------------------------- #

@app.post("/undo")
@locked_game
def undo(req: StateRequest = StateRequest()):
    require_active(req)
    if not get_session().game.history:
        return current_state()

    undone_move = get_session().game.history[-1].move   # capture before popping
    if get_session().game.undo_move():
        get_session().redo_stack.append(undone_move)
        return changed_state()

    return current_state()


@app.post("/redo")
@locked_game
def redo(req: StateRequest = StateRequest()):
    require_active(req)
    if not get_session().redo_stack:
        return current_state()

    move = get_session().redo_stack.pop()
    if not get_session().game.make_move(move):
        get_session().redo_stack.append(move)
        raise HTTPException(status_code=409, detail="Không thể đi lại nước cờ này.")
    return changed_state()


# --------------------------------------------------------------------------- #
# AI move (placeholder — random legal move, see module docstring)
# --------------------------------------------------------------------------- #

@app.post("/ai_move")
@locked_game
def ai_move(req: AiMoveRequest = AiMoveRequest()):

    require_active(req)
    moves = get_session().game.legal_moves()
    if not moves:
        raise HTTPException(status_code=409, detail="No legal moves available")

    chosen = random.choice(moves)
    get_session().game.make_move(chosen)
    get_session().redo_stack = []
    return changed_state()


# --------------------------------------------------------------------------- #
# Save / Load
# --------------------------------------------------------------------------- #

def _save_path(slot: int) -> str:
    return os.path.join(get_session().save_dir, f"slot_{slot}.json")


def _serialize_full_game(g: DongSonGame) -> dict:
    """Enough to reconstruct the position exactly — used for save/load,
    distinct from serializers.serialize_state (which is the read-only
    view the frontend consumes)."""

    grid = []
    for row in g.board.grid:
        row_out = []
        for p in row:
            if p is None:
                row_out.append(None)
            else:
                row_out.append({
                    "color": p.color.value,
                    "type": p.type.value,
                    "id": p.id,
                    "has_moved": p.has_moved,
                    "entered_palace": p.entered_palace,
                    "frozen": p.frozen,
                    "promoted": p.promoted,
                })
        grid.append(row_out)

    return {
        "grid": grid,
        "turn": g.turn.value,
        "halfmove_clock": g.halfmove_clock,
        "fullmove_number": g.fullmove_number,
        "resigned_winner": get_session().resigned_winner,
        "moves_played": g.moves_played,
        "position_history": g.position_history,
        "draw_offer_pending": g.draw_offer_pending.value if g.draw_offer_pending else None,
        "agreed_draw": g.agreed_draw,
        "claimed_fifty_move_draw": g.claimed_fifty_move_draw,
    }


def _deserialize_full_game(data: dict) -> DongSonGame:
    g = DongSonGame.__new__(DongSonGame)   # bypass __init__'s standard setup
    g.board = Board(empty=True)

    for r, row in enumerate(data["grid"]):
        for c, p in enumerate(row):
            if p is None:
                continue
            g.board.grid[r][c] = Piece(
                color=Color(p["color"]),
                type=PieceType(p["type"]),
                id=p["id"],
                has_moved=p["has_moved"],
                entered_palace=p["entered_palace"],
                frozen=p["frozen"],
                promoted=p["promoted"],
            )

    g.turn = Color(data["turn"])
    g.halfmove_clock = data["halfmove_clock"]
    g.fullmove_number = data["fullmove_number"]
    g.history = []
    g.position_history = []
    g.draw_offer_pending = Color(data["draw_offer_pending"]) if data.get("draw_offer_pending") else None
    g.moves_played = data.get("moves_played", 2 * (g.fullmove_number - 1) + (g.turn is Color.SON))
    g.agreed_draw = data.get("agreed_draw", False)
    g.claimed_fifty_move_draw = data.get("claimed_fifty_move_draw", False)

    # These need the game instance itself (self-referencing helpers)
    from dongson_engine import MoveValidator, SpecialMoveHandler, EndgameDetector
    g.validator = MoveValidator(g)
    g.special = SpecialMoveHandler(g)
    g.endgame = EndgameDetector(g)

    def as_tuple(value):
        return tuple(as_tuple(item) for item in value) if isinstance(value, list) else value

    g.position_history = [as_tuple(key) for key in data.get("position_history", [])]
    if not g.position_history:
        g.position_history.append(g.position_key())

    return g


@app.post("/save")
@locked_game
def save_game(req: SlotRequest = SlotRequest()):
    data = _serialize_full_game(get_session().game)
    with open(_save_path(req.slot), "w") as f:
        json.dump(data, f)
    return {"success": True}


@app.post("/load")
@locked_game
def load_game(req: SlotRequest = SlotRequest()):
    require_active(req)

    path = _save_path(req.slot)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"No save in slot {req.slot}")

    with open(path) as f:
        data = json.load(f)

    get_session().game = _deserialize_full_game(data)
    get_session().redo_stack = []
    get_session().resigned_winner = data.get("resigned_winner")

    return changed_state()


# --------------------------------------------------------------------------- #
# Resign
# --------------------------------------------------------------------------- #

@app.post("/resign")
@locked_game
def resign(req: StateRequest = StateRequest()):
    require_active(req)
    # The side to move resigns; the other side wins.
    get_session().resigned_winner = get_session().game.turn.opposite().value
    return changed_state()


# --------------------------------------------------------------------------- #
# Draw offer
# --------------------------------------------------------------------------- #

@app.post("/draw")
@locked_game
def offer_draw(req: DrawRequest = DrawRequest()):
    require_active(req)
    color = req.color or get_session().game.turn
    if req.action == "offer":
        success = get_session().game.offer_draw(color)
        accepted = False
    elif req.action in ("accept", "decline"):
        if req.color is None:
            raise HTTPException(status_code=400, detail="Acceptance requires the responding color")
        success = get_session().game.accept_draw(color) if req.action == "accept" else get_session().game.decline_draw(color)
        accepted = success and req.action == "accept"
    else:
        success = get_session().game.claim_fifty_move_draw(color)
        accepted = success
    if not success:
        raise HTTPException(status_code=409, detail="Draw conditions are not satisfied")
    return {
        "accepted": accepted,
        "pending": get_session().game.draw_offer_pending is not None,
        "state": changed_state(),
    }


# --------------------------------------------------------------------------- #
# Config (accepted, currently a no-op — see module docstring)
# --------------------------------------------------------------------------- #

@app.post("/config")
@locked_game
def update_config(req: ConfigRequest = ConfigRequest()):
    require_active(req)
    return current_state()


# --------------------------------------------------------------------------- #
# Replay (read-only board snapshot for a past position)
# --------------------------------------------------------------------------- #

@app.post("/replay")
@locked_game
def replay(req: ReplayRequest):
    if req.step < 0 or req.step >= len(get_session().game.history):
        raise HTTPException(status_code=400, detail="step out of range")

    board_snapshot = get_session().game.history[req.step].board_before
    return ser.serialize_board_snapshot(board_snapshot)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _parse_square_or_400(square: str):
    try:
        col = "abcdefghk".index(square[0])
        row = int(square[1:]) - 1
        if not (0 <= row < 9):
            raise ValueError
        return (row, col)
    except (IndexError, ValueError):
        raise HTTPException(status_code=400, detail=f"Invalid square: {square!r}")
