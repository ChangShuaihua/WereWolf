<template>
  <div class="settings-page">
    <header class="settings-header">
      <h1>⚙️ 设置</h1>
      <p class="settings-subtitle">配置你自己的大模型 API，绑定到你的账号，不影响其他玩家</p>
    </header>

    <div class="settings-content">
      <div class="status-card">
        <h3>🤖 大模型 API 状态</h3>
        <div class="status-grid">
          <div class="status-item">
            <span class="status-label">我的 Key</span>
            <span class="status-value" :class="status.ownKeySet ? 'ok' : 'muted'">
              {{ status.ownKeySet ? '✓ 已绑定' : '未绑定' }}
            </span>
          </div>
          <div class="status-item">
            <span class="status-label">可用性</span>
            <span class="status-value" :class="availabilityClass">
              {{ availabilityText }}
              <button
                v-if="status.configured && availability.state !== 'checking'"
                class="recheck-btn"
                type="button"
                @click="checkAvailability"
              >重新检测</button>
            </span>
          </div>
          <div class="status-item">
            <span class="status-label">模型</span>
            <span class="status-value">{{ status.modelName || '—' }}</span>
          </div>
          <div class="status-item">
            <span class="status-label">API 地址</span>
            <span class="status-value">{{ status.apiUrl || '—' }}</span>
          </div>
          <div class="status-item">
            <span class="status-label">API Key</span>
            <span class="status-value">{{ status.apiKeyPreview || '未设置' }}</span>
          </div>
        </div>
        <p v-if="status.source === 'user'" class="status-note">
          已使用你自己的 API Key（绑定到你的账号）。
        </p>
        <p v-else class="status-note">
          尚未配置任何 Key，AI 将使用本地策略（fallback）。
        </p>
      </div>

      <div class="edit-card">
        <h3>✏️ 大模型 API 配置</h3>
        <p class="card-desc">
          在这里填写你自己的大模型 API，配置会<strong>绑定到你的账号并保存到服务器</strong>，其他用户不受影响。
          房间里 AI 玩家使用「房主」的配置，规则问答使用「提问者」自己的配置。
        </p>

        <div class="form-group">
          <label>API Key</label>
          <input
            v-model="form.apiKey"
            type="password"
            placeholder="留空保持不变，不覆盖已保存的 Key"
            autocomplete="off"
            class="form-input"
          />
          <span class="form-hint">兼容 OpenAI 的 API Key（如 DeepSeek 等），保存到你的账号</span>
        </div>

        <div class="form-group">
          <label>快速预设（可选）</label>
          <select v-model="preset" class="form-input" @change="applyPreset">
            <option value="">选择预设，自动填充地址与模型…</option>
            <option v-for="p in PRESETS" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <span class="form-hint">选择后会自动填充下方「API 地址」和「模型名称」，仍可手动修改</span>
        </div>

        <div class="form-group">
          <label>API 地址（Base URL）</label>
          <input
            v-model="form.apiUrl"
            type="text"
            placeholder="https://api.deepseek.com"
            class="form-input"
          />
          <span class="form-hint">需以 http:// 或 https:// 开头</span>
        </div>

        <div class="form-group">
          <label>模型名称</label>
          <input
            v-model="form.modelName"
            type="text"
            placeholder="deepseek-chat"
            class="form-input"
          />
        </div>

        <div v-if="message" class="form-message" :class="messageType">
          {{ message }}
        </div>

        <div v-if="testResult" class="form-message" :class="testResult.ok ? 'success' : 'error'">
          <template v-if="testResult.ok">
            ✓ 连接成功（{{ testResult.latency }}ms）
            <span v-if="testResult.reply" class="test-reply">模型回复：{{ testResult.reply }}</span>
          </template>
          <template v-else>
            ✗ 连接失败（{{ testResult.latency }}ms）：{{ testResult.message }}
          </template>
        </div>

        <div class="btn-row">
          <button class="btn btn-primary" @click="handleSave" :disabled="saving">
            {{ saving ? '保存中...' : '保存并生效' }}
          </button>
          <button class="btn btn-secondary" @click="handleTest" :disabled="testing">
            {{ testing ? '测试中...' : '测试连接' }}
          </button>
          <button class="btn btn-secondary" @click="handleClear" :disabled="clearing">
            {{ clearing ? '清除中...' : '清除配置' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api'

const form = ref({
  apiKey: '',
  apiUrl: '',
  modelName: '',
})

// 常见 OpenAI 兼容服务商预设，选中后自动填充地址与模型名
const PRESETS = [
  { id: 'deepseek', name: 'DeepSeek', apiUrl: 'https://api.deepseek.com', modelName: 'deepseek-chat' },
  { id: 'openai', name: 'OpenAI', apiUrl: 'https://api.openai.com/v1', modelName: 'gpt-4o-mini' },
  { id: 'qwen', name: '通义千问（阿里云）', apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', modelName: 'qwen-plus' },
  { id: 'kimi', name: 'Kimi（月之暗面）', apiUrl: 'https://api.moonshot.cn/v1', modelName: 'moonshot-v1-8k' },
  { id: 'glm', name: '智谱 GLM', apiUrl: 'https://open.bigmodel.cn/api/paas/v4', modelName: 'glm-4-plus' },
]

const preset = ref('')

function applyPreset() {
  const p = PRESETS.find(x => x.id === preset.value)
  if (!p) return
  form.value.apiUrl = p.apiUrl
  form.value.modelName = p.modelName
}

const status = ref({
  configured: false,
  ownKeySet: false,
  apiKeyPreview: '',
  apiUrl: '',
  modelName: '',
  source: 'none',
})

const saving = ref(false)
const clearing = ref(false)
const testing = ref(false)
const message = ref('')
const messageType = ref('success')
const testResult = ref(null)

// 绑定模型的可用性：idle=未检测 / checking=检测中 / ok / fail
const availability = ref({ state: 'idle', latency: 0, message: '' })

const availabilityText = computed(() => {
  if (!status.value.configured) return '未配置'
  if (availability.value.state === 'checking') return '检测中…'
  if (availability.value.state === 'ok') return `✓ 可用（${availability.value.latency}ms）`
  if (availability.value.state === 'fail') return '✗ 不可用'
  return '未检测'
})

const availabilityClass = computed(() => {
  if (availability.value.state === 'ok') return 'ok'
  if (availability.value.state === 'fail') return 'error'
  return 'muted'
})

async function checkAvailability() {
  if (!status.value.configured) {
    availability.value = { state: 'idle', latency: 0, message: '' }
    return
  }
  availability.value = { state: 'checking', latency: 0, message: '' }
  try {
    // 空 body 表示检测「已保存」的配置
    const { data } = await api.post('/settings/llm/test', {})
    if (data.ok) {
      availability.value = { state: 'ok', latency: data.latency, message: data.reply || '' }
    } else {
      availability.value = { state: 'fail', latency: data.latency, message: data.message || '' }
    }
  } catch (err) {
    availability.value = { state: 'fail', latency: 0, message: err.response?.data?.message || '检测失败' }
  }
}

async function loadStatus() {
  try {
    const { data } = await api.get('/settings/llm')
    status.value = data
    form.value.apiUrl = data.apiUrl || ''
    form.value.modelName = data.modelName || ''
    form.value.apiKey = ''
    if (status.value.configured) {
      checkAvailability()
    }
  } catch (err) {
    message.value = err.response?.data?.message || '设置加载失败'
    messageType.value = 'error'
  }
}

async function handleSave() {
  saving.value = true
  message.value = ''

  if (form.value.apiUrl && !/^https?:\/\//.test(form.value.apiUrl.trim())) {
    message.value = 'API 地址需以 http:// 或 https:// 开头'
    messageType.value = 'error'
    saving.value = false
    return
  }

  try {
    const { data } = await api.put('/settings/llm', {
      apiKey: form.value.apiKey || undefined,
      apiUrl: form.value.apiUrl.trim() || undefined,
      modelName: form.value.modelName.trim() || undefined,
    })
    status.value = data
    form.value.apiKey = ''
    message.value = data.message || 'LLM 配置已更新'
    messageType.value = 'success'
    checkAvailability()
  } catch (err) {
    message.value = err.response?.data?.message || '保存失败'
    messageType.value = 'error'
  } finally {
    saving.value = false
  }
}

async function handleTest() {
  testing.value = true
  message.value = ''
  testResult.value = null

  try {
    const { data } = await api.post('/settings/llm/test', {
      apiKey: form.value.apiKey || undefined,
      apiUrl: form.value.apiUrl.trim() || undefined,
      modelName: form.value.modelName.trim() || undefined,
    })
    testResult.value = data
  } catch (err) {
    testResult.value = { ok: false, latency: 0, message: err.response?.data?.message || '测试请求失败' }
  } finally {
    testing.value = false
  }
}

async function handleClear() {
  clearing.value = true
  message.value = ''

  try {
    const { data } = await api.delete('/settings/llm')
    status.value = data
    form.value.apiUrl = data.apiUrl || ''
    form.value.modelName = data.modelName || ''
    form.value.apiKey = ''
    message.value = data.message || '已清除运行时配置'
    messageType.value = 'success'
    checkAvailability()
  } catch (err) {
    message.value = err.response?.data?.message || '清除失败'
    messageType.value = 'error'
  } finally {
    clearing.value = false
  }
}

onMounted(loadStatus)
</script>

<style scoped>
.settings-page {
  min-height: calc(100vh - 76px);
  background: var(--bg-primary);
  padding: 40px var(--space-8);
  position: relative;
}

.settings-page::before {
  content: '';
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse at 20% 0%, rgba(20, 184, 166, 0.1) 0%, transparent 40%),
    radial-gradient(ellipse at 80% 100%, rgba(59, 130, 246, 0.08) 0%, transparent 40%),
    radial-gradient(ellipse at 50% 50%, rgba(94, 234, 212, 0.05) 0%, transparent 60%);
  pointer-events: none;
  z-index: 0;
}

.settings-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 1200px;
  margin: 0 auto 24px;
  position: relative;
  z-index: 1;
}

.settings-header h1 {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.settings-subtitle {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0;
}

.settings-content {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 380px 1fr;
  align-items: stretch;
  gap: 24px;
  position: relative;
  z-index: 1;
}

.status-card,
.edit-card {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: var(--border-medium);
  border-radius: var(--radius-xl);
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.status-card h3,
.edit-card h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.status-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.status-value {
  font-size: 0.95rem;
  color: var(--text-primary);
  font-family: var(--font-mono);
  word-break: break-all;
}

.status-value.ok {
  color: var(--status-success);
}

.status-value.muted {
  color: var(--text-tertiary);
}

.status-value.error {
  color: var(--status-error);
}

.recheck-btn {
  margin-left: 10px;
  padding: 2px 10px;
  font-size: 0.75rem;
  color: var(--ai-primary);
  background: transparent;
  border: 1px solid var(--ai-primary);
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s;
}

.recheck-btn:hover {
  background: rgba(20, 184, 166, 0.12);
}

.recheck-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-note {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.card-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}

.card-desc strong {
  color: var(--text-primary);
}

.card-desc code {
  font-family: var(--font-mono);
  background: var(--bg-secondary);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.8rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-input {
  width: 100%;
  height: 44px;
  padding: 0 16px;
  background: var(--bg-secondary);
  border: var(--border-medium);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 0.95rem;
  transition: all 0.2s;
  outline: none;
}

.form-input:hover {
  border-color: var(--ai-primary);
  background: var(--bg-tertiary);
}

.form-input:focus {
  border-color: var(--ai-primary);
  box-shadow: 0 0 0 3px var(--ai-glow);
  background: var(--bg-tertiary);
}

.form-input::placeholder {
  color: var(--text-tertiary);
}

[data-theme="dark"] .form-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

[data-theme="light"] .form-input::placeholder {
  color: rgba(0, 0, 0, 0.4);
}

.form-hint {
  font-size: 0.8rem;
  color: var(--text-tertiary);
}

.form-message {
  padding: 12px 16px;
  border-radius: var(--radius-md);
  font-size: 0.9rem;
}

.form-message.success {
  background: rgba(54, 211, 153, 0.1);
  border: 1px solid rgba(54, 211, 153, 0.3);
  color: var(--status-success);
}

.form-message.error {
  background: rgba(229, 57, 53, 0.1);
  border: 1px solid rgba(229, 57, 53, 0.3);
  color: var(--status-error);
}

.test-reply {
  display: block;
  margin-top: 6px;
  font-size: 0.85rem;
  opacity: 0.85;
}

.btn-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

@media (max-width: 900px) {
  .settings-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .settings-page {
    padding: 24px 16px;
  }

  .status-grid {
    grid-template-columns: 1fr;
  }
}
</style>
