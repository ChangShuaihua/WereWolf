const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { RunnableLambda } = require('@langchain/core/runnables');
const { PromptTemplate } = require('@langchain/core/prompts');
const {
  agreeWerewolfTarget,
  bindStructured,
  contradictsClaim,
  detectClaimedRole,
  buildNightActionSchema,
  buildVoteSchema,
  mentionsSeat,
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

describe('seat matching', () => {
  it('matches a whole seat and ignores a longer seat number', () => {
    assert.equal(mentionsSeat('先看11号', '1号'), false);
    assert.equal(mentionsSeat('先看11号', '11号'), true);
    assert.equal(mentionsSeat('12号发言怪', '2号'), false);
    assert.equal(mentionsSeat('查2号', '2号'), true);
  });
});

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
    });

    assert.equal(calls, 2);
    assert.equal(outcome.ok, true);
    assert.equal(outcome.value.targetSeat, '2号');
    assert.equal(outcome.rag, '查验优先');
    assert.ok(outcome.trace.some((step) => step.step === 'repair'));
  });

  it('drops the decision after two illegal proposals', async () => {
    let calls = 0;
    const outcome = await runDecision({
      ...openCall(),
      input: {},
      invokeModel: async () => {
        calls += 1;
        return { action: 'kill', targetSeat: '99号', reasoning: 'bad' };
      },
      validate: () => ({ ok: false, message: '目标不在可选座位里' }),
    });

    assert.equal(calls, 2);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.fallback, false);
    assert.equal(outcome.value, null);
    assert.equal(outcome.reasoning, '');
  });

  it('keeps the reasoning written before the action', async () => {
    const outcome = await runDecision({
      ...openCall(),
      input: { seat: '2号' },
      invokeThought: async () => '2号发言最可疑，查2号',
      invokeModel: async (vars) => {
        assert.match(vars.priorReasoning, /查2号/);
        return { action: 'check', targetSeat: '2号' };
      },
      validate: (result, state) => (
        state.reasoning.includes('2号') && result.targetSeat === '2号'
          ? { ok: true, value: result }
          : { ok: false, message: '行动和推理不一致' }
      ),
    });

    assert.equal(outcome.ok, true);
    assert.equal(outcome.reasoning, '2号发言最可疑，查2号');
    assert.equal(outcome.value.targetSeat, '2号');
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
    });

    assert.equal(calls, 1);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.fallback, false);
    assert.equal(outcome.value, null);
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
    });

    assert.equal(calls, 0);
    assert.equal(outcome.cancelled, true);
    assert.equal(outcome.value, null);
  });

  it('rewrites the thought when the reasoning names no usable seat', async () => {
    let thoughts = 0;
    const outcome = await runDecision({
      ...openCall(),
      input: {},
      invokeThought: async (vars) => {
        thoughts += 1;
        if (thoughts === 1) return '随便看看';
        assert.match(vars.repairHint, /没有写明/);
        return '查2号';
      },
      invokeModel: async (vars) => ({
        action: 'check',
        targetSeat: String(vars.priorReasoning).includes('2号') ? '2号' : '9号',
      }),
      validate: (result, state) => (
        String(state.reasoning).includes('2号') && result.targetSeat === '2号'
          ? { ok: true, value: result }
          : { ok: false, message: '推理里没有写明可选座位', reviseThought: true }
      ),
    });
    assert.equal(thoughts, 2);
    assert.equal(outcome.ok, true);
    assert.equal(outcome.reasoning, '查2号');
  });

  it('aborts an in-flight model call when the caller cancels', async () => {
    const controller = new AbortController();
    let aborted = false;
    const pending = runDecision({
      ...openCall(),
      signal: controller.signal,
      input: {},
      invokeModel: (_vars, config) => new Promise((_resolve, reject) => {
        config.signal.addEventListener('abort', () => {
          aborted = true;
          reject(new Error('aborted'));
        });
      }),
      validate: () => ({ ok: true, value: {} }),
    });
    setTimeout(() => controller.abort(), 30);
    const outcome = await pending;
    assert.equal(aborted, true);
    assert.equal(outcome.ok, false);
  });

  it('asks only once when a short proposal disallows repair', async () => {
    let calls = 0;
    const outcome = await runDecision({
      ...openCall(),
      maxAttempts: 1,
      input: {},
      invokeModel: async () => {
        calls += 1;
        return { targetSeat: '99号' };
      },
      validate: () => ({ ok: false, message: '不在提案里' }),
    });
    assert.equal(calls, 1);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.fallback, false);
    assert.equal(outcome.value, null);
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
        assert.equal(schema.safeParse({ action: 'check', targetSeat: '3号', reasoning: '先验' }).success, true);
        assert.equal(schema.safeParse({ action: 'kill', targetSeat: '99号', reasoning: '先验' }).success, false);
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
    const nightActionSchema = buildNightActionSchema(['check'], ['3号']);
    const chain = bindStructured(model, prompt, nightActionSchema, 'night_action');
    const result = await chain.invoke({ seat: '3号', ragStrategy: '', repairHint: '' });
    assert.equal(result.action, 'check');
  });

  it('flags a speech that abandons an earlier claim', () => {
    assert.equal(contradictsClaim('我是狼人，这轮跟我走', 'seer'), true);
    assert.equal(contradictsClaim('我是预言家，昨晚验了3号', 'seer'), false);
    assert.equal(contradictsClaim('3号发言不太对', 'seer'), false);
  });

  it('records a single identity claim and ignores a mixed sentence', () => {
    assert.equal(detectClaimedRole('我是预言家，昨晚验了3号'), 'seer');
    assert.equal(detectClaimedRole('3号发言不太对'), null);
    assert.equal(detectClaimedRole('我是预言家，其实我是狼人'), null);
  });

  it('rejects a night action or vote outside the offered seats', () => {
    const night = buildNightActionSchema(['kill'], ['3号', '5号']);
    assert.equal(night.safeParse({ action: 'kill', targetSeat: '3号', reasoning: '刀' }).success, true);
    assert.equal(night.safeParse({ action: 'check', targetSeat: '3号', reasoning: '刀' }).success, false);
    assert.equal(night.safeParse({ action: 'kill', targetSeat: '99号', reasoning: '刀' }).success, false);
    const witch = buildNightActionSchema(['save', 'skip'], ['2号']);
    assert.equal(witch.safeParse({ action: 'skip', targetSeat: '无', reasoning: '留药' }).success, true);
    const vote = buildVoteSchema(['3号', '4号']);
    assert.equal(vote.safeParse({ targetSeat: '4号', reasoning: '出' }).success, true);
    assert.equal(vote.safeParse({ targetSeat: '8号', reasoning: '出' }).success, false);
  });
});
