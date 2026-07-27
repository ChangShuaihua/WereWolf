const jwt = require('jsonwebtoken');
const { createRoom, joinRoom, leaveRoom, toggleReady, addChat, handleDisconnect, addAIPlayer, removeAIPlayer } = require('./roomHandler');
const { startGame, handleNightAction, handleVote, skipDay, resetGame, handleHunterShoot } = require('./gameHandler');
const { socketCache, gameCache } = require('../utils/cache');
const { kickOldSocket, removeUserSocket, getUserBySocket } = require('../utils/userSocketMap');

/**
 * Initialize Socket.io with all event handlers
 */
function initSocket(io) {
  // Socket.IO authentication middleware - verify JWT on connection
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    
    if (!token) {
      console.log(`[socket] Connection rejected - no token (${socket.id})`);
      return next(new Error('AUTH_REQUIRED'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.username = decoded.username;
      
      socketCache.set(socket.id, {
        userId: decoded.id,
        username: decoded.username,
        roomCode: null,
      });
      
      console.log(`[socket] Authenticated: ${decoded.username} (${socket.id})`);
      next();
    } catch (err) {
      console.log(`[socket] Connection rejected - invalid token (${socket.id}): ${err.message}`);
      return next(new Error('AUTH_FAILED'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id} (${socket.username})`);

    if (socket.userId) {
      kickOldSocket(io, socket.userId, socket.id);
    }

    socket.on('error', (err) => {
      if (err.message === 'FORCE_LOGOUT') {
        console.log(`[socket] Socket ${socket.id} force logged out`);
        socket.disconnect(true);
      }
    });

    socket.emit('authenticated', { socketId: socket.id });

    // Create room
    socket.on('create_room', ({ username, userId, maxPlayers }) => {
      if (socket.kicked) return;
      const mode = Number(maxPlayers) || 6;
      console.log(`[socket] create_room from ${username} (${socket.id}), maxPlayers=${mode}`);
      createRoom(socket, username, userId, mode);
    });

    // Join room
    socket.on('join_room', ({ roomCode, username, userId }) => {
      if (socket.kicked) return;
      console.log(`[socket] join_room ${roomCode} from ${username} (${socket.id})`);
      joinRoom(socket, roomCode, username, userId);
    });

    // Leave room
    socket.on('leave_room', ({ roomCode } = {}) => {
      if (socket.kicked) return;
      const info = socketCache.get(socket.id);
      const code = roomCode || info?.roomCode;
      if (code) leaveRoom(socket, code);
    });

    // Toggle ready
    socket.on('player_ready', ({ roomCode } = {}) => {
      const info = socketCache.get(socket.id);
      const code = roomCode || info?.roomCode;
      if (code) toggleReady(socket, code);
    });

    // Add AI player
    socket.on('add_ai_player', ({ roomCode, agentId } = {}) => {
      console.log(`[socket] add_ai_player event received from socket=${socket.id}, roomCode=${roomCode}, agentId=${agentId}`);
      const info = socketCache.get(socket.id);
      console.log(`[socket] socketCache info:`, info);
      const code = roomCode || info?.roomCode;
      console.log(`[socket] resolved code: ${code}`);
      if (code) {
        const result = addAIPlayer(socket, code, agentId);
        console.log(`[socket] addAIPlayer result:`, result ? result.username : 'null');
      }
    });

    // Remove AI player
    socket.on('remove_ai_player', ({ roomCode, aiSocketId } = {}) => {
      console.log(`[socket] remove_ai_player event received from socket=${socket.id}, roomCode=${roomCode}, aiSocketId=${aiSocketId}`);
      const info = socketCache.get(socket.id);
      const code = roomCode || info?.roomCode;
      if (code && aiSocketId) {
        const result = removeAIPlayer(socket, code, aiSocketId);
        console.log(`[socket] removeAIPlayer result:`, result ? result.username : 'null');
      }
    });

    // Start game
    socket.on('start_game', ({ roomCode } = {}) => {
      const info = socketCache.get(socket.id);
      const code = roomCode || info?.roomCode;
      if (code) startGame(io, socket, code);
    });

    // Night action
    socket.on('night_action', (data) => {
      const info = socketCache.get(socket.id);
      if (info?.roomCode) handleNightAction(socket, info.roomCode, data);
    });

    // Hunter shoot
    socket.on('hunter_shoot', (data) => {
      const info = socketCache.get(socket.id);
      if (info?.roomCode) handleHunterShoot(socket, info.roomCode, data);
    });

    // Vote
    socket.on('vote', (data) => {
      const info = socketCache.get(socket.id);
      if (info?.roomCode) handleVote(socket, info.roomCode, data);
    });

    // Skip day
    socket.on('skip_day', () => {
      const info = socketCache.get(socket.id);
      if (info?.roomCode) skipDay(info.roomCode);
    });

    // Chat
    socket.on('chat', ({ message, roomCode: code } = {}) => {
      console.log(`[socket] chat from ${socket.id}: msg="${message}" code="${code}"`);
      const info = socketCache.get(socket.id);
      const roomCode = code || info?.roomCode;
      
      if (roomCode && message) {
        const game = gameCache.get(roomCode);
        if (game && game.phase === 'DAY' && game.speakingOrder.length > 0) {
          const currentSpeaker = game.speakingOrder[game.currentSpeakerIndex];
          if (socket.id !== currentSpeaker) {
            socket.emit('chat_error', { message: '请等待轮到你发言' });
            return;
          }
        }
        addChat(socket, roomCode, message);
      }
    });

    // Next speaker
    socket.on('next_speaker', ({ roomCode } = {}) => {
      const info = socketCache.get(socket.id);
      const code = roomCode || info?.roomCode;
      if (code) {
        const game = gameCache.get(code);
        if (game) game.nextSpeaker();
      }
    });

    // Skip speaking
    socket.on('skip_speaking', ({ roomCode } = {}) => {
      const info = socketCache.get(socket.id);
      const code = roomCode || info?.roomCode;
      if (code) {
        const game = gameCache.get(code);
        if (game) game.skipSpeaking();
      }
    });

    // Reset game and return to room
    socket.on('reset_game', () => {
      const info = socketCache.get(socket.id);
      if (info?.roomCode) resetGame(info.roomCode);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      const userId = getUserBySocket(socket.id);
      if (userId) {
        removeUserSocket(userId, socket.id);
      }
      handleDisconnect(socket);
    });
  });
}

module.exports = initSocket;
