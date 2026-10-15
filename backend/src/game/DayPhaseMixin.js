const { PHASE, TIMERS } = require('./constants');

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
        }
        resolve();
      });
    });

    // Run all AI players in parallel
    Promise.all(aiPromises).then(() => {
      console.log('[GameEngine] All AI free discussion promises resolved');
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
      const message = await aiGameHandler._generateChatMessage(this, player);
      const finalMessage = this._ensureMessageLength(message, player);
      if (finalMessage) {
        this.broadcast('chat_message', {
          username: this.getSeatNum(socketId),
          message: finalMessage,
          timestamp: Date.now(),
        });
      }

      setTimeout(() => this.nextSpeaker(), 5000);
    } catch (error) {
      console.error(`[GameEngine] AI speaking error for ${player.username}:`, error);
      setTimeout(() => this.nextSpeaker(), 5000);
    }
  },

  _ensureMessageLength(message) {
    const trimmed = String(message || '').trim();
    if (!trimmed) return '';
    if (trimmed.length <= 180) return trimmed;
    return `${trimmed.slice(0, 180).replace(/[，,！!。…]+$/g, '')}。`;
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
