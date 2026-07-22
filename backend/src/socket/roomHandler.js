const { roomCache, socketCache } = require('../utils/cache');
const { gameCache } = require('../utils/cache');
const aiGameHandler = require('../game/AIGameHandler');

/**
 * Generate a 6-character room code
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Create a new room
 */
function createRoom(socket, username, userId, aiCount = 0) {
  console.log(`[roomHandler] createRoom called with userId=${userId}, typeof=${typeof userId}`);
  const code = generateRoomCode();

  // Prevent duplicates
  let attempts = 0;
  while (roomCache.has(code) && attempts < 10) {
    code = generateRoomCode();
    attempts++;
  }

  const room = {
    code,
    hostId: socket.id,
    hostUserId: userId,
    players: [],
    chat: [],
    createdAt: Date.now(),
  };

  roomCache.set(code, room);
  joinRoom(socket, code, username, userId, true);

  for (let i = 0; i < aiCount; i++) {
    addAIPlayer(code);
  }
  
  const io = require('../app').getIO();
  io.emit('room_created', {
    code,
    hostUsername: username,
    playerCount: room.players.length,
    maxPlayers: 12,
  });
  
  return code;
}

function isHost(socketId, room) {
  return room.hostId === socketId;
}

/**
 * Add an AI player to a room (host only)
 */
function addAIPlayer(socket, code, agentId = null) {
  const room = roomCache.get(code);
  if (!room) return null;

  if (!isHost(socket.id, room)) {
    console.log('[roomHandler] Only host can add AI players');
    socket.emit('error', { message: '只有房主可以添加AI玩家' });
    return null;
  }

  if (room.players.length >= 12) {
    console.log('[roomHandler] Room is full, cannot add AI');
    socket.emit('error', { message: '房间已满，无法添加AI玩家' });
    return null;
  }

  const game = gameCache.get(code);
  if (game && game.phase !== 'WAITING') {
    console.log('[roomHandler] Game in progress, cannot add AI');
    socket.emit('error', { message: '游戏进行中，无法添加AI玩家' });
    return null;
  }

  const aiPlayer = aiGameHandler.createAIPlayer(code, agentId);
  aiPlayer.isReady = true;
  room.players.push(aiPlayer);
  roomCache.set(code, room);

  const welcomeMsg = {
    username: '系统',
    message: `🤖 ${aiPlayer.username} 加入了房间！`,
    timestamp: Date.now(),
  };
  room.chat.push(welcomeMsg);
  if (room.chat.length > 100) room.chat.shift();

  const io = require('../app').getIO();
  io.to(code).emit('chat_message', welcomeMsg);
  broadcastRoomUpdate(code);

  console.log(`[roomHandler] AI player ${aiPlayer.username} added to room ${code}`);
  return aiPlayer;
}

/**
 * Remove an AI player from a room (host only)
 */
function removeAIPlayer(socket, code, aiSocketId) {
  const room = roomCache.get(code);
  if (!room) return null;

  if (!isHost(socket.id, room)) {
    console.log('[roomHandler] Only host can remove AI players');
    socket.emit('error', { message: '只有房主可以删除AI玩家' });
    return null;
  }

  const game = gameCache.get(code);
  if (game && game.phase !== 'WAITING') {
    console.log('[roomHandler] Game in progress, cannot remove AI');
    socket.emit('error', { message: '游戏进行中，无法删除AI玩家' });
    return null;
  }

  const aiPlayer = room.players.find(p => p.socketId === aiSocketId && p.isAI);
  if (!aiPlayer) {
    console.log('[roomHandler] AI player not found');
    socket.emit('error', { message: 'AI玩家不存在' });
    return null;
  }

  room.players = room.players.filter(p => p.socketId !== aiSocketId);
  roomCache.set(code, room);

  const leaveMsg = {
    username: '系统',
    message: `🤖 ${aiPlayer.username} 离开了房间！`,
    timestamp: Date.now(),
  };
  room.chat.push(leaveMsg);
  if (room.chat.length > 100) room.chat.shift();

  const io = require('../app').getIO();
  io.to(code).emit('chat_message', leaveMsg);
  broadcastRoomUpdate(code);

  console.log(`[roomHandler] AI player ${aiPlayer.username} removed from room ${code}`);
  return aiPlayer;
}

/**
 * Join an existing room
 */
function joinRoom(socket, code, username, userId, isCreator = false) {
  console.log(`[roomHandler] joinRoom called with userId=${userId}, typeof=${typeof userId}`);
  const room = roomCache.get(code);
  if (!room) {
    socket.emit('error', { message: '房间不存在或已过期' });
    return null;
  }

  // Check if already in room by socketId
  let existing = room.players.find(p => p.socketId === socket.id);
  if (existing) return room;

  // Check if user already in room by userId (reconnect case)
  existing = room.players.find(p => p.userId === userId);
  
  // If no match by userId, try matching by username for legacy rooms
  if (!existing) {
    existing = room.players.find(p => p.username === username && !p.userId);
  }
  
  if (existing) {
    existing.socketId = socket.id;
    if (!existing.userId) existing.userId = userId;
    
    if (room.hostUserId === userId || existing.socketId === room.hostId) {
      room.hostId = socket.id;
      if (!room.hostUserId) room.hostUserId = userId;
    }
    
    socket.join(code);
    socketCache.set(socket.id, { userId, username, roomCode: code });
    roomCache.set(code, room);
    broadcastRoomUpdate(code);
    socket.emit('room_joined', { code, players: room.players, hostId: room.hostId });
    console.log(`[roomHandler] ${username} reconnected to room ${code}`);
    return room;
  }

  // Check if room is full (max 12)
  if (room.players.length >= 12) {
    socket.emit('error', { message: '房间已满' });
    return null;
  }

  // Check if game is in progress
  const game = gameCache.get(code);
  if (game && game.phase !== 'WAITING') {
    socket.emit('error', { message: '游戏已开始，无法加入' });
    return null;
  }

  // If game exists and is waiting, check this user isn't in game already
  if (game) {
    const gamePlayer = game.players.find(p => p.id === userId);
    if (gamePlayer && gamePlayer.isAlive) {
      const oldSocketId = gamePlayer.socketId;
      gamePlayer.socketId = socket.id;
      if (oldSocketId && oldSocketId !== socket.id) {
        game.roles[socket.id] = game.roles[oldSocketId];
        delete game.roles[oldSocketId];
      }
    }
  }

  const player = {
    socketId: socket.id,
    userId,
    username,
    isReady: isCreator, // creator auto-ready
    isAlive: true,
  };

  room.players.push(player);
  socket.join(code);

  socketCache.set(socket.id, { userId, username, roomCode: code });

  const welcomeMsg = {
    username: '系统',
    message: `🎉 ${username} 加入了房间！`,
    timestamp: Date.now(),
  };
  room.chat.push(welcomeMsg);
  if (room.chat.length > 100) room.chat.shift();

  roomCache.set(code, room);

  console.log(`[roomHandler] ${username} joined room ${code}, players=${room.players.length}`);

  socket.emit('room_joined', { code, players: room.players, hostId: room.hostId });
  broadcastRoomUpdate(code, room);
  
  const io = require('../app').getIO();
  io.to(code).emit('chat_message', welcomeMsg);

  return room;
}

function isRoomOnlyAI(room) {
  return room.players.every(p => p.isAI);
}

function shouldDestroyRoom(room, leavingUserId) {
  if (room.hostUserId === leavingUserId) {
    return true;
  }
  
  if (isRoomOnlyAI(room)) {
    return true;
  }
  
  return false;
}

function destroyRoom(code) {
  const aiGameHandler = require('../game/AIGameHandler');
  aiGameHandler.cleanup(code);
  
  roomCache.del(code);
  gameCache.del(code);
  
  const io = require('../app').getIO();
  io.emit('room_deleted', { code });
  
  console.log(`[roomHandler] Room ${code} deleted`);
}

/**
 * Leave a room
 */
function leaveRoom(socket, code, isDisconnect = false) {
  const room = roomCache.get(code);
  if (!room) return;

  const player = room.players.find(p => p.socketId === socket.id);
  const leavingUserId = player?.userId;

  if (isDisconnect && player) {
    player.socketId = null;
    roomCache.set(code, room);
    broadcastRoomUpdate(code);
    
    setTimeout(() => {
      const roomCheck = roomCache.get(code);
      if (roomCheck) {
        const playerCheck = roomCheck.players.find(p => p.userId === leavingUserId);
        if (playerCheck && playerCheck.socketId === null) {
          roomCheck.players = roomCheck.players.filter(p => p.userId !== leavingUserId);
          
          if (roomCheck.players.length === 0) {
            destroyRoom(code);
          } else if (shouldDestroyRoom(roomCheck, leavingUserId)) {
            destroyRoom(code);
          } else {
            if (roomCheck.hostUserId === leavingUserId) {
              roomCheck.hostId = roomCheck.players[0].socketId;
              roomCheck.hostUserId = roomCheck.players[0].userId;
            }
            roomCache.set(code, roomCheck);
            broadcastRoomUpdate(code);
          }
        }
      }
    }, 30000);
  } else {
    room.players = room.players.filter(p => p.socketId !== socket.id);

    if (room.players.length === 0 || shouldDestroyRoom(room, leavingUserId)) {
      destroyRoom(code);
      socket.leave(code);
      socketCache.del(socket.id);
      return;
    }

    if (room.hostId === socket.id && room.players.length > 0) {
      room.hostId = room.players[0].socketId;
      room.hostUserId = room.players[0].userId;
    }

    roomCache.set(code, room);
  }

  socket.leave(code);
  socketCache.del(socket.id);

  if (roomCache.has(code)) {
    broadcastRoomUpdate(code);
  }
}

/**
 * Toggle ready status
 */
function toggleReady(socket, code) {
  const room = roomCache.get(code);
  if (!room) return;

  const info = socketCache.get(socket.id);
  let player = room.players.find(p => p.socketId === socket.id);
  
  if (!player && info?.userId) {
    player = room.players.find(p => p.userId === info.userId);
    if (player) {
      player.socketId = socket.id;
    }
  }
  
  if (player) {
    player.isReady = !player.isReady;
    roomCache.set(code, room);
  }

  broadcastRoomUpdate(code);
}

/**
 * Add chat message
 */
function addChat(socket, code, message) {
  const room = roomCache.get(code);
  if (!room) { console.log('[roomHandler] addChat: room not found', code); return; }

  const player = room.players.find(p => p.socketId === socket.id);
  if (!player) { console.log('[roomHandler] addChat: player not found, socketId=', socket.id); return; }

  console.log(`[roomHandler] chat from ${player.username} in ${code}: ${message}`);

  const chatMsg = {
    username: player.username,
    message,
    timestamp: Date.now(),
  };

  room.chat.push(chatMsg);
  if (room.chat.length > 100) room.chat.shift();

  roomCache.set(code, room);

  const io = require('../app').getIO();
  io.to(code).emit('chat_message', chatMsg);
}

/**
 * Broadcast updated player list to room
 */
function broadcastRoomUpdate(code, room = null) {
  if (!room) {
    room = roomCache.get(code);
  }
  if (!room) return;

  const connectedPlayers = room.players.filter(p => p.socketId !== null);
  
  console.log(`[roomHandler] broadcastRoomUpdate room=${code}, totalPlayers=${room.players.length}, connectedPlayers=${connectedPlayers.length}`);
  console.log(`[roomHandler] players:`, room.players.map(p => ({ username: p.username, socketId: p.socketId, userId: p.userId, isAI: p.isAI })));

  const io = require('../app').getIO();
  io.to(code).emit('room_update', {
    players: connectedPlayers,
    hostId: room.hostId,
  });
}

/**
 * Handle socket disconnect
 */
function handleDisconnect(socket) {
  const info = socketCache.get(socket.id);
  if (!info || !info.roomCode) return;

  const code = info.roomCode;
  leaveRoom(socket, code, true);

  // Mark player as dead in active game
  const game = gameCache.get(code);
  if (game) {
    const player = game.getPlayer(socket.id);
    if (player && player.isAlive) {
      player.isAlive = false;
      game.broadcast('player_disconnected', {
        id: socket.id,
        username: player.username,
        message: `${player.username} 断开连接，视为死亡`,
      });
      // Check win condition after forced death
      if (game.phase !== 'WAITING' && game.phase !== 'END') {
        game.checkWinCondition();
      }
    }
  }
}

module.exports = { createRoom, joinRoom, leaveRoom, toggleReady, addChat, handleDisconnect, broadcastRoomUpdate, addAIPlayer, removeAIPlayer };
