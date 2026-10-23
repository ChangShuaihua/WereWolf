/**
 * 一次 AI 决策的 LangGraph：
 * 检索 → 先写推理 → 按这段推理给出行动 → 校验 → 最多修正一次。
 * 模型没有给出合法结果时放弃，不使用本地兜底。
 * 图只产出候选结果，不写游戏状态。
 */

const { z } = require('zod');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { RunnableLambda } = require('@langchain/core/runnables');
const { BaseCallbackHandler } = require('@langchain/core/callbacks/base');
const { StateGraph, Annotation, START, END } = require('@langchain/langgraph');
const { classifyError } = require('./LLMDecisionService');

const THINK_LIMIT_MS = 6000;
const PROPOSE_LIMIT_MS = 6000;

function mentionsSeat(text, seat) {
  const match = String(seat || '').match(/(\d+)/);
  if (!match) return false;
  return new RegExp(`(?<!\\d)${match[1]}\\s*号`).test(String(text || ''));
}

function beginAttempt(parent) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (parent?.aborted) controller.abort();
  else if (parent) parent.addEventListener('abort', onAbort, { once: true });
  return {
    signal: controller.signal,
    stop() {
      controller.abort();
    },
    release() {
      parent?.removeEventListener('abort', onAbort);
    },
  };
}

function stringEnum(values, fallback = '无') {
  const unique = [...new Set((values || []).map((value) => String(value).trim()).filter(Boolean))];
  if (unique.length === 0) unique.push(fallback);
  return z.enum(unique);
}

function buildNightActionSchema(actions, seats) {
  const actionList = (actions || []).filter(Boolean);
  const allowed = actionList.length > 0 ? actionList : ['skip'];
  const seatList = [...(seats || [])];
  if (allowed.includes('skip') && !seatList.includes('无')) seatList.push('无');
  return z.object({
    action: stringEnum(allowed, 'skip').describe('行动类型，只能从给定值里选'),
    targetSeat: stringEnum(seatList).describe('目标座位，只能从给定座位里选。skip 时填无'),
  });
}

function buildVoteSchema(seats) {
  return z.object({
    targetSeat: stringEnum(seats).describe('要投票放逐的座位，只能从给定座位里选'),
  });
}

const thoughtSchema = z.object({
  reasoning: z.string().describe('根据已知信息先写出判断过程，并写明准备采取的行动和座位。跳过时写明跳过'),
});

const speechSchema = z.object({
  message: z.string().describe('说出口的话，要体现已写出的推理，但不要把推理原文念出来'),
});

const lastWillSchema = z.object({
  message: z.string().describe('死亡遗言正文'),
});

const CLAIM_PATTERNS = [
  ['seer', /我是(?:真)?预言家/],
  ['witch', /我是女巫/],
  ['guard', /我是守卫/],
  ['hunter', /我是猎人/],
  ['werewolf', /我是狼人/],
  ['villager', /我是平民/],
];

function claimedRolesIn(message) {
  if (!message) return [];
  return CLAIM_PATTERNS.filter(([, pattern]) => pattern.test(message)).map(([role]) => role);
}

function contradictsClaim(message, claimedRole) {
  if (!claimedRole) return false;
  const hits = claimedRolesIn(message);
  if (hits.length === 0) return false;
  return hits.some((role) => role !== claimedRole);
}

function detectClaimedRole(message) {
  const hits = [...new Set(claimedRolesIn(message))];
  return hits.length === 1 ? hits[0] : null;
}

function bindStructured(model, prompt, schema, name) {
  const template = typeof prompt === 'string' ? ChatPromptTemplate.fromTemplate(prompt) : prompt;
  const structured = model.withStructuredOutput(schema, {
    name,
    method: 'functionCalling',
  });
  return template.pipe(structured);
}

class DecisionTraceHandler extends BaseCallbackHandler {
  constructor() {
    super();
    this.name = 'werewolf_decision_trace';
    this.steps = [];
  }

  handleChainStart(chain) {
    const name = chain?.name || chain?.id?.[chain.id.length - 1] || 'chain';
    this.steps.push({ event: 'start', name: String(name).slice(0, 80) });
  }

  handleChainError(error) {
    this.steps.push({ event: 'error', message: String(error?.message || error).slice(0, 160) });
  }

  handleChainEnd() {
    this.steps.push({ event: 'end' });
  }
}

const DecisionState = Annotation.Root({
  attempts: Annotation(),
  rag: Annotation(),
  proposal: Annotation(),
  validation: Annotation(),
  hint: Annotation(),
  modelError: Annotation(),
  canRepair: Annotation(),
  cancelled: Annotation(),
  outcome: Annotation(),
  reasoning: Annotation(),
  reviseThought: Annotation(),
  trace: Annotation(),
});

function pushTrace(state, step) {
  return [...(state.trace || []), step];
}

function compileDecisionGraph() {
  return new StateGraph(DecisionState)
    .addNode('gate', async (state, config) => {
      const ctx = config.configurable;
      if (!ctx.isOpen()) {
        return {
          cancelled: true,
          outcome: { ok: false, cancelled: true, value: null, reasoning: '', rag: state.rag || '', trace: state.trace || [] },
          trace: pushTrace(state, { step: 'cancelled' }),
        };
      }
      if (ctx.budgetOf() < 1000) {
        return {
          modelError: 'deadline',
          trace: pushTrace(state, { step: 'deadline' }),
        };
      }
      return { trace: pushTrace(state, { step: 'gate' }) };
    })
    .addNode('retrieve', async (state, config) => {
      const ctx = config.configurable;
      const retriever = RunnableLambda.from(async () => ctx.retrieve());
      const rag = await retriever.invoke({});
      return {
        rag: rag || '',
        trace: pushTrace(state, { step: 'retrieve', chars: String(rag || '').length }),
      };
    })
    .addNode('think', async (state, config) => {
      const ctx = config.configurable;
      if (typeof ctx.invokeThought !== 'function') {
        return { trace: pushTrace(state, { step: 'think_skip' }) };
      }
      if (!ctx.isOpen()) {
        return { cancelled: true, trace: pushTrace(state, { step: 'cancelled' }) };
      }
      const budget = ctx.budgetOf();
      if (budget < 1000) {
        return { modelError: 'deadline', trace: pushTrace(state, { step: 'deadline' }) };
      }
      const attempt = beginAttempt(ctx.signal);
      let timer;
      try {
        const thought = await Promise.race([
          ctx.invokeThought({
            ...ctx.input,
            ragStrategy: state.rag || '',
            repairHint: state.hint || '',
          }, { signal: attempt.signal, callbacks: ctx.callbacks ? [ctx.callbacks] : [] }),
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              attempt.stop();
              reject(new Error('LLM timeout'));
            }, Math.min(THINK_LIMIT_MS, budget));
          }),
        ]);
        const reasoning = String(thought?.reasoning ?? thought ?? '').trim();
        if (!reasoning) {
          return { modelError: 'empty', trace: pushTrace(state, { step: 'think_empty' }) };
        }
        return {
          reasoning,
          modelError: null,
          trace: pushTrace(state, { step: 'think', chars: reasoning.length }),
        };
      } catch (error) {
        if (ctx.signal?.aborted || !ctx.isOpen()) {
          return { cancelled: true, trace: pushTrace(state, { step: 'cancelled' }) };
        }
        const errorClass = classifyError(error);
        return {
          modelError: errorClass,
          validation: { ok: false, message: String(error?.message || error).slice(0, 200) },
          trace: pushTrace(state, { step: 'think_error', errorClass }),
        };
      } finally {
        clearTimeout(timer);
        attempt.release();
      }
    })
    .addNode('propose', async (state, config) => {
      const ctx = config.configurable;
      const attempt = (state.attempts || 0) + 1;
      if (!ctx.isOpen()) {
        return { cancelled: true, attempts: attempt, trace: pushTrace(state, { step: 'cancelled' }) };
      }
      const budget = ctx.budgetOf();
      if (budget < 1000) {
        return { modelError: 'deadline', attempts: attempt, trace: pushTrace(state, { step: 'deadline' }) };
      }
      const call = beginAttempt(ctx.signal);
      let timer;
      try {
        const proposal = await Promise.race([
          ctx.invokeModel({
            ...ctx.input,
            ragStrategy: state.rag || '',
            repairHint: state.hint || '',
            priorReasoning: state.reasoning || '',
          }, { signal: call.signal, callbacks: ctx.callbacks ? [ctx.callbacks] : [] }),
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              call.stop();
              reject(new Error('LLM timeout'));
            }, Math.min(PROPOSE_LIMIT_MS, budget));
          }),
        ]);
        return {
          proposal,
          attempts: attempt,
          modelError: null,
          trace: pushTrace(state, { step: 'propose', attempt }),
        };
      } catch (error) {
        if (ctx.signal?.aborted || !ctx.isOpen()) {
          return { cancelled: true, attempts: attempt, trace: pushTrace(state, { step: 'cancelled' }) };
        }
        const errorClass = classifyError(error);
        return {
          proposal: null,
          attempts: attempt,
          modelError: errorClass,
          validation: { ok: false, message: String(error?.message || error).slice(0, 200) },
          trace: pushTrace(state, { step: 'propose_error', attempt, errorClass }),
        };
      } finally {
        clearTimeout(timer);
        call.release();
      }
    })
    .addNode('validate', async (state, config) => {
      const ctx = config.configurable;
      if (state.cancelled) return {};
      let validation = { ok: false, message: state.modelError || '模型没有给出结果' };
      if (state.proposal) {
        validation = ctx.validate(state.proposal, state) || validation;
      }
      const fatal = state.modelError === 'auth' || state.modelError === 'deadline';
      const maxAttempts = ctx.maxAttempts || 2;
      const canRepair = !validation.ok
        && !fatal
        && (state.attempts || 0) < maxAttempts
        && ctx.isOpen()
        && ctx.budgetOf() >= 1000;
      return {
        validation,
        reviseThought: !validation.ok && validation.reviseThought === true,
        canRepair,
        outcome: validation.ok
          ? {
            ok: true,
            value: validation.value,
            attempts: state.attempts,
            rag: state.rag || '',
            reasoning: state.reasoning || '',
          }
          : null,
        trace: pushTrace(state, { step: validation.ok ? 'accept' : 'reject', attempt: state.attempts }),
      };
    })
    .addNode('repair', async (state) => {
      const message = state.validation?.message || state.modelError || '输出无法执行';
      return {
        hint: `上一次结果无效：${message}。请改成合法结果。`,
        trace: pushTrace(state, { step: 'repair', attempt: state.attempts }),
      };
    })
    .addNode('miss', async (state) => ({
      outcome: {
        ok: false,
        fallback: false,
        value: null,
        errorClass: state.modelError || null,
        message: state.validation?.message || '',
        attempts: state.attempts || 0,
        rag: state.rag || '',
        reasoning: '',
        trace: state.trace || [],
      },
      trace: pushTrace(state, { step: 'miss' }),
    }))
    .addNode('finish', async (state) => ({
      outcome: {
        ...(state.outcome || { ok: false, cancelled: !!state.cancelled }),
        rag: state.rag || state.outcome?.rag || '',
        reasoning: state.outcome?.reasoning || '',
        trace: state.trace || [],
        attempts: state.attempts || state.outcome?.attempts || 0,
      },
    }))
    .addEdge(START, 'gate')
    .addConditionalEdges('gate', (state) => {
      if (state.cancelled) return 'finish';
      if (state.modelError === 'deadline') return 'miss';
      return 'retrieve';
    })
    .addEdge('retrieve', 'think')
    .addConditionalEdges('think', (state) => {
      if (state.cancelled) return 'finish';
      if (state.modelError) return 'miss';
      return 'propose';
    })
    .addEdge('propose', 'validate')
    .addConditionalEdges('validate', (state) => {
      if (state.cancelled || state.validation?.ok) return 'finish';
      if (state.canRepair) return 'repair';
      return 'miss';
    })
    .addConditionalEdges('repair', (state) => (state.reviseThought ? 'think' : 'propose'))
    .addEdge('miss', 'finish')
    .addEdge('finish', END)
    .compile();
}

let decisionGraph;

function getDecisionGraph() {
  if (!decisionGraph) decisionGraph = compileDecisionGraph();
  return decisionGraph;
}

function blankState() {
  return {
    attempts: 0,
    rag: '',
    proposal: null,
    validation: null,
    hint: '',
    modelError: null,
    canRepair: false,
    cancelled: false,
    outcome: null,
    reasoning: '',
    reviseThought: false,
    trace: [],
  };
}

async function runDecision(options) {
  const callbacks = new DecisionTraceHandler();
  const controller = new AbortController();
  const parent = options.signal;
  const onAbort = () => controller.abort();
  if (parent?.aborted) controller.abort();
  else if (parent) parent.addEventListener('abort', onAbort, { once: true });
  try {
    const graphRun = RunnableLambda.from(() => getDecisionGraph().invoke(blankState(), {
      configurable: { ...options, callbacks, signal: controller.signal },
      callbacks: [callbacks],
      recursionLimit: 25,
    }));
    const guarded = graphRun.withFallbacks([
      RunnableLambda.from(async () => ({
        outcome: {
          ok: false,
          fallback: false,
          value: null,
          errorClass: 'request',
          message: 'decision graph failed',
          attempts: 0,
          rag: '',
          reasoning: '',
          trace: callbacks.steps,
        },
      })),
    ]);
    const finalState = await guarded.invoke({});
    const outcome = finalState?.outcome || { ok: false, fallback: false, value: null, trace: [] };
    const nodeTrace = outcome.trace || finalState?.trace || [];
    return {
      ...outcome,
      trace: [...nodeTrace, ...callbacks.steps],
    };
  } finally {
    parent?.removeEventListener('abort', onAbort);
    controller.abort();
  }
}

function agreeWerewolfTarget(proposals) {
  const tally = new Map();
  for (const item of proposals || []) {
    const action = item?.action;
    if (action?.action !== 'kill' || !action.targetId) continue;
    tally.set(action.targetId, (tally.get(action.targetId) || 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  for (const [targetId, count] of tally) {
    if (count > bestCount) {
      best = targetId;
      bestCount = count;
    }
  }
  return best;
}

const PackState = Annotation.Root({
  proposals: Annotation(),
  agreedTargetId: Annotation(),
});

function compilePackGraph() {
  return new StateGraph(PackState)
    .addNode('propose', async (state, config) => {
      const { players, decide } = config.configurable;
      const proposals = await Promise.all(players.map(async (player) => {
        const action = await decide(player);
        return { socketId: player.socketId, action };
      }));
      return { proposals };
    })
    .addNode('merge', async (state) => ({
      agreedTargetId: agreeWerewolfTarget(state.proposals),
    }))
    .addEdge(START, 'propose')
    .addEdge('propose', 'merge')
    .addEdge('merge', END)
    .compile();
}

let packGraph;

function getPackGraph() {
  if (!packGraph) packGraph = compilePackGraph();
  return packGraph;
}

async function runWerewolfPack({ players, decide }) {
  return getPackGraph().invoke(
    { proposals: [], agreedTargetId: null },
    { configurable: { players, decide }, recursionLimit: 6 },
  );
}

module.exports = {
  buildNightActionSchema,
  buildVoteSchema,
  thoughtSchema,
  speechSchema,
  lastWillSchema,
  contradictsClaim,
  detectClaimedRole,
  mentionsSeat,
  bindStructured,
  agreeWerewolfTarget,
  runDecision,
  runWerewolfPack,
};
