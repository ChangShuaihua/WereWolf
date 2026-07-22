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
  background: rgba(0, 0, 0, 0.8);
  padding: 20px;
  border-radius: 12px;
  color: #fff;
}

.hunter-waiting {
  text-align: center;
  padding: 40px;
}

.action-done {
  text-align: center;
  padding: 30px;
}

.action-done .action-message {
  font-size: 20px;
  margin-bottom: 15px;
  color: #4ade80;
}

.confirmed-info {
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
  border-radius: 8px;
  padding: 15px;
}

.confirmed-info p {
  margin: 5px 0;
  font-size: 16px;
}

.confirmed-info strong {
  color: #4ade80;
}

.action-message {
  font-size: 16px;
  margin-bottom: 20px;
  text-align: center;
}

.target-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.btn-target {
  padding: 10px 20px;
  border: 2px solid #ddd;
  border-radius: 8px;
  background: #333;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-target:hover:not(:disabled) {
  border-color: #ff6b6b;
  background: #444;
}

.btn-target.selected {
  border-color: #ff6b6b;
  background: #ff6b6b;
  color: #000;
  font-weight: bold;
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
  background: #dc2626;
  color: #fff;
  border: none;
  padding: 12px 30px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}

.btn-danger:hover {
  background: #b91c1c;
}

.btn-secondary {
  background: #6b7280;
  color: #fff;
  border: none;
  padding: 12px 30px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}

.btn-secondary:hover {
  background: #4b5563;
}
</style>
