<template>
  <div id="app">
    <header class="app-header">
      <h1 @click="$router.push('/lobby')">🐺 狼人杀</h1>
      <div class="header-right" v-if="userStore.user">
        <span class="user-info">{{ userStore.user.username }}</span>
        <button class="btn btn-sm" @click="logout">退出</button>
      </div>
    </header>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { useUserStore } from './stores/user'
import { useRouter } from 'vue-router'

const userStore = useUserStore()
const router = useRouter()

function logout() {
  userStore.logout()
  router.push('/login')
}
</script>
