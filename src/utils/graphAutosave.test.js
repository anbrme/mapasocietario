import { describe, expect, it } from 'vitest';
import {
  clearGraphAutosave,
  createGraphAutosaveRecord,
  GRAPH_AUTOSAVE_KEY,
  loadGraphAutosave,
  normalizeGraphAutosaveRecord,
  saveGraphAutosave,
} from './graphAutosave';

const createFakeIndexedDb = () => {
  const records = new Map();
  let storeCreated = false;

  const finishRequest = (transaction, request, result) => {
    queueMicrotask(() => {
      request.result = result;
      request.onsuccess?.();
      queueMicrotask(() => transaction.oncomplete?.());
    });
  };

  const db = {
    objectStoreNames: {
      contains: () => storeCreated,
    },
    createObjectStore: () => {
      storeCreated = true;
    },
    transaction: () => {
      const transaction = {
        objectStore: () => ({
          put: record => {
            const request = {};
            records.set(record.key, structuredClone(record));
            finishRequest(transaction, request, record.key);
            return request;
          },
          get: key => {
            const request = {};
            const record = records.has(key) ? structuredClone(records.get(key)) : undefined;
            finishRequest(transaction, request, record);
            return request;
          },
          delete: key => {
            const request = {};
            records.delete(key);
            finishRequest(transaction, request, undefined);
            return request;
          },
        }),
      };
      return transaction;
    },
    close: () => {},
  };

  return {
    open: () => {
      const request = {};
      queueMicrotask(() => {
        request.result = db;
        if (!storeCreated) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
};

describe('graph autosave records', () => {
  it('wraps the graph snapshot with a stable key and timestamp', () => {
    const snapshot = { format: 'mapasocietario.graph-snapshot', graph: { nodes: [], links: [] } };
    expect(createGraphAutosaveRecord(snapshot, '2026-07-15T19:00:00.000Z')).toEqual({
      key: GRAPH_AUTOSAVE_KEY,
      savedAt: '2026-07-15T19:00:00.000Z',
      snapshot,
    });
  });

  it('rejects malformed stored records', () => {
    expect(normalizeGraphAutosaveRecord(null)).toBeNull();
    expect(normalizeGraphAutosaveRecord({ key: GRAPH_AUTOSAVE_KEY })).toBeNull();
    expect(normalizeGraphAutosaveRecord({
      key: 'another-session',
      savedAt: '2026-07-15T19:00:00.000Z',
      snapshot: {},
    })).toBeNull();
  });

  it('writes, loads, and clears the latest session in IndexedDB', async () => {
    const indexedDb = createFakeIndexedDb();
    const snapshot = {
      format: 'mapasocietario.graph-snapshot',
      version: 1,
      graph: { nodes: [{ id: 'company-a', x: 12, y: 24 }], links: [] },
    };

    await saveGraphAutosave(snapshot, {
      indexedDb,
      savedAt: '2026-07-15T19:00:00.000Z',
    });

    await expect(loadGraphAutosave({ indexedDb })).resolves.toEqual({
      key: GRAPH_AUTOSAVE_KEY,
      savedAt: '2026-07-15T19:00:00.000Z',
      snapshot,
    });

    await clearGraphAutosave({ indexedDb });
    await expect(loadGraphAutosave({ indexedDb })).resolves.toBeNull();
  });
});
