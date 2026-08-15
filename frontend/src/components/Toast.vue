<template>
  <Teleport to="body">
    <TransitionGroup name="toast" tag="div" class="toast-container">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="toast"
        :class="`toast-${t.type}`"
        @click="dismissToast(t.id)"
      >
        <span class="toast-icon">{{ icon(t.type) }}</span>
        <span class="toast-text">{{ t.message }}</span>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup>
import { useToast } from '../composables/useToast'

const { toasts, dismissToast } = useToast()

function icon(type) {
  const map = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' }
  return map[type] || 'ℹ️'
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  z-index: 3000;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 480px;
  padding: 12px 20px;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: var(--border-medium);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  pointer-events: auto;
  cursor: pointer;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.toast-success { border-color: rgba(54, 211, 153, 0.4); }
.toast-error { border-color: rgba(229, 57, 53, 0.4); }
.toast-warning { border-color: rgba(245, 185, 66, 0.4); }
.toast-info { border-color: rgba(155, 109, 255, 0.4); }

.toast-icon {
  font-size: 1.1rem;
  line-height: 1;
}

.toast-text {
  line-height: 1.5;
  word-break: break-word;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-16px);
}
</style>
