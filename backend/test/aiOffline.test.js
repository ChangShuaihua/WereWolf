const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ROLE } = require('../src/game/constants');
const ai = require('../src/game/AIGameHandler');
const { invokeStructured, classifyError } = require('../src/game/LLMDecisionService');
const retriever = require('../src/services/GameRetriever');
const { roomCache } = require('../src/utils/cache');

function mockGame(specs, extra = {}) {
  const players = specs.map((spec, index) => ({
    socketId: spec.id,
    seatIndex: spec.seat ?? index,
    isAlive: spec.alive !== false,
    isAI: true,
    username: spec.id,
    agentConfig: spec.agentConfig || null,
    fallbackEnabled: spec.fallbackEnabled !== false,
  }));
  const roles = {};
  specs.forEach(spec => { roles[spec.id] = spec.role; });
  const game = {
    roomCode: extra.roomCode || 'OFFLINE',
    phase: extra.phase || 'NIGHT',
    phaseVersion: 1,
    nightCount: extra.nightCount || 1,
    players,
    roles,
    nightActions: extra.nightActions || {},
    gameHistory: extra.gameHistory || [],
    guardLastProtected: extra.guardLastProtected || null,
    witchSaveUsed: !!extra.witchSaveUsed,
    witchPoisonUsed: !!extra.witchPoisonUsed,
    killedByWerewolves: extra.killedByWerewolves || null,
    pkCandidates: extra.pkCandidates || [],
    votes: extra.votes || {},
    getPlayer(id) { return players.find(player => player.socketId === id); },
    getRole(id) { return roles[id]; },
    getSeatNum(id) {
      const player = players.find(item => item.socketId === id);
      return player ? `${player.seatIndex + 1}号` : '未知';
    },
    recordAiThought() {},
  };
  game.alivePlayers = players.filter(player => player.isAlive);
  return game;
}

describe('structured model calls', () => {
  it('does not retry an authentication failure', async () => {
    assert.equal(classifyError(new Error('401 invalid api key')), 'auth');
    let calls = 0;
    const chain = {
      async invoke() {
        calls += 1;
        throw new Error('401 invalid api key');
      },
    };
    const result = await invokeStructured({
      chain,
      input: {},
      budgetOf: () => 5000,
      attempts: 2,
    });
    assert.equal(calls, 1);
    assert.equal(result.ok, false);
    assert.equal(result.errorClass, 'auth');
  });

  it('retries an illegal action once and keeps the legal result', async () => {
    let calls = 0;
    const chain = {
      async invoke() {
        calls += 1;
        return calls === 1 ? { action: 'kill', targetSeat: '1号' } : { action: 'check', targetSeat: '2号' };
      },
    };
    const result = await invokeStructured({
      chain,
      input: {},
      budgetOf: () => 5000,
      validate: (value) => (
        value.action === 'check'
          ? { ok: true, value }
          : { ok: false, message: 'invalid night target' }
      ),
    });
    assert.equal(calls, 2);
    assert.equal(result.ok, true);
    assert.equal(result.value.action, 'check');
    assert.equal(result.attempts, 2);
  });
});

describe('offline fallback board', () => {
  it('plays a fixed night and vote without an illegal action', () => {
    roomCache.set('BOARD', { chat: [{ username: '1号', message: '验了4号是狼人', isSystem: false }] });
    const game = mockGame([
      { id: 'wolf1', role: ROLE.WEREWOLF },
      { id: 'wolf2', role: ROLE.WEREWOLF },
      { id: 'seer', role: ROLE.SEER },
      { id: 'witch', role: ROLE.WITCH },
      { id: 'guard', role: ROLE.GUARD },
      { id: 'villager', role: ROLE.VILLAGER },
    ], {
      roomCode: 'BOARD',
      nightActions: { wolf1: { action: 'kill', targetId: 'villager' } },
      killedByWerewolves: 'villager',
      guardLastProtected: 'seer',
      gameHistory: [{
        night: 1,
        action: 'check',
        actor: { id: 'seer' },
        target: { id: 'witch' },
      }],
    });

    const wolfAction = ai._getFallbackNightAction(game, game.getPlayer('wolf2'), ROLE.WEREWOLF);
    const seerAction = ai._getFallbackNightAction(game, game.getPlayer('seer'), ROLE.SEER);
    const witchAction = ai._getFallbackNightAction(game, game.getPlayer('witch'), ROLE.WITCH);
    const guardAction = ai._getFallbackNightAction(game, game.getPlayer('guard'), ROLE.GUARD);

    assert.deepEqual(wolfAction, { action: 'kill', targetId: 'villager' });
    assert.equal(seerAction.action, 'check');
    assert.notEqual(seerAction.targetId, 'witch');
    assert.deepEqual(witchAction, { action: 'save', targetId: 'villager' });
    assert.equal(guardAction.action, 'guard');
    assert.notEqual(guardAction.targetId, 'seer');
    assert.notEqual(guardAction.targetId, 'guard');

    for (const [playerId, action] of [['wolf2', wolfAction], ['seer', seerAction], ['witch', witchAction], ['guard', guardAction]]) {
      assert.equal(
        ai._isLegalNightAction(game, game.getPlayer(playerId), game.getRole(playerId), action.action, action.targetId),
        true,
      );
    }

    assert.equal(ai._getFallbackVote(game, game.getPlayer('seer')), 'witch');
    assert.notEqual(ai._getFallbackVote(game, game.getPlayer('wolf1')), 'wolf2');
    assert.notEqual(ai._getFallbackVote(game, game.getPlayer('wolf2')), 'wolf1');
  });
});

describe('fallback speech follows public chat', () => {
  it('answers a human accusation instead of ignoring messages without an AI flag', () => {
    roomCache.set('SPEAK', {
      chat: [
        { username: '1号', message: '我是预言家', isSystem: false },
        { username: '1号', message: '我怀疑2号', isSystem: false },
        { username: '2号', message: '我是好人', isSystem: false },
      ],
    });
    const game = mockGame([
      { id: 'human', role: ROLE.VILLAGER, seat: 0 },
      { id: 'accused', role: ROLE.VILLAGER, seat: 1 },
      { id: 'ai', role: ROLE.VILLAGER, seat: 2 },
    ], { roomCode: 'SPEAK' });
    const ctx = ai._parseChatContext(roomCache.get('SPEAK').chat, game, 'ai');
    assert.equal(ctx.hasSeerClaimed, true);
    assert.equal(ctx.accusations.some(item => item.target === '2号'), true);

    const message = ai._getFallbackChatMessage(game, game.getPlayer('ai'));
    assert.match(message, /2号/);
  });

  it('does not steer a werewolf onto an accused teammate', () => {
    const game = mockGame([
      { id: 'wolf1', role: ROLE.WEREWOLF, seat: 0 },
      { id: 'wolf2', role: ROLE.WEREWOLF, seat: 1 },
      { id: 'villager', role: ROLE.VILLAGER, seat: 2 },
    ]);
    const ctx = { accusations: [{ from: '3号', target: '2号' }] };
    assert.equal(ai._topAccusedSeat(game, game.getPlayer('wolf1'), ctx), null);
    assert.equal(ai._topAccusedSeat(game, game.getPlayer('villager'), ctx).socketId, 'wolf2');
  });
});

describe('strategy retrieval stays on tactic documents', () => {
  it('does not return replay notes for the current game', async () => {
    await retriever.initialize();
    retriever.docs.push({
      source: 'game_fake_replay.md',
      kind: 'replay',
      content: '狼人 核心目标 悍跳 屠边 夜晚 刀人 高阶打法',
      tokens: 20,
      _role: 'werewolf',
    });
    const results = await retriever.retrieve({
      role: 'werewolf',
      team: 'werewolf',
      phase: 'night',
      nightCount: 1,
    }, 5);
    assert.ok(results.length > 0);
    assert.ok(results.every(item => item.source !== 'game_fake_replay.md'));
    assert.ok(results.every(item => item.source !== 'game-rules.md'));
  });
});
