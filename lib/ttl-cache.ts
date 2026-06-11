/**
 * Tiny in-process TTL cache for hot, identity-style lookups (token -> user,
 * phone -> user). Deliberately not Redis: the app runs as a single
 * long-lived Node process, so a Map plus explicit invalidation gives the
 * same latency win with zero infrastructure. If the app ever scales to
 * multiple instances, swap the implementation here for a shared store.
 */
export function createTtlCache<T>(ttlMs: number, maxSize = 1000) {
  const store = new Map<string, { value: T; expires: number }>();

  return {
    get(key: string): T | undefined {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expires < Date.now()) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },

    set(key: string, value: T) {
      // Map iteration order is insertion order, so the first key is the oldest.
      if (store.size >= maxSize) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.set(key, { value, expires: Date.now() + ttlMs });
    },

    delete(key: string) {
      store.delete(key);
    },
  };
}
