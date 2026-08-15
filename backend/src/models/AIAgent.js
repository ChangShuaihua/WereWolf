const { pool } = require('../config/db');

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch (err) {
    return fallback;
  }
}

function toAgent(row) {
  if (!row) return null;

  return {
    id: row.id,
    ownerId: row.owner_id ? Number(row.owner_id) : null,
    name: row.name,
    avatar: row.avatar,
    personality: parseJson(row.personality, {}),
    speakingStyle: row.speaking_style,
    strategy: parseJson(row.strategy, {}),
    language: parseJson(row.language, {}),
    createdAt: Number(row.created_at_ms),
    updatedAt: Number(row.updated_at_ms),
  };
}

const AIAgent = {
  async count() {
    const [rows] = await pool.query('SELECT COUNT(*) AS count FROM ai_agents');
    return rows[0]?.count || 0;
  },

  async findAll() {
    const [rows] = await pool.query(
      'SELECT * FROM ai_agents ORDER BY created_at_ms ASC'
    );
    return rows.map(toAgent);
  },

  async findById(id) {
    const [rows] = await pool.query(
      'SELECT * FROM ai_agents WHERE id = ?',
      [id]
    );
    return toAgent(rows[0]);
  },

  async create(agent) {
    await pool.query(
      `INSERT INTO ai_agents
        (id, owner_id, name, avatar, personality, speaking_style, strategy, language, created_at_ms, updated_at_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        agent.id,
        agent.ownerId || null,
        agent.name,
        agent.avatar,
        JSON.stringify(agent.personality),
        agent.speakingStyle,
        JSON.stringify(agent.strategy),
        JSON.stringify(agent.language),
        agent.createdAt,
        agent.updatedAt,
      ]
    );
    return this.findById(agent.id);
  },

  async update(id, agent) {
    const [result] = await pool.query(
      `UPDATE ai_agents SET
        name = ?,
        avatar = ?,
        personality = ?,
        speaking_style = ?,
        strategy = ?,
        language = ?,
        updated_at_ms = ?
       WHERE id = ?`,
      [
        agent.name,
        agent.avatar,
        JSON.stringify(agent.personality),
        agent.speakingStyle,
        JSON.stringify(agent.strategy),
        JSON.stringify(agent.language),
        agent.updatedAt,
        id,
      ]
    );

    if (result.affectedRows === 0) return null;
    return this.findById(id);
  },

  async delete(id) {
    const [result] = await pool.query(
      'DELETE FROM ai_agents WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  },

  async bulkInsertIfEmpty(agents) {
    const existingCount = await this.count();
    if (existingCount > 0 || agents.length === 0) return false;

    const values = agents.map(agent => [
      agent.id,
      agent.ownerId || null,
      agent.name,
      agent.avatar,
      JSON.stringify(agent.personality),
      agent.speakingStyle,
      JSON.stringify(agent.strategy),
      JSON.stringify(agent.language),
      agent.createdAt,
      agent.updatedAt,
    ]);

    await pool.query(
      `INSERT INTO ai_agents
        (id, owner_id, name, avatar, personality, speaking_style, strategy, language, created_at_ms, updated_at_ms)
       VALUES ?`,
      [values]
    );

    return true;
  },
};

module.exports = AIAgent;
