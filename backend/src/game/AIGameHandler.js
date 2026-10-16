const { PromptTemplate } = require('@langchain/core/prompts');
const { StructuredOutputParser } = require('@langchain/core/output_parsers');
const { roomCache, gameCache } = require('../utils/cache');
const { PHASE, ROLE, TEAM } = require('./constants');
const { getRoleName } = require('./RoleConfig');
const aiAgentManager = require('../ai/AIAgentManager');
const gameRetriever = require('../services/GameRetriever');
const llmConfig = require('../config/llmConfig');
const User = require('../models/User');
const gameStateBuilder = require('./GameStateBuilder');
const fallbackStrategy = require('./FallbackStrategy');
const { invokeStructured } = require('./LLMDecisionService');

// W13: simple concurrency limiter for parallel AI LLM calls
function pLimit(concurrency) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve().then(fn).then(resolve, reject).finally(() => {
      active--;
      next();
    });
  };
  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    next();
  });
}

class AIGameHandler {
  constructor() {
    this.aiNames = ['小狼', '预言', '女巫', '守卫', '猎人', '村民', '智者', '勇者'];
    this.aiIdCounter = 0;
    this.aiChatTimers = {};
    // AI决策日志（保留最近100条）
    this.decisionLogs = [];
    this._MAX_LOGS = 100;
    // AI发言状态追踪：按 roomCode 隔离，避免多房间互相污染
    // key = roomCode, value = { socketId: { claimedRole, claimedChecks, suspectedPlayers } }
    this.aiClaims = {};
  }

  /**
   * 记录AI决策日志
   */
  _taskOpen(task) {
    return !task || task.state === 'RUNNING';
  }

  _attemptBudget(task) {
    if (!task) return 20000;
    return Math.max(0, task.deadline - Date.now());
  }

  _logDecision(roomCode, seatNum, role, phase, strategyUsed, decision, task) {
    const log = {
      time: Date.now(),
      roomCode,
      seatNum,
      role,
      phase,
      decisionId: task?.id || null,
      elapsedMs: task ? Date.now() - task.startedAt : null,
      taskState: task?.state || null,
      strategyUsed: strategyUsed ? strategyUsed.substring(0, 200) : '无',
      decision: typeof decision === 'string' ? decision.substring(0, 200) : JSON.stringify(decision).substring(0, 200),
    };
    this.decisionLogs.unshift(log);
    if (this.decisionLogs.length > this._MAX_LOGS) {
      this.decisionLogs = this.decisionLogs.slice(0, this._MAX_LOGS);
    }
  }

  /**
   * 获取AI决策日志
   */
  getDecisionLogs() {
    return this.decisionLogs;
  }

  _rememberThought(game, aiPlayer, { kind, summary, reasoning }) {
    if (!game || typeof game.recordAiThought !== 'function') return;
    game.recordAiThought({ player: aiPlayer, kind, summary, reasoning });
  }

  /**
   * 解析某房间应使用的 LLM 模型。
   * 仅使用房主自己的 Key；无 Key 时返回 null（走 fallback 逻辑）。
   * @param {string} roomCode
   * @returns {Promise<import('@langchain/openai').ChatOpenAI|null>}
   */
  async _getModelForRoom(roomCode, opts = {}) {
    const room = roomCache.get(roomCode);
    const hostUserId = room && room.hostUserId;

    let cfg = llmConfig.getEnvConfig();
    if (hostUserId) {
      try {
        cfg = llmConfig.mergeConfig(await User.getLLMConfig(hostUserId));
      } catch (err) {
        console.warn('[AIGameHandler] load host LLM config failed:', err.message);
      }
    }

    return llmConfig.buildModel(cfg, opts);
  }

  async createAIPlayer(roomCode, agentId = null, fallbackEnabled = true) {
    this.aiIdCounter++;
    
    const room = roomCache.get(roomCode);
    const existingAICount = room ? room.players.filter(p => p.isAI).length : 0;
    const aiNumber = existingAICount + 1;
    
    const agent = agentId
      ? await aiAgentManager.getAgentById(agentId)
      : await aiAgentManager.getRandomAgent();
    
    return {
      socketId: `ai_${roomCode}_${this.aiIdCounter}`,
      userId: null,
      username: agent ? `${agent.avatar} ${agent.name}` : `🤖 人机${aiNumber}`,
      isReady: true,
      isAlive: true,
      isAI: true,
      agentId: agent?.id || null,
      agentConfig: agent || null,
      fallbackEnabled,
    };
  }

  _isFallbackEnabled(aiPlayer) {
    return aiPlayer?.fallbackEnabled !== false;
  }

  async handlePhaseChange(roomCode, phase) {
    const game = gameCache.get(roomCode);
    if (!game) return;

    // 夜间和投票由各阶段自己调用，避免阶段开始时抢先决策、结束后再覆盖一次。
    if (phase === PHASE.END) {
      this._stopDayChat(roomCode);
    }
  }

  async _handleNightPhase(game, aiPlayers) {
    // W13: bound concurrency to 5 parallel AI decisions
    const limit = pLimit(5);
    await Promise.all(aiPlayers.map((aiPlayer) => limit(async () => {
      const role = game.getRole(aiPlayer.socketId);
      if (!role) return;

      try {
        const action = await this._decideNightAction(game, aiPlayer, role);
        if (action) {
          game.submitNightAction(aiPlayer.socketId, action.action, action.targetId);
        }
      } catch (error) {
        console.error(`[AIGameHandler] Night action error for ${aiPlayer.username}:`, error);
      }
    })));
  }

  _parseSeatChoice(game, raw) {
    if (raw == null) return null;
    const text = String(raw).trim();
    if (!text || /^(null|undefined|无|skip|跳过|none)$/i.test(text)) return null;

    const byId = game.getPlayer(text);
    if (byId) return byId.socketId;

    const matched = text.match(/(\d+)\s*号?/);
    if (!matched) return null;
    const seat = `${matched[1]}号`;
    const player = game.players.find(p => game.getSeatNum(p.socketId) === seat);
    return player ? player.socketId : null;
  }

  _nightStrategy(aiPlayer) {
    return fallbackStrategy.nightStrategy(aiPlayer);
  }

  _extractAccusedSeats(text) {
    return fallbackStrategy.extractAccusedSeats(text);
  }

  _scorePublicTarget(game, player, strategy) {
    return fallbackStrategy.scorePublicTarget(game, player, strategy);
  }

  _pickByNightStrategy(game, candidates, strategy) {
    return fallbackStrategy.pickByNightStrategy(game, candidates, strategy);
  }

  _werewolfConsensusTarget(game, aiPlayer) {
    return fallbackStrategy.werewolfConsensusTarget(game, aiPlayer);
  }

  _ownNightHistory(game, aiPlayer, role) {
    return gameStateBuilder.ownNightHistory(game, aiPlayer, role);
  }

  _buildDecisionBrief(game, aiPlayer) {
    return gameStateBuilder.decisionBrief(game, aiPlayer);
  }

  async _decideNightAction(game, aiPlayer, role, task = null) {
    if (!this._taskOpen(task)) return null;
    const model = await this._getModelForRoom(game.roomCode);
    if (!model) {
      console.log(`[AIGameHandler] No LLM model, using fallback night action for ${aiPlayer.username}`);
      if (task) task.usedFallback = true;
      return this._getFallbackNightAction(game, aiPlayer, role);
    }

    const gameState = this._buildGameState(game, aiPlayer);
    // RAG: Retrieve relevant strategies
    const ragStrategyText = await gameRetriever.getStrategyForGame(game, aiPlayer.socketId);

    const agentConfig = aiPlayer.agentConfig || await aiAgentManager.getAgentById(aiPlayer.agentId);
    
    const outputParser = StructuredOutputParser.fromNamesAndDescriptions({
      action: '行动类型，可选值: kill, check, guard, save, poison, skip',
      targetSeat: '目标座位，必须是“可选座位”中的一个，例如 3号。skip 时填无',
      reasoning: '你的推理过程，说明为什么选择这个行动',
    });

    const formatInstructions = outputParser.getFormatInstructions();

    const alivePlayersStr = gameState.alivePlayers.map(p => p.seat).join('、');
    const teammatesStr = role === ROLE.WEREWOLF
      ? (gameState.teammates.map(p => p.seat).join('、') || '无')
      : '你不知道其他玩家的身份';
    const seatOptions = this._legalNightTargets(game, aiPlayer, role).map(p => game.getSeatNum(p.socketId));

    const roleName = getRoleName(role);
    const roleAbility = this._getRoleAbility(role);

    // 狼人：查看队友已选择的击杀目标
    let teammateChoiceStr = '暂无';
    if (role === ROLE.WEREWOLF && gameState.teammates.length > 0) {
      const teammateChoices = gameState.teammates
        .map(t => {
          const action = game.nightActions[t.socketId];
          if (action?.action === 'kill' && action.targetId) {
            return `${t.seat} 选择了 ${game.getSeatNum(action.targetId)}`;
          }
          return `${t.seat} 尚未选择`;
        })
        .join('；');
      teammateChoiceStr = teammateChoices;
    }
    
    // 构建策略描述
    let strategyDesc = '';
    if (agentConfig?.strategy) {
      const s = agentConfig.strategy;
      const nightActionMap = {
        'random': '随机选择目标',
        'target_weak': '优先攻击发言较弱的玩家',
        'target_strong': '优先攻击发言较强的玩家',
        'follow_teammate': '跟随队友的选择'
      };
      strategyDesc = `\n=== 你的策略 ===\n夜间策略：${nightActionMap[s.nightAction] || '随机选择目标'}`;
    }
    
    let roleState = '';
    if (role === ROLE.WITCH) {
      const victim = game.killedByWerewolves ? game.getSeatNum(game.killedByWerewolves) : '无人';
      roleState = `\n今晚被刀的是：${victim}。解药${game.witchSaveUsed ? '已用' : '可用'}，毒药${game.witchPoisonUsed ? '已用' : '可用'}。救人时 targetSeat 必须是被刀座位。`;
    } else if (role === ROLE.GUARD && game.guardLastProtected) {
      roleState = `\n不能再守护：${game.getSeatNum(game.guardLastProtected)}。`;
    }

    const prompt = new PromptTemplate({
      template: `你是一个狼人杀游戏中的AI玩家。

当前游戏状态：
- 游戏阶段：夜晚
- 你的角色：{roleName}
- 角色能力：{roleAbility}
- 当前存活玩家：{alivePlayers}
- 身份信息：{teammates}
- 队友击杀选择：{teammateChoice}
- 可选座位：{seatOptions}
{roleState}
{decisionBrief}
{strategyDesc}
{ragStrategy}
请只从“可选座位”里选择 targetSeat，写成“3号”这种格式。skip 时 action 填 skip，targetSeat 填无。
狼人尽量和队友统一击杀目标。不要假设未告知你的身份。

{formatInstructions}`,
      inputVariables: ['roleName', 'roleAbility', 'alivePlayers', 'teammates', 'teammateChoice', 'seatOptions', 'roleState', 'decisionBrief', 'strategyDesc', 'ragStrategy', 'formatInstructions'],
    });

    const chain = prompt.pipe(model).pipe(outputParser);
    const invoked = await invokeStructured({
      chain,
      input: {
        roleName,
        roleAbility,
        alivePlayers: alivePlayersStr,
        teammates: teammatesStr,
        teammateChoice: teammateChoiceStr,
        seatOptions: seatOptions.join('、') || '无',
        roleState,
        decisionBrief: this._buildDecisionBrief(game, aiPlayer),
        strategyDesc,
        ragStrategy: ragStrategyText,
        formatInstructions,
      },
      isOpen: () => this._taskOpen(task),
      budgetOf: () => this._attemptBudget(task),
      validate: (result) => {
        if (result.action === 'skip') return { ok: true, value: { kind: 'skip', result } };
        const targetId = this._parseSeatChoice(game, result.targetSeat ?? result.targetId);
        if (this._isLegalNightAction(game, aiPlayer, role, result.action, targetId)) {
          return { ok: true, value: { kind: 'action', result, targetId } };
        }
        return { ok: false, message: 'invalid night target' };
      },
    });

    if (invoked.cancelled) return null;
    if (invoked.ok && invoked.value.kind === 'skip') {
      console.log(`[AIGameHandler] LLM night action for ${game.getSeatNum(aiPlayer.socketId)} (${getRoleName(role)}): skip`);
      this._logDecision(game.roomCode, game.getSeatNum(aiPlayer.socketId), role, 'NIGHT', ragStrategyText, 'skip', task);
      this._rememberThought(game, aiPlayer, {
        kind: '夜间行动',
        summary: '跳过',
        reasoning: invoked.value.result.reasoning,
      });
      return role === ROLE.WITCH ? { action: 'skip', targetId: null } : null;
    }
    if (invoked.ok) {
      const { result, targetId } = invoked.value;
      console.log(`[AIGameHandler] LLM night action for ${game.getSeatNum(aiPlayer.socketId)} (${getRoleName(role)}): ${result.action} -> ${game.getSeatNum(targetId)}`);
      this._logDecision(game.roomCode, game.getSeatNum(aiPlayer.socketId), role, 'NIGHT', ragStrategyText, `${result.action} -> ${game.getSeatNum(targetId)}`, task);
      this._rememberThought(game, aiPlayer, {
        kind: '夜间行动',
        summary: `${result.action} → ${game.getSeatNum(targetId)}`,
        reasoning: result.reasoning,
      });
      return { action: result.action, targetId };
    }

    if (!invoked.cancelled && invoked.errorClass) {
      console.warn(`[AIGameHandler] LLM night action failed for ${aiPlayer.username}: ${invoked.errorClass} ${invoked.message || ''}`);
    }
    if (!this._taskOpen(task)) return null;
    if (task) task.usedFallback = true;
    return this._emergencyNightAction(game, aiPlayer, role);
  }

  _remember(game, aiPlayer) {
    return (nextGame, nextPlayer, thought) => this._rememberThought(nextGame, nextPlayer, thought);
  }

  _emergencyNightAction(game, aiPlayer, role) {
    return fallbackStrategy.emergencyNightAction(game, aiPlayer, role, this._remember(game, aiPlayer));
  }

  _legalNightTargets(game, aiPlayer, role) {
    return fallbackStrategy.legalNightTargets(game, aiPlayer, role);
  }

  _isLegalNightAction(game, aiPlayer, role, action, targetId) {
    return fallbackStrategy.isLegalNightAction(game, aiPlayer, role, action, targetId);
  }

  _accusationCounts(game, candidates) {
    return fallbackStrategy.accusationCounts(game, candidates);
  }

  _getFallbackNightAction(game, aiPlayer, role) {
    return fallbackStrategy.nightAction(game, aiPlayer, role, this._remember(game, aiPlayer));
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
    return gameStateBuilder.build(game, aiPlayer);
  }

  async _handleVotePhase(game, aiPlayers) {
    // W13: bound concurrency to 5 parallel AI vote decisions
    const limit = pLimit(5);
    await Promise.all(aiPlayers.map((aiPlayer) => limit(async () => {
      try {
        const voteTarget = await this._decideVote(game, aiPlayer);
        if (voteTarget) {
          game.submitVote(aiPlayer.socketId, voteTarget);
        }
      } catch (error) {
        console.error(`[AIGameHandler] Vote error for ${aiPlayer.username}:`, error);
      }
    })));
  }

  async _decideVote(game, aiPlayer, task = null) {
    if (!this._taskOpen(task)) return null;
    const model = await this._getModelForRoom(game.roomCode);
    if (!model) {
      console.log(`[AIGameHandler] No LLM model, using fallback vote for ${aiPlayer.username}`);
      if (task) task.usedFallback = true;
      return this._getFallbackVote(game, aiPlayer);
    }

    const role = game.getRole(aiPlayer.socketId);
    const team = TEAM[role];
    const agentConfig = aiPlayer.agentConfig || await aiAgentManager.getAgentById(aiPlayer.agentId);
    const candidates = this._voteCandidates(game, aiPlayer);

    if (candidates.length === 0) return null;

    const aliveOthersStr = candidates.map(p => game.getSeatNum(p.socketId)).join('、');
    const teamName = team === 'werewolf' ? '狼人' : '好人';
    const goal = team === 'werewolf' ? '投票放逐好人，且不要投狼人队友' : '根据公开发言投票放逐狼人';
    
    const outputParser = StructuredOutputParser.fromNamesAndDescriptions({
      targetSeat: '要投票放逐的座位，必须是可选座位中的一个，例如 3号',
      reasoning: '你的推理过程，说明为什么投票给这个玩家',
    });

    const formatInstructions = outputParser.getFormatInstructions();

    const roleName = getRoleName(role);
    
    // RAG: Retrieve relevant strategies for voting
    const ragStrategyText = await gameRetriever.getStrategyForGame(game, aiPlayer.socketId);

    // 构建策略描述
    let strategyDesc = '';
    if (agentConfig?.strategy) {
      const s = agentConfig.strategy;
      const dayStrategyMap = {
        'passive': '被动跟随，不主动引导投票',
        'active': '主动发言，积极分析局势',
        'leader': '领袖风格，引导大家投票',
        'follower': '跟随者，参考他人意见投票'
      };
      const revealMap = {
        'early': '尽早暴露身份以获取信任',
        'mid': '中期适时暴露身份',
        'late': '晚期才暴露身份',
        'never': '绝不暴露身份'
      };
      strategyDesc = `\n=== 你的策略 ===\n白天策略：${dayStrategyMap[s.dayStrategy] || '主动分析'}\n身份暴露：${revealMap[s.revealIdentity] || '中期暴露'}`;
    }
    
    const prompt = new PromptTemplate({
      template: `你是一个狼人杀游戏中的AI玩家。

当前游戏状态：
- 游戏阶段：投票阶段
- 你的角色：{roleName}
- 你的阵营：{teamName}
- 可选座位：{aliveOthers}
- 你的目标：{goal}
{decisionBrief}
{strategyDesc}
{ragStrategy}
targetSeat 必须从可选座位里选，写成“3号”。不要投票给自己。你只知道自己的身份；狼人只额外知道队友。

{formatInstructions}`,
      inputVariables: ['roleName', 'teamName', 'aliveOthers', 'goal', 'decisionBrief', 'strategyDesc', 'ragStrategy', 'formatInstructions'],
    });

    const chain = prompt.pipe(model).pipe(outputParser);
    const allowed = new Set(candidates.map(player => player.socketId));
    const invoked = await invokeStructured({
      chain,
      input: {
        roleName,
        teamName,
        aliveOthers: aliveOthersStr,
        goal,
        decisionBrief: this._buildDecisionBrief(game, aiPlayer),
        strategyDesc,
        ragStrategy: ragStrategyText,
        formatInstructions,
      },
      isOpen: () => this._taskOpen(task),
      budgetOf: () => this._attemptBudget(task),
      validate: (result) => {
        const targetId = this._parseSeatChoice(game, result.targetSeat ?? result.targetId);
        if (targetId && allowed.has(targetId) && targetId !== aiPlayer.socketId) {
          return { ok: true, value: { targetId, reasoning: result.reasoning } };
        }
        return { ok: false, message: 'invalid vote target' };
      },
    });

    if (invoked.cancelled) return null;
    if (invoked.ok) {
      const { targetId, reasoning } = invoked.value;
      console.log(`[AIGameHandler] LLM vote for ${game.getSeatNum(aiPlayer.socketId)} (${getRoleName(role)}): -> ${game.getSeatNum(targetId)}`);
      this._logDecision(game.roomCode, game.getSeatNum(aiPlayer.socketId), role, 'VOTE', ragStrategyText, `vote -> ${game.getSeatNum(targetId)}`, task);
      this._rememberThought(game, aiPlayer, {
        kind: '投票',
        summary: `投票给 ${game.getSeatNum(targetId)}`,
        reasoning,
      });
      return targetId;
    }

    if (invoked.errorClass) {
      console.warn(`[AIGameHandler] LLM vote failed for ${aiPlayer.username}: ${invoked.errorClass} ${invoked.message || ''}`);
      this._logDecision(game.roomCode, game.getSeatNum(aiPlayer.socketId), role, 'VOTE', ragStrategyText, `${invoked.errorClass}: ${invoked.message || ''}`, task);
    }
    if (!this._taskOpen(task)) return null;
    const emergency = this._voteCandidates(game, aiPlayer);
    const picked = emergency[Math.floor(Math.random() * emergency.length)];
    if (!picked) return null;
    if (task) task.usedFallback = true;
    this._rememberThought(game, aiPlayer, {
      kind: '投票',
      summary: `投票给 ${game.getSeatNum(picked.socketId)}`,
      reasoning: '模型两次都没有给出合法投票，随机投了一票。',
    });
    return picked.socketId;
  }

  _voteCandidates(game, aiPlayer) {
    return fallbackStrategy.voteCandidates(game, aiPlayer);
  }

  _getFallbackVote(game, aiPlayer) {
    return fallbackStrategy.vote(game, aiPlayer, this._remember(game, aiPlayer));
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

  async _generateChatMessage(game, aiPlayer, task = null) {
    if (!this._taskOpen(task)) return '';
    const model = await this._getModelForRoom(game.roomCode);
    if (!model) {
      console.log(`[AIGameHandler] No LLM model, using fallback for ${aiPlayer.username}`);
      if (task) task.usedFallback = true;
      return this._getFallbackChatMessage(game, aiPlayer);
    }

    const role = game.getRole(aiPlayer.socketId);
    const team = TEAM[role];
    const alivePlayers = game.alivePlayers;
    const teamName = team === 'werewolf' ? '狼人' : '村民';
    const isWerewolf = team === 'werewolf';
    const alivePlayersStr = alivePlayers.map(p => game.getSeatNum(p.socketId)).join(', ');

    // Build username to seat number mapping for sanitizing context
    const nameToSeat = {};
    game.players.forEach(p => {
      if (p.username) nameToSeat[p.username] = game.getSeatNum(p.socketId);
    });
    const sortedNames = Object.keys(nameToSeat).sort((a, b) => b.length - a.length);
    const replaceNames = (text) => {
      let result = text;
      for (const name of sortedNames) {
        if (name && name.length > 0) {
          result = result.split(name).join(nameToSeat[name]);
        }
      }
      return result;
    };

    const room = roomCache.get(game.roomCode);
    const recentChat = room?.chat || [];
    const chatHistory = recentChat.slice(-8).map(msg => {
      if (msg.isSystem) return `[系统] ${replaceNames(msg.message)}`;
      const aiMarker = msg.isAI ? '🤖' : '';
      const displayName = nameToSeat[msg.username] || msg.username;
      return `${aiMarker}${displayName}: ${replaceNames(msg.message)}`;
    }).join('\n');

    const deadPlayers = game.players.filter(p => !p.isAlive).map(p => game.getSeatNum(p.socketId));
    const deadPlayersStr = deadPlayers.length > 0 ? deadPlayers.join(', ') : '无';

    const nightCount = game.nightCount;

    let gameEvents = [];
    if (game.gameHistory.length > 0) {
      const recentEvents = game.gameHistory.slice(-20);
      recentEvents.forEach(h => {
        if (!gameStateBuilder.canSeeHistoryEvent(game, aiPlayer, h)) return;
        const actorName = h.actor?.username || (h.actor?.id ? game.getSeatNum(h.actor.id) : '未知');
        const targetName = h.target?.username || (h.target?.id ? game.getSeatNum(h.target.id) : '未知');
        const isSelfAction = h.actor?.id === aiPlayer.socketId;

        if (h.action === 'kill') {
          if (isSelfAction || isWerewolf) {
            gameEvents.push(`第${h.night}夜: 你参与击杀了${targetName}`);
          }
        } else if (h.action === 'check') {
          if (isSelfAction) {
            gameEvents.push(`第${h.night}夜: 你查验了${targetName}，结果是${h.result === 'werewolf' ? '狼人' : '好人'}`);
          }
        } else if (h.action === 'guard') {
          if (isSelfAction) {
            gameEvents.push(`第${h.night}夜: 你守护了${targetName}`);
          }
        } else if (h.action === 'save') {
          if (isSelfAction) {
            gameEvents.push(`第${h.night}夜: 你用解药救了${targetName}`);
          }
        } else if (h.action === 'poison') {
          if (isSelfAction) {
            gameEvents.push(`第${h.night}夜: 你用毒药毒了${targetName}`);
          }
        } else if (h.action === 'vote') {
          gameEvents.push(`${actorName}投票给了${targetName}`);
        } else if (h.action === 'night_end') {
          if (h.deaths && h.deaths.length > 0) {
            const deathNames = h.deaths.map(d => d.username || (d.id ? game.getSeatNum(d.id) : '未知')).join(', ');
            gameEvents.push(`第${h.night}夜结束: ${deathNames}死亡`);
          } else {
            gameEvents.push(`第${h.night}夜结束: 平安夜`);
          }
        } else if (h.action === 'hunter_shoot') {
          gameEvents.push(`${actorName}开枪带走了${targetName}`);
        }
      });
    }
    const gameEventsStr = gameEvents.length > 0 ? gameEvents.join('\n') : '暂无';
    const memoryBrief = gameStateBuilder.publicMemory(game, aiPlayer).join('\n') || '暂无';

    // RAG: Retrieve relevant strategies for chat
    const ragStrategyText = await gameRetriever.getStrategyForGame(game, aiPlayer.socketId);

    const agentConfig = aiPlayer.agentConfig || await aiAgentManager.getAgentById(aiPlayer.agentId);
    let personalityDesc = '';
    let speakingStyleDesc = '';
    let languageDesc = '';
    let emotionDesc = '';
    
    if (agentConfig) {
      const p = agentConfig.personality;
      if (p.aggressiveness > 70) personalityDesc += '你性格激进，敢于主动出击，不怕被怀疑，喜欢直接质疑别人。';
      if (p.aggressiveness < 30) personalityDesc += '你性格温和，不喜欢主动攻击别人，倾向于被动防御。';
      if (p.caution > 70) personalityDesc += '你非常谨慎，从不轻易暴露自己，发言保守，不会说太多。';
      if (p.caution < 30) personalityDesc += '你比较大胆，敢于说出自己的想法，不怕暴露信息。';
      if (p.cunning > 70) personalityDesc += '你很狡猾，善于伪装，说谎时面不改色，会编造合理的谎言。';
      if (p.cunning < 30) personalityDesc += '你比较老实，不擅长说谎，更喜欢说实话。';
      if (p.honesty < 30) {
        if (isWerewolf) {
          personalityDesc += '你喜欢说谎，可以编造查验结果和夜间信息来误导好人。';
        } else {
          personalityDesc += '你说话比较直接，有什么说什么，不会拐弯抹角。';
        }
      }
      if (p.honesty > 70) {
        if (isWerewolf) {
          personalityDesc += '你比较诚实，不太擅长撒谎，需要尽量避免暴露。';
        } else {
          personalityDesc += '你很诚实，会如实汇报信息，不会编造。';
        }
      }
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
        languageDesc += `【可选使用】发言开头可以使用以下词组之一：${lang.prefixes.join('、')}`;
      }
      if (lang.suffixes && lang.suffixes.length > 0) {
        languageDesc += `；【可选使用】发言结尾可以使用以下词组之一：${lang.suffixes.join('、')}`;
      }
      if (lang.favoriteWords && lang.favoriteWords.length > 0) {
        languageDesc +=`；【可选使用】发言中可以融入以下词汇：${lang.favoriteWords.join('、')}`;
      }
    } else {
      personalityDesc = '你是一个普通的玩家，发言比较均衡。';
      speakingStyleDesc = '你的发言风格正常，比较随和。';
      languageDesc = '';
    }

    // Emotion injection based on game state
    const lastEvent = game.gameHistory.length > 0 ? game.gameHistory[game.gameHistory.length - 1] : null;
    if (lastEvent) {
      const deaths = lastEvent.deaths || [];
      if (deaths.length > 0) {
        const selfDied = deaths.some(d => d.socketId === aiPlayer.socketId);
        if (selfDied) {
          emotionDesc = '你刚刚死亡，心情可能愤怒、不甘或释然，发言中可能带有情绪。';
        } else if (isWerewolf && deaths.some(d => game.getRole(d.socketId) === ROLE.WEREWOLF)) {
          emotionDesc = '你的队友刚刚被淘汰，你可能感到压力或愤怒，发言中可能带有攻击性或掩饰。';
        } else {
          emotionDesc = '刚刚有人被淘汰，你可能感到紧迫，发言里把注意力放在公开信息上。';
        }
      }
      if (lastEvent.action === 'hunter_shoot') {
        emotionDesc += (emotionDesc ? ' ' : '') + '猎人刚刚开枪带走了一个人，局势紧张。';
      }
    }

    // Check if this player was mentioned in recent chat
    if (this._wasMentioned(room?.chat, game.getSeatNum(aiPlayer.socketId))) {
      emotionDesc += (emotionDesc ? ' ' : '') + '你刚刚被其他玩家提到，需要回应他们的质疑或观点。';
    }

    const outputParser = StructuredOutputParser.fromNamesAndDescriptions({
      reasoning: '内心推理，说明你为什么这样说。不要写进发言里',
      message: '你要说出口的话，符合你的角色、性格和游戏状态',
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

=== 你的情绪状态 ===
{emotionDesc}

=== 你的性格特征 ===
{personalityDesc}

=== 你的发言风格 ===
{speakingStyleDesc}

=== 语言习惯（可选参考） ===
{languageDesc}

=== 局内记忆（只含公开信息。你已经表过态时，不要无故改口）===
{memoryBrief}

=== 最近聊天记录 ===
{chatHistory}

=== 游戏事件记录 ===
{gameEvents}
{ragStrategy}
=== 策略运用提示 ===
上方提供了多条参考策略，请结合当前局势自主选择最合适的一条融入发言，不要生搬硬套，自然地体现在你的话语中。
=== 角色发言规则 ===
- 狼人：伪装成好人，分析局势，引导舆论，保护队友，根据聊天记录找机会嫁祸好人
- 预言家：报告查验结果（如果你验过的人），引导投票，对可疑的人提出质疑
- 女巫：谨慎发言，可以暗示你知道的信息（比如昨晚有人被杀），不要暴露太多
- 守卫：隐藏身份，谨慎发言，可以假装是平民
- 猎人：可以强势发言，威慑狼人，被怀疑时可以亮身份
- 平民：表达困惑，请求信息，跟随好人，分析其他人的发言漏洞

=== 口语化要求（最重要）===
1. 用口语说话，就像跟朋友聊天一样，不要用书面语
2. 禁止使用："我认为"、"首先...其次...最后"、"综上所述"、"毫无疑问"、"值得注意的是"等演讲式表达
3. 可以使用语气词："啊"、"嘛"、"呢"、"呗"、"啦"、"哈"
4. 可以使用口语化表达："我觉着"、"所以说"、"还有就是"、"你们看啊"、"八成"、"说不定"
5. 允许句子不完整，用"..."表示犹豫，用"！"表示情绪
6. 真人发言不是完美的，可以有跳跃和不连贯

=== 示例（真人发言风格，参考这个调调）===
- 口语化正确示例：
  "3号刚才说的不对吧，他没说为啥怀疑5号啊"
  "我觉着昨晚平安夜挺奇怪的，守卫不会守到自己人了吧"
  "等等，刚才1号跳预言家了？他验了谁啊"
  "6号你别装了，你刚才投票犹豫了好久"
  "我没啥线索，听听大家怎么说呗"
  "2号你刚才说的有道理，我也觉得4号有问题"
- AI味错误示例（不要这样说）：
  "我认为我们应该仔细分析局势"
  "首先，根据游戏逻辑，其次，基于投票结果"
  "综上所述，我怀疑XX是狼人"
  "大家注意，这轮投票至关重要"
  "我作为平民，没有任何特殊能力"

=== 必须遵守的规则 ===
1. 发言要有上下文，必须和前面的对话以及局内记忆有关联
2. 针对具体玩家，提到名字时用座位号或名字
3. 如果有人提到你，必须回应
4. 不要重复别人说过的话
5. 口语化，像真人说话，不要像AI汇报
6. 字数：短则5-15字，长则30-60字，根据你的性格和情绪决定
7. 符合你的性格特征和发言风格
8. 语言习惯中的词汇可以选择性使用，不必每次都用

{formatInstructions}`,
      inputVariables: ['aiName', 'roleName', 'teamName', 'alivePlayers', 'deadPlayers', 'nightCount', 'chatHistory', 'gameEvents', 'memoryBrief', 'ragStrategy', 'personalityDesc', 'speakingStyleDesc', 'languageDesc', 'emotionDesc', 'formatInstructions'],
    });

    const personalityTemp = this._getTemperatureForPersonality(agentConfig);
    const chatModel = await this._getModelForRoom(game.roomCode, { temperature: personalityTemp }) || model;

    const chain = prompt.pipe(chatModel).pipe(outputParser);
    const invoked = await invokeStructured({
      chain,
      input: {
        aiName: game.getSeatNum(aiPlayer.socketId),
        roleName,
        teamName,
        alivePlayers: alivePlayersStr,
        deadPlayers: deadPlayersStr,
        nightCount,
        chatHistory,
        gameEvents: gameEventsStr,
        memoryBrief,
        ragStrategy: ragStrategyText,
        personalityDesc,
        speakingStyleDesc,
        languageDesc,
        emotionDesc,
        formatInstructions,
      },
      isOpen: () => this._taskOpen(task),
      budgetOf: () => this._attemptBudget(task),
      validate: (result) => {
        const text = String(result?.message || '').trim();
        if (!text) return { ok: false, message: 'empty chat' };
        return { ok: true, value: { message: text.slice(0, 180), reasoning: result.reasoning } };
      },
    });

    if (invoked.cancelled) return '';
    if (!invoked.ok) {
      console.warn(`[AIGameHandler] LLM chat failed for ${aiPlayer.username}: ${invoked.errorClass || ''} ${invoked.message || ''}`);
      this._logDecision(game.roomCode, game.getSeatNum(aiPlayer.socketId), role, 'DAY', ragStrategyText, `${invoked.errorClass || 'error'}: ${invoked.message || ''}`, task);
      if (invoked.errorClass === 'deadline' && task) task.usedFallback = true;
      return invoked.errorClass === 'deadline' ? this._getFallbackChatMessage(game, aiPlayer) : '';
    }

    let message = this._postProcessMessage(invoked.value.message, aiPlayer);
    message = replaceNames(message);
    console.log(`[AIGameHandler] LLM chat generated for ${game.getSeatNum(aiPlayer.socketId)} (${getRoleName(role)}): ${message.substring(0, 60)}...`);
    this._logDecision(game.roomCode, game.getSeatNum(aiPlayer.socketId), role, 'DAY', ragStrategyText, message, task);
    this._rememberThought(game, aiPlayer, {
      kind: '发言',
      summary: String(message || '').slice(0, 80),
      reasoning: invoked.value.reasoning || '模型没有单独写出推理。',
    });
    return message;
  }

  _getFallbackChatMessage(game, aiPlayer) {
    const message = this._fallbackChatBody(game, aiPlayer);
    if (message && String(message).trim()) {
      this._rememberThought(game, aiPlayer, {
        kind: '发言',
        summary: String(message).trim().slice(0, 80),
        reasoning: '按本地发言模板生成，没有大模型推理。',
      });
    }
    return message;
  }

  _fallbackChatBody(game, aiPlayer) {
    if (!this._isFallbackEnabled(aiPlayer)) return '';
    const role = game.getRole(aiPlayer.socketId);
    const mySeat = game.getSeatNum(aiPlayer.socketId);
    const room = roomCache.get(game.roomCode);
    const chat = room?.chat || [];

    // 解析聊天记录，提取关键信息
    const chatContext = this._parseChatContext(chat, game, aiPlayer.socketId);

    // 获取或初始化AI发言状态（按 roomCode 隔离）
    const roomCode = game.roomCode;
    if (!this.aiClaims[roomCode]) {
      this.aiClaims[roomCode] = {};
    }
    if (!this.aiClaims[roomCode][aiPlayer.socketId]) {
      this.aiClaims[roomCode][aiPlayer.socketId] = { claimedRole: null, claimedChecks: [], hasSpoken: false };
    }
    const myClaim = this.aiClaims[roomCode][aiPlayer.socketId];

    const aliveOthers = game.alivePlayers.filter(p => p.socketId !== aiPlayer.socketId);
    // 只引用真正发过言的玩家
    const spokenPlayers = aliveOthers.filter(p => chatContext.spokenSeats.has(game.getSeatNum(p.socketId)));
    const unspokenPlayers = aliveOthers.filter(p => !chatContext.spokenSeats.has(game.getSeatNum(p.socketId)));

    let message = '';

    switch (role) {
      case ROLE.SEER:
        message = this._seerFallback(game, aiPlayer, myClaim, chatContext, aliveOthers, spokenPlayers);
        break;
      case ROLE.WEREWOLF:
        message = this._werewolfFallback(game, aiPlayer, myClaim, chatContext, aliveOthers, spokenPlayers);
        break;
      case ROLE.WITCH:
        message = this._witchFallback(game, aiPlayer, myClaim, chatContext, aliveOthers, spokenPlayers);
        break;
      case ROLE.GUARD:
        message = this._guardFallback(game, aiPlayer, myClaim, chatContext, aliveOthers, spokenPlayers);
        break;
      case ROLE.HUNTER:
        message = this._hunterFallback(game, aiPlayer, myClaim, chatContext, aliveOthers, spokenPlayers);
        break;
      default:
        message = this._villagerFallback(game, aiPlayer, myClaim, chatContext, aliveOthers, spokenPlayers);
    }

    // 更新发言状态
    myClaim.hasSpoken = true;

    return message;
  }

  /**
   * 解析聊天记录，提取关键信息
   */
  _parseChatContext(chat, game, mySocketId) {
    const spokenSeats = new Set();
    const seerClaims = []; // 谁跳了预言家
    const accusations = []; // 谁怀疑谁
    const roleClaims = {}; // seatNum -> claimed role

    for (const msg of chat) {
      if (msg.isSystem) continue;
      const seat = msg.username;
      if (!seat) continue;
      spokenSeats.add(seat);

      const text = msg.message || '';

      // 检测跳预言家
      if (/我是.*(预言家|预言)/.test(text) || /我.*验了|我.*查验了/.test(text)) {
        seerClaims.push({ seat, text });
        roleClaims[seat] = 'seer';
      }

      // 检测跳猎人
      if (/我是.*猎人/.test(text)) {
        roleClaims[seat] = 'hunter';
      }

      // 检测跳女巫
      if (/我是.*女巫/.test(text)) {
        roleClaims[seat] = 'witch';
      }

      // 检测跳守卫
      if (/我是.*守卫/.test(text)) {
        roleClaims[seat] = 'guard';
      }

      // 检测跳平民
      if (/我是.*平民/.test(text)) {
        roleClaims[seat] = 'villager';
      }

      // 检测怀疑某人
      for (const target of this._extractAccusedSeats(text)) {
        if (target !== seat) accusations.push({ from: seat, target });
      }
    }

    return {
      spokenSeats,
      seerClaims,
      accusations,
      roleClaims,
      hasSeerClaimed: seerClaims.length > 0,
      mySeat: game.getSeatNum(mySocketId),
    };
  }

  /**
   * 从发过言的玩家中随机选一个（排除自己）
   */
  _topAccusedSeat(game, aiPlayer, ctx) {
    const counts = {};
    for (const item of ctx?.accusations || []) {
      if (!item?.target || item.target === item.from) continue;
      counts[item.target] = (counts[item.target] || 0) + 1;
    }
    const mySeat = game.getSeatNum(aiPlayer.socketId);
    const role = game.getRole(aiPlayer.socketId);
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    for (const [seat] of ranked) {
      if (seat === mySeat) continue;
      const player = (game.alivePlayers || []).find((item) => game.getSeatNum(item.socketId) === seat);
      if (!player) continue;
      if (role === ROLE.WEREWOLF && game.getRole(player.socketId) === ROLE.WEREWOLF) continue;
      return player;
    }
    return null;
  }

  _pickSpokenPlayer(spokenPlayers, game, excludeSeat = null, aiPlayer = null, ctx = null) {
    if (aiPlayer && ctx) {
      const focused = this._topAccusedSeat(game, aiPlayer, ctx);
      if (focused && game.getSeatNum(focused.socketId) !== excludeSeat) return focused;
    }
    const candidates = spokenPlayers.filter(p => {
      const seat = game.getSeatNum(p.socketId);
      return seat !== excludeSeat;
    });
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * 从所有存活玩家中随机选一个（排除自己）
   */
  _pickAnyPlayer(aliveOthers, game, excludeSeat = null) {
    const candidates = aliveOthers.filter(p => {
      const seat = game.getSeatNum(p.socketId);
      return seat !== excludeSeat;
    });
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * 从指定列表中随机选 n 个不同的玩家
   */
  _pickMultiplePlayers(players, game, count, excludeSeat = null) {
    const candidates = players.filter(p => {
      const seat = game.getSeatNum(p.socketId);
      return seat !== excludeSeat;
    });
    const result = [];
    const used = new Set();
    while (result.length < count && used.size < candidates.length) {
      const idx = Math.floor(Math.random() * candidates.length);
      const p = candidates[idx];
      if (!used.has(p.socketId)) {
        used.add(p.socketId);
        result.push(p);
      }
    }
    return result;
  }

  /**
   * 随机选一条消息
   */
  _pickRandom(messages) {
    return messages[Math.floor(Math.random() * messages.length)];
  }

  _seerFallback(game, aiPlayer, myClaim) {
    const realChecks = (game.gameHistory || [])
      .filter(event => event.action === 'check' && event.actor?.id === aiPlayer.socketId && event.target?.id)
      .map(event => ({
        targetId: event.target.id,
        result: event.result || (game.getRole(event.target.id) === ROLE.WEREWOLF ? 'werewolf' : 'good'),
      }));
    if (realChecks.length > 0) {
      myClaim.claimedChecks = realChecks;
      myClaim.claimedRole = 'seer';
    }

    // 如果之前已经声明过查验结果，保持一致
    if (myClaim.claimedChecks.length > 0) {
      const lastCheck = myClaim.claimedChecks[myClaim.claimedChecks.length - 1];
      const targetSeat = game.getSeatNum(lastCheck.targetId);
      const result = lastCheck.result === 'werewolf' ? '狼人' : '好人';

      if (lastCheck.result === 'werewolf') {
        return this._pickRandom([
          `我是预言家，之前验了${targetSeat}是${result}，今天必须出他，别让他跑了。`,
          `我再强调一遍，${targetSeat}是狼人，我是真预言家，大家跟我投他。`,
          ` ${targetSeat}就是狼人，我验过的，好人别被他骗了。`,
        ]);
      } else {
        return this._pickRandom([
          `我是预言家，验了${targetSeat}是好人，大家可以信他。今晚我继续验。`,
          ` ${targetSeat}我验过是好人力挺他，现在主要看其他人发言找狼。`,
          `上轮我验了${targetSeat}是好人，今天听大家发言再判断谁是狼。`,
        ]);
      }
    }

    return this._pickRandom([
      `我是预言家，目前还没有可以公布的查验，今晚我会验一个发言可疑的人。`,
      `我跳预言家，这一轮没有查验结果，好人先别根据假信息归票。`,
    ]);
  }

  _werewolfFallback(game, aiPlayer, myClaim, ctx, aliveOthers, spokenPlayers) {
    const mySeat = game.getSeatNum(aiPlayer.socketId);

    // 如果已经有人跳预言家，狼人可以选择跟投或质疑
    if (ctx.hasSeerClaimed) {
      const seerClaim = ctx.seerClaims[ctx.seerClaims.length - 1];
      // 如果预言家验了某人是狼人，狼人可以反咬预言家
      const accusedBySeer = ctx.accusations.filter(a => a.from === seerClaim.seat);

      if (accusedBySeer.length > 0 && Math.random() < 0.4) {
        return this._pickRandom([
          `${seerClaim.seat}你说你是预言家？我觉得你才是狼人，跳出来带节奏。`,
          `我不信${seerClaim.seat}是预言家，他的发言太刻意了，像在悍跳。`,
          `${seerClaim.seat}你验人验得也太巧了吧，我看你才是狼。`,
        ]);
      }

      // 正常跟风发言
      const suspect = this._pickSpokenPlayer(spokenPlayers, game, mySeat, aiPlayer, ctx);
      if (suspect) {
        const seat = game.getSeatNum(suspect.socketId);
        return this._pickRandom([
          `我觉着${seat}的发言有问题，听他说话就不像好人，建议大家关注一下。`,
          `${seat}你刚才说的不太对吧，逻辑上有漏洞啊。`,
          `我是好人，${seat}给我的感觉不太好，大家注意他。`,
        ]);
      }
    }

    // 没有预言家跳出来的情况
    if (myClaim.hasSpoken) {
      // 第二次发言，引用发过言的玩家
      const suspect = this._pickSpokenPlayer(spokenPlayers, game, mySeat, aiPlayer, ctx);
      if (suspect) {
        const seat = game.getSeatNum(suspect.socketId);
        return this._pickRandom([
          `我还是觉得${seat}有问题，他发言太闪躲了。`,
          `${seat}刚才说的我不太信，感觉在隐瞒什么。`,
          `大家注意${seat}，他发言的时候一直在回避关键问题。`,
        ]);
      }
      return '我没什么新信息，听听大家怎么说，再做判断。';
    }

    // 第一次发言
    const suspect = this._pickSpokenPlayer(spokenPlayers, game, mySeat, aiPlayer, ctx);
    if (suspect) {
      const seat = game.getSeatNum(suspect.socketId);
      return this._pickRandom([
        `我是好人，觉着${seat}的发言有点奇怪，大家注意一下。`,
        `${seat}刚才说的不太对劲，我感觉他身份有问题。`,
        `我昨晚没什么信息，但${seat}给我感觉不太好，大家留意。`,
      ]);
    }

    return this._pickRandom([
      '我昨晚没什么信息，听听大家怎么说吧。',
      '我是好人，先听听大家发言，再做判断。',
      '没啥线索，等预言家出来给点信息。' + (ctx.hasSeerClaimed ? '' : ''),
    ]);
  }

  _witchFallback(game, aiPlayer, myClaim, ctx, aliveOthers, spokenPlayers) {
    const mySeat = game.getSeatNum(aiPlayer.socketId);

    if (myClaim.hasSpoken) {
      const suspect = this._pickSpokenPlayer(spokenPlayers, game, mySeat, aiPlayer, ctx);
      if (suspect) {
        const seat = game.getSeatNum(suspect.socketId);
        return this._pickRandom([
          `${seat}的发言让我更怀疑了，我觉得他身份有问题。`,
          `我还是关注${seat}，他说的东西前后矛盾。`,
          `大家注意${seat}，他不太像好人。`,
        ]);
      }
      return '我继续观察，暂时没有新的判断。';
    }

    const suspect = this._pickSpokenPlayer(spokenPlayers, game, mySeat, aiPlayer, ctx);
    if (suspect) {
      const seat = game.getSeatNum(suspect.socketId);
      return this._pickRandom([
        `我知道一些昨晚的情况，但现在不方便说太多。${seat}的发言让我比较怀疑。`,
        `昨晚有情况，我暂时不细说。大家注意${seat}，他发言不太对。`,
        `我有一些信息，${seat}给我感觉不太好，大家留意。`,
      ]);
    }

    return this._pickRandom([
      '昨晚的情况我了解一些，但现在不方便说，大家先发言。',
      '我知道点信息，等关键时刻再说。先听听大家的。',
      '昨晚有情况，先不说具体是什么，大家继续分析。',
    ]);
  }

  _guardFallback(game, aiPlayer, myClaim, ctx, aliveOthers, spokenPlayers) {
    const mySeat = game.getSeatNum(aiPlayer.socketId);

    if (myClaim.hasSpoken) {
      const suspect = this._pickSpokenPlayer(spokenPlayers, game, mySeat, aiPlayer, ctx);
      if (suspect) {
        const seat = game.getSeatNum(suspect.socketId);
        return this._pickRandom([
          `我还是觉得${seat}有问题，建议大家关注他。`,
          `${seat}刚才说的不太对，逻辑上有漏洞。`,
          `大家注意${seat}，他发言不太自然。`,
        ]);
      }
      return '我继续观察，大家继续发言吧。';
    }

    const suspect = this._pickSpokenPlayer(spokenPlayers, game, mySeat, aiPlayer, ctx);
    if (suspect) {
      const seat = game.getSeatNum(suspect.socketId);
      return this._pickRandom([
        `我是好人，${seat}的发言让我比较怀疑，大家注意。`,
        `${seat}刚才说的不太对劲，我觉得他可能有问题。`,
        `我没什么特殊信息，但${seat}给我感觉不太好。`,
      ]);
    }

    return this._pickRandom([
      '我是好人，昨晚没什么特别的情况，听听大家怎么说。',
      '我没什么信息，先听听大家的发言再做判断。',
      '昨晚平安度过，大家继续分析吧。',
    ]);
  }

  _hunterFallback(game, aiPlayer, myClaim, ctx, aliveOthers, spokenPlayers) {
    const mySeat = game.getSeatNum(aiPlayer.socketId);

    if (myClaim.claimedRole === 'hunter' || myClaim.hasSpoken) {
      const suspect = this._pickSpokenPlayer(spokenPlayers, game, mySeat, aiPlayer, ctx);
      if (suspect) {
        const seat = game.getSeatNum(suspect.socketId);
        return this._pickRandom([
          `我是猎人，${seat}的发言让我觉得很可疑，如果他是狼我绝不手软。`,
          `${seat}你小心点，我是猎人，你要是狼就别想跑。`,
          `我还是关注${seat}，他发言太闪躲了，像狼。`,
        ]);
      }
      return '我是猎人，身份在这里，狼人别想动我。大家继续找狼。';
    }

    myClaim.claimedRole = 'hunter';
    const suspect = this._pickSpokenPlayer(spokenPlayers, game, mySeat, aiPlayer, ctx);
    if (suspect) {
      const seat = game.getSeatNum(suspect.socketId);
      return this._pickRandom([
        `我是猎人，${seat}的发言让我怀疑，你如果是狼最好别乱动。`,
        `我是猎人，身份明了。${seat}给我感觉不太好，大家注意他。`,
        `我是猎人，有枪在手。${seat}你发言小心点，我盯着你呢。`,
      ]);
    }

    return this._pickRandom([
      '我是猎人，身份很硬，狼人别想轻易动我。大家继续分析。',
      '我是猎人，目前还在观察，先听听大家的发言。',
      '我是猎人，有枪在手，狼人小心点。大家继续找狼。',
    ]);
  }

  _villagerFallback(game, aiPlayer, myClaim, ctx, aliveOthers, spokenPlayers) {
    const mySeat = game.getSeatNum(aiPlayer.socketId);

    // 如果有预言家跳了，跟随预言家
    if (ctx.hasSeerClaimed) {
      const seerClaim = ctx.seerClaims[ctx.seerClaims.length - 1];
      // 找到预言家验出的狼人
      const wolfAccusation = ctx.accusations.find(a => a.from === seerClaim.seat);

      if (wolfAccusation) {
        return this._pickRandom([
          `我是平民，信${seerClaim.seat}的查验，${wolfAccusation.target}确实可疑，跟他投。`,
          `${seerClaim.seat}跳预言家了，验了${wolfAccusation.target}是狼人，我信他，先出${wolfAccusation.target}。`,
          `我是好人，${seerClaim.seat}的查验结果我觉得靠谱，${wolfAccusation.target}有问题。`,
        ]);
      }

      return this._pickRandom([
        `我是平民，${seerClaim.seat}跳预言家了，我暂时信他，听听后续。`,
        `我是好人，${seerClaim.seat}的查验信息很有用，大家跟着分析吧。`,
        `我是平民，先信${seerClaim.seat}是预言家，看他后续验人。`,
      ]);
    }

    // 没有预言家跳出来
    if (myClaim.hasSpoken) {
      const suspect = this._pickSpokenPlayer(spokenPlayers, game, mySeat, aiPlayer, ctx);
      if (suspect) {
        const seat = game.getSeatNum(suspect.socketId);
        return this._pickRandom([
          `我还是觉得${seat}有问题，他发言不太自然。`,
          `${seat}刚才说的不太对，逻辑上有问题。`,
          `我是平民，${seat}给我的感觉不太好，大家注意。`,
        ]);
      }
      return '我是平民，没什么新线索，继续听大家说。';
    }

    // 第一次发言
    const suspect = this._pickSpokenPlayer(spokenPlayers, game, mySeat, aiPlayer, ctx);
    if (suspect) {
      const seat = game.getSeatNum(suspect.socketId);
      return this._pickRandom([
        `我是平民，昨晚什么都不知道。${seat}的发言让我觉得有点可疑。`,
        `我是好人，${seat}刚才说的不太对劲，大家注意一下。`,
        `我是平民，没啥信息。${seat}给我感觉不太好，大家留意。`,
      ]);
    }

    return this._pickRandom([
      '我是平民，昨晚什么都不知道，等预言家出来给信息。',
      '我是好人，没什么线索，先听听大家的发言。',
      '我是平民，目前看不出谁是狼，大家继续分析。',
    ]);
  }

  async _generateLastWillMessage(game, aiPlayer, task = null) {
    if (!this._taskOpen(task)) return '';
    const model = await this._getModelForRoom(game.roomCode);
    if (!model) {
      if (task) task.usedFallback = true;
      return this._getFallbackLastWillMessage(game, aiPlayer);
    }

    try {
      const role = game.getRole(aiPlayer.socketId);
      const roleName = getRoleName(role);
      const seatNum = game.getSeatNum(aiPlayer.socketId);

      // 构建聊天记录摘要
      const room = roomCache.get(game.roomCode);
      const recentChat = (room?.chat || []).slice(-10).map(msg => {
        const name = game.getSeatNum(msg.username) || msg.username;
        return `${name}: ${msg.message}`;
      }).join('\n');

      const promptText = `你是一个狼人杀游戏中的AI玩家，角色是${roleName}，座位号${seatNum}号。你刚刚在游戏中死亡了。

最近聊天记录：
${recentChat || '（无）'}

请发表你的死亡遗言。要求：
1. 用口语说话，像真人一样
2. 根据你的角色，可以透露身份或怀疑对象
3. 30-60字
4. 不要用书面语，不要说"综上所述"之类的话

直接输出遗言内容，不要加引号或其他格式。`;

      const budget = Math.min(this._attemptBudget(task), 8000);
      if (task && budget < 1000) {
        task.usedFallback = true;
        return this._getFallbackLastWillMessage(game, aiPlayer);
      }
      const invoked = await invokeStructured({
        chain: { invoke: () => model.invoke(promptText) },
        isOpen: () => this._taskOpen(task),
        budgetOf: () => budget,
        attempts: 1,
        validate: (response) => {
          const text = typeof response === 'string' ? response : (response?.content || response?.text || '');
          const trimmed = String(text || '').trim();
          if (!trimmed) return { ok: false, message: 'empty last will' };
          return { ok: true, value: trimmed.slice(0, 180) };
        },
      });
      if (invoked.cancelled) return '';
      if (invoked.ok) {
        console.log(`[AIGameHandler] LLM last will for ${seatNum}号 (${roleName}): ${invoked.value.substring(0, 50)}...`);
        return invoked.value;
      }
      console.warn(`[AIGameHandler] LLM last will failed for ${aiPlayer.username}: ${invoked.errorClass || ''} ${invoked.message || ''}`);
      return '';
    } catch (error) {
      console.error(`[AIGameHandler] LLM last will failed for ${aiPlayer.username}:`, error.message);
      return '';
    }

    return '';
  }

  _getFallbackLastWillMessage(game, aiPlayer) {
    if (!this._isFallbackEnabled(aiPlayer)) return '';
    const role = game.getRole(aiPlayer.socketId);
    const templates = {
      [ROLE.WEREWOLF]: [
        '我是狼人，我们已经赢了！好人阵营太天真了！',
        '说实话我是狼人，大家被我骗了，狼人阵营必胜！',
        '我是狼人，好人们太善良了，我们赢定了。',
      ],
      [ROLE.SEER]: [
        '我是预言家，昨晚查了XX是好人，希望我的信息能帮到好人阵营。',
        '我是真预言家，昨晚验了XX是狼人，可惜我走了，希望大家能记住这个信息。',
        '我是预言家，把我的查验记录告诉大家，希望好人能赢。',
      ],
      [ROLE.WITCH]: [
        '我是女巫，昨晚救了一个人，希望好人能赢，我的药水没有白费。',
        '我是女巫，手里还有毒药，希望好人能利用好这个信息。',
        '我是女巫，昨晚的操作希望帮到了好人阵营，大家加油。',
      ],
      [ROLE.GUARD]: [
        '我是守卫，昨晚守了XX，希望我的守护没有白费。',
        '我是守卫，把我的守护信息告诉大家，希望能帮到好人。',
        '我是守卫，今晚本来想守预言家的，可惜我走了，大家保护好自己。',
      ],
      [ROLE.HUNTER]: [
        '我是猎人，身份很硬，我怀疑XX是狼人，希望大家能把他投出去。',
        '我是猎人，我的枪已经用了（或留着），希望好人能赢。',
        '我是猎人，怀疑XX和XX是狼人，大家注意一下。',
      ],
      [ROLE.VILLAGER]: [
        '我是平民，没有什么信息，希望好人阵营能赢。',
        '我是平民，跟着好人阵营走，相信大家的判断。',
        '我是平民，没什么线索，希望预言家能带领好人获胜。',
      ],
    };

    const messages = templates[role] || templates[ROLE.VILLAGER];
    let message = messages[Math.floor(Math.random() * messages.length)];

    const aliveOthers = game.alivePlayers.filter(p => p.socketId !== aiPlayer.socketId);
    if (aliveOthers.length > 0 && message.includes('XX')) {
      const usedIds = new Set();
      while (message.includes('XX') && aliveOthers.length > usedIds.size) {
        let candidate;
        do {
          candidate = aliveOthers[Math.floor(Math.random() * aliveOthers.length)];
        } while (usedIds.has(candidate.socketId) && usedIds.size < aliveOthers.length);
        usedIds.add(candidate.socketId);
        message = message.replace('XX', game.getSeatNum(candidate.socketId));
      }
    }
    return message;
  }

  _detectSituation(game) {
    return gameRetriever._detectSituation(game);
  }

  _sendChatMessage(roomCode, aiPlayer, message) {
    const room = roomCache.get(roomCode);
    if (!room) return;

    const game = gameCache.get(roomCode);
    const displayName = game ? game.getSeatNum(aiPlayer.socketId) : aiPlayer.username;

    const chatMsg = {
      username: displayName,
      message,
      timestamp: Date.now(),
      isAI: true,
    };

    room.chat.push(chatMsg);
    if (room.chat.length > 100) room.chat = room.chat.slice(-100);
    roomCache.set(roomCode, room);

    const io = require('../app').getIO();
    io.to(roomCode).emit('chat_message', chatMsg);
  }

  _postProcessMessage(message, aiPlayer) {
    if (!message) return '';
    let result = message.trim();

    const agentConfig = aiPlayer.agentConfig || {};
    const lang = agentConfig.language || {};

    // 只替换明显的书面语，降低概率避免过度修改
    const colloquialMap = [
      ['综上所述', '总的来说'],
      ['毫无疑问', '肯定'],
      ['值得注意的是', '你们看'],
      ['首先', '第一'],
      ['其次', '然后'],
    ];
    for (const [formal, casual] of colloquialMap) {
      result = result.split(formal).join(casual);
    }

    // 偶尔加语气词结尾
    if (Math.random() < 0.3 && /[。]$/.test(result)) {
      const punctuations = ['啊', '嘛', '呢', '呗', '啦', '哈'];
      result = result.slice(0, -1) + punctuations[Math.floor(Math.random() * punctuations.length)] + '。';
    }

    // 偶尔加语言习惯词
    if (lang.prefixes && lang.prefixes.length > 0 && Math.random() < 0.25) {
      const prefix = lang.prefixes[Math.floor(Math.random() * lang.prefixes.length)];
      result = prefix + '，' + result;
    }

    if (lang.suffixes && lang.suffixes.length > 0 && Math.random() < 0.25) {
      const suffix = lang.suffixes[Math.floor(Math.random() * lang.suffixes.length)];
      result = result + suffix;
    }

    if (lang.favoriteWords && lang.favoriteWords.length > 0 && Math.random() < 0.3) {
      const word = lang.favoriteWords[Math.floor(Math.random() * lang.favoriteWords.length)];
      if (!result.includes(word)) {
        result = result.replace(/[，,！!。]$/, `，${word}$&`);
        if (!result.includes(word)) {
          result += `，${word}！`;
        }
      }
    }

    if (result.length > 80) {
      result = result.substring(0, 75).replace(/[，,！!呀啊嘛呢呗啦咯哈。]$/, '') + '...';
    }

    return result;
  }

  _wasMentioned(chat, username) {
    if (!chat || !username) return false;
    const nameLower = username.toLowerCase();
    const recentMessages = chat.slice(-10);
    return recentMessages.some(msg => {
      if (msg.isSystem) return false;
      const msgText = (msg.message || '').toLowerCase();
      return msgText.includes(nameLower) || msgText.includes(username);
    });
  }

  _getTemperatureForPersonality(agentConfig) {
    if (!agentConfig?.personality) return 0.7;
    const p = agentConfig.personality;
    let temp = 0.7;
    if (p.caution > 70) temp -= 0.2;
    if (p.caution < 30) temp += 0.15;
    if (p.talkativeness > 70) temp += 0.1;
    if (p.talkativeness < 30) temp -= 0.15;
    if (p.aggressiveness > 70) temp += 0.1;
    if (p.cunning > 70) temp += 0.1;
    return Math.max(0.3, Math.min(1.0, temp));
  }

  cleanup(roomCode) {
    this._stopDayChat(roomCode);
    // 只清理当前房间的 AI 发言状态，保留其他房间
    if (this.aiClaims[roomCode]) {
      delete this.aiClaims[roomCode];
    }
  }
}

module.exports = new AIGameHandler();
