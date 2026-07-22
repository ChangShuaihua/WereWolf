<template>
  <div class="workshop-page">
    <header class="workshop-header">
      <button class="btn-back" @click="$router.push('/')">
        ← 返回大厅
      </button>
      <h1>🤖 AI工坊</h1>
      <button class="btn-create" @click="showCreateForm = true">
        + 创建智能体
      </button>
    </header>

    <div class="workshop-content">
      <div class="agent-list">
        <h2>智能体列表</h2>
        <div v-if="agents.length === 0" class="empty-state">
          <p>暂无智能体，点击右上角创建</p>
        </div>
        <div class="agent-card"
          v-for="agent in agents"
          :key="agent.id"
          :class="{ active: selectedAgent?.id === agent.id }"
          @click="selectAgent(agent)"
        >
          <div class="agent-avatar">{{ agent.avatar }}</div>
          <div class="agent-info">
            <h3>{{ agent.name }}</h3>
            <div class="agent-personality-tags">
              <span v-if="agent.personality.aggressiveness > 70" class="tag aggressive">激进</span>
              <span v-if="agent.personality.caution > 70" class="tag cautious">谨慎</span>
              <span v-if="agent.personality.cunning > 70" class="tag cunning">狡猾</span>
              <span v-if="agent.personality.honesty > 70" class="tag honest">诚实</span>
              <span v-if="agent.personality.talkativeness > 70" class="tag talkative">话多</span>
            </div>
          </div>
          <div class="agent-actions">
            <button class="btn-edit" @click.stop="editAgent(agent)">✏️</button>
            <button class="btn-delete" @click.stop="deleteAgent(agent.id)">🗑️</button>
          </div>
        </div>
      </div>

      <div class="agent-detail" v-if="selectedAgent">
        <h2>智能体详情</h2>
        
        <div class="detail-section">
          <label>基本信息</label>
          <div class="info-row">
            <span class="info-label">名称:</span>
            <span class="info-value">{{ selectedAgent.name }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">头像:</span>
            <span class="info-value">{{ selectedAgent.avatar }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">发言风格:</span>
            <span class="info-value">{{ speakingStyleNames[selectedAgent.speakingStyle] }}</span>
          </div>
        </div>

        <div class="detail-section">
          <label>性格参数</label>
          <div class="personality-grid">
            <div class="personality-item">
              <span class="item-label">🔥 激进度</span>
              <div class="progress-bar">
                <div class="progress-fill aggressive" :style="{ width: selectedAgent.personality.aggressiveness + '%' }"></div>
              </div>
              <span class="item-value">{{ selectedAgent.personality.aggressiveness }}</span>
            </div>
            <div class="personality-item">
              <span class="item-label">🛡️ 谨慎度</span>
              <div class="progress-bar">
                <div class="progress-fill cautious" :style="{ width: selectedAgent.personality.caution + '%' }"></div>
              </div>
              <span class="item-value">{{ selectedAgent.personality.caution }}</span>
            </div>
            <div class="personality-item">
              <span class="item-label">🦊 狡猾度</span>
              <div class="progress-bar">
                <div class="progress-fill cunning" :style="{ width: selectedAgent.personality.cunning + '%' }"></div>
              </div>
              <span class="item-value">{{ selectedAgent.personality.cunning }}</span>
            </div>
            <div class="personality-item">
              <span class="item-label">🤍 诚实度</span>
              <div class="progress-bar">
                <div class="progress-fill honest" :style="{ width: selectedAgent.personality.honesty + '%' }"></div>
              </div>
              <span class="item-value">{{ selectedAgent.personality.honesty }}</span>
            </div>
            <div class="personality-item">
              <span class="item-label">💬 话多程度</span>
              <div class="progress-bar">
                <div class="progress-fill talkative" :style="{ width: selectedAgent.personality.talkativeness + '%' }"></div>
              </div>
              <span class="item-value">{{ selectedAgent.personality.talkativeness }}</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <label>策略配置</label>
          <div class="strategy-grid">
            <div class="strategy-item">
              <span class="strategy-label">夜间策略:</span>
              <span class="strategy-value">{{ nightActionNames[selectedAgent.strategy.nightAction] }}</span>
            </div>
            <div class="strategy-item">
              <span class="strategy-label">白天策略:</span>
              <span class="strategy-value">{{ dayStrategyNames[selectedAgent.strategy.dayStrategy] }}</span>
            </div>
            <div class="strategy-item">
              <span class="strategy-label">身份暴露:</span>
              <span class="strategy-value">{{ revealIdentityNames[selectedAgent.strategy.revealIdentity] }}</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <label>语言习惯</label>
          <div class="language-grid">
            <div class="language-item">
              <span class="language-label">前缀:</span>
              <span class="language-value">{{ selectedAgent.language.prefixes.join('、') }}</span>
            </div>
            <div class="language-item">
              <span class="language-label">后缀:</span>
              <span class="language-value">{{ selectedAgent.language.suffixes.join('、') }}</span>
            </div>
            <div class="language-item">
              <span class="language-label">常用词:</span>
              <span class="language-value">{{ selectedAgent.language.favoriteWords.join('、') }}</span>
            </div>
          </div>
        </div>

        <div class="detail-actions">
          <button class="btn-edit" @click="editAgent(selectedAgent)">✏️ 编辑</button>
          <button class="btn-delete" @click="deleteAgent(selectedAgent.id)">🗑️ 删除</button>
        </div>
      </div>
    </div>

    <div v-if="showCreateForm || editingAgent" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <h2>{{ editingAgent ? '编辑智能体' : '创建智能体' }}</h2>
        
        <div class="form-group">
          <label>名称</label>
          <input v-model="formData.name" placeholder="输入智能体名称" />
        </div>

        <div class="form-group">
          <label>头像</label>
          <div class="avatar-selector">
            <span v-for="avatar in avatars" :key="avatar"
              class="avatar-option"
              :class="{ selected: formData.avatar === avatar }"
              @click="formData.avatar = avatar"
            >{{ avatar }}</span>
          </div>
        </div>

        <div class="form-group">
          <label>性格参数</label>
          <div class="personality-form">
            <div class="slider-item">
              <span class="slider-label">🔥 激进度 ({{ formData.personality.aggressiveness }})</span>
              <input type="range" v-model.number="formData.personality.aggressiveness" min="0" max="100" />
            </div>
            <div class="slider-item">
              <span class="slider-label">🛡️ 谨慎度 ({{ formData.personality.caution }})</span>
              <input type="range" v-model.number="formData.personality.caution" min="0" max="100" />
            </div>
            <div class="slider-item">
              <span class="slider-label">🦊 狡猾度 ({{ formData.personality.cunning }})</span>
              <input type="range" v-model.number="formData.personality.cunning" min="0" max="100" />
            </div>
            <div class="slider-item">
              <span class="slider-label">🤍 诚实度 ({{ formData.personality.honesty }})</span>
              <input type="range" v-model.number="formData.personality.honesty" min="0" max="100" />
            </div>
            <div class="slider-item">
              <span class="slider-label">💬 话多程度 ({{ formData.personality.talkativeness }})</span>
              <input type="range" v-model.number="formData.personality.talkativeness" min="0" max="100" />
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>发言风格</label>
          <div class="style-selector">
            <button v-for="(name, key) in speakingStyleNames" :key="key"
              class="style-btn"
              :class="{ active: formData.speakingStyle === key }"
              @click="formData.speakingStyle = key"
            >{{ name }}</button>
          </div>
        </div>

        <div class="form-group">
          <label>策略配置</label>
          <div class="strategy-form">
            <div class="strategy-select">
              <span>夜间策略:</span>
              <select v-model="formData.strategy.nightAction">
                <option v-for="(name, key) in nightActionNames" :key="key" :value="key">{{ name }}</option>
              </select>
            </div>
            <div class="strategy-select">
              <span>白天策略:</span>
              <select v-model="formData.strategy.dayStrategy">
                <option v-for="(name, key) in dayStrategyNames" :key="key" :value="key">{{ name }}</option>
              </select>
            </div>
            <div class="strategy-select">
              <span>身份暴露:</span>
              <select v-model="formData.strategy.revealIdentity">
                <option v-for="(name, key) in revealIdentityNames" :key="key" :value="key">{{ name }}</option>
              </select>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>语言习惯</label>
          <div class="language-form">
            <input v-model="formData.language.prefixesStr" placeholder="口头禅前缀，用逗号分隔" />
            <input v-model="formData.language.suffixesStr" placeholder="口头禅后缀，用逗号分隔" />
            <input v-model="formData.language.favoriteWordsStr" placeholder="常用词，用逗号分隔" />
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" @click="closeModal">取消</button>
          <button class="btn-save" @click="saveAgent">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
const router = useRouter();
const agents = ref([]);
const selectedAgent = ref(null);
const showCreateForm = ref(false);
const editingAgent = ref(null);
const avatars = ['🤖', '🐺', '👨‍🌾', '🔮', '🧪', '🏹', '🛡️', '😂', '😎', '🤔', '😈', '😇'];
const speakingStyleNames = {
 humorous: '幽默',
 serious: '严肃',
 aggressive: '激进',
 calm: '冷静',
 mysterious: '神秘'
};
const nightActionNames = {
 random: '随机攻击',
 target_weak: '攻击弱者',
 target_strong: '攻击强者',
 follow_teammate: '跟随队友'
};
const dayStrategyNames = {
 passive: '被动',
 active: '主动',
 leader: '领袖',
 follower: '跟随者'
};
const revealIdentityNames = {
 early: '尽早',
 mid: '中期',
 late: '晚期',
 never: '从不'
};
const formData = reactive({
 name: '',
 avatar: '🤖',
 personality: {
 aggressiveness: 50,
 caution: 50,
 cunning: 50,
 honesty: 50,
 talkativeness: 50
 },
 speakingStyle: 'calm',
 strategy: {
 nightAction: 'random',
 dayStrategy: 'passive',
 revealIdentity: 'mid'
 },
 language: {
 prefixesStr: '',
 suffixesStr: '',
 favoriteWordsStr: ''
 }
});
async function fetchAgents() {
 try {
 const response = await fetch('/api/ai-agents');
 agents.value = await response.json();
 }
 catch (err) {
 console.error('Failed to fetch agents:', err);
 }
}
function selectAgent(agent) {
 selectedAgent.value = agent;
}
function editAgent(agent) {
 editingAgent.value = agent;
 formData.name = agent.name;
 formData.avatar = agent.avatar;
 formData.personality = { ...agent.personality };
 formData.speakingStyle = agent.speakingStyle;
 formData.strategy = { ...agent.strategy };
 formData.language = {
 prefixesStr: agent.language.prefixes.join(','),
 suffixesStr: agent.language.suffixes.join(','),
 favoriteWordsStr: agent.language.favoriteWords.join(',')
 };
}
function closeModal() {
 showCreateForm.value = false;
 editingAgent.value = null;
 formData.name = '';
 formData.avatar = '🤖';
 formData.personality = { aggressiveness: 50, caution: 50, cunning: 50, honesty: 50, talkativeness: 50 };
 formData.speakingStyle = 'calm';
 formData.strategy = { nightAction: 'random', dayStrategy: 'passive', revealIdentity: 'mid' };
 formData.language = { prefixesStr: '', suffixesStr: '', favoriteWordsStr: '' };
}
async function saveAgent() {
 const data = {
 name: formData.name,
 avatar: formData.avatar,
 personality: formData.personality,
 speakingStyle: formData.speakingStyle,
 strategy: formData.strategy,
 language: {
 prefixes: formData.language.prefixesStr.split(',').map(s => s.trim()).filter(s => s),
 suffixes: formData.language.suffixesStr.split(',').map(s => s.trim()).filter(s => s),
 favoriteWords: formData.language.favoriteWordsStr.split(',').map(s => s.trim()).filter(s => s)
 }
 };
 if (data.language.prefixes.length === 0)
 data.language.prefixes = ['我觉得'];
 if (data.language.suffixes.length === 0)
 data.language.suffixes = ['对吧'];
 if (data.language.favoriteWords.length === 0)
 data.language.favoriteWords = ['狼', '好人'];
 try {
 if (editingAgent.value) {
 await fetch(`/api/ai-agents/${editingAgent.value.id}`, {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(data)
 });
 }
 else {
 await fetch('/api/ai-agents', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(data)
 });
 }
 await fetchAgents();
 closeModal();
 }
 catch (err) {
 console.error('Failed to save agent:', err);
 }
}
async function deleteAgent(id) {
 if (!confirm('确定要删除这个智能体吗？'))
 return;
 try {
 await fetch(`/api/ai-agents/${id}`, { method: 'DELETE' });
 await fetchAgents();
 if (selectedAgent.value?.id === id) {
 selectedAgent.value = null;
 }
 }
 catch (err) {
 console.error('Failed to delete agent:', err);
 }
}
onMounted(() => {
 fetchAgents();
});
</script>