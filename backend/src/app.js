const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { initDB } = require('./config/db');
const { roomCache } = require('./utils/cache');
const { getUserCount } = require('./utils/userSocketMap');
const aiAgentManager = require('./ai/AIAgentManager');
const authRoutes = require('./routes/auth');
const aiAgentRoutes = require('./routes/aiAgentRoutes');
const initSocket = require('./socket');
const AppError = require('./utils/AppError');

const app = express();
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

// Clear roomCache on server startup to ensure fresh data
roomCache.clear();

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

// GET /api/lobby-stats - lobby stats (online users + AI agent count)
app.get('/api/lobby-stats', (req, res) => {
  res.json({
    onlineUsers: getUserCount(),
    aiAgentCount: aiAgentManager.getAllAgents().length,
  });
});

// GET /api/rooms - list active rooms
app.get('/api/rooms', (req, res) => {
  const rooms = [];
  const allRooms = roomCache.keys();
  for (const code of allRooms) {
    const room = roomCache.get(code);
    if (room) {
      const connectedPlayers = room.players.filter(p => p.socketId !== null);
      if (connectedPlayers.length > 0) {
        rooms.push({
          code: room.code,
          hostUsername: connectedPlayers[0]?.username || '未知',
          playerCount: connectedPlayers.length,
          maxPlayers: Number(room.maxPlayers) || 6,
        });
      }
    }
  }
  res.json({ rooms });
});

// GET /api/room/:code - get room details
app.get('/api/room/:code', (req, res) => {
  const { code } = req.params;
  const room = roomCache.get(code);
  if (!room) {
    return res.status(404).json({ message: '房间不存在' });
  }
  const { buildSeats } = require('./socket/roomHandler');
  const connectedPlayers = room.players.filter(p => p.socketId !== null);
  res.json({
    code: room.code,
    hostId: room.hostId,
    players: connectedPlayers,
    seats: buildSeats(room),
    chat: room.chat,
    maxPlayers: Number(room.maxPlayers) || 6,
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
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
  
  res.status(500).json({ message: '服务器内部错误' });
});

// Initialize Socket.io
initSocket(io);

// Start server
const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await initDB();
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
