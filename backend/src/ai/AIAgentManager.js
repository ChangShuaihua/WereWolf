const AIAgent = require('../models/AIAgent');

// 默认智能体
const DEFAULT_AGENTS = [
  {
    id: 'agent-1',
    name: '精明的预言家',
    avatar: '🔮',
    personality: {
      aggressiveness: 70,
      caution: 60,
      cunning: 80,
      honesty: 40,
      talkativeness: 80
    },
    speakingStyle: 'serious',
    strategy: {
      nightAction: 'target_strong',
      dayStrategy: 'leader',
      revealIdentity: 'early'
    },
    language: {
      prefixes: ['我查的', '昨晚我'],
      suffixes: ['大家信我', '绝对没错'],
      favoriteWords: ['查杀', '金水', '铁狼']
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'agent-2',
    name: '冷静的村民',
    avatar: '👨‍🌾',
    personality: {
      aggressiveness: 30,
      caution: 80,
      cunning: 20,
      honesty: 90,
      talkativeness: 50
    },
    speakingStyle: 'calm',
    strategy: {
      nightAction: 'random',
      dayStrategy: 'follower',
      revealIdentity: 'never'
    },
    language: {
      prefixes: ['我觉得', '依我看'],
      suffixes: ['对吧', '大家觉得呢'],
      favoriteWords: ['好人', '平民', '出']
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'agent-3',
    name: '狡猾的狼人',
    avatar: '🐺',
    personality: {
      aggressiveness: 80,
      caution: 50,
      cunning: 95,
      honesty: 10,
      talkativeness: 70
    },
    speakingStyle: 'aggressive',
    strategy: {
      nightAction: 'target_weak',
      dayStrategy: 'active',
      revealIdentity: 'never'
    },
    language: {
      prefixes: ['我怀疑', '听我说'],
      suffixes: ['绝对是狼', '票他'],
      favoriteWords: ['查杀', '狼', '投']
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'agent-4',
    name: '神秘的女巫',
    avatar: '🧪',
    personality: {
      aggressiveness: 50,
      caution: 90,
      cunning: 70,
      honesty: 30,
      talkativeness: 40
    },
    speakingStyle: 'mysterious',
    strategy: {
      nightAction: 'target_strong',
      dayStrategy: 'passive',
      revealIdentity: 'late'
    },
    language: {
      prefixes: ['我有药', '昨晚'],
      suffixes: ['你们懂的', '不多说了'],
      favoriteWords: ['救', '毒', '药']
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'agent-5',
    name: '强势的猎人',
    avatar: '🏹',
    personality: {
      aggressiveness: 95,
      caution: 30,
      cunning: 40,
      honesty: 70,
      talkativeness: 60
    },
    speakingStyle: 'aggressive',
    strategy: {
      nightAction: 'random',
      dayStrategy: 'leader',
      revealIdentity: 'early'
    },
    language: {
      prefixes: ['谁敢投我', '我是猎人'],
      suffixes: ['开枪带走你', '不信试试'],
      favoriteWords: ['枪', '带走', '猎人']
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'agent-6',
    name: '幽默的平民',
    avatar: '😂',
    personality: {
      aggressiveness: 40,
      caution: 50,
      cunning: 60,
      honesty: 60,
      talkativeness: 90
    },
    speakingStyle: 'humorous',
    strategy: {
      nightAction: 'random',
      dayStrategy: 'active',
      revealIdentity: 'never'
    },
    language: {
      prefixes: ['哈哈', '笑死'], 
      suffixes: ['狗头', '滑稽'],
      favoriteWords: ['村民', '快乐', '狼']
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'agent-7',
    name: '新手小白',
    avatar: '🐣',
    personality: {
      aggressiveness: 20,
      caution: 70,
      cunning: 20,
      honesty: 80,
      talkativeness: 30
    },
    speakingStyle: 'calm',
    strategy: {
      nightAction: 'random',
      dayStrategy: 'follower',
      revealIdentity: 'never'
    },
    language: {
      prefixes: ['我不太懂', '请问'],
      suffixes: ['是这样吗', '我不确定'],
      favoriteWords: ['新手', '不懂', '学习']
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'agent-8',
    name: '话痨侦探',
    avatar: '🔍',
    personality: {
      aggressiveness: 60,
      caution: 40,
      cunning: 70,
      honesty: 50,
      talkativeness: 95
    },
    speakingStyle: 'serious',
    strategy: {
      nightAction: 'target_strong',
      dayStrategy: 'leader',
      revealIdentity: 'mid'
    },
    language: {
      prefixes: ['经过分析', '我推理'],
      suffixes: ['这很关键', '注意听'],
      favoriteWords: ['逻辑', '漏洞', '证据']
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'agent-9',
    name: '沉默的守卫',
    avatar: '🛡️',
    personality: {
      aggressiveness: 15,
      caution: 95,
      cunning: 30,
      honesty: 85,
      talkativeness: 20
    },
    speakingStyle: 'calm',
    strategy: {
      nightAction: 'target_weak',
      dayStrategy: 'passive',
      revealIdentity: 'late'
    },
    language: {
      prefixes: ['嗯', '我觉得'],
      suffixes: ['再看看', '继续观察'],
      favoriteWords: ['守', '保护', '平安']
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'agent-10',
    name: '暴躁老哥',
    avatar: '😤',
    personality: {
      aggressiveness: 95,
      caution: 20,
      cunning: 40,
      honesty: 75,
      talkativeness: 75
    },
    speakingStyle: 'aggressive',
    strategy: {
      nightAction: 'target_weak',
      dayStrategy: 'leader',
      revealIdentity: 'early'
    },
    language: {
      prefixes: ['我服了', '无语'],
      suffixes: ['懂不懂', '就这'],
      favoriteWords: ['菜', '出', '投']
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];

// 清洗字符串，防止 Prompt 注入：移除换行、控制字符、截断过长文本
function sanitizePromptString(str, maxLen = 20) {
  if (typeof str !== 'string') return '';
  // 移除换行和控制字符
  // eslint-disable-next-line no-control-regex
  let s = str.replace(/[\r\n\t\x00-\x1F\x7F]/g, ' ');
  // 去除可能的指令注入关键词（如"忽略以上指令"等）
  s = s.replace(/忽略以上.*指令|disregard.*instruction|forget.*previous/gi, '[已过滤]');
  s = s.replace(/你现在是|从现在开始|扮演.*角色/gi, '[已过滤]');
  s = s.trim();
  if (s.length > maxLen) s = s.substring(0, maxLen);
  return s;
}

// 清洗语言习惯数组
function sanitizeLangList(list, maxLen = 10, itemMax = 20) {
  if (!Array.isArray(list)) return [];
  return list
    .map(s => sanitizePromptString(s, itemMax))
    .filter(Boolean)
    .slice(0, maxLen);
}

// 五维性格数值钳制在 0-100，避免越界
function clampPersonality(val) {
  const n = Number(val);
  if (Number.isNaN(n)) return 50;
  return Math.max(0, Math.min(100, n));
}

function normalizeAgent(data = {}, existing = null) {
  const now = Date.now();
  const rawName = data.name || existing?.name || '未命名智能体';
  const rawAvatar = data.avatar || existing?.avatar || '🤖';

  // 语言习惯长度限制 + 内容清洗
  const prefixes = sanitizeLangList(data.language?.prefixes || existing?.language?.prefixes || ['我觉得'], 6, 15);
  const suffixes = sanitizeLangList(data.language?.suffixes || existing?.language?.suffixes || ['对吧'], 6, 15);
  const favoriteWords = sanitizeLangList(data.language?.favoriteWords || existing?.language?.favoriteWords || ['狼', '好人'], 10, 10);

  // 说话风格白名单
  const STYLE_WHITELIST = ['humorous', 'serious', 'aggressive', 'calm', 'mysterious'];
  let speakingStyle = data.speakingStyle || existing?.speakingStyle || 'calm';
  if (!STYLE_WHITELIST.includes(speakingStyle)) speakingStyle = 'calm';

  // 策略白名单
  const NIGHT_ACTION_WL = ['random', 'target_weak', 'target_strong', 'follow_teammate'];
  const DAY_STRATEGY_WL = ['passive', 'active', 'leader', 'follower'];
  const REVEAL_WL = ['early', 'mid', 'late', 'never'];
  const nightAction = NIGHT_ACTION_WL.includes(data.strategy?.nightAction)
    ? data.strategy.nightAction : (existing?.strategy?.nightAction || 'random');
  const dayStrategy = DAY_STRATEGY_WL.includes(data.strategy?.dayStrategy)
    ? data.strategy.dayStrategy : (existing?.strategy?.dayStrategy || 'passive');
  const revealIdentity = REVEAL_WL.includes(data.strategy?.revealIdentity)
    ? data.strategy.revealIdentity : (existing?.strategy?.revealIdentity || 'mid');

  return {
    id: existing?.id || data.id || `agent-${now}`,
    name: sanitizePromptString(rawName, 30) || '未命名智能体',
    avatar: (rawAvatar && rawAvatar.length <= 4) ? rawAvatar : '🤖',
    personality: {
      aggressiveness: clampPersonality(data.personality?.aggressiveness ?? existing?.personality?.aggressiveness ?? 50),
      caution: clampPersonality(data.personality?.caution ?? existing?.personality?.caution ?? 50),
      cunning: clampPersonality(data.personality?.cunning ?? existing?.personality?.cunning ?? 50),
      honesty: clampPersonality(data.personality?.honesty ?? existing?.personality?.honesty ?? 50),
      talkativeness: clampPersonality(data.personality?.talkativeness ?? existing?.personality?.talkativeness ?? 50),
    },
    speakingStyle,
    strategy: { nightAction, dayStrategy, revealIdentity },
    language: { prefixes, suffixes, favoriteWords },
    createdAt: existing?.createdAt || data.createdAt || now,
    updatedAt: existing ? now : (data.updatedAt || now),
  };
}

class AIAgentManager {
  constructor() {
    this.availableAgents = [];// 默认智能体列表
    this.initialized = false;// 初始化状态
  }

  async init() {
    if (this.initialized) return;
    await AIAgent.bulkInsertIfEmpty(DEFAULT_AGENTS.map(agent => normalizeAgent(agent)));
    await this.resetRandomAgents();
    this.initialized = true;
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }

  async getAllAgents() {
    await this.ensureInitialized();
    return AIAgent.findAll();
  }

  async getAgentById(id) {
    await this.ensureInitialized();
    return AIAgent.findById(id);
  }
// 创建一个智能体
  async createAgent(data, ownerId = null) {
    await this.ensureInitialized();
    const agent = normalizeAgent(data);
    agent.ownerId = ownerId;
    const created = await AIAgent.create(agent);
    await this.resetRandomAgents();
    return created;
  }
// 更新一个智能体
  async updateAgent(id, data) {
    await this.ensureInitialized();
    const existing = await AIAgent.findById(id);
    if (!existing) return null;

    const updated = await AIAgent.update(id, normalizeAgent(data, existing));
    await this.resetRandomAgents();
    return updated;
  }
// 删除一个智能体
  async deleteAgent(id) {
    await this.ensureInitialized();
    const success = await AIAgent.delete(id);
    if (success) {
      await this.resetRandomAgents();
    }
    return success;
  }
// 随机获取一个智能体
  async getRandomAgent() {
    await this.ensureInitialized();

    if (this.availableAgents.length === 0) {
      await this.resetRandomAgents();
    }

    if (this.availableAgents.length === 0) {
      return null;
    }

    const index = Math.floor(Math.random() * this.availableAgents.length);
    const agent = this.availableAgents[index];
    this.availableAgents.splice(index, 1);
    return agent;
  }
// 重置随机获取的智能体
  async resetRandomAgents() {
    this.availableAgents = await AIAgent.findAll();
  }
}

module.exports = new AIAgentManager();
