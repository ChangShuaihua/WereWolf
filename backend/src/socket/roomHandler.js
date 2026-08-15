const { roomCache, socketCache } = require('../utils/cache');
const { gameCache } = require('../utils/cache');
const { GAME_MODES } = require('../game/constants');
const aiGameHandler = require('../game/AIGameHandler');
const ruleQAService = require('../services/RuleQAService');
const User = require('../models/User');

// W9: per-socket chat rate limiting (3 messages/sec)
const chatRateMap = new Map(); // socketId -> timestamps[]
const CHAT_RATE_WINDOW_MS = 1000;
const CHAT_RATE_MAX = 3;
const ruleQARateMap = new Map();
const RULE_QA_RATE_WINDOW_MS = 60000;
const RULE_QA_RATE_MAX = 5;
function isChatRateLimited(socketId) {
  const now = Date.now();
  const arr = (chatRateMap.get(socketId) || []).filter(t => now - t < CHAT_RATE_WINDOW_MS);
  if (arr.length >= CHAT_RATE_MAX) {
    chatRateMap.set(socketId, arr);
    return true;
  }
  arr.push(now);
  chatRateMap.set(socketId, arr);
  return false;
}

function isRuleQARateLimited(socketId) {
  const now = Date.now();
  const timestamps = (ruleQARateMap.get(socketId) || [])
    .filter(time => now - time < RULE_QA_RATE_WINDOW_MS);
  if (timestamps.length >= RULE_QA_RATE_MAX) {
    ruleQARateMap.set(socketId, timestamps);
    return true;
  }
  timestamps.push(now);
  ruleQARateMap.set(socketId, timestamps);
  return false;
}

function cleanupSocketRateLimits(socketId) {
  chatRateMap.delete(socketId);
  ruleQARateMap.delete(socketId);
}

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
 * Find the first empty seat index in a room
 */
function findEmptySeat(room) {
  const takenSeats = new Set(room.players.map(p => p.seatIndex).filter(i => i !== undefined && i !== null));
  for (let i = 0; i < room.maxPlayers; i++) {
    if (!takenSeats.has(i)) return i;
  }
  return -1; // no empty seat
}

/**
 * Build a seats array for broadcasting (includes empty seats)
 */
function buildSeats(room) {
  const connectedPlayers = room.players.filter(p => p.socketId !== null);
  const seats = [];
  for (let i = 0; i < room.maxPlayers; i++) {
    const player = connectedPlayers.find(p => p.seatIndex === i);
    if (player) {
      seats.push({
        seatIndex: i,
        occupied: true,
        socketId: player.socketId,
        userId: player.userId,
        username: player.username,
        isReady: player.isReady,
        isAI: player.isAI || false,
        isHost: player.socketId === room.hostId || player.userId === room.hostUserId,
      });
    } else {
      seats.push({
        seatIndex: i,
        occupied: false,
      });
    }
  }
  return seats;
}

function buildPublicPlayers(players) {
  return players.map(player => ({
    socketId: player.socketId,
    userId: player.userId,
    username: player.username,
    seatIndex: player.seatIndex,
    isReady: Boolean(player.isReady),
    isAlive: Boolean(player.isAlive),
    isAI: Boolean(player.isAI),
  }));
}

/**
 * Create a new room
 */
function createRoom(socket, username, userId, maxPlayers = 6) {
  // Ensure maxPlayers is a number and validate against supported modes
  maxPlayers = Number(maxPlayers) || 6;
  if (!GAME_MODES.includes(maxPlayers)) {
    console.log(`[roomHandler] Invalid maxPlayers=${maxPlayers}, falling back to 6`);
    maxPlayers = 6;
  }
  console.log(`[roomHandler] createRoom called with userId=${userId}, maxPlayers=${maxPlayers}`);

  let code = generateRoomCode();

  // Prevent duplicates (W11: raise cap to 50; fall back to timestamp suffix in extreme cases)
  let attempts = 0;
  while (roomCache.has(code) && attempts < 50) {
    code = generateRoomCode();
    attempts++;
  }
  if (roomCache.has(code)) {
    // Extremely unlikely: append a short timestamp suffix to guarantee uniqueness
    code = generateRoomCode() + Date.now().toString(36).slice(-4).toUpperCase();
  }

  const room = {
    code,
    hostId: socket.id,
    hostUserId: userId,
    players: [],
    chat: [],
    maxPlayers,
    createdAt: Date.now(),
  };

  roomCache.set(code, room);
  joinRoom(socket, code, username, userId, true);

  const io = require('../app').getIO();
  io.emit('room_created', {
    code,
    hostUsername: username,
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
  });

  return code;
}

function isHost(socketId, room) {
  return room.hostId === socketId;
}

/**
 * Add an AI player to a room (host only)
 */
async function addAIPlayer(socket, code, agentId = null) {
  const room = roomCache.get(code);
  if (!room) return null;

  if (!isHost(socket.id, room)) {
    console.log('[roomHandler] Only host can add AI players');
    socket.emit('error', { message: '只有房主可以添加AI玩家' });
    return null;
  }

  if (room.players.length >= room.maxPlayers) {
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

  const host = await User.findById(socket.userId);
  const fallbackEnabled = host ? Boolean(host.ai_fallback_enabled) : true;
  const aiPlayer = await aiGameHandler.createAIPlayer(code, agentId, fallbackEnabled);
  aiPlayer.isReady = true;

  // Assign to first empty seat
  const seatIndex = findEmptySeat(room);
  if (seatIndex === -1) {
    socket.emit('error', { message: '没有空座位了' });
    return null;
  }
  aiPlayer.seatIndex = seatIndex;

  room.players.push(aiPlayer);
  roomCache.set(code, room);

  const welcomeMsg = {
    username: '系统',
    message: `🤖 ${aiPlayer.username} 加入了房间！`,
    timestamp: Date.now(),
  };
  room.chat.push(welcomeMsg);
  if (room.chat.length > 100) room.chat = room.chat.slice(-100);

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
  if (room.chat.length > 100) room.chat = room.chat.slice(-100);

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
    existing.disconnectTime = null;
    if (!existing.userId) existing.userId = userId;
    
    if (room.hostUserId === userId || existing.socketId === room.hostId) {
      room.hostId = socket.id;
      if (!room.hostUserId) room.hostUserId = userId;
    }
    
    socket.join(code);
    socketCache.set(socket.id, { userId, username, roomCode: code });
    roomCache.set(code, room);

    // Also restore game state if game is active
    const game = gameCache.get(code);
    if (game && game.phase !== 'WAITING' && game.phase !== 'END') {
      const gamePlayer = game.players.find(p => p.id === userId);
      if (gamePlayer) {
        const oldSocketId = gamePlayer.socketId;
        gamePlayer.socketId = socket.id;
        gamePlayer.disconnectTime = null;
        
        // Restore role socket mapping
        if (gamePlayer.isAlive && game.roles) {
          if (oldSocketId !== null && game.roles[oldSocketId]) {
            // Reconnect from a still-open socket: migrate mapping directly
            game.roles[socket.id] = game.roles[oldSocketId];
            delete game.roles[oldSocketId];
          } else if (gamePlayer.role) {
            // Reconnect after disconnect: read role directly from player object (C6)
            // Avoids fragile "process of elimination" recovery that could assign wrong role
            game.roles[socket.id] = gamePlayer.role;
          }
        }

        // Fix currentSpeaker if it was the old socketId
        if (game.currentSpeaker === oldSocketId) {
          game.currentSpeaker = socket.id;
        }

        // Fix speakingOrder if it contains the old socketId
        if (game.speakingOrder && game.speakingOrder.length > 0) {
          game.speakingOrder = game.speakingOrder.map(id => 
            id === oldSocketId ? socket.id : id
          );
        }

        // Send current game state to reconnected player
        const role = game.roles[socket.id];
        const roleName = role ? require('../game/RoleConfig').getRoleName(role) : '';
        
        socket.emit('game_started', {
          role: role,
          roleName: roleName,
          seatNum: game.getSeatNum(socket.id),
          seatIndex: gamePlayer.seatIndex,
          phase: game.phase,
          players: game.players.map(pl => ({
            id: pl.socketId,
            username: pl.username,
            seatNum: game.getSeatNum(pl.socketId),
            seatIndex: pl.seatIndex,
            isAlive: pl.isAlive,
          })),
        });

        // Send current phase state
        const phaseTimeout = game.phaseTimer?._idleStart
          ? Math.ceil((game.phaseTimer._idleEnd - Date.now()) / 1000)
          : 0;

        socket.emit('phase_change', {
          phase: game.phase,
          timeout: phaseTimeout || 0,
          message: game.lastPhaseMessage || '',
          nightCount: game.nightCount,
          candidates: game.candidates || [],
          currentSpeaker: game.currentSpeaker || null,
          speakerName: game.currentSpeaker ? game.getSeatNum(game.currentSpeaker) : '',
        });

        // Send night action prompt if player needs to act
        if (gamePlayer.isAlive && game.phase === 'NIGHT') {
          const nightRole = game.roles[socket.id];
          // Check if player already submitted night action
          const alreadyActed = game.nightActions[socket.id];

          if (!alreadyActed) {
            if (nightRole === 'werewolf') {
              socket.emit('night_action_prompt', {
                action: 'kill',
                message: '请选择要击杀的玩家',
                targets: game.alivePlayers.filter(p => p.socketId !== socket.id && game.roles[p.socketId] !== 'werewolf')
                  .map(p => ({ id: p.socketId, username: game.getSeatNum(p.socketId) })),
                teammates: game.alivePlayers.filter(p => game.roles[p.socketId] === 'werewolf' && p.socketId !== socket.id)
                  .map(p => ({ id: p.socketId, username: game.getSeatNum(p.socketId) })),
                isWerewolfTeam: true,
                timeout: phaseTimeout,
              });
            } else if (nightRole === 'seer') {
              socket.emit('night_action_prompt', {
                action: 'check',
                message: '请选择要查验的玩家',
                targets: game.alivePlayers.filter(p => p.socketId !== socket.id)
                  .map(p => ({ id: p.socketId, username: game.getSeatNum(p.socketId) })),
                timeout: phaseTimeout,
              });
            } else if (nightRole === 'guard') {
              socket.emit('night_action_prompt', {
                action: 'guard',
                message: '请选择要守护的玩家',
                targets: game.alivePlayers.filter(p => p.socketId !== socket.id && p.socketId !== game.guardLastProtected)
                  .map(p => ({ id: p.socketId, username: game.getSeatNum(p.socketId) })),
                timeout: phaseTimeout,
              });
            } else if (nightRole === 'witch') {
              const killedPlayer = game.killedByWerewolves ? game.getPlayer(game.killedByWerewolves) : null;
              socket.emit('night_action_prompt', {
                action: 'witch',
                message: '请使用你的药水',
                killed: killedPlayer ? { id: killedPlayer.socketId, username: game.getSeatNum(killedPlayer.socketId) } : null,
                canSave: !game.witchSaveUsed && game.killedByWerewolves !== null,
                canPoison: !game.witchPoisonUsed,
                targets: game.alivePlayers.filter(p => p.socketId !== socket.id)
                  .map(p => ({ id: p.socketId, username: game.getSeatNum(p.socketId) })),
                timeout: phaseTimeout,
              });
            }
          } else {
            // Player already acted - send confirmation so UI shows "action done"
            const acted = game.nightActions[socket.id];
            const targetPlayer = acted.targetId ? game.getPlayer(acted.targetId) : null;
            socket.emit('night_action_prompt', {
              action: acted.action,
              message: '你的行动已确认',
              targets: [],
              alreadyDone: true,
              completedAction: acted.action,
              completedTarget: targetPlayer ? { id: acted.targetId, username: game.getSeatNum(acted.targetId) } : null,
            });
          }
        }

        // Send vote info if in vote phase
        if (game.phase === 'VOTE') {
          socket.emit('vote_update', {
            votedCount: Object.keys(game.votes).length,
            totalCount: game.alivePlayers.length,
          });

          // If player already voted, send confirmation
          if (game.votes[socket.id]) {
            const votedTarget = game.getPlayer(game.votes[socket.id]);
            socket.emit('vote_result', {
              eliminated: null,
              votes: [],
              message: `你已投票给 ${votedTarget ? game.getSeatNum(game.votes[socket.id]) : '未知'}`,
              myVote: game.votes[socket.id], // C15: explicit own-vote for reliable reconnect
            });
          }
        }

        // Send speaker change if in day phase
        if (game.phase === 'DAY' && game.currentSpeaker) {
          socket.emit('speaker_change', {
            currentSpeaker: game.currentSpeaker,
            speakerName: game.getSeatNum(game.currentSpeaker),
            hasSpoken: Array.from(game.hasSpoken || []),
          });
        }

        // Send night role turn if player's role is active
        if (game.phase === 'NIGHT' && game.currentNightRole) {
          socket.emit('night_role_turn', game.currentNightRole);
        }

        // Send seer result if available
        if (game.seerResult && gamePlayer.isAlive && game.roles[socket.id] === 'seer') {
          socket.emit('seer_result', game.seerResult);
        }

        // Send hunter prompt if available
        if (game.hunterPrompt && gamePlayer.isAlive && game.roles[socket.id] === 'hunter') {
          socket.emit('hunter_trigger', game.hunterPrompt);
        }
      }
      console.log(`[roomHandler] ${username} reconnected to active game in room ${code}`);
    }
    
    broadcastRoomUpdate(code);
    socket.emit('room_joined', { code, players: buildPublicPlayers(room.players), seats: buildSeats(room), hostId: room.hostId, maxPlayers: room.maxPlayers, chat: room.chat || [] });
    console.log(`[roomHandler] ${username} reconnected to room ${code}`);
    return room;
  }

  // Check if room is full
  if (room.players.length >= room.maxPlayers) {
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

  // Assign to first empty seat
  const seatIndex = findEmptySeat(room);
  if (seatIndex === -1) {
    socket.emit('error', { message: '没有空座位了' });
    return null;
  }
  player.seatIndex = seatIndex;

  room.players.push(player);
  socket.join(code);

  socketCache.set(socket.id, { userId, username, roomCode: code });

  const welcomeMsg = {
    username: '系统',
    message: `🎉 ${username} 加入了房间！`,
    timestamp: Date.now(),
  };
  room.chat.push(welcomeMsg);
  if (room.chat.length > 100) room.chat = room.chat.slice(-100);

  roomCache.set(code, room);

  console.log(`[roomHandler] ${username} joined room ${code}, players=${room.players.length}`);

  socket.emit('room_joined', { code, players: buildPublicPlayers(room.players), seats: buildSeats(room), hostId: room.hostId, maxPlayers: room.maxPlayers });
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

  // W6: clear any pending disconnect timers so they don't fire after room is gone
  const room = roomCache.get(code);
  if (room && room.players) {
    for (const p of room.players) {
      if (p.disconnectTimer) {
        clearTimeout(p.disconnectTimer);
        p.disconnectTimer = null;
      }
    }
  }

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

    // W7: track the disconnect timer so destroyRoom can clean it up
    player.disconnectTimer = setTimeout(() => {
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

  // Check chat permissions based on game phase
  const game = gameCache.get(code);
  if (game && game.phase !== 'WAITING') {
    const { PHASE } = require('../game/constants');

    // During night, vote, and end phases, no chat allowed
    if (game.phase === PHASE.NIGHT || game.phase === PHASE.VOTE || game.phase === PHASE.END) {
      socket.emit('error', { message: '当前阶段不能发言' });
      return;
    }

    // During last will phase, only the current dead speaker can chat
    if (game.phase === PHASE.LAST_WILL) {
      if (game.currentSpeaker !== socket.id) {
        socket.emit('error', { message: '现在是死亡遗言阶段，只有死者可以发言' });
        return;
      }
    }

    // During day phase (ordered speaking), only current speaker can chat
    if (game.phase === PHASE.DAY) {
      if (game.currentSpeaker !== socket.id) {
        socket.emit('error', { message: '现在轮到其他人发言' });
        return;
      }
    }

    // During discussion phase, everyone can chat (no restriction)
  }

  // W9: rate-limit chat (max 3 messages per second per socket)
  if (isChatRateLimited(socket.id)) {
    socket.emit('error', { message: '发言过快，请稍后再试' });
    return;
  }

  // Use seat number if game is in progress
  let displayName;
  if (game && game.phase !== 'WAITING') {
    const seatNum = (player.seatIndex !== undefined ? player.seatIndex : 0) + 1;
    displayName = `${seatNum}号`;
  } else {
    displayName = player.username;
  }

  console.log(`[roomHandler] chat from ${displayName} in ${code}: ${message}`);

  const chatMsg = {
    username: displayName,
    message,
    timestamp: Date.now(),
  };

  room.chat.push(chatMsg);
  if (room.chat.length > 100) room.chat = room.chat.slice(-100);

  roomCache.set(code, room);

  const io = require('../app').getIO();
  io.to(code).emit('chat_message', chatMsg);
}

/**
 * 规则问答（不进入聊天记录，仅返回给提问者）
 */
async function ruleQA(socket, question) {
  try {
    const answer = await ruleQAService.answerQuestion(question, socket.userId);
    socket.emit('rule_qa_answer', {
      question,
      answer,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error('[roomHandler] ruleQA error:', err.message);
    socket.emit('rule_qa_answer', {
      question,
      answer: '抱歉，回答问题时出错了，请稍后再试。',
      timestamp: Date.now(),
      error: true,
    });
  }
}

/**
 * Broadcast updated player list to room
 */
function broadcastRoomUpdate(code, room = null) {
  if (!room) {
    room = roomCache.get(code);
  }
  if (!room) return;

  const seats = buildSeats(room);

  console.log(`[roomHandler] broadcastRoomUpdate room=${code}, totalPlayers=${room.players.length}, seats=${seats.length}`);

  const io = require('../app').getIO();
  io.to(code).emit('room_update', {
    players: seats.filter(s => s.occupied).map(s => ({
      socketId: s.socketId,
      userId: s.userId,
      username: s.username,
      isReady: s.isReady,
      isAI: s.isAI,
      isAlive: true,
      seatIndex: s.seatIndex,
    })),
    seats,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
  });
}

/**
 * Handle socket disconnect
 */
function handleDisconnect(socket) {
  const info = socketCache.get(socket.id);
  if (!info || !info.roomCode) return;

  const code = info.roomCode;
  const userId = info.userId;

  // Check if there's an active game
  const game = gameCache.get(code);
  const isGameActive = game && game.phase !== 'WAITING' && game.phase !== 'END';

  if (isGameActive) {
    // Game in progress: give player time to reconnect (60 seconds)
    const room = roomCache.get(code);
    if (room) {
      const player = room.players.find(p => p.socketId === socket.id);
      if (player) {
        player.socketId = null; // Mark as disconnected but keep in room
        player.disconnectTime = Date.now();
        roomCache.set(code, room);

        // Also update game player
        const gamePlayer = game.players.find(p => p.userId === userId);
        if (gamePlayer) {
          gamePlayer.socketId = null;
          gamePlayer.disconnectTime = Date.now();
        }

        broadcastRoomUpdate(code);

        console.log(`[roomHandler] Player ${userId} disconnected during game in room ${code}, waiting for reconnection (60s)`);

        // Set timeout to mark as dead if not reconnected (W6: track timer for cleanup)
        player.disconnectTimer = setTimeout(() => {
          const gameCheck = gameCache.get(code);
          if (gameCheck) {
            const gamePlayerCheck = gameCheck.players.find(p => p.userId === userId);
            if (gamePlayerCheck && gamePlayerCheck.disconnectTime) {
              // Player still disconnected after timeout
              const playerInRoom = roomCache.get(code)?.players.find(p => p.userId === userId);
              if (playerInRoom && playerInRoom.socketId === null) {
                // Mark as dead
                if (gamePlayerCheck.isAlive) {
                  gamePlayerCheck.isAlive = false;
                  gameCheck.broadcast('player_disconnected', {
                    id: userId,
                    username: gamePlayerCheck.username || `玩家${gamePlayerCheck.seatIndex + 1}号`,
                    message: `${gamePlayerCheck.username || gamePlayerCheck.seatIndex + 1}号 长时间未连接，视为死亡`,
                  });
                  if (gameCheck.phase !== 'WAITING' && gameCheck.phase !== 'END') {
                    gameCheck.checkWinCondition();
                  }
                }
                // Remove from room
                const roomCheck = roomCache.get(code);
                if (roomCheck) {
                  roomCheck.players = roomCheck.players.filter(p => p.userId !== userId);
                  roomCache.set(code, roomCheck);
                  broadcastRoomUpdate(code);
                }
              }
            }
          }
        }, 60000);
      }
    }
  } else {
    // Game not active: use normal leave logic with 30s timeout
    leaveRoom(socket, code, true);
  }
}

module.exports = { createRoom, joinRoom, leaveRoom, toggleReady, addChat, handleDisconnect, broadcastRoomUpdate, addAIPlayer, removeAIPlayer, buildSeats, buildPublicPlayers, ruleQA, isRuleQARateLimited, cleanupSocketRateLimits };
