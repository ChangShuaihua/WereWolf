<template>
  <div class="day-panel">
    <div class="day-message">
      <p>{{ message }}</p>
    </div>
    
    <div v-if="currentSpeaker" class="speaker-info">
      <p class="speaker-label">🎤 当前发言者:</p>
      <p class="speaker-name">{{ speakerName }}</p>
      <p v-if="isMyTurn" class="my-turn">✨ 轮到你发言了！</p>
    </div>
    
    <div v-if="isAlive" class="day-actions">
      <button v-if="isMyTurn" class="btn btn-primary" @click="$emit('next')">结束发言，下一位</button>
      <button v-if="isMyTurn" class="btn btn-secondary" @click="$emit('skip')">跳过发言</button>
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
  background: rgba(255, 255, 255, 0.9);
  padding: 20px;
  border-radius: 12px;
  color: #333;
}

.day-message {
  text-align: center;
  margin-bottom: 20px;
}

.day-message p {
  font-size: 18px;
  font-weight: bold;
  color: #eab308;
}

.speaker-info {
  text-align: center;
  padding: 15px;
  background: #fef3c7;
  border-radius: 8px;
  margin-bottom: 20px;
}

.speaker-label {
  font-size: 14px;
  color: #92400e;
  margin-bottom: 5px;
}

.speaker-name {
  font-size: 24px;
  font-weight: bold;
  color: #b45309;
  margin-bottom: 5px;
}

.my-turn {
  font-size: 16px;
  color: #16a34a;
  font-weight: bold;
}

.day-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}

.day-dead {
  text-align: center;
  padding: 20px;
}

.day-dead p {
  color: #dc2626;
  font-size: 16px;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: #fff;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #6b7280;
  color: #fff;
}

.btn-secondary:hover {
  background: #4b5563;
}

.btn-danger {
  background: #dc2626;
  color: #fff;
}

.btn-danger:hover {
  background: #b91c1c;
}
</style>