// Minimal IndexedDB helper with a single 'kv' object store storing string values.
// Used for background-mirroring local data to IndexedDB for durability.

export async function idbSet(key: string, value: string): Promise<void> {
	if (!hasIDB()) return;
	const db = await open();
	await txPut(db, key, value);
}

export async function idbGet(key: string): Promise<string | null> {
	if (!hasIDB()) return null;
	const db = await open();
	return await txGet(db, key);
}

export async function idbKeys(): Promise<string[]> {
	if (!hasIDB()) return [];
	const db = await open();
	return await txKeys(db);
}

function hasIDB() {
	return typeof window !== "undefined" && "indexedDB" in window;
}

function open(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open("hydraiq-db", 1);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains("kv")) {
				db.createObjectStore("kv");
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

function txPut(db: IDBDatabase, key: string, value: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction("kv", "readwrite");
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.objectStore("kv").put(value, key);
	});
}

function txGet(db: IDBDatabase, key: string): Promise<string | null> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction("kv", "readonly");
		tx.onerror = () => reject(tx.error);
		const req = tx.objectStore("kv").get(key);
		req.onsuccess = () => resolve((req.result as string) ?? null);
		req.onerror = () => reject(req.error);
	});
}

function txKeys(db: IDBDatabase): Promise<string[]> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction("kv", "readonly");
		tx.onerror = () => reject(tx.error);
		const store = tx.objectStore("kv");
		const req = store.getAllKeys();
		req.onsuccess = () => resolve((req.result as IDBValidKey[]).map((k) => String(k)));
		req.onerror = () => reject(req.error);
	});
}


