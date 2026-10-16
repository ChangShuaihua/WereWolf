/**
 * 统一的结构化模型调用。
 * 鉴权失败不重试；超时、限流、解析失败和非法结果在截止时间前最多再试一次。
 */

function classifyError(error) {
  const message = String(error?.message || error || '');
  if (/timeout/i.test(message)) return 'timeout';
  if (/429|rate.?limit|too many requests/i.test(message)) return 'rate_limit';
  if (/401|403|unauthorized|invalid api key|api key/i.test(message)) return 'auth';
  if (/parse|json|output parser/i.test(message)) return 'parse';
  return 'request';
}

function canRetry(errorClass) {
  return errorClass === 'timeout' || errorClass === 'rate_limit' || errorClass === 'parse' || errorClass === 'request' || errorClass === 'invalid';
}

async function invokeStructured({ chain, input, isOpen, budgetOf, validate, attempts = 2 }) {
  let errorClass = null;
  let message = '';
  let usedAttempts = 0;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (isOpen && !isOpen()) {
      return { ok: false, cancelled: true, errorClass, message, attempts: usedAttempts };
    }
    const budget = budgetOf ? budgetOf() : 20000;
    if (budget < 1000) {
      return { ok: false, errorClass: 'deadline', message: 'decision deadline', attempts: usedAttempts };
    }

    usedAttempts = attempt;
    try {
      const value = await Promise.race([
        chain.invoke(input),
        new Promise((_, reject) => setTimeout(() => reject(new Error('LLM timeout')), Math.min(20000, budget))),
      ]);
      if (isOpen && !isOpen()) {
        return { ok: false, cancelled: true, errorClass, message, attempts: usedAttempts };
      }
      const parsed = validate ? validate(value) : { ok: true, value };
      if (parsed.ok) return { ok: true, value: parsed.value, attempts: usedAttempts };
      errorClass = 'invalid';
      message = parsed.message || 'invalid output';
    } catch (error) {
      errorClass = classifyError(error);
      message = error.message || String(error);
      if (!canRetry(errorClass)) break;
    }
  }

  return { ok: false, errorClass, message, attempts: usedAttempts };
}

module.exports = { classifyError, canRetry, invokeStructured };
