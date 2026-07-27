const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

const TTL = 7200;

function createTtlCache(defaultTTL) {
  const store = new NodeCache({ stdTTL: defaultTTL, checkperiod: 300, useClones: false });
  
  return {
    set(key, value) { store.set(key, value); },
    get(key) { return store.get(key); },
    has(key) { return store.has(key); },
    del(key) { store.del(key); },
    keys() { return store.getKeys(); },
    clear() { store.flushAll(); },
    get store() { return store; },
  };
}

const roomCache = createTtlCache(TTL);

const gameCache = createTtlCache(TTL);

const socketCache = new NodeCache({ stdTTL: 14400, checkperiod: 600 });

roomCache.store.on('expired', (key, value) => {
  console.log(`[roomCache] Expired room: ${key}`);
  if (value && value.players) {
    for (const p of value.players) {
      if (p.socketId) {
        try { socketCache.del(p.socketId); } catch (e) { /* ignore */ }
      }
    }
  }
});

gameCache.store.on('expired', (key) => {
  console.log(`[gameCache] Expired game: ${key}`);
});

module.exports = { cache, roomCache, gameCache, socketCache };
