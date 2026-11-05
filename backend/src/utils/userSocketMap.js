const { socketCache, roomCache, gameCache } = require('./cache');

const userToSocket = new Map();

function getUserSocket(userId) {
  return userToSocket.get(userId);
}

function setUserSocket(userId, socketId) {
  const oldSocketId = userToSocket.get(userId);
  userToSocket.set(userId, socketId);
  return oldSocketId;
}

function removeUserSocket(userId, socketId) {
  const currentSocketId = userToSocket.get(userId);
  if (currentSocketId === socketId) {
    userToSocket.delete(userId);
    return true;
  }
  return false;
}

function getUserCount() {
  return userToSocket.size;
}

function getUserBySocket(socketId) {
  for (const [userId, sId] of userToSocket.entries()) {
    if (sId === socketId) return userId;
  }
  return null;
}

function cleanUpOldSocketRoom(io, oldSocketId) {
  const info = socketCache.get(oldSocketId);
  if (!info || !info.roomCode) return;

  const code = info.roomCode;
  const room = roomCache.get(code);
  if (!room) return;

  const player = room.players.find(p => p.socketId === oldSocketId);
  if (player && !player.isAI) {
    player.socketId = null;
    player.disconnectTime = Date.now();
    roomCache.set(code, room);

    const game = gameCache.get(code);
    if (game) {
      const gamePlayer = game.players.find(p => p.socketId === oldSocketId);
      if (gamePlayer) {
        gamePlayer.socketId = null;
        gamePlayer.disconnectTime = Date.now();
      }
    }

    if (game && game.roles && game.roles[oldSocketId]) {
      delete game.roles[oldSocketId];
    }
  }

  if (room.spectators) {
    room.spectators = room.spectators.filter(spectator => spectator.socketId !== oldSocketId);
    roomCache.set(code, room);
  }

  const { abandonRoomIfEmpty, broadcastRoomUpdate } = require('../socket/roomHandler');
  if (abandonRoomIfEmpty(code)) {
    console.log(`[userSocketMap] Room ${code} removed because no humans remain`);
  } else if (player || room.spectators) {
    broadcastRoomUpdate(code);
  }

  socketCache.del(oldSocketId);
}

function kickOldSocket(io, userId, newSocketId) {
  const oldSocketId = userToSocket.get(userId);
  if (oldSocketId && oldSocketId !== newSocketId) {
    const oldSocket = io.sockets.sockets.get(oldSocketId);
    if (oldSocket) {
      console.log(`[userSocketMap] Force logging out old socket ${oldSocketId} for user ${userId}`);

      cleanUpOldSocketRoom(io, oldSocketId);

      oldSocket.emit('force_logout', {
        reason: 'ACCOUNT_USED_ANOTHER_DEVICE',
        message: '您的账号已在其他设备登录，您已被强制下线',
      });

      oldSocket.kicked = true;

      setTimeout(() => {
        oldSocket.disconnect(true);
      }, 500);
    }
  }
  userToSocket.set(userId, newSocketId);
  socketCache.set(newSocketId, {
    ...(socketCache.get(newSocketId) || {}),
    userId,
  });
}

module.exports = {
  getUserSocket,
  setUserSocket,
  removeUserSocket,
  getUserBySocket,
  getUserCount,
  kickOldSocket,
};
