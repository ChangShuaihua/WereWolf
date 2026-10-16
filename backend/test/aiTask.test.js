const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { AITaskCoordinator } = require('../src/game/AITaskCoordinator');
const gameStateBuilder = require('../src/game/GameStateBuilder');
const { ROLE } = require('../src/game/constants');

function game(phase = 'NIGHT') {
  return { roomCode: 'ROOM', phase, phaseVersion: 1 };
}

describe('AI task lifecycle', () => {
  it('rejects a second submission for the same seat and phase version', () => {
    const coordinator = new AITaskCoordinator();
    const first = coordinator.beginFor(game(), 'ai-1', 'night', 1000);
    const second = coordinator.beginFor(game(), 'ai-1', 'night', 1000);
    assert.equal(first.accepted, true);
    assert.equal(second.accepted, false);
    assert.equal(second.reason, 'duplicate');
  });

  it('drops a result after the phase version changes', () => {
    const coordinator = new AITaskCoordinator();
    const current = game();
    const opened = coordinator.beginFor(current, 'ai-1', 'vote', 1000);
    current.phaseVersion = 2;
    assert.equal(coordinator.canSubmit(opened.task, current), false);
    assert.equal(coordinator.finish(opened.task, 'SUBMITTED', current), false);
    assert.equal(opened.task.state, 'EXPIRED');
  });

  it('lets a timed-out task fall back once, then refuses another submit', async () => {
    const coordinator = new AITaskCoordinator();
    const current = game();
    const opened = coordinator.beginFor(current, 'ai-1', 'night', 20);
    const result = await coordinator.withDeadline(new Promise(() => {}), 20);
    assert.equal(result.done, false);
    assert.equal(coordinator.pastDeadline(opened.task), true);
    assert.equal(coordinator.samePhase(opened.task, current), true);
    assert.equal(coordinator.finish(opened.task, 'FALLBACK_SUBMITTED', current), true);
    assert.equal(coordinator.finish(opened.task, 'SUBMITTED', current), false);
  });

  it('expires running tasks when the room changes phase', () => {
    const coordinator = new AITaskCoordinator();
    const current = game('DISCUSSION');
    const opened = coordinator.beginFor(current, 'ai-1', 'discuss-1', 1000);
    coordinator.expireRoom(current.roomCode);
    assert.equal(opened.task.state, 'EXPIRED');
    assert.equal(coordinator.samePhase(opened.task, current), false);
  });
});

describe('AI visible history', () => {
  it('hides another player check from a villager and keeps a wolf teammate kill', () => {
    const players = [
      { socketId: 'seer', isAlive: true, seatIndex: 0 },
      { socketId: 'villager', isAlive: true, seatIndex: 1 },
      { socketId: 'wolf', isAlive: true, seatIndex: 2 },
    ];
    const roles = { seer: ROLE.SEER, villager: ROLE.VILLAGER, wolf: ROLE.WEREWOLF };
    const historyGame = {
      roomCode: 'VIS',
      players,
      alivePlayers: players,
      roles,
      gameHistory: [
        {
          night: 1,
          action: 'check',
          actor: { id: 'seer', username: '1号' },
          target: { id: 'wolf', username: '3号' },
          result: 'werewolf',
        },
        {
          night: 1,
          action: 'kill',
          actor: { id: 'wolf', username: '3号' },
          target: { id: 'seer', username: '1号' },
        },
      ],
      getRole(id) { return roles[id]; },
      getSeatNum(id) {
        const player = players.find(item => item.socketId === id);
        return player ? `${player.seatIndex + 1}号` : '未知';
      },
    };

    const villager = players[1];
    const wolf = players[2];
    assert.equal(gameStateBuilder.canSeeHistoryEvent(historyGame, villager, historyGame.gameHistory[0]), false);
    assert.equal(gameStateBuilder.canSeeHistoryEvent(historyGame, wolf, historyGame.gameHistory[1]), true);
    const brief = gameStateBuilder.decisionBrief(historyGame, villager);
    assert.equal(brief.includes('查验'), false);
    assert.equal(brief.includes('狼人刀了'), false);
    assert.match(gameStateBuilder.decisionBrief(historyGame, wolf), /狼人刀了1号/);
  });

  it('remembers public claims and accusations without reading hidden roles', () => {
    const { roomCache } = require('../src/utils/cache');
    roomCache.set('MEM', {
      chat: [
        { username: '1号', message: '我是预言家', isSystem: false },
        { username: '1号', message: '我是平民', isSystem: false },
        { username: '2号', message: '我怀疑3号', isSystem: false },
        { username: '3号', message: '我觉得1号跳得太急', isSystem: false },
      ],
    });
    const players = [
      { socketId: 'seer', isAlive: true, seatIndex: 0 },
      { socketId: 'villager', isAlive: true, seatIndex: 2 },
    ];
    const memoryGame = {
      roomCode: 'MEM',
      players,
      alivePlayers: players,
      gameHistory: [],
      getRole() { return ROLE.VILLAGER; },
      getSeatNum(id) { return id === 'villager' ? '3号' : '1号'; },
    };
    const lines = gameStateBuilder.publicMemory(memoryGame, players[1]);
    const text = lines.join('\n');
    assert.match(text, /3号被点名1次/);
    assert.match(text, /1号先后声称预言家、平民（说法不一致）/);
    assert.match(text, /你已经说过：我觉得1号跳得太急/);
    assert.equal(text.includes('狼人'), false);
  });
});
