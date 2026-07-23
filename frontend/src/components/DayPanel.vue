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
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
  padding: 24px;
  border-radius: 16px;
  border: 1px solid rgba(251, 191, 36, 0.2);
  box-shadow: 0 4px 20px rgba(251, 191, 36, 0.1);
}

.day-message {
  text-align: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.day-message p {
  font-size: 16px;
  font-weight: 600;
  color: #fbbf24;
  letter-spacing: 0.5px;
}

.speaker-info {
  text-align: center;
  padding: 24px 20px;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.1));
  border-radius: 12px;
  margin-bottom: 20px;
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.speaker-label {
  font-size: 13px;
  color: #fbbf24;
  margin-bottom: 8px;
  opacity: 0.8;
}

.speaker-name {
  font-size: 28px;
  font-weight: 700;
  color: #fde047;
  margin-bottom: 8px;
  text-shadow: 0 0 20px rgba(251, 191, 36, 0.3);
}

.my-turn {
  font-size: 15px;
  color: #22c55e;
  font-weight: 600;
  padding: 6px 12px;
  background: rgba(34, 197, 94, 0.15);
  border-radius: 20px;
  display: inline-block;
}

.wait-hint {
  font-size: 14px;
  color: #94a3b8;
  margin: 0;
}

.day-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.day-actions .btn {
  width: 100%;
  max-width: 200px;
}

.day-dead {
  text-align: center;
  padding: 16px;
}

.day-dead p {
  color: #ef4444;
  font-size: 14px;
  font-style: italic;
  opacity: 0.8;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff;
  box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
}

.btn-primary:hover {
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
}

.btn-ghost {
  background: transparent;
  color: #94a3b8;
  border: 1px solid rgba(148, 163, 184, 0.3);
}

.btn-ghost:hover {
  background: rgba(148, 163, 184, 0.1);
  color: #e2e8f0;
  border-color: rgba(148, 163, 184, 0.5);
}
</style>