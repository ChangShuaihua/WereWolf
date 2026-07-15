const { gameCache, roomCache } = require('../utils/cache');
const GameEngine = require('../game/GameEngine');
const GameRecord = require('../models/GameRecord');
const User = require('../models/User');

/**
 * Start the game
 */
function startGame(io, socket, code) {
  const room = roomCache.get(code);
  if (!room) {
    socket.emit('error', { message: '房间不存在' });
    return;
  }

  // Only host can start
  // Also check by userId if socketId changed (reconnect case)
  const info = require('../utils/cache').socketCache.get(socket.id);
  const hostPlayer = room.players.find(p => p.socketId === room.hostId);
  const isHost = room.hostId === socket.id || 
    (hostPlayer && info?.userId && hostPlayer.userId === info.userId);
  
  if (!isHost) {
    socket.emit('error', { message: '只有房主可以开始游戏' });
    return;
  }

  const readyPlayers = room.players.filter(p => p.isReady);
  if (readyPlayers.length < 4) {
    socket.emit('error', { message: '至少需要4名玩家准备才能开始' });
    return;
  }

  // Create emit callback
  const emit = (target, event, data) => {
    if (event === '__game_result') {
      handleGameResult(data);
    } else if (event === '__game_replay') {
      const room = roomCache.get(data.roomCode);
      if (room) {
        const replayMsg = {
          username: '系统',
          message: data.message,
          timestamp: Date.now(),
        };
        room.chat.push(replayMsg);
        if (room.chat.length > 100) room.chat.shift();
        roomCache.set(data.roomCode, room);
        io.to(data.roomCode).emit('chat_message', replayMsg);
      }
    } else if (target === code) {
      io.to(code).emit(event, data);
    } else {
      io.to(target).emit(event, data);
    }
  };

  // Create game engine
  const engine = new GameEngine(code, room.players.map(p => ({
    id: p.userId,
    socketId: p.socketId,
    username: p.username,
    isAlive: true,
    isReady: p.isReady,
  })), emit);

  gameCache.set(code, engine);
  engine.start();
}

/**
 * Handle night action
 */
function handleNightAction(socket, code, { action, targetId }) {
  const game = gameCache.get(code);
  if (!game) return;

  const player = game.getPlayer(socket.id);
  if (!player) return;

  const role = game.getRole(socket.id);

  // Skip action
  if (action === 'skip') return;

  // Map role to default action if not explicitly provided
  if (!action) {
    switch (role) {
      case 'guard': action = 'guard'; break;
      case 'werewolf': action = 'kill'; break;
      case 'seer': action = 'check'; break;
      default: return;
    }
  }

  // Validate witch can use potions
  if (role === 'witch') {
    if (action === 'save' && game.witchSaveUsed) return;
    if (action === 'poison' && game.witchPoisonUsed) return;
  }

  game.submitNightAction(socket.id, action, targetId);
}

/**
 * Handle vote
 */
function handleVote(socket, code, { targetId }) {
  const game = gameCache.get(code);
  if (!game) return;

  game.submitVote(socket.id, targetId);
}

/**
 * Skip day discussion
 */
function skipDay(code) {
  const game = gameCache.get(code);
  if (game && game.phase === 'DAY') {
    game.skipToVote();
  }
}

/**
 * Persist game result
 */
async function handleGameResult(data) {
  try {
    const gameId = await GameRecord.create(
      data.roomCode,
      data.winner,
      data.playerCount,
      data.duration
    );

    // Record each player
    for (const p of data.players) {
      const room = roomCache.get(data.roomCode);
      const roomPlayer = room?.players.find(rp => rp.socketId === p.id);
      if (roomPlayer?.userId) {
        await GameRecord.addPlayer(gameId, roomPlayer.userId, p.role, p.isWinner);
        await User.updateStats(roomPlayer.userId, p.isWinner);
      }
    }

    console.log(`Game ${data.roomCode} ended. Winner: ${data.winner}, Duration: ${data.duration}s`);
  } catch (err) {
    console.error('Failed to save game result:', err);
  }
}

/**
 * Reset game state to allow returning to room
 */
function resetGame(code) {
  const room = roomCache.get(code);
  if (!room) return;

  gameCache.del(code);

  room.players.forEach(p => {
    p.isReady = false;
    p.isAlive = true;
  });

  roomCache.set(code, room);

  const io = require('../app').getIO();
  io.to(code).emit('room_reset');

  console.log(`[gameHandler] Game ${code} reset, players ready to return`);
}

module.exports = { startGame, handleNightAction, handleVote, skipDay, resetGame };
