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
  if (player) {
    // Don't remove the player — just mark as disconnected so reconnection works
    // on the new socket. The actual removal is handled by handleDisconnect's
    // timeout logic (60s for active game, 30s for waiting room).
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

    // Also clear the role mapping for the old socketId
    if (game && game.roles && game.roles[oldSocketId]) {
      delete game.roles[oldSocketId];
    }

    broadcastRoomUpdate(code);

    console.log(`[userSocketMap] Marked old socket ${oldSocketId} as disconnected in room ${code}, player preserved for reconnection`);
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
