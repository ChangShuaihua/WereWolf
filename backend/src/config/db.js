const mysql = require('mysql2/promise');
require('dotenv').config();

const DB_NAME = process.env.DB_NAME || 'werewolf';
const MIGRATION_LOCK_TIMEOUT_SEC = 30;

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

function assertSqlIdent(name) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`[DB Migration] unsafe SQL identifier: ${name}`);
  }
}

function assertMigrationVersions(migrations) {
  let previous = 0;
  const seen = new Set();
  for (const migration of migrations) {
    const version = migration && migration.version;
    if (!Number.isInteger(version) || version < 1) {
      throw new Error(`[DB Migration] invalid version: ${version}`);
    }
    if (seen.has(version)) {
      throw new Error(`[DB Migration] duplicate version: ${version}`);
    }
    if (version <= previous) {
      throw new Error(
        `[DB Migration] versions must strictly increase: v${version} follows v${previous}`
      );
    }
    if (typeof migration.description !== 'string' || migration.description.trim() === '') {
      throw new Error(`[DB Migration] v${version} is missing a description`);
    }
    if (typeof migration.up !== 'function') {
      throw new Error(`[DB Migration] v${version} is missing up()`);
    }
    seen.add(version);
    previous = version;
  }
}

async function columnSet(conn, table) {
  assertSqlIdent(table);
  const [cols] = await conn.query(`SHOW COLUMNS FROM \`${table}\``);
  return new Set(cols.map((column) => column.Field));
}

/**
 * 数据库迁移清单 —— 按版本号递增执行。已写入 schema_version 的 up() 不能再改，修正用新版本。
 * 新增改动只在末尾追加：
 *   { version: 11, description: '...', up: async (conn) => { ... } }
 * 结构变更必须可重入：建表用 IF NOT EXISTS，加列前先查列是否存在。
 * 加列和数据回填分成相邻两个版本。MySQL 的 CREATE/ALTER 会隐式提交，失败后靠可重入重跑。
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
      const existing = await columnSet(conn, 'users');
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
      const existing = await columnSet(conn, 'game_records');
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
      const existing = await columnSet(conn, 'ai_agents');
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
      const existing = await columnSet(conn, 'users');
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
      const existing = await columnSet(conn, 'users');
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
      const [cols] = await conn.query('SHOW COLUMNS FROM users');
      const apiKey = cols.find((column) => column.Field === 'api_key');
      if (!apiKey) {
        throw new Error('users.api_key is missing; migration v7 must be applied first');
      }
      if (!String(apiKey.Type).toLowerCase().includes('text')) {
        await conn.query('ALTER TABLE users MODIFY COLUMN api_key TEXT NULL');
      }
    },
  },
  {
    version: 9,
    description: '双 token 登录：refresh_tokens 表（refresh token 哈希存储）',
    up: async (conn) => {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          token_hash CHAR(64) NOT NULL,
          expires_at DATETIME NOT NULL,
          revoked_at DATETIME NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_token_hash (token_hash),
          KEY idx_refresh_user (user_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    },
  },
  {
    version: 10,
    description: 'users 表增加头像地址',
    up: async (conn) => {
      const existing = await columnSet(conn, 'users');
      if (!existing.has('avatar_url')) {
        await conn.query('ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) NULL AFTER username');
      }
    },
  },
];

async function ensureSchemaVersionTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

function migrationLockName() {
  const name = `werewolf_schema_${DB_NAME}`;
  return name.length <= 64 ? name : name.slice(0, 64);
}

async function acquireMigrationLock(conn) {
  const lockName = migrationLockName();
  const [rows] = await conn.query('SELECT GET_LOCK(?, ?) AS locked', [
    lockName,
    MIGRATION_LOCK_TIMEOUT_SEC,
  ]);
  if (!rows[0] || Number(rows[0].locked) !== 1) {
    throw new Error(
      `[DB Migration] could not acquire lock "${lockName}" within ${MIGRATION_LOCK_TIMEOUT_SEC}s`
    );
  }
  return lockName;
}

async function releaseMigrationLock(conn, lockName) {
  try {
    await conn.query('SELECT RELEASE_LOCK(?)', [lockName]);
  } catch (err) {
    console.error('[DB Migration] failed to release lock', err.message);
  }
}

async function appliedVersionSet(conn) {
  const [rows] = await conn.query('SELECT version FROM schema_version');
  return new Set(rows.map((row) => Number(row.version)));
}

async function applyMigration(conn, migration) {
  // 纯数据变更和记版本在同一个事务里提交。CREATE/ALTER 会隐式提交，撤不回，所以结构语句必须可重入。
  await conn.beginTransaction();
  try {
    await migration.up(conn);
    await conn.query('INSERT INTO schema_version (version, name) VALUES (?, ?)', [
      migration.version,
      migration.description,
    ]);
    await conn.commit();
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rollbackErr) {
      console.error('[DB Migration] rollback failed', rollbackErr.message);
    }
    console.error(
      `[DB Migration] v${migration.version} failed: ${migration.description}`,
      err.message
    );
    throw err;
  }
}

// Auto-create database + tables with migrations
async function initDB() {
  assertSqlIdent(DB_NAME);
  assertMigrationVersions(MIGRATIONS);

  const tmpConn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });
  try {
    await tmpConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` DEFAULT CHARSET utf8mb4`);
  } finally {
    await tmpConn.end();
  }

  const conn = await pool.getConnection();
  let lockName = null;
  try {
    await conn.query(`USE \`${DB_NAME}\``);
    lockName = await acquireMigrationLock(conn);
    await ensureSchemaVersionTable(conn);
    const applied = await appliedVersionSet(conn);

    let appliedCount = 0;
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) continue;
      await applyMigration(conn, migration);
      applied.add(migration.version);
      appliedCount += 1;
      console.log(`[DB Migration] v${migration.version} applied: ${migration.description}`);
    }

    const recorded = await appliedVersionSet(conn);
    for (const migration of MIGRATIONS) {
      if (!recorded.has(migration.version)) {
        throw new Error(
          `[DB Migration] v${migration.version} is missing from schema_version after apply`
        );
      }
    }

    if (appliedCount === 0) {
      console.log(`Database "${DB_NAME}" is up to date (${recorded.size} migrations)`);
    } else {
      console.log(
        `Database "${DB_NAME}" initialized with ${appliedCount} new migration(s) (total ${recorded.size})`
      );
    }
  } finally {
    if (lockName) await releaseMigrationLock(conn, lockName);
    conn.release();
  }
}

module.exports = {
  pool,
  initDB,
  getPool: () => pool,
  MIGRATIONS,
  assertMigrationVersions,
  assertSqlIdent,
};
