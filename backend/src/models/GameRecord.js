const { pool } = require('../config/db');

const GameRecord = {
  async create(roomCode, winner, playerCount, duration, replayData = null, analysis = null) {
    const [result] = await pool.query(
      `INSERT INTO game_records
        (room_code, winner, player_count, duration, replay_data, analysis)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [roomCode, winner, playerCount, duration, JSON.stringify(replayData), JSON.stringify(analysis)]
    );
    return result.insertId;
  },

  async addPlayer(gameId, userId, role, isWinner) {
    await pool.query(
      'INSERT INTO game_players (game_id, user_id, role, is_winner) VALUES (?, ?, ?, ?)',
      [gameId, userId, role, isWinner]
    );
  },

  // 获取用户战绩列表（分页）
  async getHistoryForUser(userId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      `SELECT gr.id, gr.room_code, gr.winner, gr.player_count, gr.duration,
              gr.created_at, gp.role, gp.is_winner
       FROM game_records gr
       INNER JOIN game_players gp ON gp.game_id = gr.id
       WHERE gp.user_id = ?
       ORDER BY gr.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    // 获取总数
    const [countRows] = await pool.query(
      'SELECT COUNT(*) as total FROM game_players WHERE user_id = ?',
      [userId]
    );

    return {
      records: rows.map(r => ({
        id: r.id,
        roomCode: r.room_code,
        winner: r.winner,
        playerCount: r.player_count,
        duration: r.duration,
        createdAt: r.created_at,
        role: r.role,
        isWinner: !!r.is_winner,
      })),
      total: countRows[0].total,
      page,
      limit,
    };
  },

  async findForUser(gameId, userId) {
    const [rows] = await pool.query(
      `SELECT gr.id, gr.room_code, gr.winner, gr.player_count, gr.duration,
              gr.replay_data, gr.analysis, gr.created_at
       FROM game_records gr
       INNER JOIN game_players gp ON gp.game_id = gr.id
       WHERE gr.id = ? AND gp.user_id = ?
       LIMIT 1`,
      [gameId, userId]
    );
    if (!rows[0]) return null;
    return {
      id: rows[0].id,
      roomCode: rows[0].room_code,
      winner: rows[0].winner,
      playerCount: rows[0].player_count,
      duration: rows[0].duration,
      createdAt: rows[0].created_at,
      replay: parseJson(rows[0].replay_data, {}),
      analysis: parseJson(rows[0].analysis, {}),
    };
  },

  // 根据真实的 game_players 记录重算单个用户的总场次/胜场/负场/积分（赢+1，输-1，下限0）
  async calcRealStatsForUser(userId) {
    const [rows] = await pool.query(
      `SELECT
         COUNT(gp.id) AS actual_games,
         SUM(CASE WHEN gp.is_winner THEN 1 ELSE 0 END) AS actual_wins,
         SUM(CASE WHEN gp.is_winner THEN 0 ELSE 1 END) AS actual_losses
       FROM game_players gp
       WHERE gp.user_id = ?`,
      [userId]
    );
    const r = rows[0] || { actual_games: 0, actual_wins: 0, actual_losses: 0 };
    const totalGames = Number(r.actual_games) || 0;
    const totalWins = Number(r.actual_wins) || 0;
    const totalLosses = Number(r.actual_losses) || 0;
    // 赢 +1，输 -1，下限 0
    const score = Math.max(0, totalWins - totalLosses);
    return { totalGames, totalWins, totalLosses, score };
  },
};

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    return fallback;
  }
}

module.exports = GameRecord;
