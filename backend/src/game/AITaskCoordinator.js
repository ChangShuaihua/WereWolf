/**
 * AI 决策任务的生命周期。
 * 阶段切换会使进行中的任务失效；同一房间、座位、阶段版本和任务类型只接受一次提交。
 */

const TERMINAL = new Set(['SUBMITTED', 'FALLBACK_SUBMITTED', 'EXPIRED']);

class AITaskCoordinator {
  constructor() {
    this.tasks = new Map();
    this.byKey = new Map();
    this.seq = 0;
    this.metrics = {
      started: 0,
      submitted: 0,
      fallbackSubmitted: 0,
      expired: 0,
      duplicate: 0,
      durations: [],
    };
  }

  begin({ roomCode, socketId, phase, phaseVersion = 0, kind, deadlineMs = 16000 }) {
    const key = `${roomCode}:${socketId}:${phase}:${phaseVersion}:${kind}`;
    const existingId = this.byKey.get(key);
    const existing = existingId ? this.tasks.get(existingId) : null;
    if (existing && (existing.state === 'RUNNING' || existing.state === 'SUBMITTED' || existing.state === 'FALLBACK_SUBMITTED')) {
      this.metrics.duplicate += 1;
      return { accepted: false, reason: 'duplicate', task: existing };
    }

    const task = {
      id: `dec_${Date.now().toString(36)}_${++this.seq}`,
      key,
      roomCode,
      socketId,
      phase,
      phaseVersion,
      kind,
      deadline: Date.now() + deadlineMs,
      state: 'RUNNING',
      startedAt: Date.now(),
      usedFallback: false,
      controller: new AbortController(),
    };
    this.tasks.set(task.id, task);
    this.byKey.set(key, task.id);
    this.metrics.started += 1;
    this._trim();
    return { accepted: true, task };
  }

  beginFor(game, socketId, kind, deadlineMs) {
    return this.begin({
      roomCode: game.roomCode,
      socketId,
      phase: game.phase,
      phaseVersion: game.phaseVersion || 0,
      kind,
      deadlineMs,
    });
  }

  samePhase(task, game) {
    if (!task || !game || task.state !== 'RUNNING') return false;
    return game.phase === task.phase && (game.phaseVersion || 0) === task.phaseVersion;
  }

  pastDeadline(task) {
    return !task || Date.now() > task.deadline;
  }

  canSubmit(task, game) {
    return this.samePhase(task, game) && !this.pastDeadline(task);
  }

  finish(task, state, game) {
    if (!task || task.state !== 'RUNNING') return false;
    if (game && (game.phase !== task.phase || (game.phaseVersion || 0) !== task.phaseVersion)) {
      this.expire(task);
      return false;
    }
    if (!TERMINAL.has(state) || state === 'EXPIRED') return false;
    task.state = state;
    task.finishedAt = Date.now();
    this.metrics.durations.push(task.finishedAt - task.startedAt);
    if (this.metrics.durations.length > 200) this.metrics.durations.shift();
    if (state === 'FALLBACK_SUBMITTED') this.metrics.fallbackSubmitted += 1;
    else this.metrics.submitted += 1;
    return true;
  }

  expire(task) {
    if (!task || task.state !== 'RUNNING') return false;
    task.state = 'EXPIRED';
    task.finishedAt = Date.now();
    this.metrics.expired += 1;
    return true;
  }

  expireRoom(roomCode) {
    for (const task of this.tasks.values()) {
      if (task.roomCode === roomCode && task.state === 'RUNNING') this.expire(task);
    }
  }

  expireKind(roomCode, socketId, kind) {
    for (const task of this.tasks.values()) {
      if (task.roomCode === roomCode && task.socketId === socketId && task.kind === kind && task.state === 'RUNNING') {
        this.expire(task);
      }
    }
  }

  withDeadline(promise, ms, task) {
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => {
        task?.controller?.abort();
        resolve({ done: false, action: null });
      }, Math.max(0, ms));
    });
    return Promise.race([
      Promise.resolve(promise).then((action) => ({ done: true, action })),
      timeout,
    ]).finally(() => clearTimeout(timer));
  }

  getStats() {
    const sorted = [...this.metrics.durations].sort((a, b) => a - b);
    const pick = (p) => {
      if (!sorted.length) return 0;
      const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
      return sorted[index];
    };
    const running = [...this.tasks.values()].filter((task) => task.state === 'RUNNING').length;
    return {
      started: this.metrics.started,
      submitted: this.metrics.submitted,
      fallbackSubmitted: this.metrics.fallbackSubmitted,
      expired: this.metrics.expired,
      duplicate: this.metrics.duplicate,
      running,
      p50Ms: pick(50),
      p95Ms: pick(95),
    };
  }

  _trim() {
    if (this.tasks.size < 500) return;
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [id, task] of this.tasks) {
      if (task.state !== 'RUNNING' && task.startedAt < cutoff) {
        this.tasks.delete(id);
        if (this.byKey.get(task.key) === id) this.byKey.delete(task.key);
      }
    }
  }
}

module.exports = new AITaskCoordinator();
module.exports.AITaskCoordinator = AITaskCoordinator;
