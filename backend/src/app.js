const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const { initDB } = require('./config/db');
const { roomCache } = require('./utils/cache');
const authRoutes = require('./routes/auth');
const aiAgentRoutes = require('./routes/aiAgentRoutes');
const initSocket = require('./socket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
  },
});

// Make io accessible to socket handlers
app.getIO = () => io;

// Clear roomCache on server startup to ensure fresh data
roomCache.clear();

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// REST Routes
app.use('/api/auth', authRoutes);
app.use('/api/ai-agents', aiAgentRoutes);

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

// Initialize Socket.io
initSocket(io);

// Start server
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await initDB();
    server.listen(PORT, () => {
      console.log(`Werewolf server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

module.exports = app;

start();
