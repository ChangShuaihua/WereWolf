<template>
  <div class="day-panel">
    <div class="day-message">
      <p>{{ message }}</p>
    </div>
    <div v-if="isAlive" class="day-actions">
      <p>☀️ 自由讨论阶段，请在聊天区发言</p>
      <button class="btn btn-secondary" @click="$emit('skip')">跳过讨论，进入投票</button>
    </div>
    <div v-else class="day-dead">
      <p>💀 你已死亡，请观看游戏</p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  message: { type: String, default: '' },
  isAlive: { type: Boolean, default: true },
})

defineEmits(['skip'])
</script>
