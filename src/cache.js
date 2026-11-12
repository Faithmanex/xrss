/** Tiny TTL cache with in-flight request coalescing. */

export function createCache(ttlMs = 120000) {
  const store = new Map();
  const inflight = new Map();

  return {
    get(key, loader) {
      const hit = store.get(key);
      if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value);
      if (inflight.has(key)) return inflight.get(key);

      const promise = Promise.resolve()
        .then(loader)
        .then((value) => {
          store.set(key, { value, expires: Date.now() + ttlMs });
          inflight.delete(key);
          return value;
        })
        .catch((err) => {
          inflight.delete(key);
          throw err;
        });

      inflight.set(key, promise);
      return promise;
    },
    clear() {
      store.clear();
    },
    get size() {
      return store.size;
    },
  };
}
