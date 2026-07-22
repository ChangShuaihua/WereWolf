const { ChatOpenAI } = require('@langchain/openai');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StructuredOutputParser } = require('@langchain/core/output_parsers');
const { roomCache, gameCache } = require('../utils/cache');
const { PHASE, ROLE, TEAM } = require('./constants');
const { getRoleName } = require('./RoleConfig');
const aiAgentManager = require('../ai/AIAgentManager');

class AIGameHandler {
  constructor() {
    this.aiNames = ['小狼', '预言', '女巫', '守卫', '猎人', '村民', '智者', '勇者'];
    this.aiIdCounter = 0;
    this.aiChatTimers = {};
    this.model = null;
    this._initModel();
  }

  _initModel() {
    if (process.env.DEEPSEEK_API_KEY) {
      this.model = new ChatOpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: 'deepseek-3.5',
        temperature: 0.7,
        maxTokens: 500,
      });
    } else {
      console.warn('[AIGameHandler] DEEPSEEK_API_KEY not set, using fallback AI logic');
    }
  }

  createAIPlayer(roomCode, agentId = null) {
    this.aiIdCounter++;
    
    const room = roomCache.get(roomCode);
    const existingAICount = room ? room.players.filter(p => p.isAI).length : 0;
    const aiNumber = existingAICount + 1;
    
    const agent = agentId ? aiAgentManager.getAgentById(agentId) : aiAgentManager.getRandomAgent();
    
    return {
      socketId: `ai_${roomCode}_${this.aiIdCounter}`,
      userId: 0,
      username: agent ? `${agent.avatar} ${agent.name}` : `🤖 人机${aiNumber}`,
      isReady: true,
      isAlive: true,
      isAI: true,
      agentId: agent?.id || null,
      agentConfig: agent || null,
    };
  }

  async handlePhaseChange(roomCode, phase) {
    const game = gameCache.get(roomCode);
    if (!game) return;

    const aiPlayers = game.alivePlayers.filter(p => p.isAI);
    if (aiPlayers.length === 0) return;

    switch (phase) {
      case PHASE.NIGHT:
        await this._handleNightPhase(game, aiPlayers);
        break;
      case PHASE.VOTE:
        await this._handleVotePhase(game, aiPlayers);
        break;
      case PHASE.END:
        this._stopDayChat(roomCode);
        break;
    }
  }

  async _handleNightPhase(game, aiPlayers) {
    for (const aiPlayer of aiPlayers) {
      const role = game.getRole(aiPlayer.socketId);
      if (!role) continue;

      try {
        const action = await this._decideNightAction(game, aiPlayer, role);
        if (action) {
          game.submitNightAction(aiPlayer.socketId, action.action, action.targetId);
        }
      } catch (error) {
        console.error(`[AIGameHandler] Night action error for ${aiPlayer.username}:`, error);
        const fallbackAction = this._getFallbackNightAction(game, aiPlayer, role);
        if (fallbackAction) {
          game.submitNightAction(aiPlayer.socketId, fallbackAction.action, fallbackAction.targetId);
        }
      }
    }
  }

  async _decideNightAction(game, aiPlayer, role) {
    if (!this.model) {
      return this._getFallbackNightAction(game, aiPlayer, role);
    }

    const gameState = this._buildGameState(game, aiPlayer);
    const outputParser = StructuredOutputParser.fromNamesAndDescriptions({
      action: '行动类型，可选值: kill, check, guard, save, poison, skip',
      targetId: '目标玩家的socketId，如果行动是skip则为null',
      reasoning: '你的推理过程，说明为什么选择这个行动',
    });

    const formatInstructions = outputParser.getFormatInstructions();

    const alivePlayersStr = gameState.alivePlayers.map(p => p.username).join(', ');
    const teammatesStr = gameState.teammates.map(p => p.username).join(', ');
    const suspiciousStr = gameState.suspiciousPlayers.map(p => p.username).join(', ');
    
    const roleName = getRoleName(role);
    const roleAbility = this._getRoleAbility(role);
    
    const prompt = new PromptTemplate({
      template: `你是一个狼人杀游戏中的AI玩家。

当前游戏状态：
- 游戏阶段：夜晚
- 你的角色：{roleName}
- 角色能力：{roleAbility}
- 当前存活玩家：{alivePlayers}
- 你的队友：{teammates}
- 可疑玩家：{suspiciousPlayers}

请根据你的角色和游戏状态做出决策。

{formatInstructions}`,
      inputVariables: ['roleName', 'roleAbility', 'alivePlayers', 'teammates', 'suspiciousPlayers', 'formatInstructions'],
    });

    const chain = prompt.pipe(this.model).pipe(outputParser);

    try {
      const result = await chain.invoke({ 
        roleName, 
        roleAbility, 
        alivePlayers: alivePlayersStr, 
        teammates: teammatesStr, 
        suspiciousPlayers: suspiciousStr,
        formatInstructions 
      });
      
      if (result.action === 'skip') {
        return null;
      }

      const isValidTarget = this._validateTarget(game, aiPlayer, result.action, result.targetId);
      if (isValidTarget) {
        return { action: result.action, targetId: result.targetId };
      }

      return this._getFallbackNightAction(game, aiPlayer, role);
    } catch (error) {
      console.error('[AIGameHandler] LLM decision error:', error);
      return this._getFallbackNightAction(game, aiPlayer, role);
    }
  }

  _getFallbackNightAction(game, aiPlayer, role) {
    const aliveOthers = game.alivePlayers.filter(p => p.socketId !== aiPlayer.socketId);
    if (aliveOthers.length === 0) return null;

    const randomTarget = aliveOthers[Math.floor(Math.random() * aliveOthers.length)];

    switch (role) {
      case ROLE.WEREWOLF:
        return { action: 'kill', targetId: randomTarget.socketId };
      case ROLE.SEER:
        return { action: 'check', targetId: randomTarget.socketId };
      case ROLE.GUARD:
        return { action: 'guard', targetId: randomTarget.socketId };
      case ROLE.WITCH:
        if (!game.witchSaveUsed && game.killedByWerewolves) {
          return { action: 'save', targetId: game.killedByWerewolves };
        }
        return { action: 'skip', targetId: null };
      default:
        return null;
    }
  }

  _validateTarget(game, aiPlayer, action, targetId) {
    if (!targetId) return false;
    const target = game.getPlayer(targetId);
    if (!target || !target.isAlive) return false;
    if (target.socketId === aiPlayer.socketId) return false;
    return true;
  }

  _getRoleAbility(role) {
    switch (role) {
      case ROLE.WEREWOLF: return '每晚可以杀死一名玩家，狼人需要统一目标';
      case ROLE.SEER: return '每晚可以查验一名玩家的身份（狼人或好人）';
      case ROLE.WITCH: return '拥有一瓶解药（可以救被狼人杀死的人）和一瓶毒药（可以毒死一名玩家）';
      case ROLE.GUARD: return '每晚可以守护一名玩家，被守护的玩家不会被狼人杀死，但不能连续两晚守护同一个人';
      case ROLE.HUNTER: return '被杀死时可以开枪带走一名玩家';
      case ROLE.VILLAGER: return '没有特殊能力，只能白天投票';
      default: return '普通村民';
    }
  }

  _buildGameState(game, aiPlayer) {
    const role = game.getRole(aiPlayer.socketId);
    const team = TEAM[role];
    
    const alivePlayers = game.alivePlayers.map(p => {
      const pRole = game.getRole(p.socketId);
      const pTeam = TEAM[pRole];
      const isSelf = p.socketId === aiPlayer.socketId;
      const isTeammate = pTeam === team && !isSelf;
      return {
        socketId: p.socketId,
        username: p.username,
        role: isSelf ? role : (isTeammate ? pRole : 'unknown'),
        isSelf,
        isTeammate,
      };
    });

    const teammates = alivePlayers.filter(p => p.isTeammate);
    const suspiciousPlayers = alivePlayers.filter(p => !p.isSelf && !p.isTeammate);

    return {
      alivePlayers,
      teammates,
      suspiciousPlayers,
    };
  }

  async _handleVotePhase(game, aiPlayers) {
    for (const aiPlayer of aiPlayers) {
      try {
        const voteTarget = await this._decideVote(game, aiPlayer);
        if (voteTarget) {
          game.submitVote(aiPlayer.socketId, voteTarget);
        }
      } catch (error) {
        console.error(`[AIGameHandler] Vote error for ${aiPlayer.username}:`, error);
        const fallbackTarget = this._getFallbackVote(game, aiPlayer);
        if (fallbackTarget) {
          game.submitVote(aiPlayer.socketId, fallbackTarget);
        }
      }
    }
  }

  async _decideVote(game, aiPlayer) {
    if (!this.model) {
      return this._getFallbackVote(game, aiPlayer);
    }

    const role = game.getRole(aiPlayer.socketId);
    const team = TEAM[role];
    const aliveOthers = game.alivePlayers.filter(p => p.socketId !== aiPlayer.socketId);

    if (aliveOthers.length === 0) return null;

    const aliveOthersStr = aliveOthers.map(p => p.username).join(', ');
    const teamName = team === 'werewolf' ? '狼人' : '村民';
    const goal = team === 'werewolf' ? '投票放逐好人' : '投票放逐狼人';
    
    const outputParser = StructuredOutputParser.fromNamesAndDescriptions({
      targetId: '要投票放逐的玩家的socketId',
      reasoning: '你的推理过程，说明为什么投票给这个玩家',
    });

    const formatInstructions = outputParser.getFormatInstructions();

    const roleName = getRoleName(role);
    
    const prompt = new PromptTemplate({
      template: `你是一个狼人杀游戏中的AI玩家。

当前游戏状态：
- 游戏阶段：投票阶段
- 你的角色：{roleName}
- 你的阵营：{teamName}
- 当前存活玩家：{aliveOthers}
- 你的目标：{goal}

请根据游戏状态决定投票给谁。

{formatInstructions}`,
      inputVariables: ['roleName', 'teamName', 'aliveOthers', 'goal', 'formatInstructions'],
    });

    const chain = prompt.pipe(this.model).pipe(outputParser);

    try {
      const result = await chain.invoke({ roleName, teamName, aliveOthers: aliveOthersStr, goal, formatInstructions });
      if (this._validateTarget(game, aiPlayer, 'vote', result.targetId)) {
        return result.targetId;
      }
      return this._getFallbackVote(game, aiPlayer);
    } catch (error) {
      console.error('[AIGameHandler] Vote decision error:', error);
      return this._getFallbackVote(game, aiPlayer);
    }
  }

  _getFallbackVote(game, aiPlayer) {
    const role = game.getRole(aiPlayer.socketId);
    const team = TEAM[role];
    
    let candidates = game.alivePlayers.filter(p => p.socketId !== aiPlayer.socketId);
    
    if (team === 'werewolf') {
      candidates = candidates.filter(p => game.getRole(p.socketId) !== ROLE.WEREWOLF);
    } else {
      candidates = candidates.filter(p => game.getRole(p.socketId) === ROLE.WEREWOLF);
    }
    
    if (candidates.length === 0) {
      candidates = game.alivePlayers.filter(p => p.socketId !== aiPlayer.socketId);
    }
    
    if (candidates.length === 0) return null;
    
    return candidates[Math.floor(Math.random() * candidates.length)].socketId;
  }

  _startDayChat(game, aiPlayers) {
    const roomCode = game.roomCode;
    
    if (this.aiChatTimers[roomCode]) {
      clearInterval(this.aiChatTimers[roomCode]);
    }

    this.aiChatTimers[roomCode] = setInterval(async () => {
      const currentGame = gameCache.get(roomCode);
      if (!currentGame || currentGame.phase !== PHASE.DAY) {
        this._stopDayChat(roomCode);
        return;
      }

      const currentSpeaker = currentGame.speakingOrder[currentGame.currentSpeakerIndex];
      if (!currentSpeaker) return;

      const speakerPlayer = currentGame.getPlayer(currentSpeaker);
      if (!speakerPlayer || !speakerPlayer.isAI) return;

      try {
        const message = await this._generateChatMessage(currentGame, speakerPlayer);
        if (message) {
          this._sendChatMessage(roomCode, speakerPlayer, message);
          
          setTimeout(() => {
            const gameStill = gameCache.get(roomCode);
            if (gameStill && gameStill.phase === PHASE.DAY) {
              gameStill.nextSpeaker();
            }
          }, 2000);
        }
      } catch (error) {
        console.error(`[AIGameHandler] Chat error for ${speakerPlayer.username}:`, error);
        const fallbackMessage = this._getFallbackChatMessage(currentGame, speakerPlayer);
        if (fallbackMessage) {
          this._sendChatMessage(roomCode, speakerPlayer, fallbackMessage);
        }
        
        setTimeout(() => {
          const gameStill = gameCache.get(roomCode);
          if (gameStill && gameStill.phase === PHASE.DAY) {
            gameStill.nextSpeaker();
          }
        }, 2000);
      }
    }, 1500);
  }

  _stopDayChat(roomCode) {
    if (this.aiChatTimers[roomCode]) {
      clearInterval(this.aiChatTimers[roomCode]);
      delete this.aiChatTimers[roomCode];
    }
  }

  async _generateChatMessage(game, aiPlayer) {
    if (!this.model) {
      return this._getFallbackChatMessage(game, aiPlayer);
    }

    const role = game.getRole(aiPlayer.socketId);
    const team = TEAM[role];
    const alivePlayers = game.alivePlayers;
    const teamName = team === 'werewolf' ? '狼人' : '村民';
    const alivePlayersStr = alivePlayers.map(p => p.username).join(', ');

    const room = roomCache.get(game.roomCode);
    const recentChat = room?.chat || [];
    const chatHistory = recentChat.slice(-15).map(msg => {
      if (msg.isSystem) return `[系统] ${msg.message}`;
      const aiMarker = msg.isAI ? '🤖' : '';
      return `${aiMarker}${msg.username}: ${msg.message}`;
    }).join('\n');

    const deadPlayers = game.players.filter(p => !p.isAlive).map(p => p.username);
    const deadPlayersStr = deadPlayers.length > 0 ? deadPlayers.join(', ') : '无';

    const nightCount = game.nightCount;

    let gameEvents = [];
    if (game.gameHistory.length > 0) {
      const recentEvents = game.gameHistory.slice(-20);
      recentEvents.forEach(h => {
        if (h.action === 'kill' || h.action === 'guard' || h.action === 'check' || h.action === 'save' || h.action === 'poison') {
          const actorRole = getRoleName(h.actor?.role);
          const actorName = h.actor?.username || '未知';
          const targetName = h.target?.username || '未知';
          gameEvents.push(`第${h.night}夜: ${actorRole}${actorName}对${targetName}使用了${h.action}`);
        } else if (h.action === 'vote') {
          const voterName = h.actor?.username || '未知';
          const targetName = h.target?.username || '未知';
          gameEvents.push(`${voterName}投票给了${targetName}`);
        } else if (h.action === 'night_end') {
          if (h.deaths && h.deaths.length > 0) {
            const deathNames = h.deaths.map(d => d.username).join(', ');
            gameEvents.push(`第${h.night}夜结束: ${deathNames}死亡`);
          } else {
            gameEvents.push(`第${h.night}夜结束: 平安夜`);
          }
        } else if (h.action === 'hunter_shoot') {
          const hunterName = h.actor?.username || '未知';
          const targetName = h.target?.username || '未知';
          gameEvents.push(`${hunterName}开枪带走了${targetName}`);
        }
      });
    }
    const gameEventsStr = gameEvents.length > 0 ? gameEvents.join('\n') : '暂无';

    const agentConfig = aiPlayer.agentConfig || aiAgentManager.getAgentById(aiPlayer.agentId);
    
    let personalityDesc = '';
    let speakingStyleDesc = '';
    let languageDesc = '';
    
    if (agentConfig) {
      const p = agentConfig.personality;
      if (p.aggressiveness > 70) personalityDesc += '你是一个激进的玩家，敢于主动出击，不怕被怀疑，喜欢直接质疑别人。';
      if (p.aggressiveness < 30) personalityDesc += '你是一个温和的玩家，不喜欢主动攻击别人，倾向于被动防御。';
      if (p.caution > 70) personalityDesc += '你非常谨慎，从不轻易暴露自己，发言保守，不会说太多。';
      if (p.caution < 30) personalityDesc += '你比较大胆，敢于说出自己的想法，不怕暴露信息。';
      if (p.cunning > 70) personalityDesc += '你很狡猾，善于伪装，说谎时面不改色，会编造合理的谎言。';
      if (p.cunning < 30) personalityDesc += '你比较老实，不擅长说谎，更喜欢说实话。';
      if (p.honesty < 30) personalityDesc += '你喜欢说谎，可以编造查验结果和夜间信息来误导别人。';
      if (p.honesty > 70) personalityDesc += '你很诚实，作为好人会如实汇报信息，不会编造。';
      if (p.talkativeness > 70) personalityDesc += '你话很多，发言会比较长，喜欢详细分析。';
      if (p.talkativeness < 30) personalityDesc += '你话不多，发言简短，只说关键信息。';

      const styleMap = {
        humorous: '你的发言风格幽默风趣，喜欢用调侃的方式表达观点，带点幽默感。',
        serious: '你的发言风格严肃认真，逻辑清晰，分析到位，语气沉稳。',
        aggressive: '你的发言风格咄咄逼人，喜欢直接质疑和攻击，语气强硬。',
        calm: '你的发言风格冷静沉稳，不急不躁，娓娓道来，语气平和。',
        mysterious: '你的发言风格神秘莫测，喜欢说一半留一半，让别人猜你的意思。'
      };
      speakingStyleDesc = styleMap[agentConfig.speakingStyle] || '';

      const lang = agentConfig.language;
      if (lang.prefixes && lang.prefixes.length > 0) {
        languageDesc += `开头常用：${lang.prefixes.join('、')}；`;
      }
      if (lang.suffixes && lang.suffixes.length > 0) {
        languageDesc += `结尾常用：${lang.suffixes.join('、')}；`;
      }
      if (lang.favoriteWords && lang.favoriteWords.length > 0) {
        languageDesc += `常用词：${lang.favoriteWords.join('、')}`;
      }
    } else {
      personalityDesc = '你是一个普通的玩家，发言比较均衡。';
      speakingStyleDesc = '你的发言风格正常，比较随和。';
      languageDesc = '';
    }

    const outputParser = StructuredOutputParser.fromNamesAndDescriptions({
      message: '你要说的话，符合你的角色、性格和游戏状态',
    });

    const formatInstructions = outputParser.getFormatInstructions();

    const roleName = getRoleName(role);
    
    const prompt = new PromptTemplate({
      template: `你是一个狼人杀游戏中的AI玩家，名字叫{aiName}。你正在参与一场真实的狼人杀游戏。

=== 当前游戏状态 ===
- 游戏阶段：白天讨论
- 当前夜晚：第{nightCount}夜结束后的白天
- 你的角色：{roleName}
- 你的阵营：{teamName}
- 存活玩家：{alivePlayers}
- 已死亡玩家：{deadPlayers}

=== 你的性格特征 ===
{personalityDesc}

=== 你的发言风格 ===
{speakingStyleDesc}

=== 语言习惯 ===
{languageDesc}

=== 最近聊天记录 ===
{chatHistory}

=== 游戏事件记录 ===
{gameEvents}

=== 角色发言规则 ===
- 狼人：伪装成好人，分析局势，引导舆论，保护队友，根据聊天记录找机会嫁祸好人
- 预言家：报告查验结果（如果你验过的人），引导投票，对可疑的人提出质疑
- 女巫：谨慎发言，可以暗示你知道的信息（比如昨晚有人被杀），不要暴露太多
- 守卫：隐藏身份，谨慎发言，可以假装是平民
- 猎人：可以强势发言，威慑狼人，被怀疑时可以亮身份
- 平民：表达困惑，请求信息，跟随好人，分析其他人的发言漏洞

=== 必须遵守的规则 ===
1. **发言要有上下文**：你的发言必须与前面的对话有关联，不能凭空说一段话
2. **要有逻辑**：你的发言要有明确的观点或推理过程，不能胡言乱语
3. **针对具体情况**：如果有人提到你，必须回应；如果有可疑行为，要指出具体是谁
4. **不要重复**：不要重复别人已经说过的话，要有自己的见解
5. **不要说废话**：不要说无意义的填充内容，每句话都要有目的
6. **字数控制**：发言字数控制在30-50字之间，不要太长也不要太短
7. **如果没有信息**：如果你确实没有有用的信息，就直接说"我目前没有什么线索"
8. **符合性格**：你的发言必须符合上面描述的性格特征和发言风格

=== 错误示例（不要这样说） ===
- "我是平民，完全没有头绪，只能跟着大家的节奏走，希望好人能赢。"（没有针对任何人或任何情况）
- "大家注意一下，这轮很关键，请大家仔细听我说。"（没有实际内容）
- 重复别人说过的话

=== 正确示例（可以这样说） ===
- 如果有人跳预言家："XX说自己是预言家，但他的查验结果和我的信息不符，我怀疑他是假的"
- 如果昨晚平安夜："昨晚是平安夜，可能是守卫守对了人，大家继续分析"
- 如果没有线索："我目前没有什么线索，希望预言家能出来给点信息"

{formatInstructions}`,
      inputVariables: ['aiName', 'roleName', 'teamName', 'alivePlayers', 'deadPlayers', 'nightCount', 'chatHistory', 'gameEvents', 'personalityDesc', 'speakingStyleDesc', 'languageDesc', 'formatInstructions'],
    });

    const chain = prompt.pipe(this.model).pipe(outputParser);

    try {
      const result = await chain.invoke({ 
        aiName: aiPlayer.username,
        roleName, 
        teamName, 
        alivePlayers: alivePlayersStr, 
        deadPlayers: deadPlayersStr,
        nightCount,
        chatHistory,
        gameEvents: gameEventsStr,
        personalityDesc,
        speakingStyleDesc,
        languageDesc,
        formatInstructions 
      });
      return result.message;
    } catch (error) {
      console.error('[AIGameHandler] Chat generation error:', error);
      return this._getFallbackChatMessage(game, aiPlayer);
    }
  }

  _getFallbackChatMessage(game, aiPlayer) {
    const role = game.getRole(aiPlayer.socketId);
    const templates = {
      [ROLE.WEREWOLF]: [
        '我昨晚平安度过，没有任何信息。大家看看谁的发言比较奇怪，一起分析一下局势。',
        '预言家还没出来吗？我是好人阵营的，希望预言家能给点有用的信息帮助大家。',
        '我觉得XX的发言不太对劲，他一直在回避问题，可能身份有问题，大家注意一下。',
        '昨晚没什么特殊情况，我是好人，跟着大家的节奏走，希望能找出狼人。',
        'XX刚才的发言漏洞百出，我怀疑他是狼人，建议大家把票投给他。',
        '刚才XX说自己是平民，但他的分析太精准了，不像普通平民能做到的。',
        '我是好人，昨晚没动静，今天先把最可疑的XX投出去再说，别犹豫。',
        '预言家快出来说话啊！我们好人不能一直被动挨打，需要你的指引。',
        'XX一直在帮XX说话，他们两个可能是一伙的，大家小心点。',
        '我觉得今天应该先出XX，他的发言最没逻辑，身份最可疑。',
        '我目前没有什么线索，只能先听听大家怎么说，再做判断。',
        '我是平民，昨晚什么都不知道，现在还看不出谁是狼人，大家继续分析。',
      ],
      [ROLE.SEER]: [
        '我是预言家，昨晚查了XX，他是狼人！请大家相信我，今天把他投出去。',
        '昨晚查验了XX，是好人。今晚我会继续查验，大家注意保护我这个预言家。',
        '我是真预言家，昨晚验了XX是狼人，希望好人能跟我一起把他投出去。',
        '昨晚验了XX是好人，现在场上局势还不明朗，大家先别乱投，听我的分析。',
        '我是预言家，昨晚查了XX是好人，今天建议先出发言最差的那个人。',
        '昨晚我验了XX是狼人，今天必须先出他！如果你们不信我，好人就输了。',
        '我是预言家，昨晚验了XX是好人，今晚我会验XX，大家等我消息。',
        '刚才XX跳预言家，他是假的！我才是真预言家，昨晚验了XX是狼人。',
        '我是预言家，昨晚验了XX是好人，现在我怀疑XX和XX是狼人，请大家跟我一起投。',
        '我是预言家，昨晚验了XX是狼人，今天一定要出他，别让狼人继续作恶。',
      ],
      [ROLE.WITCH]: [
        '昨晚有人被杀了，但我用了解药救了他，具体是谁暂时不能说，大家注意安全。',
        '我是女巫，昨晚用了解药，现在场上还有一瓶毒药，狼人小心点别乱跳。',
        '昨晚情况很复杂，我知道一些信息，XX的身份可能不简单，大家多留意一下。',
        '我是女巫，昨晚救了一个人，今天希望大家能听我的分析，一起找出狼人。',
        '我手里还有毒药，如果有人乱跳身份，我会毫不犹豫地毒掉他。',
        '昨晚有人被杀，我救了，但我不说是谁。XX的发言让我很怀疑，大家小心。',
        '我是女巫，解药已经用了，现在只有毒药了，狼人别逼我出手。',
        '昨晚是平安夜，可能是守卫守对了，也可能是狼人空刀，大家继续分析。',
        '我知道昨晚的情况，但现在不能说太多，XX的身份值得怀疑，大家注意。',
        '我是女巫，昨晚救了人，今天希望大家能听我的，先把XX投出去。',
      ],
      [ROLE.GUARD]: [
        '昨晚我守护了自己，平安无事。今晚我会继续守护关键人物，请大家放心。',
        '昨晚我守了一个人，但不确定有没有被狼人盯上，大家注意发言的细节。',
        '我是守卫，昨晚守了自己，今晚我会根据局势决定守护谁，好人别怕。',
        '昨晚平安夜，可能是狼人空刀或者我守对了人，大家继续分析找出狼人。',
        '我是守卫，昨晚守了XX，希望能帮到好人阵营，大家相信我。',
        '昨晚我守了自己，今晚我会守预言家，请预言家放心发言。',
        '昨晚平安夜，我可能守对了人，大家继续找狼，别让他们逍遥法外。',
        '我是守卫，昨晚守了XX，希望能保护好人，今晚我会继续守护关键位置。',
        '昨晚我守了自己，平安无事，今晚我会根据大家的发言决定守护谁。',
        '我是守卫，昨晚守了预言家，希望能帮到好人，大家继续加油找出狼人。',
      ],
      [ROLE.HUNTER]: [
        '我是猎人，身份很硬，谁敢出我我就带走谁！大家最好别乱投我。',
        '我是猎人，有枪在手，狼人别想轻易把我弄出去，否则我会带走一个。',
        '我是猎人，如果有人敢票我，我会开枪带走一个可疑的人，大家想清楚。',
        '我是猎人，目前还没什么头绪，先听听其他人的分析再决定怎么投。',
        '我是猎人，身份明了，希望好人能跟我一起找出狼人，别让狼人赢了。',
        '我是猎人，身份在这里，谁敢动我我就带走谁！狼人别想轻易把我投出去。',
        '我是猎人，目前还没什么线索，先听预言家的分析，再决定怎么投票。',
        '我是猎人，有枪在手，狼人小心点！如果你们敢出我，我会带走一个。',
        '我是猎人，身份很硬，大家可以先出别人，别浪费在我身上。',
        '我是猎人，刚才XX的发言让我觉得很可疑，如果他继续乱跳，我会带走他。',
      ],
      [ROLE.VILLAGER]: [
        '我是平民，没有任何技能，只能靠大家的发言来判断谁是狼人，请多指教。',
        '预言家能给点信息吗？我是平民，完全没有方向，希望能得到指引。',
        '我是平民，昨晚什么都不知道，只能跟着预言家的节奏走了，相信好人。',
        '我是平民，大家说投谁就投谁，我完全相信好人阵营的判断，一起加油。',
        '我是平民，刚才XX的发言让我觉得很可疑，建议大家把他投出去。',
        '我是平民，昨晚什么都不知道，希望预言家能出来给点信息，我好跟着投票。',
        '我是平民，刚才XX和XX的对话很奇怪，他们可能有问题，大家注意一下。',
        '我是平民，完全没有头绪，只能跟着大家的节奏走，希望好人能赢。',
        '我是平民，预言家快出来说话啊！没有你的信息，我们怎么找狼人？',
        '我是平民，刚才XX的发言漏洞太多了，我觉得他是狼人，建议大家投他。',
        '我是平民，目前没有什么线索，只能先听听大家的分析再做判断。',
        '我是平民，昨晚什么都不知道，现在还看不出谁是狼人，大家继续讨论。',
        '我是平民，没有任何信息，只能跟着大家的节奏走，相信好人能赢。',
      ],
    };

    const messages = templates[role] || templates[ROLE.VILLAGER];
    let message = messages[Math.floor(Math.random() * messages.length)];
    
    const aliveOthers = game.alivePlayers.filter(p => p.socketId !== aiPlayer.socketId);
    if (aliveOthers.length > 0 && message.includes('XX')) {
      const randomPlayer = aliveOthers[Math.floor(Math.random() * aliveOthers.length)];
      message = message.replace(/XX/g, randomPlayer.username);
    }

    return message;
  }

  _sendChatMessage(roomCode, aiPlayer, message) {
    const room = roomCache.get(roomCode);
    if (!room) return;

    const chatMsg = {
      username: aiPlayer.username,
      message,
      timestamp: Date.now(),
      isAI: true,
    };

    room.chat.push(chatMsg);
    if (room.chat.length > 100) room.chat.shift();
    roomCache.set(roomCode, room);

    const io = require('../app').getIO();
    io.to(roomCode).emit('chat_message', chatMsg);
  }

  cleanup(roomCode) {
    this._stopDayChat(roomCode);
  }
}

module.exports = new AIGameHandler();
