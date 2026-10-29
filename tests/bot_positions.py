"""Valid positions where every bot option is a capture with promotion."""
from dongson_engine import Board, Color, DongSonGame, Piece, PieceType


def promotion_capture(color):
    game = DongSonGame()
    game.board = Board(empty=True)
    pieces = {
        (0, 0): (Color.THUY, PieceType.THAN),
        (2, 2): (Color.SON, PieceType.THAN),
        (0, 1): (Color.THUY, PieceType.BO),
        (1, 1): (Color.SON, PieceType.LAC),
        (8, 0): (Color.SON, PieceType.DINH),
        (8, 1): (Color.SON, PieceType.DINH),
        **{(row, 0): (Color.THUY, PieceType.BO) for row in range(1, 8)},
    }
    for pos, (side, kind) in pieces.items():
        if color == "son":
            pos, side = (8 - pos[0], 8 - pos[1]), side.opposite()
        game.board.set(pos, Piece(side, kind, has_moved=True))
    game.turn = Color(color)
    game.position_history = [game.position_key()]
    return game
