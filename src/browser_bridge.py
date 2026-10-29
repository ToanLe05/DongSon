"""JSON-only local adapter. Runs unchanged under CPython and Pyodide.

No FastAPI, sockets, JS or browser dependencies belong in the rule layer.
"""
import copy
import json
import re
import uuid
from dataclasses import fields, is_dataclass
from enum import Enum
from datetime import datetime, timezone

from dongson_engine import (Board, Color, DongSonGame, Move, Piece, PieceType,
                           _HistoryEntry, GROUP_SINH_LE, PALACE_SQUARES, CENTER)
import serializers as ser


class RuleError(Exception):
    def __init__(self, status, code, message, state=None):
        self.detail = {"status": status, "code": code, "message": message}
        if state is not None:
            self.detail["state"] = state
        super().__init__(message)


_TYPES = {c.__name__: c for c in (Piece, Move, _HistoryEntry)}
_ENUMS = {c.__name__: c for c in (Color, PieceType)}
_GAME_FIELDS = ("board", "turn", "halfmove_clock", "fullmove_number", "history",
                "position_history", "agreed_draw", "claimed_fifty_move_draw",
                "draw_offer_pending", "moves_played")

MAX_FILE_BYTES = 16 * 1024 * 1024


def validate_saved_session(session):
    """Validate external data and historical board transitions before replacing a game.

    This validates a portable save, not authenticity of competitive play.
    """
    def require(condition):
        if not condition:
            raise ValueError("Inconsistent saved game")

    def integer(value, minimum=0):
        require(type(value) is int and minimum <= value <= 1_000_000_000)

    def coordinate(value):
        require(isinstance(value, tuple) and len(value) == 2
                and all(type(n) is int and 0 <= n < 9 for n in value))

    def piece(p):
        require(isinstance(p, Piece) and isinstance(p.color, Color) and isinstance(p.type, PieceType))
        require(isinstance(p.id, str) and 0 < len(p.id) <= 128)
        require(all(type(getattr(p, flag)) is bool for flag in
                    ("has_moved", "entered_palace", "frozen", "promoted")))
        require(not p.promoted or p.type in GROUP_SINH_LE)

    def board(b):
        require(isinstance(b, Board) and len(b.grid) == 9
                and all(isinstance(row, list) and len(row) == 9 for row in b.grid))
        ids, kings = set(), {color: 0 for color in Color}
        for pos, p in b.all_pieces():
            piece(p)
            require(p.id not in ids)
            ids.add(p.id)
            if p.type is PieceType.THAN:
                kings[p.color] += 1
            require(not p.entered_palace or (p.type in GROUP_SINH_LE and pos in PALACE_SQUARES))
            frozen = pos == CENTER and (p.type is PieceType.NGUA or (p.type is PieceType.GA and p.promoted))
            require(p.frozen == frozen)
            require(p.type not in (PieceType.BO, PieceType.DINH)
                    or pos[0] != (8 if p.color is Color.THUY else 0))
        require(all(n == 1 for n in kings.values()))

    g = session.game
    require(session.started is True and isinstance(session.game_id, str) and 0 < len(session.game_id) <= 128)
    integer(session.revision)
    require(session.resigned_winner in (None, "thuy", "son"))
    require(isinstance(g.turn, Color))
    integer(g.halfmove_clock)
    integer(g.fullmove_number, 1)
    integer(g.moves_played)
    require(type(g.agreed_draw) is bool and type(g.claimed_fifty_move_draw) is bool)
    require(not (g.agreed_draw and g.claimed_fifty_move_draw))
    require(g.draw_offer_pending is None or isinstance(g.draw_offer_pending, Color))
    require(not g.claimed_fifty_move_draw or g.halfmove_clock >= 100)
    require(not (g.agreed_draw or g.claimed_fifty_move_draw) or g.draw_offer_pending is None)
    require(not (g.agreed_draw or g.draw_offer_pending) or g.moves_played >= 2)
    require(g.draw_offer_pending is None or g.draw_offer_pending is g.turn)
    require(isinstance(g.history, list) and len(g.history) <= g.moves_played)
    require(isinstance(g.position_history, list) and len(g.position_history) == len(g.history) + 1)
    board(g.board)
    require(g.position_history[-1] == g.position_key())
    require(not g.validator.is_in_check(g.board, g.turn.opposite()))
    if session.resigned_winner is not None:
        require(session.resigned_winner == g.turn.opposite().value and g.result().value == "ongoing")

    for i, entry in enumerate(g.history):
        require(isinstance(entry, _HistoryEntry) and isinstance(entry.move, Move))
        board(entry.board_before)
        integer(entry.halfmove_clock_before)
        require(entry.draw_offer_before is None or isinstance(entry.draw_offer_before, Color))
        move = entry.move
        coordinate(move.start)
        coordinate(move.end)
        piece(move.piece)
        source = entry.board_before.get(move.start)
        require(source is not None and source.id == move.piece.id
                and source.type is move.piece.type and source.color is move.piece.color)
        require(move.promotion is None or move.promotion in GROUP_SINH_LE)
        require(type(move.is_hoan_quan) is bool)
        if move.captured is not None:
            piece(move.captured)
            coordinate(move.captured_pos)
            captured = entry.board_before.get(move.captured_pos)
            require(captured is not None and captured.id == move.captured.id
                    and captured.color is not source.color and captured.type is not PieceType.THAN)
        else:
            require(move.captured_pos is None)
        if move.is_hoan_quan:
            coordinate(move.hoan_quan_voi_pos)
            voi = entry.board_before.get(move.hoan_quan_voi_pos)
            require(voi is not None and voi.type is PieceType.VOI and voi.color is source.color
                    and source.type is PieceType.THAN and move.hoan_quan_voi_pos == move.end)
        prior = copy.copy(g)
        prior.board, prior.turn = entry.board_before, source.color
        require(g.position_history[i] == prior.position_key())
        after = g.validator._simulate(entry.board_before, move)
        target_board = g.history[i + 1].board_before if i + 1 < len(g.history) else g.board
        require(encode(after) == encode(target_board))
        expected_clock = 0 if source.type in (PieceType.BO, PieceType.DINH) or move.is_capture() else entry.halfmove_clock_before + 1
        next_clock = g.history[i + 1].halfmove_clock_before if i + 1 < len(g.history) else g.halfmove_clock
        require(next_clock == expected_clock)
        next_color = g.history[i + 1].move.piece.color if i + 1 < len(g.history) else g.turn
        require(next_color is source.color.opposite())


def inspect_file(text):
    try:
        if not isinstance(text, str) or len(text.encode("utf-8")) > MAX_FILE_BYTES:
            raise ValueError("File too large")
        data = json.loads(text)
        if data.get("format") != "dongson-game" or type(data.get("version")) is not int or data["version"] != 1:
            raise ValueError("Unsupported file format")
        snapshot = data["snapshot"]
        if type(snapshot.get("schema")) is not int or snapshot["schema"] != 1:
            raise ValueError("Unsupported snapshot")
        candidate = BrowserSession.restore(json.dumps(snapshot))
        validate_saved_session(candidate)
        return candidate
    except (ValueError, TypeError, KeyError, IndexError, AttributeError, RecursionError, OverflowError):
        raise RuleError(422, "invalid_save", "Tệp JSON không hợp lệ, sai phiên bản hoặc dữ liệu ván cờ không nhất quán.") from None


def encode(value):
    if isinstance(value, Enum):
        return {"enum": type(value).__name__, "value": value.value}
    if isinstance(value, Board):
        return {"board": encode(value.grid)}
    if is_dataclass(value):
        return {"type": type(value).__name__, "fields": {f.name: encode(getattr(value, f.name)) for f in fields(value)}}
    if isinstance(value, tuple):
        return {"tuple": [encode(v) for v in value]}
    if isinstance(value, list):
        return [encode(v) for v in value]
    return value


def decode(value):
    if isinstance(value, list):
        return [decode(v) for v in value]
    if not isinstance(value, dict):
        return value
    if "enum" in value:
        return _ENUMS[value["enum"]](value["value"])
    if "tuple" in value:
        return tuple(decode(v) for v in value["tuple"])
    if "board" in value:
        board = Board(empty=True)
        board.grid = decode(value["board"])
        if len(board.grid) != 9 or any(len(row) != 9 for row in board.grid):
            raise ValueError("Invalid board")
        return board
    if "type" in value:
        return _TYPES[value["type"]](**{k: decode(v) for k, v in value["fields"].items()})
    raise ValueError("Invalid snapshot value")


class BrowserSession:
    def __init__(self):
        self.game = DongSonGame()
        self.game_id = str(uuid.uuid4())
        self.revision = 0
        self.started = False
        self.resigned_winner = None
        self.finished_state = None

    def state(self):
        if self.finished_state is not None:
            return copy.deepcopy(self.finished_state)
        state = ser.serialize_state(self.game, self.resigned_winner)
        state.update(gameId=self.game_id, revision=self.revision, started=self.started)
        if state["gameOver"]:
            self.finished_state = copy.deepcopy(state)
        return state

    def current(self, data):
        if data.get("gameId") != self.game_id or data.get("revision") != self.revision:
            raise RuleError(409, "stale_state", "Thế cờ đã thay đổi. Vui lòng thử lại.", self.state())

    def active(self, data):
        if self.state()["gameOver"]:
            raise RuleError(409, "game_over", "Ván cờ đã kết thúc. Hãy chọn Chơi lại.", self.state())
        self.current(data)
        if not self.started:
            raise RuleError(409, "not_started", "Chọn Bắt đầu để chơi.", self.state())

    def changed(self):
        self.revision += 1
        return self.state()

    def checkpoint(self):
        return json.dumps({
            "schema": 1, "gameId": self.game_id, "revision": self.revision,
            "started": self.started, "resignedWinner": self.resigned_winner,
            "game": {key: encode(getattr(self.game, key)) for key in _GAME_FIELDS},
        }, separators=(",", ":"))

    @classmethod
    def restore(cls, snapshot):
        data = json.loads(snapshot)
        if data["schema"] != 1 or set(data["game"]) != set(_GAME_FIELDS):
            raise ValueError("Unsupported saved game")
        session = cls()
        for key in _GAME_FIELDS:
            setattr(session.game, key, decode(data["game"][key]))
        session.game_id, session.revision = data["gameId"], data["revision"]
        session.started, session.resigned_winner = data["started"], data["resignedWinner"]
        session.state()  # Validate before replacing the current session.
        return session

    def dispatch(self, endpoint, data=None):
        data = data or {}
        if endpoint == "/ping":
            return {"ok": True}
        if endpoint == "/state":
            return self.state()
        if endpoint == "/inspect_save":
            candidate = inspect_file(data.get("file"))
            return candidate.state()
        if endpoint == "/export":
            self.current(data)
            if not self.started:
                raise RuleError(409, "not_started", "Hãy bắt đầu hoặc tải một ván trước khi lưu.")
            now = datetime.now(timezone.utc)
            payload = {"format": "dongson-game", "version": 1,
                       "exportedAt": now.isoformat(), "snapshot": json.loads(self.checkpoint())}
            return {"file": json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                    "filename": now.strftime("CoDongSon-%Y%m%d-%H%M%S.json")}
        if endpoint == "/import":
            self.current(data)
            candidate = inspect_file(data.get("file"))
            candidate.game_id, candidate.revision = str(uuid.uuid4()), 0
            candidate.finished_state = None
            self.__dict__.update(candidate.__dict__)
            return self.state()
        if endpoint == "/legal_moves":
            if self.state()["gameOver"]:
                return []
            return ser.serialize_legal_moves(self.game.legal_moves(self.square(data.get("square"))))
        if endpoint == "/new_game":
            self.current(data)
            if self.started and not self.state()["gameOver"]:
                raise RuleError(409, "active_game", "Ván cờ đang diễn ra.", self.state())
            self.__init__()
            self.started = True
            return self.state()
        if endpoint not in ("/move", "/resign", "/draw"):
            raise RuleError(404, "unsupported", "Thao tác không có trong bản chơi hai người.")
        self.active(data)
        if endpoint == "/move":
            source, target = data.get("from"), data.get("to")
            self.square(source)
            self.square(target)
            promotion = {"Ngua": "n", "Voi": "v", "Ga": "g"}.get(data.get("promotion"), data.get("promotion"))
            if promotion not in (None, "n", "v", "g"):
                raise RuleError(422, "invalid_promotion", "Quân phong cấp không hợp lệ.")
            if not self.game.make_move_named(source, target, promotion):
                raise RuleError(400, "illegal_move", "Nước đi không hợp lệ.")
            return self.changed()
        if endpoint == "/resign":
            self.resigned_winner = self.game.turn.opposite().value
            return self.changed()
        action = data.get("action", "offer")
        try:
            color = Color(data["color"]) if data.get("color") else self.game.turn
        except ValueError:
            raise RuleError(422, "invalid_color", "Bên chơi không hợp lệ.") from None
        if action in ("accept", "decline") and not data.get("color"):
            raise RuleError(400, "missing_color", "Cần xác định bên trả lời đề nghị hòa.")
        handlers = {"offer": self.game.offer_draw, "accept": self.game.accept_draw,
                    "decline": self.game.decline_draw, "claim_fifty": self.game.claim_fifty_move_draw}
        if action not in handlers:
            raise RuleError(422, "invalid_action", "Thao tác hòa không hợp lệ.")
        if not handlers[action](color):
            raise RuleError(409, "draw_unavailable", "Chưa đủ điều kiện hòa.")
        return {"accepted": action in ("accept", "claim_fifty"),
                "pending": self.game.draw_offer_pending is not None, "state": self.changed()}

    @staticmethod
    def square(name):
        if not isinstance(name, str) or not re.fullmatch(r"[a-hk][1-9]", name):
            raise RuleError(422, "invalid_square", "Ô cờ không hợp lệ.")
        return int(name[1]) - 1, "abcdefghk".index(name[0])


session = BrowserSession()


def restore_json(snapshot):
    global session
    session = BrowserSession.restore(snapshot) if snapshot else BrowserSession()


def dispatch_json(request):
    try:
        command = json.loads(request)
        return json.dumps({"ok": True, "result": session.dispatch(command["endpoint"], command.get("body"))})
    except RuleError as error:
        return json.dumps({"ok": False, "error": error.detail})


def checkpoint_json():
    return session.checkpoint()
