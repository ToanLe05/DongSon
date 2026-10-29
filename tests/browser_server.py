"""Isolated browser-test app. Production server.py does not expose fixture routes."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))
import server
from dongson_engine import Board, Color, Piece, PieceType
from fastapi import Body

app = server.app
DATA = json.loads((Path(__file__).parent / "rule_positions.json").read_text(encoding="utf-8"))


@app.post("/__test__/position")
def set_position(data: dict = Body(...)):
    with server.game_lock:
        server.reset_game()
        kind = data.get("kind", "standard")
        if kind == "standard":
            server.started = False
            return server.current_state()
        pieces = dict(DATA["base"])
        turn = data.get("color", "thuy")
        if kind == "promotion":
            if turn == "thuy":
                pieces.update(a8={"color": "thuy", "type": data.get("piece", "Bo")},
                              h8={"color": "son", "type": "Dinh"})
            else:
                pieces.update(a1=None, k1={"color": "thuy", "type": "Than"},
                              a2={"color": "son", "type": data.get("piece", "Bo")})
            if data.get("capture"):
                target = "b9" if turn == "thuy" else "b1"
                pieces[target] = {"color": Color(turn).opposite().value, "type": "Dinh"}
        elif kind == "fifty":
            server.game.halfmove_clock = 100
        elif kind == "scenario":
            scenario = data["scenario"]
            if scenario in ("tribute", "tribute-blocked", "mate"):
                name = {"tribute": "tribute-safe", "tribute-blocked": "tribute-gift-capturable",
                        "mate": "tribute-mate-next"}[scenario]
                case = next(case for case in DATA["cases"] if case["id"] == name)
                pieces.update(case["pieces"])
                turn = case["turn"]
                if scenario != "mate":
                    pieces.update(e5=None, e3={"color": "thuy", "type": "Than", "has_moved": True})
                    turn = "thuy"
            elif scenario == "material":
                pieces["a7"] = {"color": "thuy", "type": "Lac"}
            elif scenario == "stalemate":
                case = next(case for case in DATA["cases"] if case["id"] == "stalemate-escape")
                pieces.update(case["pieces"])
                pieces.update(
                    e3={"color": "son", "type": "Voi"},
                    e5={"color": "thuy", "type": "Ngua", "frozen": True, "entered_palace": True},
                )
                turn = "son"
            elif scenario == "fifty":
                server.game.halfmove_clock = 99
            elif scenario == "repetition":
                pass
            elif scenario in ("frozen-knight", "frozen-promoted-ga", "palace"):
                name, piece_type = {"frozen-knight": ("d3", "Ngua"),
                                    "frozen-promoted-ga": ("e3", "Ga"),
                                    "palace": ("d4", "Voi")}[scenario]
                pieces[name] = {"color": "thuy", "type": piece_type,
                                "promoted": scenario == "frozen-promoted-ga"}
            elif scenario in ("swap", "check"):
                pieces = {
                    f"{'abcdefghk'[c]}{r + 1}": {
                        "color": p.color.value, "type": p.type.value, "has_moved": p.has_moved,
                    } for (r, c), p in server.game.board.all_pieces()
                }
                if scenario == "swap":
                    rank = "9" if turn == "son" else "1"
                    pieces.update({f"c{rank}": None, f"d{rank}": None})
                else:
                    pieces.update(e2=None, a9=None, a4={"color": "son", "type": "Lac"})
                    turn = "son"
            else:
                raise ValueError(f"Unknown test scenario: {scenario}")
        elif kind == "terminal":
            name = data["case"]
            case = next(case for case in DATA["cases"] if case["id"] == name)
            pieces.update(case["pieces"])
            turn = case["turn"]
        server.game.board = Board(empty=True)
        for name, info in pieces.items():
            if info:
                square = int(name[1:]) - 1, "abcdefghk".index(name[0])
                server.game.board.set(square, Piece(
                    Color(info["color"]), PieceType(info["type"]),
                    **{key: value for key, value in info.items() if key not in ("color", "type")}
                ))
        if data.get("mirror"):
            mirrored = Board(empty=True)
            for (r, c), piece in server.game.board.all_pieces():
                piece.color = piece.color.opposite()
                mirrored.set((8 - r, c), piece)
            server.game.board = mirrored
            turn = Color(turn).opposite().value
        server.game.turn = Color(turn)
        server.game.moves_played = 2
        server.game.position_history = [server.game.position_key()]
        return server.current_state()
