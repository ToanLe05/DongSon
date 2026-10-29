import { Assets } from "pixi.js";

// Vite resolves these URLs both in development and in a production subdirectory.
const urls = import.meta.glob("./assets/**/*.{png,jpg,jpeg,webp,svg}", {
    eager: true, query: "?url", import: "default"
});
const textures = new Map();
let loading;

export function preloadAssets() {
    loading ??= Promise.all(Object.entries(urls).map(async ([path, url]) => {
        try { textures.set(path, await Assets.load(url)); }
        catch (error) { console.warn("Image unavailable:", path, error); }
    }));
    return loading;
}

export function getAssetTexture(path) {
    return textures.get("./assets/" + path) ?? null;
}
