// 引入模块
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

class AIAgentManager {

  constructor() {
    //this是AIAgentManager类
    this.agents = [];//创建出数组来保存AI
    this.availableAgents = [];
    this.init();
  }

  // 读取本地AI的数据
  init() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        this.agents = JSON.parse(data);
      } else {
        this.agents = DEFAULT_AGENTS;
        this.save();
      }
      this.availableAgents = [...this.agents]
    } catch (err) {
      console.error('Failed to load AI agents:', err);
      this.agents = DEFAULT_AGENTS;
      this.availableAgents = [...this.agents];
    }
  }
  // 保存数据
  save() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.agents, null, 2));
    } catch (err) {
      console.error('Failed to save AI agents:', err);
    }
  }
  // 查询全部数据
  getAllAgents() {
    return this.agents;
  }
  // 查询某个数据
  getAgentById(id) {
    return this.agents.find(a => a.id === id);
  }

  createAgent(data) {
    const agent = {
      id: `agent-${Date.now()}`,
      name: data.name || '未命名智能体',
      avatar: data.avatar || '🤖',
      // 五维人格  
      personality: {
        // ?.的作用：创建一个对象，如果data.personality不存在，则使用默认值50,后面的||改为??
        aggressiveness: data.personality?.aggressiveness ?? 50,
        caution: data.personality?.caution ?? 50,
        cunning: data.personality?.cunning ?? 50,
        honesty: data.personality?.honesty ?? 50,
        talkativeness: data.personality?.talkativeness ?? 50
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
      personality: {
        ...agent.personality,
        ...(data.personality || {}),
      },
      strategy: {
        ...agent.strategy,
        ...(data.strategy || {}),
      },
      language: {
        ...agent.language,
        ...(data.language || {}),
      },
      updatedAt: Date.now()
    };
    this.save();
    return this.agents[index];
  }

  deleteAgent(id) {
    const index = this.agents.findIndex(a => a.id === id);
    if (index === -1) return false;
    // 删除数组
    this.agents.splice(index, 1);
    this.save();
    return true;
  }

  getRandomAgent() {
    if (this.availableAgents.length === 0) {
      return null;
    }

    const index = Math.floor(
      Math.random() * this.availableAgents.length
    );

    const agent = this.availableAgents[index];

    this.availableAgents.splice(index, 1);

    return agent;
  }

  resetRandomAgents() {
    this.availableAgents = [...this.agents];
  }
}

module.exports = new AIAgentManager();