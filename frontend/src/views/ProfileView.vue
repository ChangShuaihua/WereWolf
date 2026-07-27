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

      <div class="edit-card">
        <h3>🤖 大模型API配置</h3>
        
        <div class="form-group">
          <label>API Key</label>
          <input
            v-model="apiForm.api_key"
            type="password"
            placeholder="输入大模型API Key"
            class="form-input"
          />
          <span class="form-hint">用于AI功能的API密钥</span>
        </div>

        <div class="form-group">
          <label>API URL</label>
          <input
            v-model="apiForm.api_url"
            type="text"
            placeholder="例如: https://api.openai.com/v1"
            class="form-input"
          />
          <span class="form-hint">大模型API的访问地址</span>
        </div>

        <div class="form-group">
          <label>模型名称</label>
          <input
            v-model="apiForm.model_name"
            type="text"
            placeholder="例如: gpt-4o, claude-3-5-sonnet"
            class="form-input"
          />
          <span class="form-hint">使用的模型名称</span>
        </div>

        <div v-if="apiMessage" class="form-message" :class="apiMessageType">
          {{ apiMessage }}
        </div>

        <button
          class="btn btn-primary"
          @click="handleSaveApiConfig"
          :disabled="apiSaving"
        >
          {{ apiSaving ? '保存中...' : '保存API配置' }}
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

const apiForm = ref({
  api_key: '',
  api_url: '',
  model_name: '',
})

const apiSaving = ref(false)
const apiMessage = ref('')
const apiMessageType = ref('success')

onMounted(async () => {
  if (userStore.user) {
    form.value.username = userStore.user.username
  }
  
  // Load API config
  try {
    const { data } = await api.get('/auth/api-config')
    apiForm.value = {
      api_key: data.api_key || '',
      api_url: data.api_url || '',
      model_name: data.model_name || '',
    }
  } catch (err) {
    console.error('Failed to load API config:', err)
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

async function handleSaveApiConfig() {
  apiMessage.value = ''
  apiSaving.value = true

  try {
    const { data } = await api.put('/auth/api-config', {
      api_key: apiForm.value.api_key,
      api_url: apiForm.value.api_url,
      model_name: apiForm.value.model_name,
    })

    apiForm.value = {
      api_key: data.api_key || '',
      api_url: data.api_url || '',
      model_name: data.model_name || '',
    }

    apiMessage.value = 'API配置保存成功！'
    apiMessageType.value = 'success'
  } catch (err) {
    apiMessage.value = err.response?.data?.message || '保存失败'
    apiMessageType.value = 'error'
  } finally {
    apiSaving.value = false
  }
}

function handleLogout() {
  if (confirm('确定要退出登录吗？')) {
    userStore.logout()
    router.push('/login')
  }
}
</script>
