// src/services/congresoCacheService.js
// IndexedDB-based caching service for Spanish Congress data
// Replaces localStorage caching to avoid quota issues

const DB_NAME = 'congreso_cache_db';
const DB_VERSION = 1;
const STORE_NAME = 'congreso_data';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds

class CongresoCacheService {
  constructor() {
    this.db = null;
    this.initPromise = null;
  }

  /**
   * Initialize the IndexedDB database
   */
  async init() {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[CongresoCache] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[CongresoCache] IndexedDB initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = event => {
        const db = event.target.result;

        // Create object store for cached data
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('[CongresoCache] Created object store');
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Get cached data by key
   * @param {string} cacheKey - The cache key (e.g., 'proposiciones_ley')
   * @returns {Promise<any|null>} - The cached data or null if not found/expired
   */
  async getCachedData(cacheKey) {
    try {
      await this.init();

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(cacheKey);

        request.onsuccess = () => {
          const result = request.result;

          if (!result) {
            resolve(null);
            return;
          }

          // Check if cache is expired
          const age = Date.now() - result.timestamp;
          if (age > CACHE_DURATION) {
            console.log(`[CongresoCache] Cache expired for ${cacheKey}`);
            // Clean up expired entry
            this.removeCachedData(cacheKey).catch(() => {});
            resolve(null);
            return;
          }

          console.log(
            `[CongresoCache] Cache hit for ${cacheKey} (age: ${Math.round(age / 1000 / 60)} minutes)`
          );
          resolve(result.data);
        };

        request.onerror = () => {
          console.error('[CongresoCache] Error reading cache:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[CongresoCache] Error in getCachedData:', error);
      return null;
    }
  }

  /**
   * Set cached data
   * @param {string} cacheKey - The cache key
   * @param {any} data - The data to cache
   * @returns {Promise<boolean>} - Success status
   */
  async setCachedData(cacheKey, data) {
    try {
      await this.init();

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const cacheEntry = {
          cacheKey,
          data,
          timestamp: Date.now(),
        };

        const request = store.put(cacheEntry);

        request.onsuccess = () => {
          console.log(`[CongresoCache] Cached data for ${cacheKey}`);
          resolve(true);
        };

        request.onerror = () => {
          console.error('[CongresoCache] Error writing cache:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[CongresoCache] Error in setCachedData:', error);
      return false;
    }
  }

  /**
   * Remove cached data by key
   * @param {string} cacheKey - The cache key to remove
   * @returns {Promise<boolean>} - Success status
   */
  async removeCachedData(cacheKey) {
    try {
      await this.init();

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(cacheKey);

        request.onsuccess = () => {
          console.log(`[CongresoCache] Removed cache for ${cacheKey}`);
          resolve(true);
        };

        request.onerror = () => {
          console.error('[CongresoCache] Error removing cache:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[CongresoCache] Error in removeCachedData:', error);
      return false;
    }
  }

  /**
   * Clear all cached data
   * @returns {Promise<boolean>} - Success status
   */
  async clearAllCache() {
    try {
      await this.init();

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
          console.log('[CongresoCache] Cleared all cache');
          resolve(true);
        };

        request.onerror = () => {
          console.error('[CongresoCache] Error clearing cache:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[CongresoCache] Error in clearAllCache:', error);
      return false;
    }
  }

  /**
   * Clean up expired entries
   * @returns {Promise<number>} - Number of entries removed
   */
  async cleanupExpired() {
    try {
      await this.init();

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('timestamp');
        const expiredBefore = Date.now() - CACHE_DURATION;
        const range = IDBKeyRange.upperBound(expiredBefore);

        let removedCount = 0;
        const request = index.openCursor(range);

        request.onsuccess = event => {
          const cursor = event.target.result;
          if (cursor) {
            cursor.delete();
            removedCount++;
            cursor.continue();
          } else {
            if (removedCount > 0) {
              console.log(`[CongresoCache] Cleaned up ${removedCount} expired entries`);
            }
            resolve(removedCount);
          }
        };

        request.onerror = () => {
          console.error('[CongresoCache] Error cleaning up expired:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[CongresoCache] Error in cleanupExpired:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<object>} - Cache statistics
   */
  async getStats() {
    try {
      await this.init();

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const countRequest = store.count();

        countRequest.onsuccess = () => {
          const count = countRequest.result;

          // Get all entries to calculate size
          const getAllRequest = store.getAll();
          getAllRequest.onsuccess = () => {
            const entries = getAllRequest.result;
            let totalSize = 0;
            const cacheInfo = [];

            entries.forEach(entry => {
              const size = JSON.stringify(entry.data).length;
              totalSize += size;
              const age = Date.now() - entry.timestamp;
              cacheInfo.push({
                key: entry.cacheKey,
                size: Math.round(size / 1024) + ' KB',
                age: Math.round(age / 1000 / 60) + ' minutes',
                expired: age > CACHE_DURATION,
              });
            });

            resolve({
              entryCount: count,
              totalSize: Math.round(totalSize / 1024) + ' KB',
              entries: cacheInfo,
            });
          };

          getAllRequest.onerror = () => reject(getAllRequest.error);
        };

        countRequest.onerror = () => reject(countRequest.error);
      });
    } catch (error) {
      console.error('[CongresoCache] Error getting stats:', error);
      return { entryCount: 0, totalSize: '0 KB', entries: [] };
    }
  }

  /**
   * Migrate data from localStorage to IndexedDB (one-time migration)
   */
  async migrateFromLocalStorage() {
    const CACHE_KEY_PREFIX = 'congreso_data_';
    let migratedCount = 0;

    try {
      // Find all congreso_data_ keys in localStorage
      const keysToMigrate = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_KEY_PREFIX)) {
          keysToMigrate.push(key);
        }
      }

      // Also check for user-namespaced versions
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(CACHE_KEY_PREFIX)) {
          if (!keysToMigrate.includes(key)) {
            keysToMigrate.push(key);
          }
        }
      }

      for (const fullKey of keysToMigrate) {
        try {
          const value = localStorage.getItem(fullKey);
          if (value) {
            const parsed = JSON.parse(value);
            // Extract the cache key without prefix
            const cacheKey = fullKey.includes('user_data_')
              ? fullKey.split(CACHE_KEY_PREFIX)[1]
              : fullKey.replace(CACHE_KEY_PREFIX, '');

            // Only migrate if data exists and has valid structure
            if (parsed.data) {
              await this.setCachedData(cacheKey, parsed.data);
              migratedCount++;
            }

            // Remove from localStorage after successful migration
            localStorage.removeItem(fullKey);
            console.log(`[CongresoCache] Migrated ${fullKey} to IndexedDB`);
          }
        } catch (error) {
          console.warn(`[CongresoCache] Could not migrate ${fullKey}:`, error);
          // Still remove from localStorage to free space
          localStorage.removeItem(fullKey);
        }
      }

      if (migratedCount > 0) {
        console.log(
          `[CongresoCache] Migrated ${migratedCount} entries from localStorage to IndexedDB`
        );
      }

      return migratedCount;
    } catch (error) {
      console.error('[CongresoCache] Migration error:', error);
      return migratedCount;
    }
  }
}

// Export singleton instance
export const congresoCacheService = new CongresoCacheService();
export default congresoCacheService;
