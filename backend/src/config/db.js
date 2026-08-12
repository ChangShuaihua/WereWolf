
const mysql = require('mysql2/promise');
require('dotenv').config();

const DB_NAME = process.env.DB_NAME || 'werewolf';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

// Auto-create database + tables
async function initDB() {
  // Step 1: create database if not exists (connect without db)
  const tmpConn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });
  await tmpConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` DEFAULT CHARSET utf8mb4`);
  await tmpConn.end();

  // Step 2: create tables
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        score INT DEFAULT 0,
        total_games INT DEFAULT 0,
        total_wins INT DEFAULT 0,
        total_losses INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 兼容已有数据库：添加积分字段（如不存在）
    const [userColumns] = await conn.query('SHOW COLUMNS FROM users');
    const userColumnNames = new Set(userColumns.map(c => c.Field));
    if (!userColumnNames.has('score')) {
      await conn.query('ALTER TABLE users ADD COLUMN score INT DEFAULT 0 AFTER password');
    }
    if (!userColumnNames.has('total_games')) {
      await conn.query('ALTER TABLE users ADD COLUMN total_games INT DEFAULT 0 AFTER score');
    }
    if (!userColumnNames.has('total_wins')) {
      await conn.query('ALTER TABLE users ADD COLUMN total_wins INT DEFAULT 0 AFTER total_games');
    }
    if (!userColumnNames.has('total_losses')) {
      await conn.query('ALTER TABLE users ADD COLUMN total_losses INT DEFAULT 0 AFTER total_wins');
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS game_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_code VARCHAR(6) NOT NULL,
        winner ENUM('werewolf', 'villager') NOT NULL,
        player_count INT NOT NULL,
        duration INT NOT NULL,
        replay_data JSON NULL,
        analysis JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Keep existing installations compatible with the richer replay format.
    const [gameRecordColumns] = await conn.query('SHOW COLUMNS FROM game_records');
    const gameRecordColumnNames = new Set(gameRecordColumns.map(column => column.Field));
    if (!gameRecordColumnNames.has('replay_data')) {
      await conn.query('ALTER TABLE game_records ADD COLUMN replay_data JSON NULL AFTER duration');
    }
    if (!gameRecordColumnNames.has('analysis')) {
      await conn.query('ALTER TABLE game_records ADD COLUMN analysis JSON NULL AFTER replay_data');
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS game_players (
        id INT AUTO_INCREMENT PRIMARY KEY,
        game_id INT NOT NULL,
        user_id INT NOT NULL,
        role VARCHAR(20) NOT NULL,
        is_winner BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (game_id) REFERENCES game_records(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS ai_agents (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        avatar VARCHAR(32) NOT NULL,
        personality JSON NOT NULL,
        speaking_style VARCHAR(32) NOT NULL,
        strategy JSON NOT NULL,
        language JSON NOT NULL,
        created_at_ms BIGINT NOT NULL,
        updated_at_ms BIGINT NOT NULL,
        INDEX idx_ai_agents_created_at (created_at_ms)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log(`Database "${DB_NAME}" initialized successfully`);
  } finally {
    conn.release();
  }
}

module.exports = { pool, initDB };
