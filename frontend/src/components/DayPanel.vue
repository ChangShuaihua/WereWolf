<template>
  <div class="day-panel">
    <div class="day-message">
      <p>{{ message }}</p>
    </div>
    
    <div v-if="currentSpeaker" class="speaker-info">
      <p class="speaker-label">🎤 当前发言者</p>
      <p class="speaker-name">{{ speakerName }}</p>
      <p v-if="isMyTurn" class="my-turn">✨ 轮到你发言了！</p>
      <p v-else class="wait-hint">请耐心等待...</p>
    </div>
    
    <div v-if="isAlive" class="day-actions">
      <button v-if="isMyTurn" class="btn btn-primary" @click="$emit('next')">结束发言，下一位</button>
      <button v-if="isMyTurn" class="btn btn-ghost" @click="$emit('skip')">跳过发言</button>
    </div>
    <div v-else class="day-dead">
      <p>💀 你已死亡，请观看游戏</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  message: { type: String, default: '' },
  isAlive: { type: Boolean, default: true },
  currentSpeaker: { type: String, default: null },
  speakerName: { type: String, default: '' },
  mySocketId: { type: String, default: '' },
})

defineEmits(['skip', 'next', 'skipDay'])

const isMyTurn = computed(() => props.currentSpeaker === props.mySocketId)
</script>

<style scoped>
.day-panel {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  padding: 14px;
  border-radius: 16px;
  border: var(--border-medium);
  box-shadow: var(--shadow-md);
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  max-height: 100%;
}

.day-message {
  text-align: center;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-thin);
}

.day-message p {
  font-size: 14px;
  font-weight: 600;
  color: var(--status-warning);
  letter-spacing: 0.5px;
}

.speaker-info {
  text-align: center;
  padding: 8px;
  background: rgba(251, 191, 36, 0.1);
  border-radius: 10px;
  margin-bottom: 12px;
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.speaker-label {
  font-size: 12px;
  color: var(--status-warning);
  margin-bottom: 4px;
  opacity: 0.8;
}

.speaker-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--status-warning);
  margin-bottom: 4px;
  text-shadow: 0 0 16px rgba(251, 191, 36, 0.3);
}

.my-turn {
  font-size: 13px;
  color: var(--status-success);
  font-weight: 600;
  padding: 4px 10px;
  background: rgba(52, 211, 153, 0.15);
  border-radius: 16px;
  display: inline-block;
}

.wait-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 0;
}

.day-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.day-actions .btn {
  width: 100%;
  max-width: 180px;
  height: 38px;
  font-size: 13px;
}

.day-dead {
  text-align: center;
  padding: 12px;
}

.day-dead p {
  color: var(--status-error);
  font-size: 13px;
  font-style: italic;
  opacity: 0.8;
}

.btn {
  padding: 8px 20px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, var(--villager-primary), var(--villager-secondary));
  color: white;
  box-shadow: 0 4px 14px var(--villager-glow);
}

.btn-primary:hover {
  background: linear-gradient(135deg, var(--villager-light), var(--villager-primary));
  transform: translateY(-1px);
  box-shadow: 0 6px 20px var(--villager-glow);
}

.btn-ghost {
  background: transparent;
  color: var(--text-tertiary);
  border: var(--border-medium);
}

.btn-ghost:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}
</style>