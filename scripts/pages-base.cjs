function normalizeBase(value, { relative = false } = {}) {
    if (relative && value === "./") return value;
    if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")
        || /[\\?#\s]/.test(value) || value.includes("//")) {
        throw new Error("Base must be a URL path such as /DongSon/ or /, not a full URL.");
    }
    for (const segment of value.split("/")) {
        const decoded = decodeURIComponent(segment);
        if ([".", ".."].includes(decoded) || /[\\/\0]/.test(decoded)) throw new Error("Invalid base path.");
    }
    return value.endsWith("/") ? value : value + "/";
}

function pagesBase({ repository, base } = {}) {
    if (base) return normalizeBase(base);
    const parts = (repository || "").split("/");
    if (parts.length !== 2 || parts.some(s => !/^[A-Za-z0-9_.-]+$/.test(s) || [".", ".."].includes(s))) {
        throw new Error("Specify --repository OWNER/REPO, --base /REPO/, or GITHUB_REPOSITORY.");
    }
    const [owner, repo] = parts;
    return repo.toLowerCase() === `${owner}.github.io`.toLowerCase() ? "/" : `/${repo}/`;
}

module.exports = { normalizeBase, pagesBase };
