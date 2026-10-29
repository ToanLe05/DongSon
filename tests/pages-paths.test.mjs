import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { pagesBase, normalizeBase } = require("../scripts/pages-base.cjs");
const source = await readFile(new URL("../src/local/runtimeUrl.js", import.meta.url), "utf8");
const { pythonRuntimeUrl } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

test("Pages repository paths preserve case and distinguish user sites", () => {
    assert.equal(pagesBase({ repository: "ToanLVK/DongSon" }), "/DongSon/");
    assert.equal(pagesBase({ repository: "Player/Co-DongSon" }), "/Co-DongSon/");
    assert.equal(pagesBase({ repository: "Player/PLAYER.github.io" }), "/");
    assert.equal(pagesBase({ repository: "Player/other.github.io" }), "/other.github.io/");
    assert.equal(pagesBase({ repository: "Player/DongSon", base: "/" }), "/");
    assert.equal(pagesBase({ base: "/games/DongSon" }), "/games/DongSon/");
    assert.throws(() => pagesBase(), /OWNER\/REPO/);
});

test("Public bases reject origin changes and path traversal", () => {
    for (const base of ["https://host/Repo/", "//host/Repo/", "/../", "/%2e%2e/", "/a%2fb/", "/repo?x/", "/a\\b/"]) {
        assert.throws(() => normalizeBase(base));
    }
    assert.equal(normalizeBase("./", { relative: true }), "./");
    assert.equal(normalizeBase("/"), "/");
});

test("Python runtime follows the configured base from folders and index.html", () => {
    for (const documentURL of ["https://player.github.io/DongSon/", "https://player.github.io/DongSon/index.html",
        "https://player.github.io/DongSon/another/path"]) {
        assert.equal(pythonRuntimeUrl("/DongSon/", documentURL), "https://player.github.io/DongSon/python-runtime/");
    }
    assert.equal(pythonRuntimeUrl("/", "https://player.github.io/index.html"), "https://player.github.io/python-runtime/");
    assert.equal(pythonRuntimeUrl("./", "http://localhost:8000/dongson/index.html"), "http://localhost:8000/dongson/python-runtime/");
});
