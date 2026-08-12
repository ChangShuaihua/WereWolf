const fs = require('fs');
const path = require('path');

/**
 * GameRetriever - 狼人杀策略检索器
 * 
 * 负责从知识库中检索与当前游戏局势最相关的策略文档，
 * 采用分层加权评分算法，优先匹配角色策略和特殊情境。
 */
class GameRetriever {
  constructor() {
    this.docs = [];
    this.isLoaded = false;
    this._loadPromise = null;
  }

  /**
   * 初始化：加载所有策略文档并切块（惰性加载，只执行一次）
   */
  async initialize() {
    if (this.isLoaded) return;
    if (this._loadPromise) return this._loadPromise;

    this._loadPromise = this._doInitialize();
    return this._loadPromise;
  }

  async _doInitialize() {
    const strategiesDir = path.join(__dirname, '../knowledge/strategies');
    const replaysDir = path.join(__dirname, '../knowledge/replays');
    const rulesDir = path.join(__dirname, '../knowledge/rules');
    
    try {
      let totalChunks = 0;
      let totalFiles = 0;

      // 加载策略文档
      if (fs.existsSync(strategiesDir)) {
        const files = fs.readdirSync(strategiesDir).filter(f => f.endsWith('.md'));
        for (const file of files) {
          const filePath = path.join(strategiesDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const chunks = this._chunkDocument(content, file);
          this.docs.push(...chunks);
          totalChunks += chunks.length;
        }
        totalFiles += files.length;
      } else {
        console.warn('[GameRetriever] Strategies directory not found:', strategiesDir);
      }

      // 加载游戏规则文档
      if (fs.existsSync(rulesDir)) {
        const ruleFiles = fs.readdirSync(rulesDir).filter(f => f.endsWith('.md'));
        for (const file of ruleFiles) {
          const filePath = path.join(rulesDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const chunks = this._chunkDocument(content, file);
          this.docs.push(...chunks);
          totalChunks += chunks.length;
        }
        totalFiles += ruleFiles.length;
      }

      // 加载历史对局
      if (fs.existsSync(replaysDir)) {
        const replayFiles = fs.readdirSync(replaysDir).filter(f => f.endsWith('.md'));
        for (const file of replayFiles) {
          const filePath = path.join(replaysDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const chunks = this._chunkDocument(content, file);
          this.docs.push(...chunks);
          totalChunks += chunks.length;
        }
        totalFiles += replayFiles.length;
      }

      this.isLoaded = true;
      console.log(`[GameRetriever] Loaded ${totalChunks} chunks from ${totalFiles} files (${this.docs.length} total in memory)`);
    } catch (err) {
      console.error('[GameRetriever] Failed to initialize:', err.message);
    }
  }

  /**
   * 将文档按段落切块，每块不超过MAX_TOKENS字符
   */
  _chunkDocument(content, fileName) {
    const chunks = [];
    const paragraphs = content.split(/\n\n+/);
    const MAX_TOKENS = 500;

    let currentChunk = '';
    let currentTokens = 0;

    for (const para of paragraphs) {
      const paraTokens = para.length;
      
      if (currentTokens + paraTokens > MAX_TOKENS && currentChunk) {
        chunks.push({
          source: fileName,
          content: currentChunk.trim(),
          tokens: currentTokens,
          _role: this._detectChunkRole(currentChunk),
        });
        currentChunk = para;
        currentTokens = paraTokens;
      } else {
        currentChunk = currentChunk ? currentChunk + '\n\n' + para : para;
        currentTokens += paraTokens;
      }
    }

    if (currentChunk) {
      chunks.push({
        source: fileName,
        content: currentChunk.trim(),
        tokens: currentTokens,
        _role: this._detectChunkRole(currentChunk),
      });
    }

    return chunks;
  }

  /**
   * 检测文档块所属的角色分类
   */
  _detectChunkRole(content) {
    if (/狼人|悍跳|屠边|屠城/.test(content)) return 'werewolf';
    if (/预言家|金水|查杀|警徽/.test(content)) return 'seer';
    if (/女巫|解药|毒药/.test(content)) return 'witch';
    if (/守卫|守护|守人/.test(content)) return 'guard';
    if (/猎人|开枪/.test(content)) return 'hunter';
    if (/平民|村民|好人/.test(content)) return 'villager';
    if (/对跳|多人跳/.test(content)) return 'multiple_claims';
    if (/平安夜/.test(content)) return 'peaceful_night';
    if (/投票|归票|放逐/.test(content)) return 'vote';
    if (/发言|白天/.test(content)) return 'day';
    if (/夜晚|夜间|刀人/.test(content)) return 'night';
    return 'general';
  }

  /**
   * 从游戏状态中构建检索上下文
   * @param {Object} game - GameEngine 实例
   * @param {string} aiPlayerSocketId - AI玩家的socketId
   * @returns {Object} 检索上下文
   */
  buildContext(game, aiPlayerSocketId) {
    if (!game) return {};

    const role = game.getRole(aiPlayerSocketId);
    const team = role ? this._getTeam(role) : null;
    const situation = this._detectSituation(game);

    return {
      role,
      team,
      phase: game.phase,
      nightCount: game.nightCount,
      situation,
      playerCount: game.players.filter(p => p.isAlive).length,
      deadCount: game.players.filter(p => !p.isAlive).length,
    };
  }

  /**
   * 检索最相关的策略
   * @param {Object} context - 检索上下文
   * @param {string} context.role - 角色
   * @param {string} context.team - 阵营
   * @param {string} context.phase - 游戏阶段
   * @param {string} context.situation - 特殊情境
   * @param {number} context.nightCount - 当前夜数
   * @param {number} topK - 返回的最大结果数
   * @returns {Array<{source: string, content: string, score: number}>}
   */
  async retrieve(context, topK = 3) {
    await this.initialize();
    if (this.docs.length === 0) return [];

    const scores = this.docs.map(chunk => {
      let score = 0;
      const content = chunk.content;
      const contentLower = content.toLowerCase();

      // 1. 角色精确匹配（权重最高）
      if (context.role) {
        if (chunk._role === context.role) {
          score += 20;
        }
        const roleKeywords = this._getRoleKeywords(context.role);
        for (const kw of roleKeywords) {
          if (contentLower.includes(kw.toLowerCase())) {
            score += 10;
            break;
          }
        }
      }

      // 2. 阵营匹配
      if (context.team) {
        const teamKeywords = this._getTeamKeywords(context.team);
        for (const kw of teamKeywords) {
          if (contentLower.includes(kw.toLowerCase())) {
            score += 6;
            break;
          }
        }
      }

      // 3. 阶段匹配
      if (context.phase) {
        const phaseKeywords = this._getPhaseKeywords(context.phase);
        for (const kw of phaseKeywords) {
          if (contentLower.includes(kw.toLowerCase())) {
            score += 5;
            break;
          }
        }
      }

      // 4. 特殊情境匹配
      if (context.situation) {
        const situationKeywords = this._getSituationKeywords(context.situation);
        for (const kw of situationKeywords) {
          if (contentLower.includes(kw.toLowerCase())) {
            score += 15;
            break;
          }
        }
      }

      // 5. 指令性内容加权
      if (/核心目标|决策原则|高阶打法|关键/.test(content)) {
        score += 3;
      }

      // 6. 夜数相关（后期策略更激进）
      if (context.nightCount && context.nightCount >= 3) {
        if (/后期|残局|最后|关键/.test(content)) {
          score += 4;
        }
      }

      return { chunk, score };
    });

    // 归一化：将分数映射到 0-1
    const maxScore = scores.reduce((m, s) => Math.max(m, s.score), 0);
    if (maxScore === 0) return [];

    scores.sort((a, b) => b.score - a.score);
    
    return scores
      .filter(s => s.score > 0)
      .slice(0, topK)
      .map(s => ({
        source: s.chunk.source,
        content: s.chunk.content,
        score: s.score / maxScore,
      }));
  }

  /**
   * 获取格式化的策略上下文，用于注入LLM Prompt
   * @param {Object} context - 检索上下文
   * @param {string} context.role - 角色
   * @param {string} context.phase - 游戏阶段
   * @param {string} context.situation - 特殊情境
   * @param {number} context.nightCount - 当前夜数
   * @returns {string} 格式化的策略文本，若无匹配则返回空字符串
   */
  async getContextForPrompt(context) {
    const results = await this.retrieve(context, 3);
    if (results.length === 0) return '';

    const sections = results.map((r, i) => {
      const title = r.source.replace('.md', '');
      return `【策略${i + 1}·${title}】\n${r.content}`;
    });

    return `\n===== 策略参考（请结合实际灵活运用，不要生搬硬套）=====\n${sections.join('\n---\n')}\n===== 结束 =====\n`;
  }

  /**
   * 便捷方法：直接从Game实例构建上下文并获取策略
   */
  async getStrategyForGame(game, aiPlayerSocketId) {
    const context = this.buildContext(game, aiPlayerSocketId);
    return this.getContextForPrompt(context);
  }

  /**
   * 检索与用户问题相关的规则文档
   * @param {string} question - 用户的问题
   * @param {number} topK - 返回的最大结果数
   * @returns {Array<{source: string, content: string, score: number}>}
   */
  async retrieveRules(question, topK = 3) {
    await this.initialize();
    if (this.docs.length === 0 || !question) return [];

    // 提取问题关键词
    const keywords = this._extractKeywords(question);
    
    const scores = this.docs.map(chunk => {
      let score = 0;
      const content = chunk.content;
      const contentLower = content.toLowerCase();
      const questionLower = question.toLowerCase();

      // 1. 关键词匹配
      for (const kw of keywords) {
        const kwLower = kw.toLowerCase();
        if (contentLower.includes(kwLower)) {
          score += 10;
        }
      }

      // 2. 角色关键词匹配
      const roleMap = {
        '狼人': 'werewolf', '狼': 'werewolf',
        '预言家': 'seer', '预言': 'seer',
        '女巫': 'witch',
        '守卫': 'guard', '守护': 'guard',
        '猎人': 'hunter', '开枪': 'hunter',
        '平民': 'villager', '村民': 'villager',
      };
      for (const [kw, role] of Object.entries(roleMap)) {
        if (questionLower.includes(kw) && contentLower.includes(kw)) {
          score += 8;
        }
      }

      // 3. 规则关键词匹配（优先匹配规则文档）
      const ruleKeywords = ['规则', '不能', '可以', '是否', '怎么', '如何', '什么时候', '能', '吗'];
      for (const kw of ruleKeywords) {
        if (questionLower.includes(kw)) {
          if (contentLower.includes('不能') || contentLower.includes('可以') || contentLower.includes('规则')) {
            score += 3;
          }
          break;
        }
      }

      // 4. FAQ 匹配
      if (content.includes('Q:') || content.includes('A:')) {
        // 检查问题是否与FAQ中的问题相似
        const faqQuestions = content.match(/Q:.*?\?/g) || [];
        for (const faqQ of faqQuestions) {
          const faqQLower = faqQ.toLowerCase();
          let matchCount = 0;
          for (const kw of keywords) {
            if (faqQLower.includes(kw.toLowerCase())) {
              matchCount++;
            }
          }
          if (matchCount > 0) {
            score += matchCount * 15;
          }
        }
      }

      return { chunk, score };
    });

    const maxScore = scores.reduce((m, s) => Math.max(m, s.score), 0);
    if (maxScore === 0) return [];

    scores.sort((a, b) => b.score - a.score);
    
    return scores
      .filter(s => s.score > 0)
      .slice(0, topK)
      .map(s => ({
        source: s.chunk.source,
        content: s.chunk.content,
        score: s.score / maxScore,
      }));
  }

  /**
   * 从问题中提取关键词
   */
  _extractKeywords(question) {
    // 移除常见停用词
    const stopWords = ['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '上', '也', '很', '到', '说', '要', '去', '会', '着', '没有', '看', '好', '自己', '这', '那'];
    let words = question.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ').split(/\s+/);
    words = words.filter(w => w.length > 0 && !stopWords.includes(w));
    return words;
  }

  /**
   * 获取规则问答的上下文
   * @param {string} question - 用户问题
   * @returns {string} 格式化的规则上下文
   */
  async getRulesContextForPrompt(question) {
    const results = await this.retrieveRules(question, 3);
    if (results.length === 0) return '';

    const sections = results.map((r, i) => 
      `【参考${i + 1}】\n${r.content}`
    );

    return `\n以下是相关的游戏规则参考：\n${sections.join('\n---\n')}\n`;
  }

  /**
   * 将结束的对局存入知识库，供后续检索
   * @param {Object} gameResult - 游戏结果数据
   * @param {string} gameResult.roomCode - 房间号
   * @param {string} gameResult.winner - 获胜方 ('werewolf' | 'villager')
   * @param {number} gameResult.playerCount - 玩家数
   * @param {number} gameResult.duration - 游戏时长(秒)
   * @param {Array} gameResult.players - 玩家列表
   * @param {Array} gameResult.history - 游戏历史
   */
  async addGameReplay(gameResult) {
    try {
      if (!gameResult || !gameResult.players || !gameResult.history) {
        return;
      }

      const replaysDir = path.join(__dirname, '../knowledge/replays');
      if (!fs.existsSync(replaysDir)) {
        fs.mkdirSync(replaysDir, { recursive: true });
      }

      const timestamp = Date.now();
      const dateStr = new Date(timestamp).toISOString().slice(0, 10);
      const fileName = `game_${dateStr}_${timestamp}.md`;
      const filePath = path.join(replaysDir, fileName);

      // 将对局转换为可读的Markdown文档
      const content = this._formatGameAsDocument(gameResult, timestamp);
      fs.writeFileSync(filePath, content, 'utf-8');

      // 将文档切块并加入内存索引
      const chunks = this._chunkDocument(content, fileName);
      this.docs.push(...chunks);

      console.log(`[GameRetriever] Saved game replay: ${fileName} (${chunks.length} chunks, total: ${this.docs.length})`);
    } catch (err) {
      console.error('[GameRetriever] Failed to save game replay:', err.message);
    }
  }

  /**
   * 将游戏结果格式化为可检索的Markdown文档
   */
  _formatGameAsDocument(result, timestamp) {
    const date = new Date(timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const winnerName = result.winner === 'werewolf' ? '狼人阵营' : '村民阵营';
    const durationMin = Math.floor(result.duration / 60);
    const durationSec = result.duration % 60;

    let doc = `# 对局复盘 - ${date}\n\n`;
    doc += `## 对局概况\n`;
    doc += `- 获胜方：${winnerName}\n`;
    doc += `- 玩家数：${result.playerCount}\n`;
    doc += `- 时长：${durationMin}分${durationSec}秒\n\n`;

    // 角色分布
    doc += `## 角色分布\n`;
    const werewolves = result.players.filter(p => p.role === 'werewolf');
    const seer = result.players.find(p => p.role === 'seer');
    const witch = result.players.find(p => p.role === 'witch');
    const guard = result.players.find(p => p.role === 'guard');
    const hunter = result.players.find(p => p.role === 'hunter');
    const villagers = result.players.filter(p => p.role === 'villager');

    doc += `- 狼人：${werewolves.map(p => p.username || p.seatIndex).join(', ')}\n`;
    if (seer) doc += `- 预言家：${seer.username || seer.seatIndex}\n`;
    if (witch) doc += `- 女巫：${witch.username || witch.seatIndex}\n`;
    if (guard) doc += `- 守卫：${guard.username || guard.seatIndex}\n`;
    if (hunter) doc += `- 猎人：${hunter.username || hunter.seatIndex}\n`;
    if (villagers.length > 0) doc += `- 平民：${villagers.map(p => p.username || p.seatIndex).join(', ')}\n`;
    doc += '\n';

    // 关键事件
    if (result.history && result.history.length > 0) {
      doc += `## 关键事件\n`;
      const nightGroups = {};
      result.history.forEach(h => {
        const night = h.night || 0;
        if (!nightGroups[night]) nightGroups[night] = [];
        nightGroups[night].push(h);
      });

      Object.keys(nightGroups).sort((a, b) => Number(a) - Number(b)).forEach(night => {
        const nightNum = Number(night);
        const label = nightNum === 0 ? '第一天白天' : `第${nightNum}夜`;
        doc += `### ${label}\n`;
        nightGroups[night].forEach(h => {
          const detail = h.detail || `${h.action}${h.actor?.username ? ' - ' + h.actor.username : ''}`;
          doc += `- ${detail}\n`;
        });
        doc += '\n';
      });
    }

    // 经验总结
    doc += `## 经验总结\n`;
    doc += `- ${winnerName}获胜，时长${durationMin}分${durationSec}秒\n`;
    if (result.winner === 'werewolf') {
      doc += `- 狼人获胜关键：${werewolves.length}狼配合良好，有效隐藏身份并精准击杀关键好人\n`;
    } else {
      doc += `- 好人获胜关键：预言家查验准确，好人投票果断，神职配合默契\n`;
    }
    doc += `- 可借鉴点：关注角色分布与位置关系，分析发言逻辑与投票走向\n`;

    return doc;
  }

  // ========== 内部辅助方法 ==========

  _getTeam(role) {
    const werewolfRoles = ['werewolf'];
    const goodRoles = ['seer', 'witch', 'guard', 'hunter', 'villager'];
    if (werewolfRoles.includes(role)) return 'werewolf';
    if (goodRoles.includes(role)) return 'good';
    return null;
  }

  _getRoleKeywords(role) {
    const map = {
      werewolf: ['狼人', '狼', '悍跳', '屠边', '屠城', '队友'],
      seer: ['预言家', '查验', '金水', '查杀', '警徽', '查验结果'],
      witch: ['女巫', '解药', '毒药', '用药', '救人'],
      guard: ['守卫', '守护', '守人', '守卫'],
      hunter: ['猎人', '开枪', '带走', '开枪带走'],
      villager: ['平民', '村民', '好人', '找狼'],
    };
    return map[role] || [];
  }

  _getTeamKeywords(team) {
    const map = {
      werewolf: ['狼人', '队友', '悍跳', '屠边'],
      good: ['好人', '预言家', '金水'],
    };
    return map[team] || [];
  }

  _getPhaseKeywords(phase) {
    const map = {
      DAY: ['白天', '发言', '投票', '归票', '跳身份', '发言阶段'],
      NIGHT: ['夜晚', '夜间', '刀人', '查验', '守卫', '夜晚行动'],
      VOTE: ['投票', '归票', '放逐', '冲票', '投票阶段'],
    };
    return map[phase] || [];
  }

  _getSituationKeywords(situation) {
    const map = {
      peaceful_night: ['平安夜', '守对', '救对', '解药', '守护成功'],
      multiple_claims: ['对跳', '多人跳', '悍跳', '真预言家', '假预言家'],
      check_result: ['查杀', '金水', '查验结果', '查验'],
      last_god: ['最后一个神', '神职', '必跳', '最后神'],
      hunter_shoot: ['猎人开枪', '开枪带走', '开枪'],
      witch_poison: ['毒药', '毒杀', '女巫用药'],
      crisis: ['劣势', '翻盘', '反杀', '最后一搏'],
     优势: ['优势', '扩大', '锁定胜局'],
    };
    return map[situation] || [];
  }

  /**
   * 检测当前游戏局势
   */
  _detectSituation(game) {
    if (!game || !game.gameHistory || game.gameHistory.length === 0) {
      return null;
    }

    const recent = game.gameHistory.slice(-3);
    
    // 平安夜
    for (const h of recent) {
      if (h.action === 'night_end' && h.deaths && h.deaths.length === 0) {
        return 'peaceful_night';
      }
    }

    // 猎人开枪
    if (recent.some(h => h.action === 'hunter_shoot')) {
      return 'hunter_shoot';
    }

    // 女巫毒杀
    if (recent.some(h => h.action === 'poison')) {
      return 'witch_poison';
    }

    // 查杀
    if (recent.some(h => h.action === 'check' && h.result === 'werewolf')) {
      return 'check_result';
    }

    // 末神
    const aliveGood = game.players.filter(p => p.isAlive && ['seer', 'witch', 'guard', 'hunter'].includes(game.getRole(p.socketId)));
    if (aliveGood.length === 1 && game.nightCount >= 3) {
      return 'last_god';
    }

    // 局势判断
    const wolfCount = game.players.filter(p => {
      const r = game.getRole(p.socketId);
      return r === 'werewolf' && p.isAlive;
    }).length;
    const goodCount = game.players.filter(p => {
      const r = game.getRole(p.socketId);
      return r !== 'werewolf' && p.isAlive;
    }).length;

    if (wolfCount >= goodCount) {
      return 'crisis';
    }

    return null;
  }
}

module.exports = new GameRetriever();
