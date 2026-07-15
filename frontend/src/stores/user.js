import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api'

export const useUserStore = defineStore('user', () => {
  const user = ref(JSON.parse(localStorage.getItem('werewolf_user') || 'null'))
  const token = ref(localStorage.getItem('werewolf_token') || '')

  const isLoggedIn = computed(() => !!token.value)

  async function login(username, password) {
    const { data } = await api.post('/auth/login', { username, password })
    token.value = data.token
    user.value = data.user
    localStorage.setItem('werewolf_token', data.token)
    localStorage.setItem('werewolf_user', JSON.stringify(data.user))
    return data.user
  }

  async function register(username, password) {
    const { data } = await api.post('/auth/register', { username, password })
    token.value = data.token
    user.value = data.user
    localStorage.setItem('werewolf_token', data.token)
    localStorage.setItem('werewolf_user', JSON.stringify(data.user))
    return data.user
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('werewolf_token')
    localStorage.removeItem('werewolf_user')
  }

  return { user, token, isLoggedIn, login, register, logout }
})
