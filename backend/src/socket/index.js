const { createRoom, joinRoom, leaveRoom, toggleReady, addChat, handleDisconnect } = require('./roomHandler');
const { startGame, handleNightAction, handleVote, skipDay, resetGame } = require('./gameHandler');
const { socketCache } = require('../utils/cache');

/**
 * Initialize Socket.io with all event handlers
 */
function initSocket(io) {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Authenticate on connection
    socket.on('authenticate', ({ userId, username }) => {
      socketCache.set(socket.id, { userId, username, roomCode: null });
      socket.emit('authenticated', { socketId: socket.id });
      console.log(`User authenticated: ${username} (${socket.id})`);
    });

    // Create room
    socket.on('create_room', ({ username, userId }) => {
      console.log(`[socket] create_room from ${username} (${socket.id})`);
      const code = createRoom(socket, username, userId);
      if (code) {
        socket.emit('room_created', { code });
      }
    });

    // Join room
    socket.on('join_room', ({ roomCode, username, userId }) => {
      console.log(`[socket] join_room ${roomCode} from ${username} (${socket.id})`);
      joinRoom(socket, roomCode, username, userId);
    });

    // Leave room
    socket.on('leave_room', ({ roomCode } = {}) => {
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
      if (roomCode && message) addChat(socket, roomCode, message);
    });

    // Reset game and return to room
    socket.on('reset_game', () => {
      const info = socketCache.get(socket.id);
      if (info?.roomCode) resetGame(info.roomCode);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      handleDisconnect(socket);
    });
  });
}

module.exports = initSocket;
