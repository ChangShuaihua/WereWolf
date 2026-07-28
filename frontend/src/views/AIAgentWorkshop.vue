<template>
  <div class="workshop-page">
    <div class="workshop-content">
      <div class="agent-list">
        <div class="list-header">
          <h2>智能体列表</h2>
          <button class="btn-create" @click="showCreateForm = true">
            + 创建
          </button>
        </div>
        <div v-if="agents.length === 0" class="empty-state">
          <p>暂无智能体</p>
          <button class="btn btn-primary" @click="showCreateForm = true">创建第一个智能体</button>
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

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api';
import { useConfirmDialog } from '../composables/useConfirm';

const { showConfirm } = useConfirmDialog();

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
    const { data } = await api.get('/ai-agents');
    agents.value = data;
  } catch (err) {
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

  if (data.language.prefixes.length === 0) data.language.prefixes = ['我觉得'];
  if (data.language.suffixes.length === 0) data.language.suffixes = ['对吧'];
  if (data.language.favoriteWords.length === 0) data.language.favoriteWords = ['狼', '好人'];

  try {
    if (editingAgent.value) {
      await api.put(`/ai-agents/${editingAgent.value.id}`, data);
    } else {
      await api.post('/ai-agents', data);
    }
    await fetchAgents();
    closeModal();
  } catch (err) {
    console.error('Failed to save agent:', err);
  }
}

async function deleteAgent(id) {
  const confirmed = await showConfirm({
    title: '删除确认',
    message: '确定要删除这个智能体吗？\n此操作不可撤销。',
    confirmText: '删除',
    cancelText: '取消',
    type: 'error'
  });
  if (!confirmed) return;
  try {
    await api.delete(`/ai-agents/${id}`);
    await fetchAgents();
    if (selectedAgent.value?.id === id) {
      selectedAgent.value = null;
    }
  } catch (err) {
    console.error('Failed to delete agent:', err);
  }
}

onMounted(async () => {
  await fetchAgents();
  if (agents.value.length > 0 && !selectedAgent.value) {
    selectedAgent.value = agents.value[0];
  }
});
</script>

<style scoped>
.workshop-page {
  min-height: calc(100vh - 76px);
  background: var(--bg-primary);
  padding: 32px;
  position: relative;
}

.workshop-page::before {
  content: '';
  position: fixed;
  inset: 0;
  background: 
    radial-gradient(ellipse at 20% 0%, rgba(20, 184, 166, 0.1) 0%, transparent 40%),
    radial-gradient(ellipse at 80% 100%, rgba(59, 130, 246, 0.08) 0%, transparent 40%);
  pointer-events: none;
  z-index: 0;
}

.workshop-content {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 24px;
  position: relative;
  z-index: 1;
}

.agent-list {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: var(--border-medium);
  border-radius: var(--radius-xl);
  padding: 24px;
  max-height: calc(100vh - 128px);
  overflow-y: auto;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.list-header h2 {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.btn-create {
  padding: 10px 20px;
  background: linear-gradient(135deg, var(--ai-primary), var(--ai-secondary));
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 14px var(--ai-glow);
}

.btn-create:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px var(--ai-glow);
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
}

.empty-state p {
  margin-bottom: 16px;
}

.agent-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: var(--bg-secondary);
  border: var(--border-thin);
  border-radius: var(--radius-lg);
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.agent-card:hover {
  background: var(--bg-tertiary);
  border-color: var(--text-tertiary);
}

.agent-card.active {
  background: rgba(20, 184, 166, 0.12);
  border-color: var(--ai-primary);
  box-shadow: 0 0 20px rgba(20, 184, 166, 0.15);
}

.agent-avatar {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, var(--ai-primary), var(--ai-secondary));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  flex-shrink: 0;
}

.agent-info {
  flex: 1;
  min-width: 0;
}

.agent-info h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 6px;
}

.agent-personality-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag {
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: 0.7rem;
  font-weight: 500;
}

.tag.aggressive { background: rgba(229, 57, 53, 0.15); color: #FF5A5A; }
.tag.cautious { background: rgba(79, 140, 255, 0.15); color: #78A9FF; }
.tag.cunning { background: rgba(20, 184, 166, 0.15); color: var(--ai-secondary); }
.tag.honest { background: rgba(54, 211, 153, 0.15); color: var(--status-success); }
.tag.talkative { background: rgba(245, 185, 66, 0.15); color: var(--status-warning); }

.agent-actions {
  display: flex;
  gap: 6px;
}

.btn-edit,
.btn-delete {
  width: 32px;
  height: 32px;
  background: var(--bg-secondary);
  border: var(--border-thin);
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn-edit:hover {
  background: rgba(20, 184, 166, 0.15);
  border-color: var(--ai-primary);
}

.btn-delete:hover {
  background: rgba(229, 57, 53, 0.15);
  border-color: var(--status-error);
}

.agent-detail {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: var(--border-medium);
  border-radius: var(--radius-xl);
  padding: 32px;
  max-height: calc(100vh - 128px);
  overflow-y: auto;
}

.agent-detail h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 24px;
}

.detail-section {
  margin-bottom: 28px;
}

.detail-section label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-row {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  border-bottom: var(--border-thin);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  width: 80px;
  color: var(--text-tertiary);
  font-size: 0.9rem;
}

.info-value {
  flex: 1;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.personality-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.personality-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.item-label {
  width: 100px;
  font-size: 0.88rem;
  color: var(--text-secondary);
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

.progress-fill.aggressive { background: linear-gradient(90deg, var(--werewolf-primary), var(--werewolf-light)); }
.progress-fill.cautious { background: linear-gradient(90deg, var(--villager-primary), var(--villager-light)); }
.progress-fill.cunning { background: linear-gradient(90deg, var(--ai-primary), var(--ai-light)); }
.progress-fill.honest { background: linear-gradient(90deg, var(--status-success), #6EE7B7); }
.progress-fill.talkative { background: linear-gradient(90deg, var(--status-warning), #FCD34D); }

.item-value {
  width: 40px;
  text-align: right;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  font-family: var(--font-mono);
}

.strategy-grid,
.language-grid {
  display: grid;
  gap: 12px;
}

.strategy-item,
.language-item {
  display: flex;
  gap: 12px;
  padding: 10px 16px;
  background: var(--bg-secondary);
  border: var(--border-thin);
  border-radius: var(--radius-md);
}

.strategy-label,
.language-label {
  width: 80px;
  font-size: 0.88rem;
  color: var(--text-tertiary);
}

.strategy-value,
.language-value {
  flex: 1;
  font-size: 0.88rem;
  color: var(--text-primary);
}

.detail-actions {
  display: flex;
  gap: 12px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: var(--border-thin);
}

.detail-actions .btn-edit,
.detail-actions .btn-delete {
  width: auto;
  height: 44px;
  padding: 0 24px;
  font-size: 0.9rem;
  font-weight: 600;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(8, 10, 15, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 24px;
}

.modal-content {
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: var(--border-medium);
  border-radius: var(--radius-xl);
  padding: 32px;
}

.modal-content h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group > label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.form-group input[type="text"],
.form-group input:not([type]),
.form-group select {
  width: 100%;
  height: 44px;
  padding: 0 16px;
  background: var(--bg-secondary);
  border: var(--border-medium);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.95rem;
  outline: none;
  transition: all 0.2s;
}

.form-group input:focus,
.form-group select:focus {
  border-color: var(--ai-primary);
  box-shadow: 0 0 0 3px var(--ai-glow);
}

.avatar-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.avatar-option {
  width: 48px;
  height: 48px;
  background: var(--bg-secondary);
  border: var(--border-thin);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.avatar-option:hover {
  background: var(--bg-tertiary);
}

.avatar-option.selected {
  background: rgba(20, 184, 166, 0.2);
  border-color: var(--ai-primary);
  box-shadow: 0 0 12px var(--ai-glow);
}

.personality-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.slider-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.slider-label {
  width: 140px;
  font-size: 0.88rem;
  color: var(--text-secondary);
}

.slider-item input[type="range"] {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
  outline: none;
}

.slider-item input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  background: linear-gradient(135deg, var(--ai-primary), var(--ai-secondary));
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 8px var(--ai-glow);
}

.style-selector {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 8px;
}

.style-btn {
  padding: 10px 16px;
  background: var(--bg-secondary);
  border: var(--border-thin);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 0.88rem;
  cursor: pointer;
  transition: all 0.2s;
}

.style-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.style-btn.active {
  background: rgba(20, 184, 166, 0.2);
  border-color: var(--ai-primary);
  color: var(--ai-secondary);
}

.strategy-form,
.language-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.strategy-select {
  display: flex;
  align-items: center;
  gap: 12px;
}

.strategy-select span {
  width: 100px;
  font-size: 0.88rem;
  color: var(--text-secondary);
}

.strategy-select select {
  flex: 1;
}

.language-form input {
  height: 44px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 32px;
  padding-top: 24px;
  border-top: var(--border-thin);
}

.btn-cancel {
  padding: 10px 24px;
  background: var(--bg-secondary);
  border: var(--border-medium);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.btn-save {
  padding: 10px 24px;
  background: linear-gradient(135deg, var(--ai-primary), var(--ai-secondary));
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 14px var(--ai-glow);
}

.btn-save:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px var(--ai-glow);
}

@media (max-width: 900px) {
  .workshop-page {
    padding: 20px 16px;
  }
  
  .workshop-content {
    grid-template-columns: 1fr;
  }
  
  .agent-list,
  .agent-detail {
    max-height: none;
  }
}
</style>