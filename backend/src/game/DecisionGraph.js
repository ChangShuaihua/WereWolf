/**
 * 一次 AI 决策的 LangGraph：
 * 检索 → 结构化提案 → 校验 → 最多修正一次 → 本地兜底。
 * 图只产出候选结果，不写游戏状态。
 */

const { z } = require('zod');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { RunnableLambda } = require('@langchain/core/runnables');
const { BaseCallbackHandler } = require('@langchain/core/callbacks/base');
const { StateGraph, Annotation, START, END } = require('@langchain/langgraph');
const { classifyError } = require('./LLMDecisionService');

const nightActionSchema = z.object({
  action: z.enum(['kill', 'check', 'guard', 'save', 'poison', 'skip']).describe('行动类型'),
  targetSeat: z.string().describe('目标座位，必须是可选座位中的一个，例如 3号。skip 时填无'),
  reasoning: z.string().describe('为什么选择这个行动'),
});

const voteSchema = z.object({
  targetSeat: z.string().describe('要投票放逐的座位，必须是可选座位中的一个，例如 3号'),
  reasoning: z.string().describe('为什么投票给这个玩家'),
});

const speechSchema = z.object({
  reasoning: z.string().describe('内心推理，不要写进发言'),
  message: z.string().describe('说出口的话'),
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

function contradictsClaim(message, claimedRole) {
  if (!claimedRole || !message) return false;
  const hits = CLAIM_PATTERNS.filter(([, pattern]) => pattern.test(message)).map(([role]) => role);
  if (hits.length === 0) return false;
  return hits.some((role) => role !== claimedRole);
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
          outcome: { ok: false, cancelled: true, rag: state.rag || '', trace: state.trace || [] },
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
      let timer;
      try {
        const proposal = await Promise.race([
          ctx.invokeModel({
            ...ctx.input,
            ragStrategy: state.rag || '',
            repairHint: state.hint || '',
          }, ctx.callbacks),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('LLM timeout')), Math.min(20000, budget));
          }),
        ]);
        return {
          proposal,
          attempts: attempt,
          modelError: null,
          trace: pushTrace(state, { step: 'propose', attempt }),
        };
      } catch (error) {
        const errorClass = classifyError(error);
        return {
          proposal: null,
          attempts: attempt,
          modelError: errorClass,
          trace: pushTrace(state, { step: 'propose_error', attempt, errorClass }),
        };
      } finally {
        clearTimeout(timer);
      }
    })
    .addNode('validate', async (state, config) => {
      const ctx = config.configurable;
      if (state.cancelled) return {};
      let validation = { ok: false, message: state.modelError || '模型没有给出结果' };
      if (state.proposal) {
        validation = ctx.validate(state.proposal) || validation;
      }
      const fatal = state.modelError === 'auth' || state.modelError === 'deadline';
      const canRepair = !validation.ok
        && !fatal
        && (state.attempts || 0) < 2
        && ctx.isOpen()
        && ctx.budgetOf() >= 1000;
      return {
        validation,
        canRepair,
        outcome: validation.ok
          ? { ok: true, value: validation.value, attempts: state.attempts, rag: state.rag || '' }
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
    .addNode('fallback', async (state, config) => {
      const ctx = config.configurable;
      if (!ctx.isOpen()) {
        return {
          cancelled: true,
          outcome: { ok: false, cancelled: true, rag: state.rag || '', trace: state.trace || [] },
        };
      }
      const value = await ctx.fallback(state);
      return {
        outcome: {
          ok: false,
          fallback: true,
          value,
          errorClass: state.modelError || null,
          message: state.validation?.message || '',
          attempts: state.attempts || 0,
          rag: state.rag || '',
          trace: state.trace || [],
        },
        trace: pushTrace(state, { step: 'fallback' }),
      };
    })
    .addNode('finish', async (state) => ({
      outcome: {
        ...(state.outcome || { ok: false, cancelled: !!state.cancelled }),
        rag: state.rag || state.outcome?.rag || '',
        trace: state.trace || [],
        attempts: state.attempts || state.outcome?.attempts || 0,
      },
    }))
    .addEdge(START, 'gate')
    .addConditionalEdges('gate', (state) => {
      if (state.cancelled) return 'finish';
      if (state.modelError === 'deadline') return 'fallback';
      return 'retrieve';
    })
    .addEdge('retrieve', 'propose')
    .addEdge('propose', 'validate')
    .addConditionalEdges('validate', (state) => {
      if (state.cancelled || state.validation?.ok) return 'finish';
      if (state.canRepair) return 'repair';
      return 'fallback';
    })
    .addEdge('repair', 'propose')
    .addEdge('fallback', 'finish')
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
    trace: [],
  };
}

async function runDecision(options) {
  const callbacks = new DecisionTraceHandler();
  const graphRun = RunnableLambda.from(() => getDecisionGraph().invoke(blankState(), {
    configurable: { ...options, callbacks },
    callbacks: [callbacks],
    recursionLimit: 25,
  }));
  const guarded = graphRun.withFallbacks([
    RunnableLambda.from(async () => {
      const value = await options.fallback();
      return {
        outcome: {
          ok: false,
          fallback: true,
          value,
          errorClass: 'request',
          message: 'decision graph failed',
          attempts: 0,
          rag: '',
          trace: callbacks.steps,
        },
      };
    }),
  ]);
  const finalState = await guarded.invoke({});
  const outcome = finalState?.outcome || { ok: false, fallback: false, value: null, trace: [] };
  const nodeTrace = outcome.trace || finalState?.trace || [];
  return {
    ...outcome,
    trace: [...nodeTrace, ...callbacks.steps],
  };
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
  nightActionSchema,
  voteSchema,
  speechSchema,
  lastWillSchema,
  contradictsClaim,
  bindStructured,
  agreeWerewolfTarget,
  runDecision,
  runWerewolfPack,
};
