const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { initDB } = require('./config/db');
const { initRedis, getRedisStatus, shutdownRedis } = require('./config/redis');
const { syncAllUsersToRedis } = require('./services/statsService');
const { roomCache } = require('./utils/cache');
const { getUserCount } = require('./utils/userSocketMap');
const aiAgentManager = require('./ai/AIAgentManager');
const authRoutes = require('./routes/auth');
const aiAgentRoutes = require('./routes/aiAgentRoutes');
const replayRoutes = require('./routes/replayRoutes');
const statsRoutes = require('./routes/stats');
const settingsRoutes = require('./routes/settings');
const initSocket = require('./socket');
const authMiddleware = require('./middleware/auth');
const { AppError } = require('./utils/AppError');

/**
 * Validate required environment variables at startup (C8/C9).
 * Hard-fails the process if security-critical config is missing.
 */
function validateEnv() {
  const errors = [];

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be set and at least 32 characters long');
  }

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.DB_USER) errors.push('DB_USER must be set in production');
    if (!process.env.DB_PASSWORD) errors.push('DB_PASSWORD must be set in production');
    if (!process.env.DB_HOST) errors.push('DB_HOST must be set in production');
  }

  if (errors.length > 0) {
    console.error('[validateEnv] Environment validation failed:');
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }
}

validateEnv();

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

// CORS configuration
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
}));

// Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Make io accessible to socket handlers
app.getIO = () => io;

// Rate limiting - auth routes (20 attempts per minute)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: '登录/注册尝试过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting - general API (100 requests per minute)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: '请求过于频繁' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limit to all API routes
app.use('/api/', apiLimiter);

// Body size limit
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// REST Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/ai-agents', aiAgentRoutes);
app.use('/api/replays', replayRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/settings', settingsRoutes);

// GET /api/lobby-stats - lobby stats (online users + AI agent count)
app.get('/api/lobby-stats', authMiddleware, async (req, res, next) => {
  try {
    const aiAgents = await aiAgentManager.getAllAgents();
    res.json({
      onlineUsers: getUserCount(),
      aiAgentCount: aiAgents.length,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/rooms - list active rooms
app.get('/api/rooms', authMiddleware, (req, res) => {
  const rooms = [];
  const allRooms = roomCache.keys();
  for (const code of allRooms) {
    const room = roomCache.get(code);
    if (room) {
      const connectedPlayers = room.players.filter(p => p.socketId !== null);
      if (connectedPlayers.length > 0) {
        const host = connectedPlayers.find(p => p.socketId === room.hostId)
          || connectedPlayers.find(p => Number(p.userId) === Number(room.hostUserId));
        rooms.push({
          code: room.code,
          hostUsername: host?.username || '未知',
          playerCount: connectedPlayers.length,
          maxPlayers: Number(room.maxPlayers) || 6,
        });
      }
    }
  }
  res.json({ rooms });
});

// GET /api/room/:code - get room details
app.get('/api/room/:code', authMiddleware, (req, res) => {
  const { code } = req.params;
  const room = roomCache.get(code);
  if (!room) {
    return res.status(404).json({ message: '房间不存在' });
  }
  const { buildSeats, buildPublicPlayers } = require('./socket/roomHandler');
  const connectedPlayers = room.players.filter(p => p.socketId !== null);
  res.json({
    code: room.code,
    hostId: room.hostId,
    players: buildPublicPlayers(connectedPlayers),
    seats: buildSeats(room),
    chat: room.chat,
    maxPlayers: Number(room.maxPlayers) || 6,
  });
});

// Health check（免登录，用于 Docker 健康探针）
app.get('/api/health', async (req, res) => {
  const { pool } = require('./config/db');
  let dbStatus = 'unknown';
  let rooms = 0;
  let online = 0;
  try {
    if (pool) {
      await pool.query('SELECT 1');
      dbStatus = 'ok';
    }
  } catch (e) {
    dbStatus = 'error';
  }
  try { online = getUserCount(); } catch (_) {}
  try { rooms = roomCache.keys().length; } catch (_) {}

  const redisOk = !!(getRedisStatus() && getRedisStatus().connected);
  const overall = dbStatus === 'ok' ? (redisOk ? 'ok' : 'degraded') : 'unhealthy';
  res.status(dbStatus === 'ok' ? 200 : 503).json({
    status: overall,
    timestamp: Date.now(),
    db: dbStatus,
    redis: getRedisStatus(),
    onlineUsers: online,
    activeRooms: rooms,
  });
});

// Readiness probe（就绪探针）
app.get('/api/ready', (req, res) => {
  res.json({ ready: true, uptime: process.uptime(), timestamp: Date.now() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: '接口不存在' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: '请求体过大' });
  }

  if (err.message === 'CORS not allowed') {
    return res.status(403).json({ message: '跨域请求被拒绝' });
  }

  const payload = { message: '服务器内部错误' };
  // Include stack trace only outside production (C10)
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    payload.stack = err.stack;
  }
  res.status(500).json(payload);
});

// Initialize Socket.io
initSocket(io);

// Start server
const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await initDB();
    await aiAgentManager.init();
    await initRedis();
    // 同步用户积分数据到 Redis
    await syncAllUsersToRedis();
    // Rooms are ephemeral; start each process with a fresh lobby view.
    roomCache.clear();
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Werewolf server running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

module.exports = app;

start();

process.on('SIGINT', async () => {
  await shutdownRedis();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdownRedis();
  process.exit(0);
});

// C10: catch unhandled async errors so the process stays alive and logs them
process.on('unhandledRejection', (reason, promise) => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
