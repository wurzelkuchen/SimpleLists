/**
 * Persistent IndexedDB Storage Layer for Simple Lists
 * 
 * Provides an explicit IndexedDB schema with versioning and migration support.
 * All mutations survive application restarts, WebView recreation, process terminations,
 * and offline periods.
 */

const DB_NAME = 'simple_lists_db';
const DB_VERSION = 1;

let dbInstance = null;

export function openDatabase() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      console.warn('IndexedDB is not available in this environment');
      return resolve(null);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Store: lists
      // Key: id (UUID v4)
      if (!db.objectStoreNames.contains('lists')) {
        const listStore = db.createObjectStore('lists', { keyPath: 'id' });
        listStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        listStore.createIndex('status', 'status', { unique: false });
      }

      // Store: config
      // Key: key (string)
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Fetch all lists from IndexedDB
 */
export async function dbGetAllLists() {
  const db = await openDatabase();
  if (!db) return [];

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('lists', 'readonly');
      const store = tx.objectStore('lists');
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Fetch single list by ID
 */
export async function dbGetList(id) {
  const db = await openDatabase();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('lists', 'readonly');
      const store = tx.objectStore('lists');
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Save / Update a single list
 */
export async function dbSaveList(list) {
  const db = await openDatabase();
  if (!db) return;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('lists', 'readwrite');
      const store = tx.objectStore('lists');
      // Store cloned plain JSON to avoid Vue reactive proxy issues
      const plainList = JSON.parse(JSON.stringify(list));
      const req = store.put(plainList);

      req.onsuccess = () => resolve(plainList);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Save multiple lists in a single transaction
 */
export async function dbSaveAllLists(lists) {
  const db = await openDatabase();
  if (!db) return;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('lists', 'readwrite');
      const store = tx.objectStore('lists');

      for (const list of lists) {
        store.put(JSON.parse(JSON.stringify(list)));
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Delete a list permanently from local DB
 */
export async function dbDeleteList(id) {
  const db = await openDatabase();
  if (!db) return;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('lists', 'readwrite');
      const store = tx.objectStore('lists');
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Read configuration value
 */
export async function dbGetConfig(key) {
  const db = await openDatabase();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('config', 'readonly');
      const store = tx.objectStore('config');
      const req = store.get(key);

      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Save configuration value
 */
export async function dbSetConfig(key, value) {
  const db = await openDatabase();
  if (!db) return;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('config', 'readwrite');
      const store = tx.objectStore('config');
      const req = store.put({ key, value });

      req.onsuccess = () => resolve(value);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Remove a config key
 */
export async function dbRemoveConfig(key) {
  const db = await openDatabase();
  if (!db) return;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('config', 'readwrite');
      const store = tx.objectStore('config');
      const req = store.delete(key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}
