<template>
  <div id="app">
    <header class="app-header" v-if="showChrome">
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
        <router-link to="/stats" class="tab-item" active-class="tab-active">
          <span class="tab-icon">🏆</span>
          <span class="tab-text">战绩</span>
        </router-link>
        <router-link to="/settings" class="tab-item" active-class="tab-active">
          <span class="tab-icon">⚙️</span>
          <span class="tab-text">设置</span>
        </router-link>
      </nav>
      <div class="header-user">
        <button class="theme-toggle-btn" @click="themeStore.toggleTheme()" :title="themeStore.isDark ? '切换到亮色模式' : '切换到暗色模式'">
          <span v-if="themeStore.isDark" class="theme-icon">☀️</span>
          <span v-else class="theme-icon">🌙</span>
        </button>
        <router-link to="/profile" class="user-link">
          <img v-if="userStore.user.avatarUrl" :src="userStore.user.avatarUrl" alt="" class="user-avatar" />
          <span v-else class="user-icon">👤</span>
          <span class="user-name">{{ userStore.user.username }}</span>
        </router-link>
      </div>
    </header>
    <main class="app-main" :class="{ 'page-scroll': isScrollablePage }">
      <router-view />
    </main>
    <nav v-if="showChrome" class="mobile-tabbar" aria-label="页面导航">
      <router-link to="/lobby" class="mobile-tab" active-class="mobile-tab-active">
        <span class="mobile-tab-icon">🏠</span>
        <span>大厅</span>
      </router-link>
      <router-link to="/workshop" class="mobile-tab" active-class="mobile-tab-active">
        <span class="mobile-tab-icon">🤖</span>
        <span>AI工坊</span>
      </router-link>
      <router-link to="/stats" class="mobile-tab" active-class="mobile-tab-active">
        <span class="mobile-tab-icon">🏆</span>
        <span>战绩</span>
      </router-link>
      <router-link to="/settings" class="mobile-tab" active-class="mobile-tab-active">
        <span class="mobile-tab-icon">⚙️</span>
        <span>设置</span>
      </router-link>
    </nav>
    <Toast />
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
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from './stores/user'
import { useThemeStore } from './stores/theme'
import { useConfirmDialog } from './composables/useConfirm'
import ConfirmDialog from './components/ConfirmDialog.vue'
import Toast from './components/Toast.vue'

const route = useRoute()
const userStore = useUserStore()
const themeStore = useThemeStore()
const { visible: dialogVisible, state: dialogState, onConfirm: onDialogConfirm, onCancel: onDialogCancel } = useConfirmDialog()

// 游戏页面和房间页面不需要外部滚动
const isScrollablePage = computed(() => {
  const path = route.path
  return !path.startsWith('/game') && !path.startsWith('/room')
})

const showChrome = computed(() => {
  const path = route.path
  return !!userStore.user && path !== '/login' && !path.startsWith('/room') && !path.startsWith('/game')
})
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

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
}

.mobile-tabbar {
  display: none;
}

@media (max-width: 768px) {
  .mobile-tabbar {
    display: flex;
    flex-shrink: 0;
    height: calc(56px + env(safe-area-inset-bottom, 0px));
    padding-bottom: env(safe-area-inset-bottom, 0px);
    background: var(--glass-bg);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    border-top: var(--border-thin);
    z-index: 100;
  }

  .mobile-tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 48px;
    text-decoration: none;
    color: var(--text-secondary);
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    box-shadow: inset 0 2px 0 transparent;
  }

  .mobile-tab-icon {
    font-size: 1.15rem;
    line-height: 1;
  }

  .mobile-tab-active {
    color: var(--ai-primary);
    box-shadow: inset 0 2px 0 var(--ai-primary);
  }
}
</style>
