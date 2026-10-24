<template>
  <div class="profile-page">
    <header class="profile-header">
      <button class="btn btn-ai btn-sm" @click="$router.push('/lobby')">← 返回大厅</button>
      <h1>👤 个人中心</h1>
      <div class="header-spacer"></div>
    </header>

    <div class="profile-content">
      <div class="profile-card">
        <div class="profile-avatar-wrap">
          <button type="button" class="profile-avatar" :disabled="uploadingAvatar" @click="pickAvatar">
            <img v-if="userStore.user?.avatarUrl" :src="userStore.user.avatarUrl" alt="" class="avatar-photo" />
            <span v-else class="avatar-icon">{{ userStore.user?.username?.charAt(0).toUpperCase() || '?' }}</span>
            <span class="avatar-edit">{{ uploadingAvatar ? '上传中' : '更换' }}</span>
          </button>
          <input
            ref="avatarInput"
            class="avatar-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            @change="onAvatarFile"
          />
          <button v-if="userStore.user?.avatarUrl" type="button" class="avatar-reset" @click="clearAvatar">
            使用默认头像
          </button>
          <p v-if="avatarMessage" class="form-message" :class="avatarMessageType">{{ avatarMessage }}</p>
        </div>
        <div class="profile-info">
          <h2>{{ userStore.user?.username }}</h2>
          <p class="profile-id">ID: {{ userStore.user?.id }}</p>
        </div>
      </div>

      <div class="edit-card">
        <h3>✏️ 编辑资料</h3>
        
        <div class="form-group">
          <label>用户名</label>
          <input
            v-model="form.username"
            type="text"
            placeholder="输入新用户名"
            maxlength="20"
            class="form-input"
          />
          <span class="form-hint">2-20个字符，只能包含字母、数字、下划线或中文</span>
        </div>

        <div class="form-group">
          <label :for="passwordFieldId">{{ passwordLabel }}</label>
          <div class="password-row">
            <div class="password-field">
              <input
                :id="passwordFieldId"
                ref="passwordInput"
                v-model="passwordDraft"
                :type="showPassword ? 'text' : 'password'"
                class="form-input"
                :placeholder="passwordPlaceholder"
                :autocomplete="passwordStep === 'old' ? 'current-password' : 'new-password'"
                @keydown.enter.prevent="onPasswordEnter"
              />
              <button
                type="button"
                class="password-toggle"
                :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                :aria-pressed="showPassword"
                @click="showPassword = !showPassword"
              >
                <svg v-if="showPassword" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 3l18 18" />
                  <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                  <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.5 0 9.5 4.2 11 7-0.6 1.1-1.5 2.3-2.6 3.4" />
                  <path d="M6.1 6.1C4.2 7.4 2.8 9.1 2 12c1.5 2.8 5.5 7 10 7 1.3 0 2.5-.2 3.6-.7" />
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
            <button
              v-if="passwordStep !== 'confirm'"
              type="button"
              class="password-next"
              @click="advancePassword"
            >下一步</button>
          </div>
          <span class="form-hint">{{ passwordHint }}</span>
          <button
            v-if="passwordStep !== 'old'"
            type="button"
            class="password-back"
            @click="retreatPassword"
          >{{ passwordStep === 'new' ? '重新输入旧密码' : '重新输入新密码' }}</button>
        </div>

        <div v-if="message" class="form-message" :class="messageType">
          {{ message }}
        </div>

        <button
          class="btn btn-primary"
          @click="handleSave"
          :disabled="saving"
        >
          {{ saving ? '保存中...' : '保存修改' }}
        </button>

        <button class="btn btn-danger" @click="handleLogout">
          🚪 退出登录
        </button>
      </div>

      <div class="edit-card">
        <h3>AI 行为设置</h3>

        <label class="setting-row">
          <span class="setting-copy">
            <strong>启用 fallback</strong>
            <span>模型不可用、超时或输出无效时，使用本地策略和模板继续游戏。</span>
          </span>
          <input v-model="aiFallbackEnabled" class="switch-input" type="checkbox" />
          <span class="switch" aria-hidden="true"></span>
        </label>

        <div v-if="aiMessage" class="form-message" :class="aiMessageType">
          {{ aiMessage }}
        </div>

        <button class="btn btn-primary" @click="saveAISettings" :disabled="savingAISettings">
          {{ savingAISettings ? '保存中...' : '保存 AI 设置' }}
        </button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import api from '../api'
import { compressAvatar } from '../utils/avatarImage'
import { validatePassword, validateUsername } from '../utils/authRules'
import { useConfirmDialog } from '../composables/useConfirm'

const { showConfirm } = useConfirmDialog()

const router = useRouter()
const userStore = useUserStore()

const form = ref({
  username: '',
  oldPassword: '',
  password: '',
})
const passwordDraft = ref('')
const showPassword = ref(false)
const passwordStep = ref('old')
const passwordInput = ref(null)
const passwordLabel = computed(() => ({ old: '修改密码', new: '新密码', confirm: '确认新密码' }[passwordStep.value]))
const passwordPlaceholder = computed(() => ({
  old: '先输入旧密码',
  new: '再输入新密码，至少6位',
  confirm: '再输入一次新密码',
}[passwordStep.value]))
const passwordHint = computed(() => ({
  old: '输完后按回车，或点下一步',
  new: '密码至少6位，需包含字母和数字。',
  confirm: '再输入一次新密码，确认没有打错。',
}[passwordStep.value]))
const passwordFieldId = computed(() => ({ old: 'old-password', new: 'new-password', confirm: 'confirm-password' }[passwordStep.value]))

const saving = ref(false)
const message = ref('')
const messageType = ref('success')
const aiFallbackEnabled = ref(true)
const savingAISettings = ref(false)
const aiMessage = ref('')
const aiMessageType = ref('success')
const avatarInput = ref(null)
const uploadingAvatar = ref(false)
const avatarMessage = ref('')
const avatarMessageType = ref('success')

onMounted(async () => {
  if (userStore.user) {
    form.value.username = userStore.user.username
    aiFallbackEnabled.value = userStore.user.aiFallbackEnabled !== false
  }

  try {
    const { data } = await api.get('/auth/me')
    rememberUser(data.user)
    form.value.username = data.user.username
    aiFallbackEnabled.value = data.user.aiFallbackEnabled !== false
  } catch (err) {
    aiMessage.value = err.response?.data?.message || 'AI 设置加载失败'
    aiMessageType.value = 'error'
  }
})

function rememberUser(user) {
  userStore.user = { ...userStore.user, ...user }
  localStorage.setItem('werewolf_user', JSON.stringify(userStore.user))
}

function pickAvatar() {
  avatarInput.value?.click()
}

async function onAvatarFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  uploadingAvatar.value = true
  avatarMessage.value = ''
  try {
    const image = await compressAvatar(file)
    const { data } = await api.post('/auth/me/avatar', { image })
    rememberUser(data.user)
    avatarMessage.value = '头像已更新'
    avatarMessageType.value = 'success'
  } catch (err) {
    avatarMessage.value = err.response?.data?.message || err.message || '头像上传失败'
    avatarMessageType.value = 'error'
  } finally {
    uploadingAvatar.value = false
  }
}

async function clearAvatar() {
  uploadingAvatar.value = true
  avatarMessage.value = ''
  try {
    const { data } = await api.delete('/auth/me/avatar')
    rememberUser(data.user)
    avatarMessage.value = '已恢复默认头像'
    avatarMessageType.value = 'success'
  } catch (err) {
    avatarMessage.value = err.response?.data?.message || '头像移除失败'
    avatarMessageType.value = 'error'
  } finally {
    uploadingAvatar.value = false
  }
}

async function saveAISettings() {
  savingAISettings.value = true
  aiMessage.value = ''
  try {
    const { data } = await api.put('/auth/me', {
      aiFallbackEnabled: aiFallbackEnabled.value,
    })
    rememberUser(data.user)
    aiMessage.value = 'AI 设置已保存，新添加的 AI 玩家将使用该设置。'
    aiMessageType.value = 'success'
  } catch (err) {
    aiMessage.value = err.response?.data?.message || 'AI 设置保存失败'
    aiMessageType.value = 'error'
  } finally {
    savingAISettings.value = false
  }
}

function focusPassword() {
  nextTick(() => passwordInput.value?.focus())
}

function advancePassword() {
  const value = passwordDraft.value
  if (passwordStep.value === 'old') {
    if (!value) {
      message.value = '先输入旧密码'
      messageType.value = 'error'
      return false
    }
    form.value.oldPassword = value
    form.value.password = ''
    passwordDraft.value = ''
    passwordStep.value = 'new'
  } else if (passwordStep.value === 'new') {
    if (!value) {
      message.value = '请输入新密码'
      messageType.value = 'error'
      return false
    }
    const passwordErr = validatePassword(value)
    if (passwordErr) {
      message.value = passwordErr
      messageType.value = 'error'
      return false
    }
    form.value.password = value
    passwordDraft.value = ''
    passwordStep.value = 'confirm'
  }
  message.value = ''
  focusPassword()
  return true
}

function resetPasswordStep() {
  passwordStep.value = 'old'
  passwordDraft.value = ''
  form.value.oldPassword = ''
  form.value.password = ''
  focusPassword()
}

function retreatPassword() {
  if (passwordStep.value === 'confirm') {
    passwordStep.value = 'new'
    passwordDraft.value = ''
    form.value.password = ''
    message.value = ''
    focusPassword()
    return
  }
  resetPasswordStep()
}

function onPasswordEnter() {
  if (passwordStep.value !== 'confirm') advancePassword()
}

async function handleSave() {
  message.value = ''

  if (passwordStep.value === 'old' && passwordDraft.value) {
    if (advancePassword()) {
      message.value = '请继续输入新密码'
      messageType.value = 'error'
    }
    return
  }

  if (passwordStep.value === 'new') {
    if (!passwordDraft.value) {
      message.value = '请输入新密码'
      messageType.value = 'error'
      return
    }
    if (advancePassword()) {
      message.value = '请再确认一次新密码'
      messageType.value = 'error'
    }
    return
  }

  if (passwordStep.value === 'confirm') {
    if (!passwordDraft.value) {
      message.value = '请再输入一次新密码'
      messageType.value = 'error'
      return
    }
    if (passwordDraft.value !== form.value.password) {
      message.value = '两次输入的新密码不一致'
      messageType.value = 'error'
      passwordDraft.value = ''
      focusPassword()
      return
    }
  }
  
  if (!form.value.username && !form.value.password) {
    message.value = '请至少修改一项信息'
    messageType.value = 'error'
    return
  }

  if (form.value.password && !form.value.oldPassword) {
    message.value = '修改密码需要提供旧密码'
    messageType.value = 'error'
    return
  }

  if (form.value.username) {
    form.value.username = form.value.username.trim()
    const usernameErr = validateUsername(form.value.username)
    if (usernameErr) {
      message.value = usernameErr
      messageType.value = 'error'
      return
    }
  }

  saving.value = true

  try {
    const { data } = await api.put('/auth/me', {
      username: form.value.username || undefined,
      password: form.value.password || undefined,
      oldPassword: form.value.oldPassword || undefined,
    })

    rememberUser(data.user)

    message.value = '修改成功！'
    messageType.value = 'success'

    resetPasswordStep()
  } catch (err) {
    message.value = err.response?.data?.message || '修改失败'
    messageType.value = 'error'
    if (String(message.value).includes('旧密码')) resetPasswordStep()
  } finally {
    saving.value = false
  }
}

async function handleLogout() {
  const confirmed = await showConfirm({
    title: '退出确认',
    message: '确定要退出登录吗？',
    confirmText: '退出',
    cancelText: '取消',
    type: 'warning'
  });
  if (confirmed) {
    userStore.logout()
    router.push('/login')
  }
}
</script>

<style scoped>
.profile-page {
  min-height: calc(100vh - var(--header-h));
  background: transparent;
  padding: 40px var(--space-8);
  position: relative;
}

.profile-page::before {
  content: '';
  position: fixed;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(7, 10, 18, 0.46) 0%, rgba(7, 10, 18, 0.16) 40%, rgba(7, 10, 18, 0.48) 100%),
    url('/bg3.png') center 28% / cover no-repeat;
  pointer-events: none;
  z-index: 0;
}

.profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto 32px;
  position: relative;
  z-index: 1;
}

.profile-header h1 {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.header-spacer {
  width: 100px;
}

.profile-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
  position: relative;
  z-index: 1;
}

.profile-card {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: var(--border-medium);
  border-radius: var(--radius-xl);
  padding: 32px;
  display: flex;
  align-items: center;
  gap: 24px;
}

.profile-avatar-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  flex-shrink: 0;
}

.profile-avatar {
  position: relative;
  width: 80px;
  height: 80px;
  padding: 0;
  background: linear-gradient(135deg, var(--ai-primary), var(--ai-secondary));
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 24px var(--ai-glow);
  overflow: hidden;
  cursor: pointer;
}

.profile-avatar:disabled {
  cursor: progress;
}

.profile-avatar:focus-visible {
  outline: 2px solid var(--ai-primary);
  outline-offset: 3px;
}

.avatar-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-edit {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 3px 0 5px;
  background: rgba(8, 10, 15, 0.62);
  color: #fff;
  font-size: 0.68rem;
  letter-spacing: 0.04em;
}

.avatar-file {
  display: none;
}

.avatar-reset {
  padding: 0;
  background: none;
  border: none;
  color: var(--text-tertiary);
  font-size: 0.78rem;
  cursor: pointer;
}

.avatar-reset:hover {
  color: var(--text-primary);
}

.avatar-icon {
  font-size: 2rem;
  font-weight: 700;
  color: var(--on-accent);
}

.profile-info h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.profile-id {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0;
  font-family: var(--font-mono);
}

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

.edit-card h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
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
  color: rgba(255, 255, 255, 0.4);
}

.form-hint {
  font-size: 0.8rem;
  color: var(--text-tertiary);
}

.password-row {
  display: flex;
  gap: 8px;
}

.password-field {
  position: relative;
  flex: 1;
  min-width: 0;
}

.password-field .form-input {
  width: 100%;
  padding-right: 44px;
}

.password-toggle {
  position: absolute;
  top: 50%;
  right: 6px;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #e7c27a;
  cursor: pointer;
}

.password-toggle svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.password-toggle:hover,
.password-toggle:focus-visible {
  background: rgba(198, 161, 94, 0.16);
  outline: none;
}

.password-next {
  flex-shrink: 0;
  height: 44px;
  padding: 0 16px;
  background: var(--bg-secondary);
  border: var(--border-medium);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-weight: 600;
  cursor: pointer;
}

.password-next:hover,
.password-next:focus-visible {
  border-color: var(--ai-primary);
  color: var(--ai-secondary);
}

.password-back {
  align-self: flex-start;
  padding: 0;
  background: none;
  border: none;
  color: var(--text-tertiary);
  font-size: 0.78rem;
  cursor: pointer;
}

.password-back:hover,
.password-back:focus-visible {
  color: var(--text-primary);
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

.edit-card .btn {
  margin-top: 8px;
}

.edit-card .btn + .btn {
  margin-top: 12px;
}

.setting-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px;
  align-items: center;
  gap: 16px;
  cursor: pointer;
}

.setting-copy {
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: var(--text-secondary);
  font-size: 0.85rem;
  line-height: 1.5;
}

.setting-copy strong {
  color: var(--text-primary);
  font-size: 0.95rem;
}

.switch-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.switch {
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: var(--bg-tertiary);
  border: var(--border-medium);
  position: relative;
  transition: background 0.2s, border-color 0.2s;
}

.switch::after {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  top: 2px;
  left: 2px;
  border-radius: 50%;
  background: var(--text-secondary);
  transition: transform 0.2s, background 0.2s;
}

.switch-input:checked + .switch {
  background: var(--ai-primary);
  border-color: var(--ai-primary);
}

.switch-input:checked + .switch::after {
  transform: translateX(20px);
  background: white;
}

.switch-input:focus-visible + .switch {
  box-shadow: 0 0 0 3px var(--ai-glow);
}

@media (max-width: 600px) {
  .profile-page {
    padding: 20px 16px 28px;
  }

  .profile-header {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    margin-bottom: 20px;
  }

  .header-spacer {
    display: none;
  }

  .profile-header h1 {
    font-size: 1.4rem;
  }
  
  .profile-card {
    flex-direction: column;
    text-align: center;
    padding: 24px 16px;
  }

  .edit-card {
    padding: 24px 16px;
  }

  .edit-card .btn {
    width: 100%;
  }
}
</style>
