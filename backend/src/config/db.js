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

/**
 * 数据库迁移清单 —— 有序执行。
 * 新增改动只需要在末尾 push 一条新迁移：
 *   { version: 4, up: async (conn) => { await conn.query('...'); } }
 * 系统会自动跳过已执行过的版本。
 */
const MIGRATIONS = [
  {
    version: 1,
    description: '创建基础表：users / game_records / game_players / ai_agents',
    up: async (conn) => {
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
          owner_id INT NULL,
          name VARCHAR(100) NOT NULL,
          avatar VARCHAR(32) NOT NULL,
          personality JSON NOT NULL,
          speaking_style VARCHAR(32) NOT NULL,
          strategy JSON NOT NULL,
          language JSON NOT NULL,
          created_at_ms BIGINT NOT NULL,
          updated_at_ms BIGINT NOT NULL,
          INDEX idx_ai_agents_created_at (created_at_ms),
          INDEX idx_ai_agents_owner (owner_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    },
  },
  {
    version: 2,
    description: 'users 表补齐 score/total_games/total_wins/total_losses（兼容老库）',
    up: async (conn) => {
      const [cols] = await conn.query('SHOW COLUMNS FROM users');
      const existing = new Set(cols.map((c) => c.Field));
      if (!existing.has('score'))
        await conn.query('ALTER TABLE users ADD COLUMN score INT DEFAULT 0 AFTER password');
      if (!existing.has('total_games'))
        await conn.query('ALTER TABLE users ADD COLUMN total_games INT DEFAULT 0 AFTER score');
      if (!existing.has('total_wins'))
        await conn.query('ALTER TABLE users ADD COLUMN total_wins INT DEFAULT 0 AFTER total_games');
      if (!existing.has('total_losses'))
        await conn.query(
          'ALTER TABLE users ADD COLUMN total_losses INT DEFAULT 0 AFTER total_wins'
        );
    },
  },
  {
    version: 3,
    description: 'game_records 表补齐 replay_data/analysis（兼容老库）',
    up: async (conn) => {
      const [cols] = await conn.query('SHOW COLUMNS FROM game_records');
      const existing = new Set(cols.map((c) => c.Field));
      if (!existing.has('replay_data'))
        await conn.query(
          'ALTER TABLE game_records ADD COLUMN replay_data JSON NULL AFTER duration'
        );
      if (!existing.has('analysis'))
        await conn.query(
          'ALTER TABLE game_records ADD COLUMN analysis JSON NULL AFTER replay_data'
        );
    },
  },
  {
    version: 4,
    description: 'ai_agents 表补齐 owner_id（兼容老库）',
    up: async (conn) => {
      const [cols] = await conn.query('SHOW COLUMNS FROM ai_agents');
      const existing = new Set(cols.map((c) => c.Field));
      if (!existing.has('owner_id')) {
        await conn.query(
          'ALTER TABLE ai_agents ADD COLUMN owner_id INT NULL AFTER id, ADD INDEX idx_ai_agents_owner (owner_id)'
        );
      }
    },
  },
  {
    version: 5,
    description: 'users 表增加 AI fallback 偏好',
    up: async (conn) => {
      const [cols] = await conn.query('SHOW COLUMNS FROM users');
      const existing = new Set(cols.map((c) => c.Field));
      if (!existing.has('ai_fallback_enabled')) {
        await conn.query(
          'ALTER TABLE users ADD COLUMN ai_fallback_enabled BOOLEAN NOT NULL DEFAULT TRUE AFTER total_losses'
        );
      }
    },
  },
  {
    version: 6,
    description: '积分规则改为累计胜场数',
    up: async (conn) => {
      await conn.query('UPDATE users SET score = total_wins');
    },
  },
  {
    version: 7,
    description: 'users 表增加用户级大模型 API 配置（api_key/api_url/model_name）',
    up: async (conn) => {
      const [cols] = await conn.query('SHOW COLUMNS FROM users');
      const existing = new Set(cols.map((c) => c.Field));
      if (!existing.has('api_key'))
        await conn.query(
          'ALTER TABLE users ADD COLUMN api_key VARCHAR(500) NULL AFTER ai_fallback_enabled'
        );
      if (!existing.has('api_url'))
        await conn.query('ALTER TABLE users ADD COLUMN api_url VARCHAR(255) NULL AFTER api_key');
      if (!existing.has('model_name'))
        await conn.query('ALTER TABLE users ADD COLUMN model_name VARCHAR(100) NULL AFTER api_url');
    },
  },
  {
    version: 8,
    description: '扩大用户 LLM API Key 字段以容纳加密数据',
    up: async (conn) => {
      await conn.query('ALTER TABLE users MODIFY COLUMN api_key TEXT NULL');
    },
  },
];

async function ensureTableExists(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  const [rows] = await conn.query('SELECT MAX(version) AS v FROM schema_version');
  return (rows[0] && rows[0].v) || 0;
}

// Auto-create database + tables with migrations
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

  // Step 2: run migrations sequentially with tx
  const conn = await pool.getConnection();
  try {
    await conn.query('USE ' + DB_NAME);
    await ensureTableExists(conn);
    const [appliedRows] = await conn.query('SELECT version FROM schema_version');
    const applied = new Set(appliedRows.map((r) => r.version));

    let appliedCount = 0;
    for (const m of MIGRATIONS) {
      if (applied.has(m.version)) continue;
      // 单迁移事务：出错即回滚，不会留下半迁移
      await conn.beginTransaction();
      try {
        await m.up(conn);
        await conn.query('INSERT INTO schema_version (version, name) VALUES (?, ?)', [
          m.version,
          m.description,
        ]);
        await conn.commit();
        appliedCount++;
        console.log(`[DB Migration] v${m.version} applied: ${m.description}`);
      } catch (e) {
        await conn.rollback();
        console.error(`[DB Migration] v${m.version} failed: ${m.description}`, e.message);
        throw e;
      }
    }

    if (appliedCount === 0) {
      console.log(`Database "${DB_NAME}" is up to date (${applied.size} migrations)`);
    } else {
      console.log(
        `Database "${DB_NAME}" initialized with ${appliedCount} new migration(s) (total ${applied.size})`
      );
    }
  } finally {
    conn.release();
  }
}

module.exports = { pool, initDB, getPool: () => pool };
