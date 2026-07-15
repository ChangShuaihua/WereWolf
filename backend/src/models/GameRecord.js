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

  async getLeaderboard(limit = 50) {
    const [rows] = await pool.query(
      'SELECT id, username, wins, losses, score FROM users ORDER BY score DESC LIMIT ?',
      [limit]
    );
    return rows;
  },

  async getUserHistory(userId, limit = 20) {
    const [rows] = await pool.query(
      `SELECT gr.id, gr.room_code, gr.winner, gr.player_count, gr.duration, gp.role, gp.is_winner, gr.created_at
       FROM game_players gp
       JOIN game_records gr ON gp.game_id = gr.id
       WHERE gp.user_id = ?
       ORDER BY gr.created_at DESC
       LIMIT ?`,
      [userId, limit]
    );
    return rows;
  },
};

module.exports = GameRecord;
