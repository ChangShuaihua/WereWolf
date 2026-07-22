const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../data/aiAgents.json');

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
  }
];

class AIAgentManager {
  constructor() {
    this.agents = [];
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        this.agents = JSON.parse(data);
      } else {
        this.agents = DEFAULT_AGENTS;
        this.save();
      }
    } catch (err) {
      console.error('Failed to load AI agents:', err);
      this.agents = DEFAULT_AGENTS;
    }
  }

  save() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.agents, null, 2));
    } catch (err) {
      console.error('Failed to save AI agents:', err);
    }
  }

  getAllAgents() {
    return this.agents;
  }

  getAgentById(id) {
    return this.agents.find(a => a.id === id);
  }

  createAgent(data) {
    const agent = {
      id: `agent-${Date.now()}`,
      name: data.name || '未命名智能体',
      avatar: data.avatar || '🤖',
      personality: {
        aggressiveness: data.personality?.aggressiveness || 50,
        caution: data.personality?.caution || 50,
        cunning: data.personality?.cunning || 50,
        honesty: data.personality?.honesty || 50,
        talkativeness: data.personality?.talkativeness || 50
      },
      speakingStyle: data.speakingStyle || 'calm',
      strategy: {
        nightAction: data.strategy?.nightAction || 'random',
        dayStrategy: data.strategy?.dayStrategy || 'passive',
        revealIdentity: data.strategy?.revealIdentity || 'mid'
      },
      language: {
        prefixes: data.language?.prefixes || ['我觉得'],
        suffixes: data.language?.suffixes || ['对吧'],
        favoriteWords: data.language?.favoriteWords || ['狼', '好人']
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.agents.push(agent);
    this.save();
    return agent;
  }

  updateAgent(id, data) {
    const index = this.agents.findIndex(a => a.id === id);
    if (index === -1) return null;

    const agent = this.agents[index];
    this.agents[index] = {
      ...agent,
      ...data,
      updatedAt: Date.now()
    };
    this.save();
    return this.agents[index];
  }

  deleteAgent(id) {
    const index = this.agents.findIndex(a => a.id === id);
    if (index === -1) return false;

    this.agents.splice(index, 1);
    this.save();
    return true;
  }

  getRandomAgent() {
    if (this.agents.length === 0) return null;
    return this.agents[Math.floor(Math.random() * this.agents.length)];
  }
}

module.exports = new AIAgentManager();