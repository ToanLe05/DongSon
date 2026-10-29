export function pythonRuntimeUrl(base, documentURL) {
    return new URL("python-runtime/", new URL(base, documentURL)).href;
}
