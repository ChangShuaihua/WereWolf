const { PHASE, TIMERS } = require('./constants');

const VotePhaseMixin = {
  // ==================== Vote Phase ====================
  async startVote() {
    this.phase = PHASE.VOTE;
    this.votes = {};
    this.currentSpeaker = null;

    const alive = this.alivePlayers;
    this.candidates = alive.map(p => ({ id: p.socketId, username: this.getSeatNum(p.socketId) }));

    // Wait for AI players to submit their votes first
    const aiPlayers = alive.filter(p => p.isAI);
    if (aiPlayers.length > 0) {
      await this._waitForAIVotes(aiPlayers);
    }

    this.lastPhaseMessage = '投票阶段，请选择要放逐的玩家';

    this.broadcast('phase_change', {
      phase: PHASE.VOTE,
      timeout: TIMERS.VOTE,
      message: this.lastPhaseMessage,
      candidates: this.candidates,
    });

    this.clearTimer();
    this.phaseTimer = setTimeout(() => this.resolveVote(), TIMERS.VOTE * 1000);
  },

  async _waitForAIVotes(aiPlayers) {
    const aiGameHandler = require('./AIGameHandler');

    const timeoutPromise = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const aiPlayer of aiPlayers) {
      try {
        const voteTarget = await Promise.race([
          aiGameHandler._decideVote(this, aiPlayer),
          timeoutPromise(3000)
        ]);

        if (voteTarget) {
          this.submitVote(aiPlayer.socketId, voteTarget);
        } else {
          console.warn(`[GameEngine] AI vote timeout for ${aiPlayer.username}, using fallback`);
          const fallbackTarget = aiGameHandler._getFallbackVote(this, aiPlayer);
          if (fallbackTarget) {
            this.submitVote(aiPlayer.socketId, fallbackTarget);
          }
        }
      } catch (error) {
        console.error(`[GameEngine] AI vote error for ${aiPlayer.username}:`, error);
        const fallbackTarget = aiGameHandler._getFallbackVote(this, aiPlayer);
        if (fallbackTarget) {
          this.submitVote(aiPlayer.socketId, fallbackTarget);
        }
      }
    }
  },

  submitVote(socketId, targetId) {
    if (this.phase !== PHASE.VOTE) return;
    const voter = this.getPlayer(socketId);
    if (!voter || !voter.isAlive) return;

    // C3: during PK, votes must target one of the PK candidates
    if (this.pkCandidates.length > 0 && !this.pkCandidates.includes(targetId)) return;

    const target = this.getPlayer(targetId);

    this.votes[socketId] = targetId;

    this.gameHistory.push({
      night: this.nightCount,
      action: 'vote',
      actor: { id: socketId, username: this.getSeatNum(socketId), role: this.roles[socketId] },
      target: target ? { id: targetId, username: this.getSeatNum(targetId) } : null,
      detail: `${this.getSeatNum(socketId)}投票给了${target ? this.getSeatNum(targetId) : '未知'}`,
    });

    // Notify all of vote progress
    this.broadcast('vote_update', {
      votedCount: Object.keys(this.votes).length,
      totalCount: this.alivePlayers.length,
    });
  },

  resolveVote() {
    this.clearTimer();
    if (this.phase !== PHASE.VOTE) return;

    const alive = this.alivePlayers;
    const tally = {};

    for (const [voterId, targetId] of Object.entries(this.votes)) {
      if (alive.find(p => p.socketId === voterId)) {
        tally[targetId] = (tally[targetId] || 0) + 1;
      }
    }

    // Find max votes and all targets sharing the max
    let maxVotes = 0;
    for (const count of Object.values(tally)) {
      if (count > maxVotes) maxVotes = count;
    }
    const topTargets = Object.entries(tally)
      .filter(([, count]) => count === maxVotes)
      .map(([id]) => id);
    const voteDetails = Object.entries(tally).map(([id, count]) => {
      return { id, username: this.getSeatNum(id), votes: count };
    });

    // C3: tie-break via PK vote
    if (topTargets.length > 1 && maxVotes > 0) {
      this._startPKVote(topTargets);
      return;
    }

    let eliminatedPlayer = null;
    if (topTargets.length === 1 && maxVotes > 0) {
      eliminatedPlayer = this.getPlayer(topTargets[0]);
      if (eliminatedPlayer) {
        eliminatedPlayer.isAlive = false;
      }
    }

    // Reset PK state after a resolved vote round
    this.pkRound = 0;
    this.pkCandidates = [];

    const result = {
      eliminated: eliminatedPlayer
        ? { id: eliminatedPlayer.socketId, username: this.getSeatNum(eliminatedPlayer.socketId), role: this.roles[eliminatedPlayer.socketId] }
        : null,
      votes: voteDetails,
      message: eliminatedPlayer
        ? `${this.getSeatNum(eliminatedPlayer.socketId)} 被放逐出局`
        : '平票，没有人被放逐',
    };

    this.broadcast('vote_result', result);

    this.broadcast('chat_message', {
      username: '系统',
      message: `🗳️ ${result.message}`,
      timestamp: Date.now(),
      isSystem: true,
    });

    // Check win condition
    if (this.checkWinCondition()) return;

    // Back to night
    setTimeout(() => this.startNight(), 3000);
  },

  /**
   * C3: Start a PK (tie-break) vote round between the given candidates.
   * Only one PK round is allowed; a second tie skips to night without elimination.
   */
  _startPKVote(pkCandidates) {
    this.pkRound = (this.pkRound || 0) + 1;

    // Second consecutive tie: no elimination, go to night
    if (this.pkRound > 1) {
      this.broadcast('vote_result', {
        eliminated: null,
        votes: [],
        message: 'PK 平票，没有人被放逐',
      });
      this.broadcast('chat_message', {
        username: '系统',
        message: '🗳️ PK 平票，没有人被放逐',
        timestamp: Date.now(),
        isSystem: true,
      });
      this.pkRound = 0;
      this.pkCandidates = [];
      if (this.checkWinCondition()) return;
      setTimeout(() => this.startNight(), 3000);
      return;
    }

    // Reset votes and restrict candidates for the PK round
    this.votes = {};
    this.pkCandidates = pkCandidates;
    this.candidates = pkCandidates;
    this.lastPhaseMessage = `${pkCandidates.map(id => this.getSeatNum(id)).join('、')} 进入PK，请再次投票`;

    // Convert socketId array to {id, username} format for frontend
    const candidatesForFrontend = pkCandidates.map(id => ({
      id,
      username: this.getSeatNum(id),
    }));

    this.broadcast('phase_change', {
      phase: PHASE.VOTE,
      isPK: true,
      candidates: candidatesForFrontend,
      timeout: 30,
      message: this.lastPhaseMessage,
    });
    this.broadcast('chat_message', {
      username: '系统',
      message: `🗳️ ${this.lastPhaseMessage}`,
      timestamp: Date.now(),
      isSystem: true,
    });

    this.clearTimer();
    this.phaseTimer = setTimeout(() => this.resolveVote(), 30000);
  },
};

module.exports = VotePhaseMixin;
