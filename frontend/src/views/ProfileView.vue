<template>
  <div class="profile-page">
    <header class="profile-header">
      <button class="btn btn-sm" @click="$router.push('/lobby')">← 返回大厅</button>
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
          <div class="profile-stats">
            <div class="stat-item">
              <span class="stat-value">{{ userStore.user?.wins || 0 }}</span>
              <span class="stat-label">胜利</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ userStore.user?.losses || 0 }}</span>
              <span class="stat-label">失败</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ userStore.user?.score || 0 }}</span>
              <span class="stat-label">积分</span>
            </div>
          </div>
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

function handleLogout() {
  if (confirm('确定要退出登录吗？')) {
    userStore.logout()
    router.push('/login')
  }
}
</script>
