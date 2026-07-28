<template>
  <div id="app">
    <header class="app-header" v-if="userStore.user && $route.path !== '/login' && !$route.path.startsWith('/room') && !$route.path.startsWith('/game')">
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
        <button class="theme-toggle-btn" @click="themeStore.toggleTheme()" :title="themeStore.isDark ? '切换到亮色模式' : '切换到暗色模式'">
          <span v-if="themeStore.isDark" class="theme-icon">☀️</span>
          <span v-else class="theme-icon">🌙</span>
        </button>
        <router-link to="/profile" class="user-link">
          <span class="user-icon">👤</span>
          <span class="user-name">{{ userStore.user.username }}</span>
        </router-link>
      </div>
    </header>
    <main class="app-main">
      <router-view />
    </main>
    <ConfirmDialog
      v-model="dialogVisible"
      :title="dialogState.title"
      :message="dialogState.message"
      :confirm-text="dialogState.confirmText"
      :cancel-text="dialogState.cancelText"
      :show-cancel="dialogState.showCancel"
      :type="dialogState.type"
      @confirm="onDialogConfirm"
      @cancel="onDialogCancel"
    />
  </div>
</template>

<script setup>
import { useUserStore } from './stores/user'
import { useThemeStore } from './stores/theme'
import { useConfirmDialog } from './composables/useConfirm'
import ConfirmDialog from './components/ConfirmDialog.vue'

const userStore = useUserStore()
const themeStore = useThemeStore()
const { visible: dialogVisible, state: dialogState, onConfirm: onDialogConfirm, onCancel: onDialogCancel } = useConfirmDialog()
</script>

<style scoped>
.theme-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: var(--border-thin);
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 0;
}

.theme-toggle-btn:hover {
  background: var(--bg-tertiary);
  transform: scale(1.1);
}

.theme-toggle-btn:active {
  transform: scale(0.95);
}

.theme-icon {
  font-size: 1.1rem;
  transition: transform 0.3s ease;
}
</style>
