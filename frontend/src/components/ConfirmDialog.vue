<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="visible" class="confirm-overlay" @click.self="handleCancel">
        <div class="confirm-dialog" :class="`dialog-${type}`">
          <div class="dialog-icon">
            <span v-if="type === 'success'">✅</span>
            <span v-else-if="type === 'warning'">⚠️</span>
            <span v-else-if="type === 'error'">❌</span>
            <span v-else-if="type === 'info'">ℹ️</span>
            <span v-else>❓</span>
          </div>
          <h3 class="dialog-title">{{ title }}</h3>
          <p class="dialog-message">{{ message }}</p>
          <div class="dialog-actions">
            <button v-if="showCancel" class="dialog-btn btn-cancel" @click="handleCancel">
              {{ cancelText }}
            </button>
            <button class="dialog-btn btn-confirm" :class="`btn-${type}`" @click="handleConfirm">
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '提示'
  },
  message: {
    type: String,
    default: ''
  },
  confirmText: {
    type: String,
    default: '确定'
  },
  cancelText: {
    type: String,
    default: '取消'
  },
  showCancel: {
    type: Boolean,
    default: true
  },
  type: {
    type: String,
    default: 'info',
    validator: (v) => ['success', 'warning', 'error', 'info'].includes(v)
  }
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

function handleConfirm() {
  emit('confirm')
  visible.value = false
}

function handleCancel() {
  emit('cancel')
  visible.value = false
}
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(8, 10, 15, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 24px;
}

.confirm-dialog {
  width: 100%;
  max-width: 420px;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: var(--border-medium);
  border-radius: var(--radius-xl);
  padding: 32px;
  text-align: center;
  animation: dialog-pop 0.3s ease-out;
}

@keyframes dialog-pop {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.25s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-icon {
  font-size: 3rem;
  margin-bottom: 16px;
  line-height: 1;
}

.dialog-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 12px;
}

.dialog-message {
  font-size: 0.95rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0 0 28px;
  white-space: pre-line;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.dialog-btn {
  flex: 1;
  max-width: 140px;
  padding: 12px 24px;
  font-size: 0.95rem;
  font-weight: 600;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: var(--font-sans);
}

.btn-cancel {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: var(--border-medium);
}

.btn-cancel:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.btn-confirm {
  color: white;
}

.btn-confirm.btn-success {
  background: linear-gradient(135deg, #36D399, #059669);
  box-shadow: 0 4px 16px rgba(54, 211, 153, 0.3);
}

.btn-confirm.btn-success:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(54, 211, 153, 0.4);
}

.btn-confirm.btn-warning {
  background: linear-gradient(135deg, #F5B942, #D97706);
  box-shadow: 0 4px 16px rgba(245, 185, 66, 0.3);
}

.btn-confirm.btn-warning:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(245, 185, 66, 0.4);
}

.btn-confirm.btn-error {
  background: linear-gradient(135deg, #E53935, #B91C1C);
  box-shadow: 0 4px 16px rgba(229, 57, 53, 0.3);
}

.btn-confirm.btn-error:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(229, 57, 53, 0.4);
}

.btn-confirm.btn-info {
  background: linear-gradient(135deg, var(--villager-primary), var(--villager-secondary));
  box-shadow: 0 4px 16px var(--villager-glow);
}

.btn-confirm.btn-info:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px var(--villager-glow);
}

.dialog-warning .dialog-icon {
  animation: shake 0.5s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
</style>
