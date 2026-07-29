const NodeCache = require('node-cache');
const { getRedisClient } = require('../config/redis');

const TTL = 7200;
const SOCKET_TTL = 14400;
const KEY_PREFIX = process.env.REDIS_KEY_PREFIX || 'werewolf';

function runRedisTask(task) {
  const redis = getRedisClient();
  if (!redis) return;

  task(redis).catch((err) => {
    console.warn('[cache] Redis sync failed:', err.message);
  });
}

function defaultSerialize(value) {
  return JSON.stringify(value);
}

function serializeGameSnapshot(value) {
  if (!value || typeof value !== 'object') return defaultSerialize(value);

  return JSON.stringify({
    roomCode: value.roomCode,
    players: value.players,
    maxPlayers: value.maxPlayers,
    roles: value.roles,
    phase: value.phase,
    startTime: value.startTime,
    nightCount: value.nightCount,
    gameHistory: value.gameHistory,
    updatedAt: Date.now(),
  });
}

function createTtlCache(name, defaultTTL, options = {}) {
  const store = new NodeCache({ stdTTL: defaultTTL, checkperiod: 300, useClones: false });
  const redisPrefix = `${KEY_PREFIX}:${name}:`;
  const serialize = options.serialize || defaultSerialize;
  
  return {
    set(key, value) {
      store.set(key, value);
      runRedisTask(async (redis) => {
        await redis.set(`${redisPrefix}${key}`, serialize(value), { EX: defaultTTL });
      });
    },
    get(key) { return store.get(key); },
    has(key) { return store.has(key); },
    del(key) {
      store.del(key);
      runRedisTask(async (redis) => {
        await redis.del(`${redisPrefix}${key}`);
      });
    },
    keys() { return store.getKeys(); },
    clear() {
      store.flushAll();
      runRedisTask(async (redis) => {
        for await (const key of redis.scanIterator({ MATCH: `${redisPrefix}*`, COUNT: 100 })) {
          await redis.del(key);
        }
      });
    },
    get store() { return store; },
  };
}

const cache = createTtlCache('general', 600);

const roomCache = createTtlCache('rooms', TTL);

const gameCache = createTtlCache('games', TTL, { serialize: serializeGameSnapshot });

const socketCache = createTtlCache('sockets', SOCKET_TTL);

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
