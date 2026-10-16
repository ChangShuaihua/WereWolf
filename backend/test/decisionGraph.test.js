const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { RunnableLambda } = require('@langchain/core/runnables');
const { PromptTemplate } = require('@langchain/core/prompts');
const {
  agreeWerewolfTarget,
  bindStructured,
  contradictsClaim,
  nightActionSchema,
  runDecision,
  runWerewolfPack,
} = require('../src/game/DecisionGraph');

function openCall() {
  return {
    isOpen: () => true,
    budgetOf: () => 10000,
    retrieve: async () => '查验优先',
  };
}

describe('decision graph', () => {
  it('repairs an illegal proposal once and then accepts it', async () => {
    let calls = 0;
    const outcome = await runDecision({
      ...openCall(),
      input: { seat: '2号' },
      invokeModel: async (vars) => {
        calls += 1;
        if (calls === 1) return { action: 'kill', targetSeat: '99号', reasoning: 'bad' };
        assert.match(vars.repairHint, /可选座位/);
        return { action: 'kill', targetSeat: '2号', reasoning: 'ok' };
      },
      validate: (result) => (
        result.targetSeat === '2号'
          ? { ok: true, value: result }
          : { ok: false, message: '目标不在可选座位里' }
      ),
      fallback: async () => ({ action: 'skip' }),
    });

    assert.equal(calls, 2);
    assert.equal(outcome.ok, true);
    assert.equal(outcome.value.targetSeat, '2号');
    assert.equal(outcome.rag, '查验优先');
    assert.ok(outcome.trace.some((step) => step.step === 'repair'));
  });

  it('uses the local fallback after two illegal proposals', async () => {
    let calls = 0;
    const outcome = await runDecision({
      ...openCall(),
      input: {},
      invokeModel: async () => {
        calls += 1;
        return { action: 'kill', targetSeat: '99号', reasoning: 'bad' };
      },
      validate: () => ({ ok: false, message: '目标不在可选座位里' }),
      fallback: async () => ({ action: 'kill', targetId: 'villager' }),
    });

    assert.equal(calls, 2);
    assert.equal(outcome.fallback, true);
    assert.deepEqual(outcome.value, { action: 'kill', targetId: 'villager' });
  });

  it('does not retry an authentication failure', async () => {
    let calls = 0;
    const outcome = await runDecision({
      ...openCall(),
      input: {},
      invokeModel: async () => {
        calls += 1;
        throw new Error('401 invalid api key');
      },
      validate: () => ({ ok: true, value: {} }),
      fallback: async () => 'local',
    });

    assert.equal(calls, 1);
    assert.equal(outcome.fallback, true);
    assert.equal(outcome.value, 'local');
    assert.equal(outcome.errorClass, 'auth');
  });

  it('stops when the task is already closed', async () => {
    let calls = 0;
    const outcome = await runDecision({
      ...openCall(),
      isOpen: () => false,
      input: {},
      invokeModel: async () => {
        calls += 1;
        return {};
      },
      validate: () => ({ ok: true, value: {} }),
      fallback: async () => 'local',
    });

    assert.equal(calls, 0);
    assert.equal(outcome.cancelled, true);
  });
});

describe('werewolf pack graph', () => {
  it('picks the majority kill and keeps the first target when the vote ties', () => {
    assert.equal(agreeWerewolfTarget([
      { action: { action: 'kill', targetId: 'a' } },
      { action: { action: 'kill', targetId: 'b' } },
      { action: { action: 'kill', targetId: 'a' } },
    ]), 'a');
    assert.equal(agreeWerewolfTarget([
      { action: { action: 'kill', targetId: 'b' } },
      { action: { action: 'kill', targetId: 'a' } },
    ]), 'b');
    assert.equal(agreeWerewolfTarget([{ action: null }]), null);
  });

  it('collects parallel proposals and merges them', async () => {
    const result = await runWerewolfPack({
      players: [{ socketId: 'wolf1' }, { socketId: 'wolf2' }],
      decide: async (player) => ({
        action: 'kill',
        targetId: player.socketId === 'wolf1' ? 'seer' : 'seer',
      }),
    });
    assert.equal(result.agreedTargetId, 'seer');
    assert.equal(result.proposals.length, 2);
  });
});

describe('structured prompt binding', () => {
  it('fills the prompt and reads the structured result', async () => {
    const model = {
      withStructuredOutput(schema, config) {
        assert.equal(schema, nightActionSchema);
        assert.equal(config.name, 'night_action');
        assert.equal(config.method, 'functionCalling');
        return RunnableLambda.from(async (input) => {
          const text = typeof input === 'string' ? input : input.toString();
          assert.match(text, /3号/);
          return { action: 'check', targetSeat: '3号', reasoning: '先验' };
        });
      },
    };
    const prompt = new PromptTemplate({
      template: '可选座位：{seat}\n{ragStrategy}\n{repairHint}',
      inputVariables: ['seat', 'ragStrategy', 'repairHint'],
    });
    const chain = bindStructured(model, prompt, nightActionSchema, 'night_action');
    const result = await chain.invoke({ seat: '3号', ragStrategy: '', repairHint: '' });
    assert.equal(result.action, 'check');
  });

  it('flags a speech that abandons an earlier claim', () => {
    assert.equal(contradictsClaim('我是狼人，这轮跟我走', 'seer'), true);
    assert.equal(contradictsClaim('我是预言家，昨晚验了3号', 'seer'), false);
    assert.equal(contradictsClaim('3号发言不太对', 'seer'), false);
  });
});
