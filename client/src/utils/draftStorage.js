const DB_NAME = "txtro_drafts_db";
const DB_VERSION = 1;
const STORE_NAME = "drafts";


const getDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "userId" });
            }
        }

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    })
}


/**
 * Save draft for a specific user/conversation
 * @param {string} userId - Recipient user ID
 * @param {string} text - Message input text
 * @param {File[]} files - Selected File objects
 */
export const saveDraftToStorage = async (userId, text = "", files = []) => {
    if (!userId) return;
    try {
        const db = await getDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);

        const hasContent = Boolean(text && text.trim()) || (Array.isArray(files) && files.length > 0);
        if (!hasContent) {
            store.delete(userId);
            return;
        }
        store.put({
            userId,
            text,
            files,
            updateAt: Date.now()
        });
    } catch (error) {
        console.warn("Failed to save draft to IndexedDB:", error);
    }
}

/**
 * Get draft for a specific user/conversation
 * @param {string} userId
 * @returns {Promise<{ text: string, files: File[] } | null>}
 */
export const getDraftFromStorage = async (userId) => {
    if (!userId) return null;
    try {
        const db = await getDB();
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);

        return new Promise((resolve) => {
            const request = store.get(userId);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => resolve(null);
        });
    } catch (error) {
        console.warn("Failed to get draft from Indexed:", error);
        return null;
    }
}

/**
 * Delete draft for a specific user
 * @param {string} userId
 */
export const deleteDraftFromStorage = async (userId) => {
    if (!userId) return;
    try {
        const db = await getDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.delete(userId);
    } catch (error) {
        console.warn("Failed to delete draft from IndexedDB:", error);
    }
}

/**
 * Get all drafts (used to show "✏️ Draft:" in the Sidebar)
 * Automatically prunes any draft older than 7 days
 * @returns {Promise<Record<string, { text: string, files: File[] }>>}
 */

export const getAllDraftFromStorage = async () => {
    try {
        const db = await getDB();
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);

        return new Promise((resolve) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const results = request.result || [];
                const map = {};
                const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
                const now = Date.now();

                results.forEach((item) => {
                    if (now - (item.updateAt || 0) < SEVEN_DAYS) {
                        map[item.userId] = item;
                    }
                })
                resolve(map);
            }
            request.onerror = () => resolve({});
        })
    } catch (error) {
        return {};
    }
};

export const getAllDraftsFromStorage = getAllDraftFromStorage;