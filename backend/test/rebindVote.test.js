const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const GameEngine = require('../src/game/GameEngine');
const { PHASE, ROLE } = require('../src/game/constants');

function createGame() {
  const game = new GameEngine('ROOM', [
    { id: 1, socketId: 'wolf', username: 'W', seatIndex: 0, isAlive: true, isReady: true, boundSocketId: 'wolf' },
    { id: 2, socketId: 'villager', username: 'V', seatIndex: 1, isAlive: true, isReady: true, boundSocketId: 'villager' },
  ], () => {}, 2);
  game.roles = { wolf: ROLE.WEREWOLF, villager: ROLE.VILLAGER };
  game.players.forEach(player => {
    player.role = game.roles[player.socketId];
  });
  return game;
}

describe('one action per player', () => {
  it('keeps the first day vote and rejects a second one', () => {
    const game = createGame();
    game.phase = PHASE.VOTE;

    assert.equal(game.submitVote('wolf', 'villager'), true);
    assert.equal(game.submitVote('wolf', 'villager'), false);
    assert.deepEqual(game.votes, { wolf: 'villager' });
  });

  it('keeps the first werewolf kill and rejects a second one', () => {
    const game = createGame();
    game.phase = PHASE.NIGHT;

    assert.equal(game.submitNightAction('wolf', 'kill', 'villager'), true);
    assert.equal(game.submitNightAction('wolf', 'kill', 'villager'), false);
    assert.equal(game.nightActions.wolf.targetId, 'villager');
  });

  it('moves an existing vote and kill onto the new socket id', () => {
    const game = createGame();
    game.phase = PHASE.VOTE;
    game.submitVote('wolf', 'villager');
    game.phase = PHASE.NIGHT;
    game.submitNightAction('wolf', 'kill', 'villager');
    game.pkCandidates = ['villager'];
    game.guardLastProtected = 'villager';
    game.killedByWerewolves = 'villager';

    game.rebindSocket('wolf', 'wolf-2');
    game.rebindSocket('villager', 'villager-2');

    assert.equal(game.roles['wolf-2'], ROLE.WEREWOLF);
    assert.equal(game.roles.wolf, undefined);
    assert.deepEqual(game.votes, { 'wolf-2': 'villager-2' });
    assert.equal(game.nightActions['wolf-2'].targetId, 'villager-2');
    assert.deepEqual(game.pkCandidates, ['villager-2']);
    assert.equal(game.guardLastProtected, 'villager-2');
    assert.equal(game.killedByWerewolves, 'villager-2');
    assert.equal(game.players[0].socketId, 'wolf-2');

    game.phase = PHASE.VOTE;
    assert.equal(game.submitVote('wolf-2', 'villager-2'), false);
    game.phase = PHASE.NIGHT;
    assert.equal(game.submitNightAction('wolf-2', 'kill', 'villager-2'), false);
  });
});
