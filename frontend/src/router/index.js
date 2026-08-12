import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import LobbyView from '../views/LobbyView.vue'
import RoomView from '../views/RoomView.vue'
import GameView from '../views/GameView.vue'
import AIAgentWorkshop from '../views/AIAgentWorkshop.vue'
import ProfileView from '../views/ProfileView.vue'
import ReplayView from '../views/ReplayView.vue'
import StatsView from '../views/StatsView.vue'

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', name: 'Login', component: LoginView },
  { path: '/lobby', name: 'Lobby', component: LobbyView, meta: { requiresAuth: true } },
  { path: '/room/:code', name: 'Room', component: RoomView, meta: { requiresAuth: true } },
  { path: '/game/:code', name: 'Game', component: GameView, meta: { requiresAuth: true } },
  { path: '/workshop', name: 'Workshop', component: AIAgentWorkshop, meta: { requiresAuth: true } },
  { path: '/profile', name: 'Profile', component: ProfileView, meta: { requiresAuth: true } },
  { path: '/stats', name: 'Stats', component: StatsView, meta: { requiresAuth: true } },
  { path: '/replay/:id', name: 'Replay', component: ReplayView, meta: { requiresAuth: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// W24: 通过解析 JWT payload 的 exp 字段判断 token 是否过期
function isTokenExpired(token) {
  if (!token) return true
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return true
    // base64url -> base64
    let payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    // 补齐 padding
    while (payloadB64.length % 4) payloadB64 += '='
    const payload = JSON.parse(atob(payloadB64))
    if (!payload || typeof payload.exp !== 'number') return false
    // 提前 30s 判定过期，避免边界请求失败
    const nowSec = Math.floor(Date.now() / 1000)
    return payload.exp < nowSec + 30
  } catch (e) {
    // 解析失败视为过期，强制重新登录
    return true
  }
}

// Auth guard
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('werewolf_token')
  const expired = isTokenExpired(token)
  // W24: token 过期视为未登录
  if (to.meta.requiresAuth && (!token || expired)) {
    if (expired && token) {
      localStorage.removeItem('werewolf_token')
      localStorage.removeItem('werewolf_user')
    }
    next('/login')
  } else if (to.path === '/login' && token && !expired) {
    // Check for saved room code to auto-rejoin after refresh
    const savedRoomCode = localStorage.getItem('werewolf_room_code')
    if (savedRoomCode) {
      next(`/room/${savedRoomCode}`)
    } else {
      next('/lobby')
    }
  } else {
    next()
  }
})

export default router
