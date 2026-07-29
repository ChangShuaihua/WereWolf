const { createClient } = require('redis');

let client = null;
let ready = false;
let lastError = null;
let lastLoggedError = null;

const DEFAULT_RECONNECT_RETRIES = 5;

function formatRedisError(err) {
  if (!err) return 'Unknown Redis error';
  return err.message || err.code || err.name || String(err);
}

function getRedisUrl() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;

  const host = process.env.REDIS_HOST || 'localhost';
  const port = process.env.REDIS_PORT || '6379';
  const db = process.env.REDIS_DB || '0';
  return `redis://${host}:${port}/${db}`;
}

async function initRedis() {
  if (process.env.REDIS_DISABLED === 'true') {
    console.log('[redis] Disabled by REDIS_DISABLED=true');
    return null;
  }

  if (client) return client;

  client = createClient({
    url: getRedisUrl(),
    socket: {
      reconnectStrategy: (retries) => {
        const maxRetries = Number(process.env.REDIS_RECONNECT_RETRIES || DEFAULT_RECONNECT_RETRIES);
        if (retries > maxRetries) {
          return new Error('Redis reconnect retry limit reached');
        }
        return Math.min(retries * 100, 3000);
      },
    },
  });

  client.on('ready', () => {
    ready = true;
    lastError = null;
    lastLoggedError = null;
    console.log('[redis] Connected');
  });

  client.on('end', () => {
    ready = false;
    console.warn('[redis] Connection closed');
  });

  client.on('error', (err) => {
    ready = false;
    lastError = formatRedisError(err);
    if (lastLoggedError !== lastError) {
      lastLoggedError = lastError;
      console.warn('[redis] Error:', lastError);
    }
  });

  try {
    await client.connect();
    return client;
  } catch (err) {
    ready = false;
    lastError = formatRedisError(err);
    console.warn('[redis] Unable to connect, using in-memory cache only:', lastError);
    try {
      await client.disconnect();
    } catch (disconnectErr) {
      // Ignore disconnect errors after a failed initial connection.
    }
    client = null;
    return null;
  }
}

function getRedisClient() {
  if (!client || !ready) return null;
  return client;
}

function getRedisStatus() {
  return {
    enabled: process.env.REDIS_DISABLED !== 'true',
    ready,
    url: getRedisUrl().replace(/\/\/([^:@]+):([^@]+)@/, '//***:***@'),
    lastError,
  };
}

async function shutdownRedis() {
  if (!client) return;
  try {
    await client.quit();
  } catch (err) {
    console.warn('[redis] Error while closing:', err.message);
  } finally {
    client = null;
    ready = false;
  }
}

module.exports = {
  initRedis,
  getRedisClient,
  getRedisStatus,
  shutdownRedis,
};
