export const MAX_GAME_FILE_BYTES = 16 * 1024 * 1024;

export async function readGameFile(file) {
    if (!file || file.size > MAX_GAME_FILE_BYTES) {
        throw Object.assign(new Error("Chọn tệp JSON không lớn hơn 16 MB."), { code: "invalid_save" });
    }
    try { return await file.text(); }
    catch { throw Object.assign(new Error("Không đọc được tệp. Hãy chọn lại tệp JSON."), { code: "invalid_save" }); }
}

export function downloadGameFile({ file, filename }, document = globalThis.document) {
    const url = URL.createObjectURL(new Blob([file], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    try { link.click(); }
    finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}
