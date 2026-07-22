import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import LobbyView from '../views/LobbyView.vue'
import RoomView from '../views/RoomView.vue'
import GameView from '../views/GameView.vue'
import AIAgentWorkshop from '../views/AIAgentWorkshop.vue'
import ProfileView from '../views/ProfileView.vue'

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', name: 'Login', component: LoginView },
  { path: '/lobby', name: 'Lobby', component: LobbyView, meta: { requiresAuth: true } },
  { path: '/room/:code', name: 'Room', component: RoomView, meta: { requiresAuth: true } },
  { path: '/game/:code', name: 'Game', component: GameView, meta: { requiresAuth: true } },
  { path: '/workshop', name: 'Workshop', component: AIAgentWorkshop, meta: { requiresAuth: true } },
  { path: '/profile', name: 'Profile', component: ProfileView, meta: { requiresAuth: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Auth guard
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('werewolf_token')
  if (to.meta.requiresAuth && !token) {
    next('/login')
  } else if (to.path === '/login' && token) {
    next('/lobby')
  } else {
    next()
  }
})

export default router
