import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '../utils/auth'

export const useUserStore = defineStore('user', () => {
  const user = ref(JSON.parse(localStorage.getItem('werewolf_user') || 'null'))
  const token = ref(getAccessToken())

  const isLoggedIn = computed(() => !!token.value)

  async function login(username, password) {
    const { data } = await api.post('/auth/login', { username, password })
    token.value = data.accessToken
    user.value = data.user
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
    localStorage.setItem('werewolf_user', JSON.stringify(data.user))
    return data.user
  }

  async function register(username, password) {
    const { data } = await api.post('/auth/register', { username, password })
    token.value = data.accessToken
    user.value = data.user
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
    localStorage.setItem('werewolf_user', JSON.stringify(data.user))
    return data.user
  }

  async function logout() {
    const refreshToken = getRefreshToken()
    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken })
      }
    } catch (e) {
      // 撤销失败不阻塞本地登出
    }
    token.value = ''
    user.value = null
    clearTokens()
  }

  return { user, token, isLoggedIn, login, register, logout }
})
