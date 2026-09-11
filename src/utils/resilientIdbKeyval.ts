/**
 * Resilient idb-keyval wrapper
 *
 * Handles partial IndexedDB corruption (e.g. Firefox "Manage Data" deleting
 * the object store but leaving the database). When `get` or `set` throws an
 * error indicating the `keyval` store is missing, this wrapper deletes the
 * corrupt database, allows idb-keyval to recreate it on retry, and retries
 * the operation once. Callers see either success (possibly with empty data
 * after recovery) or a real error — never the intermediate corruption state.
 */

import {
  get as idbGet,
  set as idbSet,
  del as idbDel,
  createStore,
  type UseStore,
} from 'idb-keyval';

const IDB_KEYVAL_DB_NAME = 'keyval-store';
const IDB_KEYVAL_STORE_NAME = 'keyval';

/**
 * Detect if an error is due to a missing or corrupt idb-keyval object store.
 *
 * Firefox partial clear typically produces:
 *   "IDBDatabase.transaction: 'keyval' is not a known object store name"
 *
 * Other browsers may produce similar DOMException messages.
 */
function isObjectStoreMissingError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();

  // Firefox: "'keyval' is not a known object store name"
  if (
    message.includes('keyval') &&
    (message.includes('not a known object store') ||
      message.includes('object store not found') ||
      message.includes('no objectstore named'))
  ) {
    return true;
  }

  // Chrome/Safari: variations of "object store not found"
  if (
    message.includes('object store') &&
    (message.includes('not found') || message.includes('does not exist'))
  ) {
    return true;
  }

  // Generic IDB corruption indicators
  if (
    error.name === 'NotFoundError' ||
    error.name === 'InvalidStateError' ||
    (error.name === 'DOMException' &&
      (message.includes('objectstore') || message.includes('object store')))
  ) {
    return true;
  }

  return false;
}

/**
 * Delete the idb-keyval database entirely.
 *
 * This clears the corrupt state so idb-keyval can recreate it fresh.
 * Returns true if deletion succeeded or the database didn't exist.
 */
async function deleteIdbKeyvalDatabase(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(IDB_KEYVAL_DB_NAME);

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
      request.onblocked = () => {
        // Database is in use by another connection; cannot delete.
        // This is rare but possible if multiple tabs are open.
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
}

// Custom store reference, created fresh after recovery
let customStore: UseStore | null = null;

/**
 * Get a fresh store reference after recovery.
 * idb-keyval's default store caches the connection, so after deleting
 * the database we need a new store to force reconnection.
 */
function getOrCreateStore(): UseStore {
  if (!customStore) {
    customStore = createStore(IDB_KEYVAL_DB_NAME, IDB_KEYVAL_STORE_NAME);
  }
  return customStore;
}

/**
 * Reset the store reference after database deletion.
 * Forces a new connection on next operation.
 */
function resetStore(): void {
  customStore = null;
}

/**
 * Resilient get: reads a value, recovering from partial IndexedDB corruption.
 *
 * If the keyval store is missing (partial Firefox clear), this:
 * 1. Deletes the corrupt database
 * 2. Returns undefined (treating corruption as empty storage)
 *
 * The next `set` will recreate the database with the proper store structure.
 */
export async function resilientGet<T>(key: IDBValidKey): Promise<T | undefined> {
  try {
    // First try with the default store (uses cached connection)
    return await idbGet<T>(key);
  } catch (error) {
    if (!isObjectStoreMissingError(error)) {
      throw error;
    }

    // Object store is missing — database is corrupt from partial clear
    const deleted = await deleteIdbKeyvalDatabase();
    if (!deleted) {
      // Could not delete; re-throw original error
      throw error;
    }

    // Reset store reference so next access creates fresh connection
    resetStore();

    // After deletion, treat as empty storage (the database is gone)
    // The next set will recreate everything properly
    return undefined;
  }
}

/**
 * Resilient set: writes a value, recovering from partial IndexedDB corruption.
 *
 * If the keyval store is missing (partial Firefox clear), this:
 * 1. Deletes the corrupt database
 * 2. Creates a fresh store and retries the set
 */
export async function resilientSet<T>(
  key: IDBValidKey,
  value: T
): Promise<void> {
  try {
    // First try with the default store
    await idbSet(key, value);
  } catch (error) {
    if (!isObjectStoreMissingError(error)) {
      throw error;
    }

    // Object store is missing — database is corrupt from partial clear
    const deleted = await deleteIdbKeyvalDatabase();
    if (!deleted) {
      throw error;
    }

    // Reset and get a fresh store reference
    resetStore();
    const freshStore = getOrCreateStore();

    // Retry with fresh store (this will create the database and store)
    await idbSet(key, value, freshStore);
  }
}

/**
 * Resilient del: deletes a value, recovering from partial IndexedDB corruption.
 *
 * If the keyval store is missing, deletion is a no-op (nothing to delete).
 */
export async function resilientDel(key: IDBValidKey): Promise<void> {
  try {
    await idbDel(key);
  } catch (error) {
    if (!isObjectStoreMissingError(error)) {
      throw error;
    }

    // Object store is missing — database is corrupt
    // For deletion, we can just clear the whole corrupt database
    await deleteIdbKeyvalDatabase();
    resetStore();
    // Nothing to delete from an empty database
  }
}

export { isObjectStoreMissingError, deleteIdbKeyvalDatabase };
