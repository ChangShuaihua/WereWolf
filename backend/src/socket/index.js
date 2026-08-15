const jwt = require('jsonwebtoken');
const { createRoom, joinRoom, leaveRoom, toggleReady, addChat, handleDisconnect, addAIPlayer, removeAIPlayer, ruleQA } = require('./roomHandler');
const { startGame, handleNightAction, handleVote, skipDay, resetGame, handleHunterShoot } = require('./gameHandler');
const { socketCache, gameCache } = require('../utils/cache');
const { kickOldSocket, removeUserSocket, getUserBySocket } = require('../utils/userSocketMap');
const {
  getRoomInfoOrReject,
  validatePhaseOrReject,
  validateAliveOrReject,
} = require('../utils/socketValidators');

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
    socket.on('create_room', ({ username, userId, maxPlayers } = {}) => {
      if (socket.kicked) return;
      const finalUsername = socket.username || username;
      const finalUserId = socket.userId || userId;
      if (!finalUsername || !finalUserId) {
        socket.emit('error', { message: '用户未认证，无法创建房间' });
        return;
      }
      const mode = Number(maxPlayers) || 6;
      console.log(`[socket] create_room from ${finalUsername} (${socket.id}), maxPlayers=${mode}`);
      createRoom(socket, finalUsername, finalUserId, mode);
    });

    // Join room
    socket.on('join_room', ({ roomCode, username, userId } = {}) => {
      if (socket.kicked) return;
      const finalUsername = socket.username || username;
      const finalUserId = socket.userId || userId;
      if (!finalUsername || !finalUserId) {
        socket.emit('error', { message: '用户未认证，无法加入房间' });
        return;
      }
      console.log(`[socket] join_room ${roomCode} from ${finalUsername} (${socket.id})`);
      joinRoom(socket, roomCode, finalUsername, finalUserId);
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
    socket.on('add_ai_player', async ({ roomCode, agentId } = {}) => {
      const info = socketCache.get(socket.id);
      const code = roomCode || info?.roomCode;
      if (code) {
        try {
          await addAIPlayer(socket, code, agentId);
        } catch (err) {
          console.error('[socket] addAIPlayer failed:', err);
          socket.emit('error', { message: '添加AI玩家失败' });
        }
      }
    });

    // Remove AI player
    socket.on('remove_ai_player', ({ roomCode, aiSocketId } = {}) => {
      const info = socketCache.get(socket.id);
      const code = roomCode || info?.roomCode;
      if (code && aiSocketId) {
        removeAIPlayer(socket, code, aiSocketId);
      }
    });

    // Start game
    socket.on('start_game', ({ roomCode } = {}) => {
      const info = socketCache.get(socket.id);
      const code = roomCode || info?.roomCode;
      if (code) startGame(io, socket, code);
    });

    // Night action（仅 NIGHT 阶段且该玩家存活）
    socket.on('night_action', (data) => {
      const ctx = getRoomInfoOrReject(socket);
      if (!ctx) return;
      const { game, player } = ctx;
      if (!validatePhaseOrReject(socket, game, 'NIGHT', '执行夜间行动')) return;
      if (!validateAliveOrReject(socket, player, '执行夜间行动')) return;
      handleNightAction(socket, ctx.code, data);
    });

    // Hunter shoot（仅 HUNTER_SHOOT 阶段且该玩家存活）
    socket.on('hunter_shoot', (data) => {
      const ctx = getRoomInfoOrReject(socket);
      if (!ctx) return;
      const { game, player } = ctx;
      if (!validatePhaseOrReject(socket, game, 'HUNTER_SHOOT', '开枪')) return;
      if (!validateAliveOrReject(socket, player, '开枪')) return;
      handleHunterShoot(socket, ctx.code, data);
    });

    // Vote（仅 VOTING 阶段且该玩家存活）
    socket.on('vote', (data) => {
      const ctx = getRoomInfoOrReject(socket);
      if (!ctx) return;
      const { game, player } = ctx;
      if (!validatePhaseOrReject(socket, game, 'VOTING', '投票')) return;
      if (!validateAliveOrReject(socket, player, '投票')) return;
      handleVote(socket, ctx.code, data);
    });

    // Skip day（仅 DAY 阶段，允许非存活玩家触发，但需要游戏开始）
    socket.on('skip_day', () => {
      const ctx = getRoomInfoOrReject(socket);
      if (!ctx) return;
      if (!validatePhaseOrReject(socket, ctx.game, 'DAY', '跳过白天发言')) return;
      skipDay(ctx.code);
    });

    // Chat
    socket.on('chat', ({ message, roomCode: code } = {}) => {
      const info = socketCache.get(socket.id);
      const roomCode = code || info?.roomCode;

      if (roomCode && message) {
        if (typeof message !== 'string') {
          socket.emit('chat_error', { message: '无效的消息格式' });
          return;
        }
        if (message.length > 1000) {
          socket.emit('chat_error', { message: '消息过长（限1000字符）' });
          return;
        }
        const trimmedMsg = message.trim();
        if (trimmedMsg.length === 0) return;

        const game = gameCache.get(roomCode);
        if (game && game.phase === 'DAY' && game.speakingOrder.length > 0) {
          const currentSpeaker = game.speakingOrder[game.currentSpeakerIndex];
          if (socket.id !== currentSpeaker) {
            socket.emit('chat_error', { message: '请等待轮到你发言' });
            return;
          }
        }
        addChat(socket, roomCode, trimmedMsg);
      }
    });

    // Rule QA (独立通道，不进入聊天记录)
    socket.on('rule_qa', ({ question } = {}) => {
      if (question) {
        if (typeof question !== 'string' || question.length > 200) {
          socket.emit('rule_qa_answer', {
            question: String(question || '').slice(0, 50),
            answer: '问题过长或格式无效（限200字符）',
            error: true,
            timestamp: Date.now(),
          });
          return;
        }
        ruleQA(socket, question.trim());
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
