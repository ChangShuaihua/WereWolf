<template>
  <div class="settings-page">
    <header class="settings-header">
      <button class="btn btn-ai btn-sm" @click="$router.push('/lobby')">← 返回大厅</button>
      <h1>⚙️ 设置</h1>
      <div class="header-spacer"></div>
    </header>

    <div class="settings-content">
      <div class="status-card">
        <h3>🤖 大模型 API 状态</h3>
        <div class="status-grid">
          <div class="status-item">
            <span class="status-label">配置状态</span>
            <span class="status-value" :class="status.configured ? 'ok' : 'muted'">
              {{ status.configured ? '✓ 已配置' : '未配置' }}
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
        <p v-if="status.runtimeOverride" class="status-note">
          当前使用运行时配置（仅内存，重启后失效）。
        </p>
      </div>

      <div class="edit-card">
        <h3>✏️ 大模型 API 配置</h3>
        <p class="card-desc">
          在这里填写你希望调用的大模型 API。配置仅保存在服务器内存中，
          <strong>不会写入数据库或本地文件</strong>，服务重启后即失效并回退到 <code>.env</code> 默认值。
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
          <span class="form-hint">兼容 OpenAI 的 API Key（如 MiMo、DeepSeek 等），仅在内存中保存</span>
        </div>

        <div class="form-group">
          <label>API 地址（Base URL）</label>
          <input
            v-model="form.apiUrl"
            type="text"
            placeholder="https://api.xiaomimimo.com"
            class="form-input"
          />
          <span class="form-hint">需以 http:// 或 https:// 开头</span>
        </div>

        <div class="form-group">
          <label>模型名称</label>
          <input
            v-model="form.modelName"
            type="text"
            placeholder="mimo-v2-flash"
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
import { ref, onMounted } from 'vue'
import api from '../api'

const form = ref({
  apiKey: '',
  apiUrl: '',
  modelName: '',
})

const status = ref({
  configured: false,
  apiKeySet: false,
  apiKeyPreview: '',
  apiUrl: '',
  modelName: '',
  runtimeOverride: false,
})

const saving = ref(false)
const clearing = ref(false)
const testing = ref(false)
const message = ref('')
const messageType = ref('success')
const testResult = ref(null)

async function loadStatus() {
  try {
    const { data } = await api.get('/settings/llm')
    status.value = data
    form.value.apiUrl = data.apiUrl || ''
    form.value.modelName = data.modelName || ''
    form.value.apiKey = ''
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
  justify-content: space-between;
  align-items: center;
  max-width: 800px;
  margin: 0 auto 32px;
  position: relative;
  z-index: 1;
}

.settings-header h1 {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.header-spacer {
  width: 100px;
}

.settings-content {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
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

@media (max-width: 600px) {
  .settings-page {
    padding: 24px 16px;
  }

  .status-grid {
    grid-template-columns: 1fr;
  }
}
</style>
