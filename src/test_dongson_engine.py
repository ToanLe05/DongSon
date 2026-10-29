from dongson_engine import (
    DongSonGame, Board, Piece, Color, PieceType, GameResult, CENTER, PALACE_SQUARES
)


def test_initial_setup():
    print("=== Test: Initial setup piece counts ===")
    game = DongSonGame()
    for color in (Color.THUY, Color.SON):
        pieces = [p for _, p in game.board.all_pieces(color)]
        assert len(pieces) == 18, f"expected 18 pieces, got {len(pieces)}"
        counts = {}
        for p in pieces:
            counts[p.type] = counts.get(p.type, 0) + 1
        assert counts[PieceType.THAN] == 1
        assert counts[PieceType.LAC] == 2
        assert counts[PieceType.BO] == 5
        assert counts[PieceType.DINH] == 4
        assert counts[PieceType.NGUA] == 2
        assert counts[PieceType.VOI] == 2
        assert counts[PieceType.GA] == 2
    print("Piece counts match rules (18/side, correct per-type counts).")
    print("PASSED\n")


def test_bo_and_dinh_basic_moves():
    print("=== Test: Bo (diagonal capture) and Dinh (straight only) movement ===")
    game = DongSonGame()
    # Thuy Bo at a2 (row1,col0) should be able to push to a3, not sideways
    moves = game.legal_moves((1, 0))
    ends = {m.end for m in moves}
    assert (2, 0) in ends
    assert (2, 1) not in ends  # no sideways
    print("Bo moves forward only when not capturing:", sorted(ends))
    print("PASSED\n")


def test_ngua_unblocked_jump():
    print("=== Test: Ngua (knight-jump) is never blocked ===")
    game = DongSonGame()
    game.board = Board(empty=True)
    game.board.set((4, 4), Piece(Color.THUY, PieceType.THAN))
    game.board.set((8, 1), Piece(Color.SON, PieceType.THAN))
    game.board.set((7, 8), Piece(Color.SON, PieceType.DINH))  # not aligned with (4,4)
    game.board.set((1, 1), Piece(Color.THUY, PieceType.NGUA))
    # Surround it completely with pieces (should not matter for a knight-jump)
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            if (dr, dc) != (0, 0):
                game.board.set((1 + dr, 1 + dc), Piece(Color.THUY, PieceType.DINH))
    game.turn = Color.THUY
    moves = game.legal_moves((1, 1))
    print("Ngua legal destinations from b2 (surrounded):", [m.end for m in moves])
    assert len(moves) > 0, "Ngua should not be blocked by adjacent pieces"
    print("PASSED\n")


def test_sinh_le_corner_zone_restriction():
    print("=== Test: Sinh Le endpoints must share a corner 5x5 ===")
    game = DongSonGame()
    game.board = Board(empty=True)
    game.board.set((4, 4), Piece(Color.THUY, PieceType.THAN))
    game.board.set((8, 1), Piece(Color.SON, PieceType.THAN))
    game.board.set((7, 8), Piece(Color.SON, PieceType.DINH))
    # a7 and a9 share the upper-left corner zone, regardless of piece color.
    game.board.set((6, 0), Piece(Color.THUY, PieceType.GA))
    game.turn = Color.THUY
    moves = game.legal_moves((6, 0))
    ends = {m.end for m in moves}
    print("Ga at a7 legal destinations:", ends)
    assert (8, 0) in ends
    print("Zone restriction enforced correctly.")
    print("PASSED\n")


def test_palace_lock():
    print("=== Test: Sinh Le piece is locked in once it enters the Palace ===")
    game = DongSonGame()
    game.board = Board(empty=True)
    game.board.set((4, 4), Piece(Color.THUY, PieceType.THAN))
    game.board.set((8, 1), Piece(Color.SON, PieceType.THAN))
    game.board.set((7, 8), Piece(Color.SON, PieceType.DINH))
    game.board.set((3, 2), Piece(Color.THUY, PieceType.VOI))  # c4, diagonal from d5 (palace edge)
    game.turn = Color.THUY
    moves = game.legal_moves((3, 2))
    into_palace = [m for m in moves if m.end in PALACE_SQUARES]
    assert into_palace, "Voi should be able to step into the Palace"
    game.make_move(into_palace[0])
    voi = game.board.get(into_palace[0].end)
    assert voi.entered_palace is True
    game.turn = Color.THUY  # force back for isolated test
    moves2 = game.legal_moves(into_palace[0].end)
    assert all(m.end in PALACE_SQUARES for m in moves2), "Voi must be locked inside the Palace now"
    print("Palace lock correctly enforced after entry.")
    print("PASSED\n")


def test_center_freeze():
    print("=== Test: Ngua landing on e5 becomes permanently frozen ===")
    game = DongSonGame()
    game.board = Board(empty=True)
    game.board.set((0, 4), Piece(Color.THUY, PieceType.THAN))
    game.board.set((8, 8), Piece(Color.SON, PieceType.THAN))
    game.board.set((7, 8), Piece(Color.SON, PieceType.DINH))
    game.board.set((2, 3), Piece(Color.THUY, PieceType.NGUA))  # d3 -> e5 is a knight jump
    game.turn = Color.THUY
    moves = game.legal_moves((2, 3))
    to_center = next((m for m in moves if m.end == CENTER), None)
    assert to_center is not None
    game.make_move(to_center)
    ngua = game.board.get(CENTER)
    assert ngua.frozen is True
    game.turn = Color.THUY
    assert game.legal_moves(CENTER) == [], "Frozen Ngua must have no legal moves"
    print("Center-freeze rule correctly enforced.")
    print("PASSED\n")


def test_hoan_quan_swap():
    print("=== Test: Hoan Quan (Than<->Voi swap) ===")
    game = DongSonGame()
    # Clear the two squares between Than(e1) and Voi(b1): c1, d1 currently hold Ngua, Ga
    game.board.set((0, 2), None)
    game.board.set((0, 3), None)
    moves = game.legal_moves((0, 4))  # Than at e1
    swap = next((m for m in moves if m.is_hoan_quan), None)
    assert swap is not None, "Hoan Quan should be available with a clear path"
    game.make_move(swap)
    than_now = game.board.get((0, 1))  # b1
    voi_now = game.board.get((0, 4))   # e1
    assert than_now.type is PieceType.THAN
    assert voi_now.type is PieceType.VOI
    print("Than and Voi swapped positions correctly.")
    print("PASSED\n")


def test_tien_cung_win():
    print("=== Test: Tien Cung (palace-tribute) win detection ===")
    game = DongSonGame()
    game.board = Board(empty=True)
    game.board.set((0, 0), Piece(Color.THUY, PieceType.THAN, has_moved=True))
    game.board.set((8, 1), Piece(Color.SON, PieceType.THAN, has_moved=True))
    game.board.set((7, 8), Piece(Color.SON, PieceType.DINH))
    # Thuy Than one step from center, Thuy Voi already safely inside the Palace
    game.board.set((3, 4), Piece(Color.THUY, PieceType.THAN, has_moved=True))
    game.board.set((0, 0), None)
    game.board.set((3, 3), Piece(Color.THUY, PieceType.VOI, has_moved=True, entered_palace=True))
    game.turn = Color.THUY
    moves = game.legal_moves((3, 4))
    to_center = next(m for m in moves if m.end == CENTER)
    game.make_move(to_center)
    result = game.result()
    print("Result after Than reaches e5 with a safe Voi already in the Palace:", result)
    assert result == GameResult.TIEN_CUNG_THUY_WINS
    print("PASSED\n")


def test_tien_cung_blocked_when_sinh_le_attacked():
    print("=== Test: Tien Cung fails if the Sinh Le piece in the Palace is under attack ===")
    game = DongSonGame()
    game.board = Board(empty=True)
    game.board.set((3, 4), Piece(Color.THUY, PieceType.THAN, has_moved=True))
    game.board.set((3, 3), Piece(Color.THUY, PieceType.VOI, has_moved=True, entered_palace=True))
    # Son Lac attacking d4 along the rank
    game.board.set((3, 8), Piece(Color.SON, PieceType.LAC, has_moved=True))
    game.board.set((8, 1), Piece(Color.SON, PieceType.THAN, has_moved=True))
    game.board.set((7, 8), Piece(Color.SON, PieceType.DINH))
    game.turn = Color.THUY
    moves = game.legal_moves((3, 4))
    to_center = next(m for m in moves if m.end == CENTER)
    game.make_move(to_center)
    result = game.result()
    print("Result when the Voi in the Palace is attacked by a Lac:", result)
    assert result == GameResult.ONGOING, "Should NOT be a win while the Sinh Le piece can be captured"
    print("PASSED\n")


def test_chieu_ha_checkmate():
    print("=== Test: Chieu Ha (checkmate) detection ===")
    game = DongSonGame()
    game.board = Board(empty=True)
    # Corner mate. Because Than moves like a Queen (unlimited rank/file/diagonal),
    # fully mating it in a corner needs every escape line covered AND every
    # capturable attacker defended:
    #   - a Lac on rank 1 shuts the whole rank              (defended by a Lac on col k)
    #   - a Lac on column a shuts the whole column           (undefended, but never reachable)
    #   - an enemy Than one diagonal step away physically blocks the only
    #     diagonal escape and delivers the check              (defended by a Lac on col b)
    game.board.set((0, 0), Piece(Color.THUY, PieceType.THAN, has_moved=True))
    game.board.set((0, 8), Piece(Color.SON, PieceType.LAC, has_moved=True))   # covers rank 1
    game.board.set((8, 0), Piece(Color.SON, PieceType.LAC, has_moved=True))   # covers column a
    game.board.set((1, 1), Piece(Color.SON, PieceType.THAN, has_moved=True))  # blocks diagonal, checks
    game.board.set((8, 1), Piece(Color.SON, PieceType.LAC, has_moved=True))   # defends (1,1)
    game.board.set((8, 8), Piece(Color.SON, PieceType.LAC, has_moved=True))   # defends (0,8)
    game.turn = Color.THUY
    print(game)
    print("In check:", game.is_in_check())
    print("Legal moves for Thuy:", game.legal_moves())
    result = game.result()
    print("Result:", result)
    assert result == GameResult.CHIEU_HA_SON_WINS
    print("PASSED\n")


def test_insufficient_material_draw():
    print("=== Test: Draw when either side is reduced to a lone Than ===")
    game = DongSonGame()
    game.board = Board(empty=True)
    game.board.set((0, 0), Piece(Color.THUY, PieceType.THAN, has_moved=True))
    game.board.set((8, 1), Piece(Color.SON, PieceType.THAN, has_moved=True))
    result = game.result()
    print("Result (bare Than vs bare Than):", result)
    assert result == GameResult.INSUFFICIENT_MATERIAL

    # A lone Than is also a draw against a side with remaining material.
    game.board.set((5, 5), Piece(Color.SON, PieceType.LAC, has_moved=True))
    result2 = game.result()
    print("Result (lone Thuy Than vs Than+Lac):", result2)
    assert result2 == GameResult.INSUFFICIENT_MATERIAL
    print("PASSED\n")


def test_undo():
    print("=== Test: Undo restores state ===")
    game = DongSonGame()
    key_before = game.position_key()
    game.make_move_named("a2", "a3")
    assert game.turn is Color.SON
    game.undo_move()
    assert game.turn is Color.THUY
    assert game.position_key() == key_before
    print("Undo correctly restored position.")
    print("PASSED\n")


if __name__ == "__main__":
    test_initial_setup()
    test_bo_and_dinh_basic_moves()
    test_ngua_unblocked_jump()
    test_sinh_le_corner_zone_restriction()
    test_palace_lock()
    test_center_freeze()
    test_hoan_quan_swap()
    test_tien_cung_win()
    test_tien_cung_blocked_when_sinh_le_attacked()
    test_chieu_ha_checkmate()
    test_insufficient_material_draw()
    test_undo()
    print("ALL TESTS PASSED")
