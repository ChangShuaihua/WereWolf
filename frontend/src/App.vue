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
import { useConfirmDialog } from './composables/useConfirm'
import ConfirmDialog from './components/ConfirmDialog.vue'

const userStore = useUserStore()
const { visible: dialogVisible, state: dialogState, onConfirm: onDialogConfirm, onCancel: onDialogCancel } = useConfirmDialog()
</script>
