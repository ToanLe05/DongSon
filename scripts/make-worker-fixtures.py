"""Build local-save fixtures using the existing isolated scenario definitions."""
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(root / "src"), str(root / "tests")]
import browser_server
from browser_bridge import BrowserSession

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
target = root / ".test-artifacts" / "worker-fixtures.json"
target.parent.mkdir(exist_ok=True)
target.write_text(json.dumps(fixtures, ensure_ascii=False), encoding="utf-8")
print(f"Prepared {len(fixtures)} browser-local saved positions.")
