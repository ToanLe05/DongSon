"""Build local-save fixtures using the existing isolated scenario definitions."""
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(root / "src"), str(root / "tests")]
import browser_server
from browser_bridge import BrowserSession
from bot_positions import promotion_capture

cases = {
    "promotion-thuy": {"kind": "promotion", "color": "thuy"},
    "promotion-son": {"kind": "promotion", "color": "son"},
    "fifty": {"kind": "scenario", "scenario": "fifty"},
}
for name in ("tribute", "mate", "material", "stalemate", "repetition", "frozen-knight", "frozen-promoted-ga", "palace", "swap"):
    cases[name] = {"kind": "scenario", "scenario": name}
fixtures = {}
for name, setup in cases.items():
    browser_server.set_position(setup)
    session = BrowserSession()
    session.game = browser_server.server.game
    session.started = True
    fixtures[name] = {"snapshot": session.checkpoint(), "state": session.state()}
for side in ("thuy", "son"):
    session = BrowserSession()
    def context(**extra):
        return {"gameId": session.game_id, "revision": session.revision, **extra}
    session.dispatch("/new_game", context(mode="human_vs_bot", humanColor=side, botId="random"))
    if side == "thuy":
        session.dispatch("/move", context(**{"from": "a2", "to": "a3"}))
    fixtures["bot-turn-" + side] = {
        "snapshot": session.checkpoint(), "state": session.state(),
        "file": session.dispatch("/export", context())["file"],
    }
for color in ("thuy", "son"):
    session = BrowserSession()
    session.started = True
    session.match_config = {"mode": "human_vs_bot", "humanColor": "son" if color == "thuy" else "thuy", "botId": "random"}
    session.game = promotion_capture(color)
    fixtures["bot-promotion-capture-" + color] = {"snapshot": session.checkpoint(), "state": session.state()}

target = root / ".test-artifacts" / "worker-fixtures.json"
target.parent.mkdir(exist_ok=True)
target.write_text(json.dumps(fixtures, ensure_ascii=False), encoding="utf-8")
print(f"Prepared {len(fixtures)} browser-local saved positions.")
