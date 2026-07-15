<template>
  <div class="overlay">
    <div class="result-card">
      <div class="result-icon">{{ result?.winner === 'werewolf' ? '🐺' : '👨‍🌾' }}</div>
      <h1>{{ result?.winner === 'werewolf' ? '狼人阵营获胜！' : '村民阵营获胜！' }}</h1>
      <p class="result-msg">{{ result?.message }}</p>
      <p class="result-duration">游戏时长: {{ formatDuration(result?.duration || 0) }}</p>

      <div class="result-players">
        <div v-for="p in result?.players || []" :key="p.id" class="result-player" :class="{ winner: p.isWinner }">
          <span class="rp-name">{{ p.username }}</span>
          <span class="rp-role">{{ p.roleName }}</span>
          <span class="rp-status">{{ p.isAlive ? '存活' : '死亡' }}</span>
          <span class="rp-result">{{ p.isWinner ? '🏆' : '❌' }}</span>
        </div>
      </div>

      <div class="result-actions">
        <button class="btn btn-primary" @click="$emit('returnRoom')">🏠 返回房间</button>
        <button class="btn btn-secondary" @click="$emit('back')">🏃 返回大厅</button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  result: { type: Object, default: null },
})

defineEmits(['back', 'returnRoom'])

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}分${s}秒`
}
</script>
