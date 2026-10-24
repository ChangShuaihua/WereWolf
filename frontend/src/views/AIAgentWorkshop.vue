<template>
  <div class="workshop-page">
    <div class="workshop-content">
      <div class="agent-list">
        <div class="list-header">
          <h2>智能体列表</h2>
          <button class="btn-create" @click="openCreate">
            + 创建
          </button>
        </div>
        <p v-if="pageNotice" class="page-notice" role="alert">{{ pageNotice }}</p>
        <div v-if="agents.length === 0" class="empty-state">
          <p>暂无智能体</p>
          <button class="btn btn-primary" @click="openCreate">创建第一个智能体</button>
        </div>
        <template v-else>
        <div class="list-tabs" role="tablist" aria-label="智能体分类">
          <button
            v-for="group in agentGroups"
            :key="group.key"
            type="button"
            class="list-tab"
            role="tab"
            :id="`agent-tab-${group.key}`"
            :aria-selected="listTab === group.key"
            :tabindex="listTab === group.key ? 0 : -1"
            @click="listTab = group.key"
            @keydown="onTabKeydown($event, group.key)"
          >
            {{ group.title }}
            <span class="tab-count">{{ group.agents.length }}</span>
          </button>
        </div>
        <section
          v-if="activeGroup"
          class="agent-group"
          role="tabpanel"
          :aria-labelledby="`agent-tab-${activeGroup.key}`"
        >
          <p class="group-note">{{ activeGroup.note }}</p>
          <p v-if="activeGroup.agents.length === 0" class="group-empty">{{ activeGroup.empty }}</p>
          <div class="agent-card"
            v-for="agent in activeGroup.agents"
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
              <button class="btn-copy" title="复制一份" @click.stop="copyAgent(agent)">复制</button>
              <button v-if="canEdit(agent)" class="btn-edit" title="编辑" @click.stop="editAgent(agent)">✏️</button>
              <button v-if="canEdit(agent)" class="btn-delete" title="删除" @click.stop="deleteAgent(agent.id)">🗑️</button>
            </div>
          </div>
        </section>
        </template>
      </div>

      <div class="agent-detail" v-if="selectedAgent">
        <h2>
          {{ selectedAgent.name }}
          <span v-if="isBuiltin(selectedAgent)" class="builtin-mark">内置</span>
        </h2>

        <div class="sample-card">
          <span class="sample-label">试听一句</span>
          <p class="sample-text">{{ buildSampleLine(selectedAgent) }}</p>
          <p class="sample-note">按当前性格和口头禅拼的本地例句。进房后模型可能说得不一样。没有模型时，夜间和投票走下面的策略，不走这句。</p>
        </div>
        
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
          <ul class="effect-list">
            <li v-for="note in personalityNotes(selectedAgent.personality)" :key="note">{{ note }}</li>
          </ul>
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
          <ul class="effect-list">
            <li v-for="note in strategyNotes(selectedAgent.strategy)" :key="note">{{ note }}</li>
          </ul>
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
          <button class="btn-copy" @click="copyAgent(selectedAgent)">复制一份</button>
          <button v-if="canEdit(selectedAgent)" class="btn-edit" @click="editAgent(selectedAgent)">✏️ 编辑</button>
          <button v-if="canEdit(selectedAgent)" class="btn-delete" @click="deleteAgent(selectedAgent.id)">🗑️ 删除</button>
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
            <span v-for="avatar in avatarChoices" :key="avatar"
              class="avatar-option"
              :class="{ selected: formData.avatar === avatar }"
              role="button"
              tabindex="0"
              @click="formData.avatar = avatar"
              @keydown.enter.prevent="formData.avatar = avatar"
            >{{ avatar }}</span>
          </div>
        </div>

        <div class="form-group">
          <label>性格参数</label>
          <div class="personality-form">
            <div class="slider-item">
              <span class="slider-label">🔥 激进度 ({{ formData.personality.aggressiveness }})</span>
              <input type="range" v-model.number="formData.personality.aggressiveness" min="0" max="100" />
              <p class="slider-hint">{{ traitHint('aggressiveness', formData.personality.aggressiveness) }}</p>
            </div>
            <div class="slider-item">
              <span class="slider-label">🛡️ 谨慎度 ({{ formData.personality.caution }})</span>
              <input type="range" v-model.number="formData.personality.caution" min="0" max="100" />
              <p class="slider-hint">{{ traitHint('caution', formData.personality.caution) }}</p>
            </div>
            <div class="slider-item">
              <span class="slider-label">🦊 狡猾度 ({{ formData.personality.cunning }})</span>
              <input type="range" v-model.number="formData.personality.cunning" min="0" max="100" />
              <p class="slider-hint">{{ traitHint('cunning', formData.personality.cunning) }}</p>
            </div>
            <div class="slider-item">
              <span class="slider-label">🤍 诚实度 ({{ formData.personality.honesty }})</span>
              <input type="range" v-model.number="formData.personality.honesty" min="0" max="100" />
              <p class="slider-hint">{{ traitHint('honesty', formData.personality.honesty) }}</p>
            </div>
            <div class="slider-item">
              <span class="slider-label">💬 话多程度 ({{ formData.personality.talkativeness }})</span>
              <input type="range" v-model.number="formData.personality.talkativeness" min="0" max="100" />
              <p class="slider-hint">{{ traitHint('talkativeness', formData.personality.talkativeness) }}</p>
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
          <ul class="effect-list">
            <li v-for="note in strategyNotes(formData.strategy)" :key="note">{{ note }}</li>
          </ul>
        </div>

        <div class="form-group">
          <label>语言习惯</label>
          <div class="language-form">
            <input v-model="formData.language.prefixesStr" placeholder="口头禅前缀，用逗号分隔" />
            <input v-model="formData.language.suffixesStr" placeholder="口头禅后缀，用逗号分隔" />
            <input v-model="formData.language.favoriteWordsStr" placeholder="常用词，用逗号分隔" />
          </div>
        </div>

        <div class="sample-card">
          <span class="sample-label">试听一句</span>
          <p class="sample-text">{{ buildSampleLine(formPreview) }}</p>
        </div>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

        <div class="modal-actions">
          <button class="btn-cancel" @click="closeModal">取消</button>
          <button class="btn-save" @click="saveAgent">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue';
import api from '../api';
import { useUserStore } from '../stores/user';
import { useConfirmDialog } from '../composables/useConfirm';
import { buildSampleLine, personalityNotes, strategyNotes, traitHint } from '../utils/agentPreview';

const { showConfirm } = useConfirmDialog();
const userStore = useUserStore();

const agents = ref([]);
const selectedAgent = ref(null);
const showCreateForm = ref(false);
const editingAgent = ref(null);
const pageNotice = ref('');
const formError = ref('');
const listTab = ref('builtin');
const avatars = ['🧠', '😌', '😏', '🌫️', '📣', '😄', '🐣', '🗣️', '🤫', '😤', '🤔', '😎', '😇', '😂', '🤖'];

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

const avatarChoices = computed(() => {
  if (formData.avatar && !avatars.includes(formData.avatar)) {
    return [formData.avatar, ...avatars];
  }
  return avatars;
});

const formPreview = computed(() => ({
  personality: formData.personality,
  speakingStyle: formData.speakingStyle,
  strategy: formData.strategy,
  language: {
    prefixes: splitPhrases(formData.language.prefixesStr),
    suffixes: splitPhrases(formData.language.suffixesStr),
    favoriteWords: splitPhrases(formData.language.favoriteWordsStr),
  },
}));

const agentGroups = computed(() => {
  const mineId = Number(userStore.user?.id);
  const builtin = agents.value.filter(agent => isBuiltin(agent));
  const mine = agents.value.filter(agent => !isBuiltin(agent) && Number(agent.ownerId) === mineId);
  const others = agents.value.filter(agent => !isBuiltin(agent) && Number(agent.ownerId) !== mineId);
  const groups = [
    {
      key: 'builtin',
      title: '内置',
      note: '只能查看和复制。复制出来的那份才能改名字、滑条和口头禅。',
      empty: '还没有内置智能体。',
      agents: builtin,
    },
    {
      key: 'mine',
      title: '我的',
      note: '这些会跟你进房间，也可以继续改。',
      empty: '还没有自己的智能体。可以新建，或从内置复制一份再改。',
      agents: mine,
    },
  ];
  if (others.length > 0) {
    groups.push({
      key: 'others',
      title: '其他用户',
      note: '管理员可以改这些智能体。',
      empty: '',
      agents: others,
    });
  }
  return groups;
});

const activeGroup = computed(() => (
  agentGroups.value.find(group => group.key === listTab.value) || agentGroups.value[0]
));

watch(agentGroups, (groups) => {
  if (!groups.some(group => group.key === listTab.value)) {
    listTab.value = groups[0]?.key || 'builtin';
  }
});

function onTabKeydown(event, key) {
  const keys = agentGroups.value.map(group => group.key);
  const index = keys.indexOf(key);
  if (index < 0) return;
  let next = null;
  if (event.key === 'ArrowRight') next = keys[(index + 1) % keys.length];
  if (event.key === 'ArrowLeft') next = keys[(index - 1 + keys.length) % keys.length];
  if (!next) return;
  event.preventDefault();
  listTab.value = next;
  nextTick(() => {
    document.getElementById(`agent-tab-${next}`)?.focus();
  });
}

function isBuiltin(agent) {
  return agent?.builtin === true || agent?.ownerId == null;
}

function canEdit(agent) {
  if (!agent) return false;
  if (typeof agent.canModify === 'boolean') return agent.canModify;
  return !isBuiltin(agent) && Number(agent.ownerId) === Number(userStore.user?.id);
}

function splitPhrases(value) {
  return String(value || '').split(/[,，]/).map(item => item.trim()).filter(Boolean);
}

function apiMessage(err, fallback) {
  return err?.response?.data?.message || fallback;
}

function copyName(name) {
  const base = String(name || '智能体').replace(/的副本$/, '');
  const next = `${base}的副本`;
  return next.length > 20 ? next.slice(0, 20) : next;
}

async function fetchAgents() {
  try {
    const { data } = await api.get('/ai-agents');
    agents.value = data;
    pageNotice.value = '';
    if (selectedAgent.value) {
      selectedAgent.value = data.find(agent => agent.id === selectedAgent.value.id) || null;
    }
  } catch (err) {
    pageNotice.value = apiMessage(err, '智能体列表加载失败');
  }
}

function selectAgent(agent) {
  selectedAgent.value = agent;
}

function editAgent(agent) {
  if (!canEdit(agent)) {
    pageNotice.value = '内置智能体不能直接改，先复制一份。';
    return;
  }
  formError.value = '';
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

function openCreate() {
  closeModal();
  showCreateForm.value = true;
}

function closeModal() {
  showCreateForm.value = false;
  editingAgent.value = null;
  formError.value = '';
  formData.name = '';
  formData.avatar = '🤖';
  formData.personality = { aggressiveness: 50, caution: 50, cunning: 50, honesty: 50, talkativeness: 50 };
  formData.speakingStyle = 'calm';
  formData.strategy = { nightAction: 'random', dayStrategy: 'passive', revealIdentity: 'mid' };
  formData.language = { prefixesStr: '', suffixesStr: '', favoriteWordsStr: '' };
}

async function saveAgent() {
  const data = {
    name: formData.name.trim(),
    avatar: formData.avatar,
    personality: formData.personality,
    speakingStyle: formData.speakingStyle,
    strategy: formData.strategy,
    language: {
      prefixes: splitPhrases(formData.language.prefixesStr),
      suffixes: splitPhrases(formData.language.suffixesStr),
      favoriteWords: splitPhrases(formData.language.favoriteWordsStr),
    }
  };

  if (!data.name) {
    formError.value = '先写一个名字，1 到 20 个字。';
    return;
  }
  if (data.language.prefixes.length === 0) data.language.prefixes = ['我觉得'];
  if (data.language.suffixes.length === 0) data.language.suffixes = ['对吧'];
  if (data.language.favoriteWords.length === 0) data.language.favoriteWords = ['看票', '发言'];

  try {
    const editingId = editingAgent.value?.id;
    const response = editingId
      ? await api.put(`/ai-agents/${editingId}`, data)
      : await api.post('/ai-agents', data);
    const savedId = response.data?.id || editingId;
    await fetchAgents();
    selectedAgent.value = agents.value.find(agent => agent.id === savedId) || selectedAgent.value;
    if (!editingId) listTab.value = 'mine';
    closeModal();
  } catch (err) {
    formError.value = apiMessage(err, '保存失败');
  }
}

async function copyAgent(agent) {
  const data = {
    name: copyName(agent.name),
    avatar: avatars.includes(agent.avatar) ? agent.avatar : '🤖',
    personality: { ...agent.personality },
    speakingStyle: agent.speakingStyle,
    strategy: { ...agent.strategy },
    language: {
      prefixes: [...(agent.language?.prefixes || [])],
      suffixes: [...(agent.language?.suffixes || [])],
      favoriteWords: [...(agent.language?.favoriteWords || [])],
    },
  };
  try {
    const { data: created } = await api.post('/ai-agents', data);
    await fetchAgents();
    selectedAgent.value = agents.value.find(item => item.id === created.id) || selectedAgent.value;
    listTab.value = 'mine';
    pageNotice.value = '';
  } catch (err) {
    pageNotice.value = apiMessage(err, '复制失败');
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
    pageNotice.value = apiMessage(err, '删除失败');
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
  min-height: calc(100vh - var(--header-h));
  background: transparent;
  padding: 32px;
  position: relative;
}

.workshop-page::before {
  content: '';
  position: fixed;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(7, 10, 18, 0.46) 0%, rgba(7, 10, 18, 0.16) 40%, rgba(7, 10, 18, 0.48) 100%),
    url('/bg2.webp') center 28% / cover no-repeat;
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
  background: var(--ai-primary);
  border: none;
  border-radius: var(--radius-md);
  color: var(--on-accent);
  font-weight: 600;
  font-size: 0.9rem;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
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
  background: var(--ai-glow);
  border-color: var(--ai-primary);
  box-shadow: none;
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
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 6px;
}

.list-tabs {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 4px;
  margin-bottom: 14px;
  padding: 4px;
  background: var(--bg-secondary);
  border: var(--border-thin);
  border-radius: var(--radius-lg);
}

.list-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 12px;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
}

.list-tab[aria-selected="true"] {
  background: var(--ai-glow);
  color: var(--ai-secondary);
  box-shadow: inset 0 0 0 1px var(--ai-primary);
}

.list-tab:hover {
  color: var(--text-primary);
}

.tab-count {
  min-width: 1.4em;
  padding: 0 6px;
  border-radius: var(--radius-full);
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  line-height: 1.6;
}

.list-tab[aria-selected="true"] .tab-count {
  background: var(--bg-primary);
  color: var(--ai-secondary);
}

.group-note,
.group-empty,
.page-notice,
.slider-hint,
.sample-note {
  margin: 0 0 10px;
  color: var(--text-tertiary);
  font-size: 0.78rem;
  line-height: 1.5;
}

.page-notice,
.form-error {
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: rgba(229, 57, 53, 0.12);
  color: var(--status-error);
}

.builtin-mark {
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
}

.btn-copy {
  height: 32px;
  padding: 0 10px;
  background: var(--bg-secondary);
  border: var(--border-thin);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-primary);
}

.btn-copy:hover {
  background: var(--ai-glow);
  border-color: var(--ai-primary);
  color: var(--ai-primary);
}

.sample-card {
  margin-bottom: 24px;
  padding: 16px 18px;
  background: var(--bg-secondary);
  border: var(--border-thin);
  border-left: 3px solid var(--ai-primary);
  border-radius: var(--radius-md);
}

.sample-label {
  display: block;
  margin-bottom: 8px;
  color: var(--ai-secondary);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.sample-text {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.05rem;
  line-height: 1.55;
}

.sample-note {
  margin: 8px 0 0;
}

.effect-list {
  margin: 12px 0 0;
  padding-left: 18px;
  color: var(--text-secondary);
  font-size: 0.82rem;
  line-height: 1.55;
}

.effect-list li + li {
  margin-top: 6px;
}

.form-error {
  margin: 0 0 8px;
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
.tag.cunning { background: var(--ai-glow); color: var(--ai-secondary); }
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
  color: var(--text-primary);
}

.btn-edit:hover {
  background: var(--ai-glow);
  border-color: var(--ai-primary);
  color: var(--ai-primary);
}

.btn-delete:hover {
  background: rgba(229, 57, 53, 0.15);
  border-color: var(--status-error);
  color: var(--status-error);
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
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
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
.detail-actions .btn-delete,
.detail-actions .btn-copy {
  width: auto;
  height: 44px;
  padding: 0 24px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.detail-actions .btn-edit:hover {
  color: var(--ai-primary);
}

.detail-actions .btn-delete:hover {
  color: var(--status-error);
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
  background: var(--ai-glow);
  border-color: var(--ai-primary);
  box-shadow: none;
}

.personality-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.slider-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.slider-label {
  width: 140px;
  font-size: 0.88rem;
  color: var(--text-secondary);
}

.slider-hint {
  flex-basis: 100%;
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
  background: var(--ai-primary);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: none;
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
  background: var(--ai-glow);
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
  background: var(--ai-primary);
  border: none;
  border-radius: var(--radius-md);
  color: var(--on-accent);
  font-weight: 600;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
}

.btn-save:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px var(--ai-glow);
}

.btn-create:focus-visible,
.btn-edit:focus-visible,
.btn-delete:focus-visible,
.btn-copy:focus-visible,
.btn-save:focus-visible,
.btn-cancel:focus-visible,
.style-btn:focus-visible,
.list-tab:focus-visible,
.avatar-option:focus-visible {
  outline: 2px solid var(--ai-primary);
  outline-offset: 2px;
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

@media (max-width: 600px) {
  .workshop-page {
    padding: 16px 12px 24px;
  }

  .list-header,
  .detail-actions,
  .modal-actions,
  .slider-item,
  .personality-item,
  .strategy-select,
  .info-row {
    flex-wrap: wrap;
  }

  .slider-item,
  .strategy-select {
    align-items: stretch;
    flex-direction: column;
    gap: 8px;
  }

  .slider-label,
  .item-label,
  .info-label,
  .strategy-label,
  .language-label,
  .strategy-select span {
    width: auto;
  }

  .agent-detail,
  .modal-content {
    padding: 20px 16px;
  }

  .modal-overlay {
    padding: 12px;
    align-items: flex-end;
  }

  .modal-content {
    max-height: min(88dvh, 100%);
    border-radius: 16px 16px 8px 8px;
  }

  .detail-actions .btn-edit,
  .detail-actions .btn-delete,
  .detail-actions .btn-copy,
  .modal-actions .btn-cancel,
  .modal-actions .btn-save {
    width: 100%;
  }
}
</style>