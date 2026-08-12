const { PHASE, ROLE, TIMERS } = require('./constants');

const DayPhaseMixin = {
  // ==================== Discussion Phase ====================
  startFreeDiscussion() {
    this.phase = PHASE.DISCUSSION;
    this.lastPhaseMessage = '自由讨论阶段，所有人可以发言';

    this.broadcast('phase_change', {
      phase: PHASE.DISCUSSION,
      timeout: TIMERS.DISCUSSION,
      message: this.lastPhaseMessage,
    });

    this.broadcast('chat_message', {
      username: '系统',
      message: `💬 自由讨论阶段开始，所有人可以发言（${TIMERS.DISCUSSION}秒）`,
      timestamp: Date.now(),
      isSystem: true,
    });

    // Trigger AI players to speak during free discussion
    const allAlive = this.alivePlayers;
    const aiPlayers = allAlive.filter(p => p.isAI);
    console.log(`[GameEngine] Free discussion: ${allAlive.length} alive players, ${aiPlayers.length} AI players`);
    console.log(`[GameEngine] AI players:`, aiPlayers.map(p => ({ username: p.username, isAI: p.isAI, alive: p.isAlive })));

    if (aiPlayers.length > 0) {
      this._triggerAIFreeDiscussion(aiPlayers);
    } else {
      console.warn('[GameEngine] No AI players found for free discussion');
    }

    this.clearTimer();
    this.phaseTimer = setTimeout(() => this.startOrderedSpeaking(), TIMERS.DISCUSSION * 1000);
  },

  _triggerAIFreeDiscussion(aiPlayers) {
    const aiGameHandler = require('./AIGameHandler');

    console.log(`[GameEngine] Starting AI free discussion for ${aiPlayers.length} AI players`);

    // Launch all AI players in parallel with independent random delays
    const aiPromises = aiPlayers.map((aiPlayer, index) => {
      return new Promise(async (resolve) => {
        try {
          // First message: delay 2-8 seconds
          const firstDelay = 2000 + Math.random() * 6000;
          console.log(`[GameEngine] AI ${aiPlayer.username} first speak after ${(firstDelay / 1000).toFixed(1)}s`);

          await new Promise(r => setTimeout(r, firstDelay));

          // Check if still in discussion phase
          if (this.phase !== PHASE.DISCUSSION) {
            console.log(`[GameEngine] Phase changed, AI ${aiPlayer.username} skipping`);
            resolve();
            return;
          }

          // Check if player is still alive
          if (!aiPlayer.isAlive) {
            console.log(`[GameEngine] AI ${aiPlayer.username} is dead, skipping`);
            resolve();
            return;
          }

          // Generate first message with fallback
          console.log(`[GameEngine] AI ${aiPlayer.username} generating first message...`);
          let message = await aiGameHandler._generateChatMessage(this, aiPlayer);

          // Fallback to template message if empty
          if (!message || !message.trim()) {
            console.warn(`[GameEngine] AI ${aiPlayer.username} generated empty message, using fallback`);
            message = aiGameHandler._getFallbackChatMessage(this, aiPlayer);
          }

          if (message && message.trim()) {
            const finalMessage = this._ensureMessageLength(message, aiPlayer);
            console.log(`[GameEngine] AI ${aiPlayer.username} broadcasting: "${finalMessage?.substring(0, 50)}..."`);
            this.broadcast('chat_message', {
              username: this.getSeatNum(aiPlayer.socketId),
              message: finalMessage,
              timestamp: Date.now(),
            });
          }

          // Second message: delay 15-30 seconds after first
          const secondDelay = 15000 + Math.random() * 15000;
          console.log(`[GameEngine] AI ${aiPlayer.username} second speak after ${(secondDelay / 1000).toFixed(1)}s`);

          await new Promise(r => setTimeout(r, secondDelay));

          // Check if still in discussion phase and alive
          if (this.phase !== PHASE.DISCUSSION || !aiPlayer.isAlive) {
            resolve();
            return;
          }

          // Generate second message with different context
          console.log(`[GameEngine] AI ${aiPlayer.username} generating second message...`);
          let message2 = await aiGameHandler._generateChatMessage(this, aiPlayer);

          // Fallback to template message if empty
          if (!message2 || !message2.trim()) {
            console.warn(`[GameEngine] AI ${aiPlayer.username} generated empty second message, using fallback`);
            message2 = aiGameHandler._getFallbackChatMessage(this, aiPlayer);
          }

          if (message2 && message2.trim()) {
            const finalMessage2 = this._ensureMessageLength(message2, aiPlayer);
            console.log(`[GameEngine] AI ${aiPlayer.username} broadcasting second: "${finalMessage2?.substring(0, 50)}..."`);
            this.broadcast('chat_message', {
              username: this.getSeatNum(aiPlayer.socketId),
              message: finalMessage2,
              timestamp: Date.now(),
            });
          }
        } catch (error) {
          console.error(`[GameEngine] AI discussion error for ${aiPlayer.username}:`, error);

          // Emergency fallback: send a basic message
          try {
            const fallbackMessage = aiGameHandler._getFallbackChatMessage(this, aiPlayer);
            if (fallbackMessage) {
              this.broadcast('chat_message', {
                username: this.getSeatNum(aiPlayer.socketId),
                message: fallbackMessage,
                timestamp: Date.now(),
              });
            }
          } catch (e) {
            console.error(`[GameEngine] Emergency fallback failed for ${aiPlayer.username}:`, e);
          }
        }
        resolve();
      });
    });

    // Run all AI players in parallel
    Promise.all(aiPromises).then(() => {
      console.log('[GameEngine] All AI free discussion promises resolved');
    });

    // Interrupt mechanism: 30% chance each AI sends a short reaction during discussion
    aiPlayers.forEach((aiPlayer) => {
      if (Math.random() < 0.3) {
        const reactionDelay = 8000 + Math.random() * 20000;
        setTimeout(async () => {
          if (this.phase !== PHASE.DISCUSSION || !aiPlayer.isAlive) return;

          const seatNum = this.getSeatNum(aiPlayer.socketId);
          const reactions = [
            '对！',
            '胡说！',
            '我不同意',
            '等一下',
            '有道理',
            '不一定吧',
            '嗯嗯',
            '我觉得不是',
            '他说的不对',
            '哈哈',
            '这也行？',
            '我不信',
            '有可能',
            '别装了',
            '你确定？',
          ];
          const reaction = reactions[Math.floor(Math.random() * reactions.length)];

          this.broadcast('chat_message', {
            username: seatNum,
            message: reaction,
            timestamp: Date.now(),
          });
        }, reactionDelay);
      }
    });
  },

  startOrderedSpeaking() {
    this.phase = PHASE.DAY;

    const alive = this.alivePlayers;
    this.speakingOrder = alive.map(p => p.socketId);
    this.currentSpeakerIndex = 0;
    this.hasSpoken = new Set();
    this.candidates = [];

    this._skipDeadSpeakers();

    this.currentSpeaker = this.speakingOrder[this.currentSpeakerIndex];
    this.lastPhaseMessage = `按顺序发言阶段（每人${TIMERS.DAY}秒）`;

    this.broadcast('phase_change', {
      phase: PHASE.DAY,
      timeout: TIMERS.DAY,
      message: this.lastPhaseMessage,
      currentSpeaker: this.currentSpeaker,
      speakerName: this.getSeatNum(this.currentSpeaker),
    });

    this.broadcast('chat_message', {
      username: '系统',
      message: `🎤 按顺序发言开始，请 ${this.getSeatNum(this.currentSpeaker)} 发言（${TIMERS.DAY}秒）`,
      timestamp: Date.now(),
      isSystem: true,
    });

    this.clearTimer();

    const currentSpeaker = this.speakingOrder[this.currentSpeakerIndex];
    if (currentSpeaker) {
      const speakerPlayer = this.getPlayer(currentSpeaker);
      if (speakerPlayer && speakerPlayer.isAI) {
        setTimeout(() => this._triggerAISpeaking(currentSpeaker), 1000);
      }
    }

    // Set timer for current speaker
    this.phaseTimer = setTimeout(() => {
      this.nextSpeaker();
    }, TIMERS.DAY * 1000);
  },

  // ==================== Day Phase ====================
  startDay() {
    const lastWillPlayers = this.lastWillDeadPlayers || [];
    this.lastWillDeadPlayers = null;

    if (lastWillPlayers.length > 0) {
      this.startLastWill(lastWillPlayers);
    } else {
      this.startFreeDiscussion();
    }
  },

  // ==================== Last Will Phase ====================
  startLastWill(deadPlayers) {
    this.phase = PHASE.LAST_WILL;
    this.lastWillQueue = [...deadPlayers];
    this.lastWillIndex = 0;

    const deadNames = deadPlayers.map(p => this.getSeatNum(p.socketId)).join('、');
    this.lastPhaseMessage = `死亡遗言阶段：${deadNames}`;

    this.broadcast('phase_change', {
      phase: PHASE.LAST_WILL,
      timeout: TIMERS.LAST_WILL,
      message: this.lastPhaseMessage,
      lastWillPlayers: deadPlayers.map(p => ({ id: p.socketId, username: this.getSeatNum(p.socketId) })),
    });

    this.broadcast('chat_message', {
      username: '系统',
      message: `💀 ${deadNames} 请发表死亡遗言（每人${TIMERS.LAST_WILL}秒）`,
      timestamp: Date.now(),
      isSystem: true,
    });

    this._startLastWillSpeaker();
  },

  _startLastWillSpeaker() {
    if (!this.lastWillQueue || this.lastWillIndex >= this.lastWillQueue.length) {
      this.startFreeDiscussion();
      return;
    }

    const deadPlayer = this.lastWillQueue[this.lastWillIndex];
    this.lastPhaseMessage = `${this.getSeatNum(deadPlayer.socketId)} 的死亡遗言`;

    this.broadcast('phase_change', {
      phase: PHASE.LAST_WILL,
      timeout: TIMERS.LAST_WILL,
      message: this.lastPhaseMessage,
      currentSpeaker: deadPlayer.socketId,
      speakerName: this.getSeatNum(deadPlayer.socketId),
      lastWillPlayers: this.lastWillQueue.map(p => ({ id: p.socketId, username: this.getSeatNum(p.socketId) })),
    });

    const player = this.getPlayer(deadPlayer.socketId);

    if (player && player.isAI) {
      setTimeout(() => this._generateAILastWill(deadPlayer.socketId), 1000);
    }

    this.clearTimer();
    this.phaseTimer = setTimeout(() => {
      this._nextLastWillSpeaker();
    }, TIMERS.LAST_WILL * 1000);
  },

  async _generateAILastWill(socketId) {
    const aiGameHandler = require('./AIGameHandler');
    const player = this.getPlayer(socketId);
    if (!player) return;

    try {
      const message = await aiGameHandler._generateLastWillMessage(this, player);
      if (message && message.trim()) {
        this.broadcast('chat_message', {
          username: this.getSeatNum(socketId),
          message: message,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error(`[GameEngine] AI last will error for ${player.username}:`, error);
      const fallbackMessage = `我是${this.getSeatNum(socketId)}，希望好人阵营能赢。`;
      this.broadcast('chat_message', {
        username: this.getSeatNum(socketId),
        message: fallbackMessage,
        timestamp: Date.now(),
      });
    }
  },

  _nextLastWillSpeaker() {
    this.lastWillIndex++;
    this._startLastWillSpeaker();
  },

  // ==================== Speaking Phase ====================
  _skipDeadSpeakers() {
    const aliveSpeakers = this.speakingOrder.filter(socketId => {
      const player = this.getPlayer(socketId);
      return player && player.isAlive !== false;
    });

    if (aliveSpeakers.length > 0) {
      this.speakingOrder = aliveSpeakers;

      if (this.currentSpeakerIndex >= this.speakingOrder.length) {
        this.currentSpeakerIndex = 0;
      }
    }
  },

  async _triggerAISpeaking(socketId) {
    const aiGameHandler = require('./AIGameHandler');
    const player = this.getPlayer(socketId);
    if (!player || !player.isAI) return;

    try {
      const timeoutPromise = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      let message = await Promise.race([
        aiGameHandler._generateChatMessage(this, player),
        timeoutPromise(5000)
      ]);

      if (!message || !message.trim()) {
        message = aiGameHandler._getFallbackChatMessage(this, player);
      }

      message = this._ensureMessageLength(message, player);

      this.broadcast('chat_message', {
        username: this.getSeatNum(socketId),
        message: message,
        timestamp: Date.now(),
      });

      setTimeout(() => this.nextSpeaker(), 5000);
    } catch (error) {
      console.error(`[GameEngine] AI speaking error for ${player.username}:`, error);
      const fallbackMessage = aiGameHandler._getFallbackChatMessage(this, player);
      const finalMessage = this._ensureMessageLength(fallbackMessage, player);

      this.broadcast('chat_message', {
        username: this.getSeatNum(socketId),
        message: finalMessage,
        timestamp: Date.now(),
      });

      setTimeout(() => this.nextSpeaker(), 5000);
    }
  },

  _ensureMessageLength(message, player) {
    if (!message) message = '';

    const trimmed = message.trim();
    if (trimmed.length === 0) return '...';

    const agentConfig = player.agentConfig || null;
    const talkativeness = agentConfig?.personality?.talkativeness ?? 50;

    let minLen, maxLen;
    if (talkativeness > 70) {
      minLen = 40; maxLen = 70;
    } else if (talkativeness < 30) {
      minLen = 5; maxLen = 20;
    } else {
      minLen = 15; maxLen = 55;
    }

    minLen = Math.max(3, minLen + Math.floor(Math.random() * 10) - 5);
    maxLen = minLen + 15 + Math.floor(Math.random() * 15);

    if (trimmed.length >= minLen && trimmed.length <= maxLen) {
      return trimmed;
    }

    if (trimmed.length > maxLen) {
      let truncated = trimmed.substring(0, maxLen);
      truncated = truncated.replace(/[，,！!呀啊嘛呢呗啦咯哈。…]+$/g, '');
      if (trimmed.endsWith('...')) truncated += '...';
      else truncated += '。';
      return truncated;
    }

    const role = this.getRole(player.socketId);

    const extensions = {
      [ROLE.WEREWOLF]: [
        ' 大家仔细分析一下局势',
        ' 我觉着得谨慎点投票',
        ' 希望好人做出正确判断',
        ' 狼人肯定会伪装',
        ' 别被表面迷惑',
      ],
      [ROLE.SEER]: [
        ' 相信我的查验结果',
        ' 今晚继续验人',
        ' 好人需要我的信息',
        ' 狼人会质疑我，别上当',
        ' 大家跟我一起投票',
      ],
      [ROLE.WITCH]: [
        ' 我手里还有毒药',
        ' 小心狼人乱跳',
        ' 我会谨慎用药',
        ' 好人保护好自己',
        ' 今晚看情况',
      ],
      [ROLE.GUARD]: [
        ' 今晚守关键人物',
        ' 大家放心',
        ' 狼人别想得手',
        ' 看局势决定守护',
        ' 好人需要我',
      ],
      [ROLE.HUNTER]: [
        ' 有枪在手',
        ' 谁敢出我就带走谁',
        ' 身份硬得很',
        ' 狼人别想轻易投我',
        ' 看情况开枪',
      ],
      [ROLE.VILLAGER]: [
        ' 希望预言家给信息',
        ' 跟着大家走',
        ' 好人带领我们',
        ' 相信好人阵营',
        ' 一起加油',
      ],
    };

    const roleExtensions = extensions[role] || extensions[ROLE.VILLAGER];
    let result = trimmed;

    let iterations = 0;
    const maxIterations = 5;
    while (result.length < minLen && iterations < maxIterations) {
      iterations++;
      const extension = roleExtensions[Math.floor(Math.random() * roleExtensions.length)];
      if (!result.endsWith(extension)) {
        if (!result.endsWith('。') && !result.endsWith('，')) {
          result += '，';
        }
        result += extension;
      }
    }

    if (result.length > maxLen) {
      result = result.substring(0, maxLen).replace(/[，,！!呀啊嘛呢呗啦咯哈。]+$/g, '') + '。';
    }

    return result;
  },

  skipToVote() {
    if (this.phase !== PHASE.DAY) return;
    this.clearTimer();
    this.startVote();
  },

  nextSpeaker() {
    if (this.phase !== PHASE.DAY) return;

    this.hasSpoken.add(this.speakingOrder[this.currentSpeakerIndex]);

    if (this.hasSpoken.size >= this.speakingOrder.length) {
      this.clearTimer();
      this.startVote();
      return;
    }

    this.currentSpeakerIndex++;
    if (this.currentSpeakerIndex >= this.speakingOrder.length) {
      this.currentSpeakerIndex = 0;
    }

    this._skipDeadSpeakers();

    this.currentSpeaker = this.speakingOrder[this.currentSpeakerIndex];

    this.broadcast('speaker_change', {
      currentSpeaker: this.currentSpeaker,
      speakerName: this.getSeatNum(this.currentSpeaker),
      hasSpoken: Array.from(this.hasSpoken),
    });

    this.broadcast('chat_message', {
      username: '系统',
      message: `🎤 请 ${this.getSeatNum(this.currentSpeaker)} 发言（${TIMERS.DAY}秒）`,
      timestamp: Date.now(),
      isSystem: true,
    });

    if (this.currentSpeaker) {
      const speakerPlayer = this.getPlayer(this.currentSpeaker);
      if (speakerPlayer && speakerPlayer.isAI) {
        setTimeout(() => this._triggerAISpeaking(this.currentSpeaker), 1000);
      }
    }

    this.clearTimer();
    this.phaseTimer = setTimeout(() => {
      this.nextSpeaker();
    }, TIMERS.DAY * 1000);
  },

  skipSpeaking() {
    if (this.phase !== PHASE.DAY) return;

    const currentSpeaker = this.speakingOrder[this.currentSpeakerIndex];
    this.hasSpoken.add(currentSpeaker);

    if (this.hasSpoken.size >= this.speakingOrder.length) {
      this.clearTimer();
      this.startVote();
      return;
    }

    this.currentSpeakerIndex++;
    if (this.currentSpeakerIndex >= this.speakingOrder.length) {
      this.currentSpeakerIndex = 0;
    }

    this._skipDeadSpeakers();

    this.currentSpeaker = this.speakingOrder[this.currentSpeakerIndex];

    this.broadcast('speaker_change', {
      currentSpeaker: this.currentSpeaker,
      speakerName: this.getSeatNum(this.currentSpeaker),
      hasSpoken: Array.from(this.hasSpoken),
    });

    if (this.currentSpeaker) {
      const speakerPlayer = this.getPlayer(this.currentSpeaker);
      if (speakerPlayer && speakerPlayer.isAI) {
        setTimeout(() => this._triggerAISpeaking(this.currentSpeaker), 1000);
      }
    }
  },
};

module.exports = DayPhaseMixin;
