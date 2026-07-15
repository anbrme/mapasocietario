export const GRAPH_AUTOSAVE_KEY = 'latest-graph-session';

const GRAPH_AUTOSAVE_DB = 'mapasocietario-local';
const GRAPH_AUTOSAVE_STORE = 'graph-sessions';
const GRAPH_AUTOSAVE_DB_VERSION = 1;

export const createGraphAutosaveRecord = (
  snapshot,
  savedAt = new Date().toISOString()
) => ({
  key: GRAPH_AUTOSAVE_KEY,
  savedAt,
  snapshot,
});

export const normalizeGraphAutosaveRecord = record => {
  if (
    !record ||
    record.key !== GRAPH_AUTOSAVE_KEY ||
    typeof record.savedAt !== 'string' ||
    !record.snapshot ||
    typeof record.snapshot !== 'object'
  ) {
    return null;
  }
  return record;
};

const openAutosaveDatabase = indexedDb => new Promise((resolve, reject) => {
  if (!indexedDb) {
    reject(new Error('IndexedDB is unavailable.'));
    return;
  }

  const request = indexedDb.open(GRAPH_AUTOSAVE_DB, GRAPH_AUTOSAVE_DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(GRAPH_AUTOSAVE_STORE)) {
      db.createObjectStore(GRAPH_AUTOSAVE_STORE, { keyPath: 'key' });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Could not open local graph storage.'));
});

const runStoreRequest = async (mode, operation, indexedDb = globalThis.indexedDB) => {
  const db = await openAutosaveDatabase(indexedDb);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(GRAPH_AUTOSAVE_STORE, mode);
      const request = operation(transaction.objectStore(GRAPH_AUTOSAVE_STORE));
      let result;
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => reject(request.error || new Error('Local graph storage failed.'));
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error || new Error('Local graph storage failed.'));
      transaction.onabort = () => reject(transaction.error || new Error('Local graph storage was aborted.'));
    });
  } finally {
    db.close();
  }
};

export const saveGraphAutosave = async (snapshot, options = {}) => {
  const record = createGraphAutosaveRecord(snapshot, options.savedAt);
  await runStoreRequest(
    'readwrite',
    store => store.put(record),
    options.indexedDb ?? globalThis.indexedDB
  );
  return record;
};

export const loadGraphAutosave = async (options = {}) => {
  const record = await runStoreRequest(
    'readonly',
    store => store.get(GRAPH_AUTOSAVE_KEY),
    options.indexedDb ?? globalThis.indexedDB
  );
  return normalizeGraphAutosaveRecord(record);
};

export const clearGraphAutosave = async (options = {}) => {
  await runStoreRequest(
    'readwrite',
    store => store.delete(GRAPH_AUTOSAVE_KEY),
    options.indexedDb ?? globalThis.indexedDB
  );
};
