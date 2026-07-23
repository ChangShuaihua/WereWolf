<template>
  <div class="hunter-panel">
    <div v-if="!prompt" class="hunter-waiting">
      <p>🔫 等待猎人行动提示...</p>
    </div>

    <div v-else-if="actionDone" class="action-done">
      <p class="action-message">✅ 你的开枪已确认</p>
      <div class="confirmed-info">
        <p>🔫 开枪带走了 <strong>{{ completedTargetName }}</strong></p>
      </div>
    </div>

    <div v-else class="hunter-actions">
      <p class="action-message">🔫 {{ prompt.message }}</p>
      <div class="target-grid">
        <button
          v-for="t in prompt.targets"
          :key="t.id"
          class="btn btn-target"
          :class="{ selected: selectedTarget === t.id, disabled: actionDone }"
          :disabled="actionDone"
          @click="selectTarget(t.id)"
        >
          {{ t.username }}
        </button>
        <div v-if="selectedTarget" class="action-confirm">
          <button class="btn btn-danger" @click="confirmAction">🔫 确认开枪</button>
          <button class="btn btn-secondary" @click="selectedTarget = null">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  prompt: { type: Object, default: null },
})

const emit = defineEmits(['shoot'])

const selectedTarget = ref(null)
const actionDone = ref(false)

const completedTargetName = computed(() => {
  if (!props.prompt?.targets || !selectedTarget.value) return ''
  const target = props.prompt.targets.find(t => t.id === selectedTarget.value)
  return target?.username || ''
})

function selectTarget(targetId) {
  if (actionDone.value) return
  selectedTarget.value = selectedTarget.value === targetId ? null : targetId
}

function confirmAction() {
  emit('shoot', selectedTarget.value)
  actionDone.value = true
}
</script>

<style scoped>
.hunter-panel {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
  padding: 24px;
  border-radius: 16px;
  color: #fff;
  border: 1px solid rgba(239, 68, 68, 0.2);
  box-shadow: 0 4px 20px rgba(239, 68, 68, 0.1);
}

.hunter-waiting {
  text-align: center;
  padding: 24px;
  color: #cbd5e1;
}

.action-done {
  text-align: center;
  padding: 24px;
}

.action-done .action-message {
  font-size: 18px;
  margin-bottom: 16px;
  color: #4ade80;
}

.confirmed-info {
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
  border-radius: 12px;
  padding: 16px;
}

.confirmed-info p {
  margin: 6px 0;
  font-size: 15px;
}

.confirmed-info strong {
  color: #4ade80;
}

.action-message {
  font-size: 15px;
  margin-bottom: 16px;
  text-align: center;
  color: #e2e8f0;
}

.target-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.btn-target {
  padding: 10px 18px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 10px;
  background: rgba(51, 65, 85, 0.5);
  color: #e2e8f0;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}

.btn-target:hover:not(:disabled) {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.15);
}

.btn-target.selected {
  border-color: #ef4444;
  background: #ef4444;
  color: #fff;
  font-weight: 600;
}

.btn-target.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-confirm {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 20px;
  width: 100%;
}

.btn-danger {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #fff;
  border: none;
  padding: 10px 24px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-danger:hover {
  background: linear-gradient(135deg, #f87171, #ef4444);
  transform: translateY(-1px);
}

.btn-secondary {
  background: rgba(100, 116, 139, 0.5);
  color: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 10px 24px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: rgba(100, 116, 139, 0.7);
  color: #f8fafc;
}
</style>
