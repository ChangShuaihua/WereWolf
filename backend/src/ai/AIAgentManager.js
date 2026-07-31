const AIAgent = require('../models/AIAgent');

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

function normalizeAgent(data = {}, existing = null) {
  const now = Date.now();

  return {
    id: existing?.id || data.id || `agent-${now}`,
    name: data.name || existing?.name || '未命名智能体',
    avatar: data.avatar || existing?.avatar || '🤖',
    personality: {
      aggressiveness: data.personality?.aggressiveness ?? existing?.personality?.aggressiveness ?? 50,
      caution: data.personality?.caution ?? existing?.personality?.caution ?? 50,
      cunning: data.personality?.cunning ?? existing?.personality?.cunning ?? 50,
      honesty: data.personality?.honesty ?? existing?.personality?.honesty ?? 50,
      talkativeness: data.personality?.talkativeness ?? existing?.personality?.talkativeness ?? 50,
    },
    speakingStyle: data.speakingStyle || existing?.speakingStyle || 'calm',
    strategy: {
      nightAction: data.strategy?.nightAction || existing?.strategy?.nightAction || 'random',
      dayStrategy: data.strategy?.dayStrategy || existing?.strategy?.dayStrategy || 'passive',
      revealIdentity: data.strategy?.revealIdentity || existing?.strategy?.revealIdentity || 'mid',
    },
    language: {
      prefixes: data.language?.prefixes || existing?.language?.prefixes || ['我觉得'],
      suffixes: data.language?.suffixes || existing?.language?.suffixes || ['对吧'],
      favoriteWords: data.language?.favoriteWords || existing?.language?.favoriteWords || ['狼', '好人'],
    },
    createdAt: existing?.createdAt || data.createdAt || now,
    updatedAt: existing ? now : (data.updatedAt || now),
  };
}

class AIAgentManager {
  constructor() {
    this.availableAgents = [];
    this.initialized = false;
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

  async createAgent(data) {
    await this.ensureInitialized();
    const agent = normalizeAgent(data);
    const created = await AIAgent.create(agent);
    await this.resetRandomAgents();
    return created;
  }

  async updateAgent(id, data) {
    await this.ensureInitialized();
    const existing = await AIAgent.findById(id);
    if (!existing) return null;

    const updated = await AIAgent.update(id, normalizeAgent(data, existing));
    await this.resetRandomAgents();
    return updated;
  }

  async deleteAgent(id) {
    await this.ensureInitialized();
    const success = await AIAgent.delete(id);
    if (success) {
      await this.resetRandomAgents();
    }
    return success;
  }

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

  async resetRandomAgents() {
    this.availableAgents = await AIAgent.findAll();
  }
}

module.exports = new AIAgentManager();
