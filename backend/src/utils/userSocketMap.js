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
    room.players = room.players.filter(p => p.socketId !== oldSocketId);

    if (room.hostId === oldSocketId && room.players.length > 0) {
      room.hostId = room.players[0].socketId;
      room.hostUserId = room.players[0].userId;
    }

    roomCache.set(code, room);

    const game = gameCache.get(code);
    if (game) {
      const gamePlayer = game.players.find(p => p.socketId === oldSocketId);
      if (gamePlayer) {
        gamePlayer.socketId = null;
        gamePlayer.disconnectTime = null;
      }
    }

    io.to(code).emit('room_update', {
      code,
      players: room.players.map(p => ({
        socketId: p.socketId,
        username: p.username,
        seatIndex: p.seatIndex,
        isAlive: p.isAlive,
        isReady: p.isReady,
        isHost: p.socketId === room.hostId,
      })),
      hostId: room.hostId,
    });

    console.log(`[userSocketMap] Cleaned up old socket ${oldSocketId} from room ${code}`);
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
