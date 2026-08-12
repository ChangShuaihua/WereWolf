const { ChatOpenAI } = require('@langchain/openai');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const gameRetriever = require('./GameRetriever');

/**
 * RuleQAService - 房间内规则问答服务
 * 
 * 玩家在房间内发送以"?"或"规则"开头的消息时，
 * 通过RAG检索游戏规则文档，生成自然语言回答。
 */
class RuleQAService {
  constructor() {
    this.model = null;
    this._initModel();
  }

  _initModel() {
    const apiKey = process.env.XIAOMI_API_KEY || process.env.DEEPSEEK_API_KEY;
    const apiUrl = process.env.XIAOMI_API_URL || process.env.DEEPSEEK_API_URL || 'https://api.xiaomimimo.com';
    const modelName = process.env.XIAOMI_MODEL_NAME || process.env.MODEL_NAME || 'mimo-v2-flash';
    
    if (apiKey) {
      this.model = new ChatOpenAI({
        apiKey,
        modelName,
        configuration: { baseURL: apiUrl },
        temperature: 0.3,
        maxTokens: 300,
      });
      console.log(`[RuleQAService] Model initialized: ${modelName}`);
    } else {
      console.warn('[RuleQAService] No AI API key set, using fallback mode');
    }
  }

  /**
   * 判断消息是否为规则问答
   * @param {string} message - 用户消息
   * @returns {boolean}
   */
  isRuleQuestion(message) {
    if (!message || typeof message !== 'string') return false;
    const trimmed = message.trim();
    // 以?、？开头，或包含"规则"、"怎么玩"、"如何"等关键词
    return /^(?:\?|？)/.test(trimmed) ||
           /规则|怎么玩|如何|能.*吗|可以.*吗|不能.*吗/.test(trimmed);
  }

  /**
   * 回答规则问题
   * @param {string} question - 用户的问题
   * @returns {string} 回答内容
   */
  async answerQuestion(question) {
    // 清理问题（移除开头的?）
    const cleanQuestion = question.trim().replace(/^[?？]+/, '').trim();
    if (!cleanQuestion) return '请问你想了解什么规则呢？';

    // 检索相关规则
    const rulesContext = await gameRetriever.getRulesContextForPrompt(cleanQuestion);

    if (!this.model) {
      // 无LLM时返回检索到的规则片段
      if (rulesContext) {
        return `根据游戏规则：\n${rulesContext}`;
      }
      return '抱歉，我暂时无法回答这个问题。';
    }

    // 使用LLM生成自然语言回答
    const prompt = new PromptTemplate({
      template: `你是一个狼人杀游戏规则助手。请根据以下规则参考内容，回答玩家的问题。

回答要求：
- 简洁明了，直接回答问题
- 如果规则参考中有明确答案，请基于参考内容回答
- 如果规则参考中没有相关内容，请基于你对狼人杀规则的了解回答，并说明"参考内容中未提及"
- 回答控制在100字以内
- 使用友好、帮助性的语气

=== 规则参考 ===
{rulesContext}

=== 玩家问题 ===
{question}

请回答：`,
      inputVariables: ['rulesContext', 'question'],
    });

    try {
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const answer = await chain.invoke({
        rulesContext: rulesContext || '暂无相关规则参考',
        question: cleanQuestion,
      });
      return answer.trim();
    } catch (err) {
      console.error('[RuleQAService] LLM answer error:', err.message);
      // 降级：返回检索到的规则片段
      if (rulesContext) {
        return `根据游戏规则：\n${rulesContext}`;
      }
      return '抱歉，回答问题时出错了，请稍后再试。';
    }
  }
}

module.exports = new RuleQAService();
