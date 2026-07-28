<template>
  <div class="profile-page">
    <header class="profile-header">
      <button class="btn btn-ai btn-sm" @click="$router.push('/lobby')">← 返回大厅</button>
      <h1>👤 个人中心</h1>
      <div class="header-spacer"></div>
    </header>

    <div class="profile-content">
      <div class="profile-card">
        <div class="profile-avatar">
          <span class="avatar-icon">{{ userStore.user?.username?.charAt(0).toUpperCase() || '?' }}</span>
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
          <span class="form-hint">用户名长度2-20个字符</span>
        </div>

        <div class="form-group">
          <label>旧密码</label>
          <input
            v-model="form.oldPassword"
            type="password"
            placeholder="输入旧密码（修改密码时必填）"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label>新密码</label>
          <input
            v-model="form.password"
            type="password"
            placeholder="输入新密码（至少6位）"
            class="form-input"
          />
          <span class="form-hint">密码长度至少6位</span>
        </div>

        <div class="form-group">
          <label>确认新密码</label>
          <input
            v-model="form.confirmPassword"
            type="password"
            placeholder="再次输入新密码"
            class="form-input"
          />
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

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import api from '../api'
import { useConfirmDialog } from '../composables/useConfirm'

const { showConfirm } = useConfirmDialog()

const router = useRouter()
const userStore = useUserStore()

const form = ref({
  username: '',
  oldPassword: '',
  password: '',
  confirmPassword: '',
})

const saving = ref(false)
const message = ref('')
const messageType = ref('success')

onMounted(() => {
  if (userStore.user) {
    form.value.username = userStore.user.username
  }
})

async function handleSave() {
  message.value = ''
  
  if (!form.value.username && !form.value.password) {
    message.value = '请至少修改一项信息'
    messageType.value = 'error'
    return
  }

  if (form.value.password) {
    if (!form.value.oldPassword) {
      message.value = '修改密码需要提供旧密码'
      messageType.value = 'error'
      return
    }
    if (form.value.password.length < 6) {
      message.value = '密码长度至少6位'
      messageType.value = 'error'
      return
    }
    if (form.value.password !== form.value.confirmPassword) {
      message.value = '两次输入的密码不一致'
      messageType.value = 'error'
      return
    }
  }

  if (form.value.username) {
    if (form.value.username.length < 2 || form.value.username.length > 20) {
      message.value = '用户名长度应为2-20个字符'
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

    userStore.user = data.user
    localStorage.setItem('werewolf_user', JSON.stringify(data.user))

    message.value = '修改成功！'
    messageType.value = 'success'

    form.value.oldPassword = ''
    form.value.password = ''
    form.value.confirmPassword = ''
  } catch (err) {
    message.value = err.response?.data?.message || '修改失败'
    messageType.value = 'error'
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
  min-height: calc(100vh - 76px);
  background: var(--bg-primary);
  padding: 40px var(--space-8);
  position: relative;
}

.profile-page::before {
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

.profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 800px;
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
  max-width: 800px;
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

.profile-avatar {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, var(--ai-primary), var(--ai-secondary));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 24px var(--ai-glow);
  flex-shrink: 0;
}

.avatar-icon {
  font-size: 2rem;
  font-weight: 700;
  color: white;
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

.edit-card .btn {
  margin-top: 8px;
}

.edit-card .btn + .btn {
  margin-top: 12px;
}

@media (max-width: 600px) {
  .profile-page {
    padding: 24px 16px;
  }
  
  .profile-card {
    flex-direction: column;
    text-align: center;
  }
}
</style>
