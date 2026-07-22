const { pool } = require('../config/db');

const GameRecord = {
  async create(roomCode, winner, playerCount, duration) {
    const [result] = await pool.query(
      'INSERT INTO game_records (room_code, winner, player_count, duration) VALUES (?, ?, ?, ?)',
      [roomCode, winner, playerCount, duration]
    );
    return result.insertId;
  },

  async addPlayer(gameId, userId, role, isWinner) {
    await pool.query(
      'INSERT INTO game_players (game_id, user_id, role, is_winner) VALUES (?, ?, ?, ?)',
      [gameId, userId, role, isWinner]
    );
  },
};

module.exports = GameRecord;
