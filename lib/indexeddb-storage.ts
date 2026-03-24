"use client";

export type AsyncStorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type IndexedDBStorageOptions = {
  dbName: string;
  storeName: string;
};

const memoryFallback = new Map<string, string>();

export function createIndexedDBStorage({
  dbName,
  storeName,
}: IndexedDBStorageOptions): AsyncStorageLike {
  let dbPromise: Promise<IDBDatabase> | null = null;

  const getDatabase = async () => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      throw new Error("IndexedDB is not available in this environment.");
    }

    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open(dbName, 1);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName);
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(request.error ?? new Error("Failed to open IndexedDB."));
      });
    }

    return dbPromise;
  };

  const withStore = async <T>(
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => IDBRequest<T> | void,
  ) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return null;
    }

    const db = await getDatabase();

    return new Promise<T | null>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);

      let request: IDBRequest<T> | void;

      try {
        request = callback(store);
      } catch (error) {
        reject(error);
        return;
      }

      if (request) {
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () =>
          reject(request.error ?? new Error("IndexedDB request failed."));
      } else {
        transaction.oncomplete = () => resolve(null);
      }

      transaction.onerror = () =>
        reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    });
  };

  return {
    async getItem(key) {
      if (typeof window === "undefined" || !("indexedDB" in window)) {
        return memoryFallback.get(key) ?? null;
      }

      const result = await withStore<string>("readonly", (store) => store.get(key));
      return result ?? null;
    },

    async setItem(key, value) {
      if (typeof window === "undefined" || !("indexedDB" in window)) {
        memoryFallback.set(key, value);
        return;
      }

      await withStore("readwrite", (store) => {
        store.put(value, key);
      });
    },

    async removeItem(key) {
      if (typeof window === "undefined" || !("indexedDB" in window)) {
        memoryFallback.delete(key);
        return;
      }

      await withStore("readwrite", (store) => {
        store.delete(key);
      });
    },
  };
}
