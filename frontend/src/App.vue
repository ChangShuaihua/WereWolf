<template>
  <div id="app">
    <header class="app-header" v-if="userStore.user && $route.path !== '/login'">
      <div class="header-brand">
        <span class="brand-icon">🐺</span>
        <span class="brand-text">狼人杀</span>
      </div>
      <nav class="header-tabs">
        <router-link to="/lobby" class="tab-item" active-class="tab-active">
          <span class="tab-icon">🏠</span>
          <span class="tab-text">大厅</span>
        </router-link>
        <router-link to="/workshop" class="tab-item" active-class="tab-active">
          <span class="tab-icon">🤖</span>
          <span class="tab-text">AI工坊</span>
        </router-link>
      </nav>
      <div class="header-user">
        <router-link to="/profile" class="user-link">
          <span class="user-icon">👤</span>
          <span class="user-name">{{ userStore.user.username }}</span>
        </router-link>
      </div>
    </header>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { useUserStore } from './stores/user'

const userStore = useUserStore()
</script>
