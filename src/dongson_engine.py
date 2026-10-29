"""
dongson_engine.py
==================
Game engine for "Cờ Đông Sơn" (Đông Sơn Chess), a Vietnamese chess variant.
Rules reference: https://codongson.vn/luat-choi-co-ban/
Executable project contract and interpretation choices: ../RULES.md

------------------------------------------------------------------------------

Board: 9x9. Columns a,b,c,d,e,f,g,h,k (9 letters, no 'i'/'j'). Rows 1-9.
  - row index 0 = rank 1 (Thủy Tinh's back rank)
  - row index 8 = rank 9 (Sơn Tinh's back rank)
  - col index 0..8 = files a..h,k
Palace ("Cung"): the 3x3 block at rows(idx) 3-5, cols(idx) 3-5 (files d,e,f).
Center ("Ô Tâm"): e5 = (row idx 4, col idx 4), the exact center of the board.
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import Optional, List, Tuple, Dict, Set
import copy
import uuid

# --------------------------------------------------------------------------- #
# Enums & piece representation
# --------------------------------------------------------------------------- #

class Color(Enum):
    THUY = "thuy"   # Thủy Tinh — starts at the bottom (rank 1), water-drop symbol
    SON = "son"     # Sơn Tinh — starts at the top (rank 9), triangle symbol

    def opposite(self) -> "Color":
        return Color.SON if self is Color.THUY else Color.THUY

    def forward(self) -> int:
        """Row-index direction this side's pawns/militia advance toward the enemy."""
        return 1 if self is Color.THUY else -1



class PieceType(Enum):
    THAN = "Than"   # Deity/Hallow — moves like a Queen; the piece that must avoid checkmate
    LAC = "Lac"     # Lac General — moves like a Rook
    BO = "Bo"       # Tribe — moves 1 fwd, captures 1 diagonally fwd (pawn-like); promotes
    DINH = "Dinh"   # Militiaman — moves/captures 1 square straight forward only; promotes
    NGUA = "Ngua"   # Quagga — knight-shaped jump, unblocked; Wedgift-group piece
    VOI = "Voi"     # Gomphothere — 1-2 squares diagonal, unblocked; Wedgift-group piece
    GA = "Ga"       # Chincuake — exactly 2 squares orthogonal jump, unblocked; Wedgift-group


PIECE_VALUES = {
    PieceType.THAN: float("inf"),
    PieceType.LAC: 6,
    PieceType.BO: 2,
    PieceType.DINH: 1,
    PieceType.NGUA: 5,
    PieceType.VOI: 4,
    PieceType.GA: 3,
}

# The three groups referenced by the rules text
GROUP_THAN = {PieceType.THAN}
GROUP_CHIEN_DAU = {PieceType.LAC, PieceType.BO, PieceType.DINH}       # "Combat" group
GROUP_SINH_LE = {PieceType.NGUA, PieceType.VOI, PieceType.GA}          # "Wedgift" group


@dataclass
class Piece:
    color: Color
    type: PieceType
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    has_moved: bool = False
    entered_palace: bool = False   # Sính Lễ pieces: True once they've stepped into the Palace
    frozen: bool = False           # True if a Ngựa/promoted-Gà has landed on the center and locked
    promoted: bool = False         # True if this piece resulted from a Bộ/Đinh promotion

    def symbol(self) -> str:
        letter = {
            PieceType.THAN: "T", PieceType.LAC: "L", PieceType.BO: "B",
            PieceType.DINH: "D", PieceType.NGUA: "N", PieceType.VOI: "V", PieceType.GA: "G",
        }[self.type]
        return letter if self.color is Color.THUY else letter.lower()

    def __repr__(self):
        return f"{self.color.value[0]}{self.type.value}"


@dataclass
class Move:
    start: Tuple[int, int]
    end: Tuple[int, int]
    piece: Piece
    captured: Optional[Piece] = None
    captured_pos: Optional[Tuple[int, int]] = None
    promotion: Optional[PieceType] = None       # Sính Lễ type chosen on Bộ/Đinh promotion
    is_hoan_quan: bool = False                  # Than<->Voi swap ("castling")
    hoan_quan_voi_pos: Optional[Tuple[int, int]] = None

    def is_capture(self) -> bool:
        return self.captured is not None

    def square_name(self, pos) -> str:
        files = "abcdefghk"
        r, c = pos
        return f"{files[c]}{r + 1}"

    def notation(self) -> str:
        s = self.square_name(self.start) + self.square_name(self.end)
        if self.promotion:
            s += {"Ngua": "n", "Voi": "v", "Ga": "g"}[self.promotion.value]
        return s

    def __repr__(self):
        return f"<Move {self.notation()} {self.piece}>"


# --------------------------------------------------------------------------- #
# Board
# --------------------------------------------------------------------------- #

FILES = "abcdefghk"          # 9 files, note: no 'i' or 'j'
CENTER = (4, 4)               # e5
PALACE_SQUARES: Set[Tuple[int, int]] = {
    (r, c) for r in range(3, 6) for c in range(3, 6)
}


class Board:
    SIZE = 9

    def __init__(self, empty: bool = False):
        self.grid: List[List[Optional[Piece]]] = [[None] * 9 for _ in range(9)]
        if not empty:
            self.setup_standard_position()

    def setup_standard_position(self):
        """
        Confirmed starting layout (Thuy Tinh side; Son Tinh mirrors it):

            rank 1 (row idx 0): a=Lac b=Voi c=Ngua d=Ga e=Than f=Ga g=Ngua h=Voi k=Lac
            rank 2 (row idx 1): Bo at a, c, e, g, k
            rank 3 (row idx 2): Dinh at b, d, f, h

        Note Bo and Dinh sit on two *separate* ranks (not interleaved on one
        rank as originally assumed). Than is on the center file with Voi
        exactly 3 files away on each side (2 empty squares between them),
        which is what makes Hoan Quan's "2 squares crossed" geometry work.
        """
        back_rank = [
            PieceType.LAC, PieceType.VOI, PieceType.NGUA, PieceType.GA, PieceType.THAN,
            PieceType.GA, PieceType.NGUA, PieceType.VOI, PieceType.LAC,
        ]
        bo_cols = [0, 2, 4, 6, 8]     # a, c, e, g, k
        dinh_cols = [1, 3, 5, 7]      # b, d, f, h

        for col in range(9):
            self.grid[0][col] = Piece(Color.THUY, back_rank[col])
            self.grid[8][col] = Piece(Color.SON, back_rank[col])
        for col in bo_cols:
            self.grid[1][col] = Piece(Color.THUY, PieceType.BO)
            self.grid[7][col] = Piece(Color.SON, PieceType.BO)
        for col in dinh_cols:
            self.grid[2][col] = Piece(Color.THUY, PieceType.DINH)
            self.grid[6][col] = Piece(Color.SON, PieceType.DINH)

    @staticmethod
    def in_bounds(pos: Tuple[int, int]) -> bool:
        r, c = pos
        return 0 <= r < 9 and 0 <= c < 9

    def get(self, pos):
        r, c = pos
        return self.grid[r][c]

    def set(self, pos, piece):
        r, c = pos
        self.grid[r][c] = piece

    def find_than(self, color: Color) -> Optional[Tuple[int, int]]:
        for r in range(9):
            for c in range(9):
                p = self.grid[r][c]
                if p and p.color is color and p.type is PieceType.THAN:
                    return (r, c)
        return None

    def all_pieces(self, color: Optional[Color] = None):
        for r in range(9):
            for c in range(9):
                p = self.grid[r][c]
                if p is not None and (color is None or p.color is color):
                    yield (r, c), p

    def clone(self) -> "Board":
        new_board = Board(empty=True)
        new_board.grid = [[copy.copy(p) if p else None for p in row] for row in self.grid]
        return new_board

    def to_ascii(self) -> str:
        lines = []
        for r in range(8, -1, -1):
            row_str = f"{r + 1:2} "
            for c in range(9):
                p = self.grid[r][c]
                cell = p.symbol() if p else ("." if (r, c) != CENTER else "o")
                row_str += cell + " "
            lines.append(row_str)
        lines.append("   " + " ".join(FILES))
        return "\n".join(lines)


# --------------------------------------------------------------------------- #
# Move generation (pseudo-legal — does not yet check for self-inflicted check)
# --------------------------------------------------------------------------- #

ROOK_DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1)]
BISHOP_DIRS = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
KNIGHT_OFFSETS = [(1, 2), (2, 1), (-1, 2), (-2, 1), (1, -2), (2, -1), (-1, -2), (-2, -1)]


CORNER_ZONES = tuple(
    frozenset((r, c) for r in range(r0, r0 + 5) for c in range(c0, c0 + 5))
    for r0 in (0, 4) for c0 in (0, 4)
)


def sinh_le_allowed_zone(pos, entered_palace: bool) -> Set[Tuple[int, int]]:
    """Both endpoints must share a corner 5x5; a palace occupant cannot leave."""
    if entered_palace or pos in PALACE_SQUARES:
        return set(PALACE_SQUARES)
    return set().union(*(zone for zone in CORNER_ZONES if pos in zone))


class MoveGenerator:

    @staticmethod
    def ray_squares(board: Board, pos, directions):
        r, c = pos
        for dr, dc in directions:
            step = 1
            while Board.in_bounds((r + dr * step, c + dc * step)):
                end = (r + dr * step, c + dc * step)
                yield end
                if board.get(end) is not None:
                    break
                step += 1

    @classmethod
    def attack_squares_for_piece(cls, board: Board, pos) -> Set[Tuple[int, int]]:
        piece = board.get(pos)
        if piece is None or piece.frozen:
            return set()
        r, c = pos
        if piece.type in (PieceType.THAN, PieceType.LAC):
            directions = ROOK_DIRS + BISHOP_DIRS if piece.type is PieceType.THAN else ROOK_DIRS
            return set(cls.ray_squares(board, pos, directions))
        if piece.type is PieceType.BO:
            offsets = [(piece.color.forward(), -1), (piece.color.forward(), 1)]
        elif piece.type is PieceType.DINH:
            offsets = [(piece.color.forward(), 0)]
        elif piece.type is PieceType.NGUA:
            offsets = KNIGHT_OFFSETS
        elif piece.type is PieceType.VOI:
            offsets = [(dr * dist, dc * dist) for dr, dc in BISHOP_DIRS for dist in (1, 2)]
        else:
            offsets = [(dr * 2, dc * 2) for dr, dc in ROOK_DIRS]
        targets = {(r + dr, c + dc) for dr, dc in offsets if Board.in_bounds((r + dr, c + dc))}
        if piece.type in GROUP_SINH_LE:
            targets &= sinh_le_allowed_zone(pos, piece.entered_palace)
        return targets

    @classmethod
    def jumping_moves(cls, board: Board, pos, piece: Piece) -> List[Move]:
        moves = []
        for end in sorted(cls.attack_squares_for_piece(board, pos)):
            target = board.get(end)
            if target is None or target.color is not piece.color:
                moves.append(Move(pos, end, piece, target, end if target else None))
        return moves

    @staticmethod
    def bo_moves(board: Board, pos, piece: Piece) -> List[Move]:
        """Tribe: 1 step straight forward (if empty); captures 1 step diagonally forward."""
        r, c = pos
        d = piece.color.forward()
        far_rank = 8 if piece.color is Color.THUY else 0
        moves = []

        def add(end, captured=None):
            r2, _ = end
            if r2 == far_rank:
                for promo in (PieceType.VOI, PieceType.GA, PieceType.NGUA):
                    moves.append(Move(pos, end, piece, captured, end if captured else None,
                                       promotion=promo))
            else:
                moves.append(Move(pos, end, piece, captured, end if captured else None))

        fwd = (r + d, c)
        if Board.in_bounds(fwd) and board.get(fwd) is None:
            add(fwd)
        for dc in (-1, 1):
            cap = (r + d, c + dc)
            if Board.in_bounds(cap):
                target = board.get(cap)
                if target is not None and target.color is not piece.color:
                    add(cap, captured=target)
        return moves

    @staticmethod
    def dinh_moves(board: Board, pos, piece: Piece) -> List[Move]:
        """Militiaman: exactly 1 step straight forward; captures the same way (no diagonal)."""
        r, c = pos
        d = piece.color.forward()
        far_rank = 8 if piece.color is Color.THUY else 0
        end = (r + d, c)
        if not Board.in_bounds(end):
            return []
        target = board.get(end)
        if target is not None and target.color is piece.color:
            return []
        moves = []
        if end[0] == far_rank:
            for promo in (PieceType.VOI, PieceType.GA, PieceType.NGUA):
                moves.append(Move(pos, end, piece, target, end if target else None, promotion=promo))
        else:
            moves.append(Move(pos, end, piece, target, end if target else None))
        return moves

    @classmethod
    def sliding_moves(cls, board: Board, pos, piece: Piece, directions) -> List[Move]:
        moves = []
        for end in cls.ray_squares(board, pos, directions):
            target = board.get(end)
            if target is None or target.color is not piece.color:
                moves.append(Move(pos, end, piece, target, end if target else None))
        return moves

    ngua_moves = jumping_moves
    voi_moves = jumping_moves
    ga_moves = jumping_moves

    @classmethod
    def than_moves(cls, board, pos, piece):
        return cls.sliding_moves(board, pos, piece, ROOK_DIRS + BISHOP_DIRS)

    @classmethod
    def lac_moves(cls, board, pos, piece):
        return cls.sliding_moves(board, pos, piece, ROOK_DIRS)

    @classmethod
    def pseudo_legal_moves_for_piece(cls, board: Board, pos) -> List[Move]:
        piece = board.get(pos)
        if piece is None:
            return []
        dispatch = {
            PieceType.THAN: cls.than_moves,
            PieceType.LAC: cls.lac_moves,
            PieceType.BO: cls.bo_moves,
            PieceType.DINH: cls.dinh_moves,
            PieceType.NGUA: cls.ngua_moves,
            PieceType.VOI: cls.voi_moves,
            PieceType.GA: cls.ga_moves,
        }
        return dispatch[piece.type](board, pos, piece)


# --------------------------------------------------------------------------- #
# Move validation: attack detection, check, legality filtering, Hoan Quan
# --------------------------------------------------------------------------- #

class MoveValidator:
    def __init__(self, game: "DongSonGame"):
        self.game = game

    def is_square_attacked(self, board: Board, pos, by_color: Color) -> bool:
        """Geometric control, including defended friendly endpoints and pinned pieces.

        It uses the same shape, blocking, zone, palace and frozen rules as moves.
        Own-Than safety is applied separately to legal moves, not recursively here.
        """
        return any(
            pos in MoveGenerator.attack_squares_for_piece(board, source)
            for source, _ in board.all_pieces(by_color)
        )

    def is_in_check(self, board: Board, color: Color) -> bool:
        than_pos = board.find_than(color)
        if than_pos is None:
            return False
        return self.is_square_attacked(board, than_pos, color.opposite())

    def _simulate(self, board: Board, move: Move) -> Board:
        new_board = board.clone()
        self.game.special.apply_move_to_board(new_board, move)
        return new_board

    def leaves_own_than_in_check(self, board: Board, move: Move) -> bool:
        simulated = self._simulate(board, move)
        return self.is_in_check(simulated, move.piece.color)

    def generate_pseudo_legal_moves(self, board: Board, color: Color) -> List[Move]:
        moves = []
        for pos, piece in board.all_pieces(color):
            moves.extend(MoveGenerator.pseudo_legal_moves_for_piece(board, pos))
        moves.extend(self.generate_hoan_quan_moves(board, color))
        return moves

    def generate_legal_moves(self, board: Board, color: Color) -> List[Move]:
        pseudo = self.generate_pseudo_legal_moves(board, color)
        return [
            m for m in pseudo
            if not (m.captured and m.captured.type is PieceType.THAN)
            and not self.leaves_own_than_in_check(board, m)
        ]

    def legal_moves_from(self, board: Board, color: Color, pos) -> List[Move]:
        return [m for m in self.generate_legal_moves(board, color) if m.start == pos]

    # -- Hoan Quan (Than <-> Voi swap) --------------------------------------- #

    def generate_hoan_quan_moves(self, board: Board, color: Color) -> List[Move]:
        """
        Conditions (per rules text):
          1) Must be the first move ever for BOTH Than and that Voi (has_moved False on both)
          2) No piece stands between them
          3) None of the 4 squares involved (Than sq, 2 crossed squares, Voi sq) are attacked
        """
        moves = []
        back_row = 0 if color is Color.THUY else 8
        than_pos = (back_row, 4)
        than = board.get(than_pos)
        if than is None or than.type is not PieceType.THAN or than.color is not color or than.has_moved:
            return moves
        enemy = color.opposite()

        for voi_col in (1, 7):  # b and h
            voi_pos = (back_row, voi_col)
            voi = board.get(voi_pos)
            if voi is None or voi.type is not PieceType.VOI or voi.color is not color or voi.has_moved:
                continue
            lo, hi = sorted([voi_col, 4])
            between = [(back_row, c) for c in range(lo + 1, hi)]
            if any(board.get(sq) is not None for sq in between):
                continue
            squares_to_check = [than_pos, voi_pos] + between
            if any(self.is_square_attacked(board, sq, enemy) for sq in squares_to_check):
                continue
            moves.append(Move(than_pos, voi_pos, than, is_hoan_quan=True, hoan_quan_voi_pos=voi_pos))
        return moves


# --------------------------------------------------------------------------- #
# Special move handling
# --------------------------------------------------------------------------- #

class SpecialMoveHandler:
    def __init__(self, game: "DongSonGame"):
        self.game = game

    def apply_move_to_board(self, board: Board, move: Move):
        if move.is_hoan_quan:
            than = board.get(move.start)
            voi = board.get(move.hoan_quan_voi_pos)
            board.set(move.start, voi)
            board.set(move.hoan_quan_voi_pos, than)
            than.has_moved = True
            voi.has_moved = True
            return

        piece = board.get(move.start)

        if move.captured is not None and move.captured_pos is not None:
            board.set(move.captured_pos, None)

        board.set(move.start, None)
        moved = copy.copy(piece)
        moved.has_moved = True

        if move.promotion is not None:
            moved.type = move.promotion
            moved.promoted = True

        # Wedgift-group palace lock: entering a Palace square locks the piece in
        if moved.type in GROUP_SINH_LE and move.end in PALACE_SQUARES:
            moved.entered_palace = True

        # Center-freeze rule: a Ngua, or a *promoted* Ga, landing on e5 becomes
        # permanently immobile (and thereby blocks its own side's Tien Cung,
        # since the center square can no longer be vacated voluntarily).
        if move.end == CENTER and (
            moved.type is PieceType.NGUA or (moved.type is PieceType.GA and moved.promoted)
        ):
            moved.frozen = True

        board.set(move.end, moved)

    def promotion_needed(self, move: Move) -> bool:
        return move.piece.type in (PieceType.BO, PieceType.DINH) and move.promotion is not None


# --------------------------------------------------------------------------- #
# Endgame detection
# --------------------------------------------------------------------------- #

class GameResult(Enum):
    ONGOING = "ongoing"
    CHIEU_HA_THUY_WINS = "chieu_ha_thuy_wins"       # Thuy checkmates Son
    CHIEU_HA_SON_WINS = "chieu_ha_son_wins"
    TIEN_CUNG_THUY_WINS = "tien_cung_thuy_wins"     # Thuy completes the palace tribute
    TIEN_CUNG_SON_WINS = "tien_cung_son_wins"
    STALEMATE = "draw_stalemate"
    INSUFFICIENT_MATERIAL = "draw_insufficient_material"
    FIFTY_MOVE_RULE = "draw_fifty_move_rule"
    THREEFOLD_REPETITION = "draw_threefold_repetition"
    AGREED_DRAW = "draw_by_agreement"


class EndgameDetector:
    def __init__(self, game: "DongSonGame"):
        self.game = game

    # -- Chieu Ha (checkmate) ------------------------------------------------ #

    def is_chieu_ha(self, board: Board, color: Color) -> bool:
        if not self.game.validator.is_in_check(board, color):
            return False
        return len(self.game.validator.generate_legal_moves(board, color)) == 0

    def is_stalemate(self, board: Board, color: Color) -> bool:
        if self.game.validator.is_in_check(board, color):
            return False
        return len(self.game.validator.generate_legal_moves(board, color)) == 0

    # -- Tien Cung (palace tribute win) -------------------------------------- #

    def check_tien_cung(self, board: Board, color: Color) -> bool:
        """Safe e5, at least one gift immune to legal capture, no mate in one reply."""
        than_pos = board.find_than(color)
        if than_pos != CENTER:
            return False

        sinh_le_in_palace = [
            pos for pos, piece in board.all_pieces(color)
            if piece.type in GROUP_SINH_LE and pos in PALACE_SQUARES and pos != CENTER
        ]
        if not sinh_le_in_palace:
            return False

        enemy = color.opposite()
        if self.game.validator.is_square_attacked(board, than_pos, enemy):
            return False  # Than currently in check -> not a confirmed Tien Cung

        replies = self.game.validator.generate_legal_moves(board, enemy)
        capturable = {move.captured_pos for move in replies if move.is_capture()}
        if not any(pos not in capturable for pos in sinh_le_in_palace):
            return False

        for reply in replies:
            after_reply = self.game.validator._simulate(board, reply)
            if self.is_chieu_ha(after_reply, color):
                return False
        return True

    # -- Draws ---------------------------------------------------------------- #

    def is_insufficient_material(self, board: Board) -> bool:
        """Either side reduced to a lone Than is a draw; wins take precedence.

        Other material combinations are not guessed from piece values.
        """
        return any(
            [p.type for _, p in board.all_pieces(color)] == [PieceType.THAN]
            for color in (Color.THUY, Color.SON)
        )

    def is_fifty_move_draw(self) -> bool:
        return self.game.halfmove_clock >= 100  # 50 moves/side without a Bo/Dinh move or capture

    def is_threefold_repetition(self) -> bool:
        current_key = self.game.position_key()
        return sum(1 for k in self.game.position_history if k == current_key) >= 3

    # -- Aggregate result ------------------------------------------------------ #

    def get_result(self) -> GameResult:
        if self.game.agreed_draw:
            return GameResult.AGREED_DRAW
        board = self.game.board
        mover = self.game.turn.opposite()   # the side that just completed a move
        to_move = self.game.turn            # the side about to move

        if self.check_tien_cung(board, mover):
            return GameResult.TIEN_CUNG_THUY_WINS if mover is Color.THUY else GameResult.TIEN_CUNG_SON_WINS

        if self.is_chieu_ha(board, to_move):
            return GameResult.CHIEU_HA_THUY_WINS if mover is Color.THUY else GameResult.CHIEU_HA_SON_WINS

        if self.is_stalemate(board, to_move):
            return GameResult.STALEMATE

        if self.is_insufficient_material(board):
            return GameResult.INSUFFICIENT_MATERIAL

        if self.game.claimed_fifty_move_draw:
            return GameResult.FIFTY_MOVE_RULE

        if self.is_threefold_repetition():
            return GameResult.THREEFOLD_REPETITION

        return GameResult.ONGOING


# --------------------------------------------------------------------------- #
# DongSonGame: top-level orchestrator
# --------------------------------------------------------------------------- #

@dataclass
class _HistoryEntry:
    move: Move
    halfmove_clock_before: int
    board_before: Board
    draw_offer_before: Optional[Color]


class DongSonGame:
    def __init__(self):
        self.board = Board()
        self.turn = Color.THUY   # "Đấu thủ cầm quân Thủy thực hiện nước đi trước"
        self.halfmove_clock = 0
        self.fullmove_number = 1
        self.history: List[_HistoryEntry] = []
        self.position_history: List[tuple] = []
        self.agreed_draw = False
        self.claimed_fifty_move_draw = False
        self.draw_offer_pending: Optional[Color] = None
        self.moves_played = 0  # used to enforce "each side must move at least once" for agreed draws

        self.validator = MoveValidator(self)
        self.special = SpecialMoveHandler(self)
        self.endgame = EndgameDetector(self)

        self.position_history.append(self.position_key())

    def position_key(self) -> tuple:
        board_state = tuple(
            tuple(
                (p.color.value, p.type.value, p.entered_palace, p.frozen, p.promoted) if p else None
                for p in row
            )
            for row in self.board.grid
        )
        rights = []
        for color, row in ((Color.THUY, 0), (Color.SON, 8)):
            than = self.board.get((row, 4))
            for col in (1, 7):
                voi = self.board.get((row, col))
                rights.append(bool(
                    than and than.color is color and than.type is PieceType.THAN and not than.has_moved
                    and voi and voi.color is color and voi.type is PieceType.VOI and not voi.has_moved
                ))
        return (board_state, self.turn.value, tuple(rights))

    def legal_moves(self, pos: Optional[Tuple[int, int]] = None) -> List[Move]:
        if pos is not None:
            return self.validator.legal_moves_from(self.board, self.turn, pos)
        return self.validator.generate_legal_moves(self.board, self.turn)

    def is_in_check(self, color: Optional[Color] = None) -> bool:
        return self.validator.is_in_check(self.board, color or self.turn)

    def make_move(self, move: Move) -> bool:
        if self.is_game_over():
            return False
        legal = self.legal_moves(move.start)
        match = next((m for m in legal if m.end == move.end
                      and m.promotion == move.promotion
                      and m.is_hoan_quan == move.is_hoan_quan), None)
        if match is None:
            return False

        self.history.append(_HistoryEntry(
            move=match,
            halfmove_clock_before=self.halfmove_clock,
            board_before=self.board.clone(),
            draw_offer_before=self.draw_offer_pending,
        ))

        self.special.apply_move_to_board(self.board, match)

        if match.piece.type in (PieceType.BO, PieceType.DINH) or match.is_capture():
            self.halfmove_clock = 0
        else:
            self.halfmove_clock += 1

        if self.turn is Color.SON:
            self.fullmove_number += 1
        self.turn = self.turn.opposite()
        self.moves_played += 1
        self.draw_offer_pending = None

        self.position_history.append(self.position_key())
        return True

    def make_move_named(self, start_sq: str, end_sq: str, promotion: Optional[str] = None) -> bool:
        """Convenience: e.g. make_move_named('a2','a3') or ('a8','a9','v') for promotion to Voi."""
        def parse(sq):
            col = FILES.index(sq[0])
            row = int(sq[1:]) - 1
            return (row, col)

        start, end = parse(start_sq), parse(end_sq)
        promo_map = {"n": PieceType.NGUA, "v": PieceType.VOI, "g": PieceType.GA}
        promo = promo_map[promotion.lower()] if promotion else None
        candidates = self.legal_moves(start)
        target = next((m for m in candidates if m.end == end and m.promotion == promo), None)
        if target is None:
            return False
        return self.make_move(target)

    def undo_move(self) -> bool:
        if not self.history:
            return False
        entry = self.history.pop()
        self.board = entry.board_before
        self.draw_offer_pending = entry.draw_offer_before
        self.agreed_draw = False
        self.claimed_fifty_move_draw = False
        self.halfmove_clock = entry.halfmove_clock_before
        if self.turn is Color.THUY:
            self.fullmove_number -= 1
        self.turn = self.turn.opposite()
        self.moves_played -= 1
        self.position_history.pop()
        return True

    # -- draw offers ------------------------------------------------------------ #

    def offer_draw(self, color: Color) -> bool:
        if color is not self.turn or self.moves_played < 2 or self.is_game_over():
            return False
        self.draw_offer_pending = color
        return True

    def accept_draw(self, color: Optional[Color] = None) -> bool:
        if color is None or self.moves_played < 2 or self.is_game_over():
            return False
        if self.draw_offer_pending is None or color is not self.draw_offer_pending.opposite():
            return False
        self.agreed_draw = True
        self.draw_offer_pending = None
        return True

    def decline_draw(self, color: Color) -> bool:
        if self.is_game_over() or self.draw_offer_pending is None:
            return False
        if color is not self.draw_offer_pending.opposite():
            return False
        self.draw_offer_pending = None
        return True

    def claim_fifty_move_draw(self, color: Color) -> bool:
        if color is not self.turn or self.is_game_over() or not self.endgame.is_fifty_move_draw():
            return False
        self.claimed_fifty_move_draw = True
        self.draw_offer_pending = None
        return True

    # -- endgame convenience ------------------------------------------------- #

    def result(self) -> GameResult:
        return self.endgame.get_result()

    def is_game_over(self) -> bool:
        return self.result() is not GameResult.ONGOING

    def __repr__(self):
        return self.board.to_ascii() + f"\n{self.turn.value} to move (move {self.fullmove_number})"
