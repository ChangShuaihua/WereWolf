const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ROLE } = require('../src/game/constants');
const ai = require('../src/game/AIGameHandler');
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
  }));
  const roles = {};
  specs.forEach(spec => {
    roles[spec.id] = spec.role;
  });
  const game = {
    roomCode: extra.roomCode || 'ROOM1',
    phase: 'night',
    nightCount: extra.nightCount || 2,
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
    getPlayer(id) {
      return players.find(player => player.socketId === id);
    },
    getRole(id) {
      return roles[id];
    },
    getSeatNum(id) {
      const player = players.find(item => item.socketId === id);
      return player ? `${player.seatIndex + 1}号` : '未知';
    },
  };
  game.alivePlayers = players.filter(player => player.isAlive);
  return game;
}

describe('AI decision visibility and fallback', () => {
  it('does not treat other good roles as a seer teammate', () => {
    const game = mockGame([
      { id: 'seer', role: ROLE.SEER },
      { id: 'witch', role: ROLE.WITCH },
      { id: 'wolf', role: ROLE.WEREWOLF },
    ]);
    const state = ai._buildGameState(game, game.getPlayer('seer'));
    assert.deepEqual(state.teammates, []);
    assert.equal(state.alivePlayers.find(player => player.socketId === 'witch').role, 'unknown');
    assert.equal(state.alivePlayers.find(player => player.socketId === 'wolf').role, 'unknown');
  });

  it('lets werewolves see only werewolf teammates', () => {
    const game = mockGame([
      { id: 'wolf1', role: ROLE.WEREWOLF },
      { id: 'wolf2', role: ROLE.WEREWOLF },
      { id: 'seer', role: ROLE.SEER },
    ]);
    const state = ai._buildGameState(game, game.getPlayer('wolf1'));
    assert.deepEqual(state.teammates.map(player => player.socketId), ['wolf2']);
    assert.equal(state.alivePlayers.find(player => player.socketId === 'seer').role, 'unknown');
  });

  it('parses a seat label back to the player', () => {
    const game = mockGame([
      { id: 'a', role: ROLE.VILLAGER },
      { id: 'b', role: ROLE.VILLAGER },
      { id: 'c', role: ROLE.VILLAGER },
    ]);
    assert.equal(ai._parseSeatChoice(game, '3号'), 'c');
    assert.equal(ai._parseSeatChoice(game, '座位是2号'), 'b');
    assert.equal(ai._parseSeatChoice(game, '无'), null);
  });

  it('does not guard the same player on consecutive nights', () => {
    const game = mockGame([
      { id: 'guard', role: ROLE.GUARD },
      { id: 'a', role: ROLE.VILLAGER },
      { id: 'b', role: ROLE.VILLAGER },
    ], { guardLastProtected: 'b', roomCode: 'GUARD' });
    const action = ai._getFallbackNightAction(game, game.getPlayer('guard'), ROLE.GUARD);
    assert.equal(action.action, 'guard');
    assert.notEqual(action.targetId, 'b');
    assert.notEqual(action.targetId, 'guard');
  });

  it('saves the werewolf victim when the witch has no public suspect', () => {
    const game = mockGame([
      { id: 'witch', role: ROLE.WITCH },
      { id: 'a', role: ROLE.VILLAGER },
      { id: 'b', role: ROLE.VILLAGER },
    ], { killedByWerewolves: 'a', roomCode: 'SAVE', nightCount: 1 });
    const action = ai._getFallbackNightAction(game, game.getPlayer('witch'), ROLE.WITCH);
    assert.deepEqual(action, { action: 'save', targetId: 'a' });
  });

  it('poisons a repeatedly accused player', () => {
    roomCache.set('POISON', {
      chat: [
        { username: '1号', message: '3号是狼', isSystem: false },
        { username: '2号', message: '我怀疑3号', isSystem: false },
      ],
    });
    const game = mockGame([
      { id: 'witch', role: ROLE.WITCH },
      { id: 'a', role: ROLE.VILLAGER },
      { id: 'b', role: ROLE.VILLAGER },
    ], { roomCode: 'POISON', witchSaveUsed: true, nightCount: 2 });
    const action = ai._getFallbackNightAction(game, game.getPlayer('witch'), ROLE.WITCH);
    assert.deepEqual(action, { action: 'poison', targetId: 'b' });
  });

  it('follows a teammate kill instead of hitting another wolf', () => {
    const game = mockGame([
      { id: 'wolf1', role: ROLE.WEREWOLF },
      { id: 'wolf2', role: ROLE.WEREWOLF },
      { id: 'villager', role: ROLE.VILLAGER },
    ], { nightActions: { wolf1: { action: 'kill', targetId: 'villager' } }, roomCode: 'WOLF' });
    const action = ai._getFallbackNightAction(game, game.getPlayer('wolf2'), ROLE.WEREWOLF);
    assert.deepEqual(action, { action: 'kill', targetId: 'villager' });
    assert.equal(ai._isLegalNightAction(game, game.getPlayer('wolf2'), ROLE.WEREWOLF, 'kill', 'wolf1'), false);
  });

  it('votes for a publicly accused seat and respects a wolf teammate', () => {
    roomCache.set('VOTE', {
      chat: [{ username: '1号', message: '验了3号是狼人', isSystem: false }],
    });
    const game = mockGame([
      { id: 'seer', role: ROLE.SEER },
      { id: 'wolf', role: ROLE.WEREWOLF },
      { id: 'villager', role: ROLE.VILLAGER },
    ], { roomCode: 'VOTE' });
    assert.equal(ai._getFallbackVote(game, game.getPlayer('seer')), 'villager');
    assert.notEqual(ai._getFallbackVote(game, game.getPlayer('wolf')), 'wolf');
  });
});

describe('rule keyword extraction', () => {
  it('splits a Chinese question into role terms instead of one sentence', () => {
    const keywords = retriever._extractKeywords('女巫能不能自救');
    assert.ok(keywords.includes('女巫'));
    assert.ok(keywords.includes('自救'));
    assert.equal(keywords.includes('女巫能不能自救'), false);
  });
});
