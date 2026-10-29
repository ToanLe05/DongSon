export const DB_NAME = "dongson-local-v1";
export const STORE_NAME = "games";

export function savedSlotKey(slot = 1) {
    if (!Number.isInteger(slot) || slot < 1 || slot > 9) throw new Error("Invalid save slot");
    return `saved-slot:${slot}`;
}

export function writeSavedGame(db, slot, file) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(file, savedSlotKey(slot));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error("Không lưu được ván cờ."));
    });
}

export function openStore() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("Bản lưu đang được mở ở một trang khác."));
        request.onsuccess = () => {
            request.result.onversionchange = () => request.result.close();
            resolve(request.result);
        };
    });
}

export function readSnapshot(db, key) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get(key);
        tx.oncomplete = () => resolve(request.result ?? null);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error("Không đọc được bản lưu."));
    });
}

// Compare and write in one transaction: a duplicated tab cannot overwrite a newer move.
export function commitSnapshot(db, key, expected, snapshot) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(key);
        let result;
        request.onsuccess = () => {
            const current = request.result ?? null;
            result = { committed: current === expected, snapshot: current };
            if (result.committed) store.put(snapshot, key);
        };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error("Không lưu được ván cờ."));
    });
}
