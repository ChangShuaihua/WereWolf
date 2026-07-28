<template>
  <div class="game-result-overlay">
    <div class="game-result-card" :class="{ victory: isVictory, defeat: !isVictory }">
      <div class="result-badge" :class="{ victory: isVictory, defeat: !isVictory }">
        <span class="result-icon">{{ result?.winner === 'werewolf' ? '🐺' : '👨‍🌾' }}</span>
      </div>
      <h1 class="result-title">{{ result?.winner === 'werewolf' ? '狼人阵营获胜！' : '村民阵营获胜！' }}</h1>
      <p class="result-desc">{{ result?.message }}</p>
      <p class="result-duration">游戏时长: {{ formatDuration(result?.duration || 0) }}</p>

      <div class="result-players">
        <div v-for="p in result?.players || []" :key="p.id" class="result-player" :class="{ winner: p.isWinner, dead: !p.isAlive }">
          <span class="rp-role">{{ p.roleName }}</span>
          <span class="rp-name">{{ p.username }}</span>
          <span class="rp-status">{{ p.isAlive ? '存活' : '死亡' }}</span>
          <span class="rp-result">{{ p.isWinner ? '🏆' : '❌' }}</span>
        </div>
      </div>

      <div class="result-actions">
        <button class="btn btn-return" @click="$emit('returnRoom')">
          <span class="btn-icon">🏠</span>
          <span>返回房间</span>
        </button>
        <button class="btn btn-lobby" @click="$emit('back')">
          <span class="btn-icon">🏃</span>
          <span>返回大厅</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  result: { type: Object, default: null },
})

defineEmits(['back', 'returnRoom'])

const isVictory = computed(() => {
  return props.result?.winner === 'werewolf' || props.result?.winner === 'villager'
})

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}分${s}秒`
}
</script>

<style scoped>
.game-result-overlay {
  position: fixed;
  inset: 0;
  background: rgba(8, 10, 15, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 24px;
  animation: overlayFadeIn 0.3s ease;
}

@keyframes overlayFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.game-result-card {
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--glass-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: var(--border-medium);
  border-radius: var(--radius-xl);
  padding: 36px 32px 28px;
  text-align: center;
  animation: cardPopIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes cardPopIn {
  0% {
    opacity: 0;
    transform: scale(0.8) translateY(30px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.game-result-card.victory {
  border-color: var(--werewolf-primary);
  box-shadow: 0 0 80px rgba(229, 57, 53, 0.25), 0 20px 60px rgba(0, 0, 0, 0.5);
}

.game-result-card.defeat {
  border-color: var(--villager-primary);
  box-shadow: 0 0 80px var(--villager-glow), 0 20px 60px rgba(0, 0, 0, 0.5);
}

.result-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  margin-bottom: 20px;
  animation: badgePulse 2s ease-in-out infinite;
}

@keyframes badgePulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.result-badge.victory {
  background: linear-gradient(135deg, rgba(229, 57, 53, 0.2), rgba(142, 32, 32, 0.2));
  border: 2px solid var(--werewolf-primary);
  box-shadow: 0 0 40px var(--werewolf-glow);
}

.result-badge.defeat {
  background: linear-gradient(135deg, rgba(79, 140, 255, 0.2), rgba(52, 120, 219, 0.2));
  border: 2px solid var(--villager-primary);
  box-shadow: 0 0 40px var(--villager-glow);
}

.result-icon {
  font-size: 2.5rem;
  line-height: 1;
}

.result-title {
  font-size: 1.8rem;
  font-weight: 800;
  margin: 0 0 10px;
  letter-spacing: 1px;
}

.victory .result-title {
  color: var(--werewolf-light);
  text-shadow: 0 0 20px var(--werewolf-glow);
}

.defeat .result-title {
  color: var(--villager-light);
  text-shadow: 0 0 20px var(--villager-glow);
}

.result-desc {
  font-size: 0.95rem;
  color: var(--text-secondary);
  margin: 0 0 12px;
}

.result-duration {
  font-size: 0.9rem;
  color: var(--text-tertiary);
  margin: 0 0 28px;
  font-family: var(--font-mono);
}

.result-players {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 28px;
  text-align: left;
}

.result-player {
  display: grid;
  grid-template-columns: 70px 1fr 50px 30px;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border: var(--border-thin);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.result-player:hover {
  background: var(--bg-tertiary);
}

.result-player.winner {
  background: rgba(54, 211, 153, 0.08);
  border-color: rgba(54, 211, 153, 0.2);
}

.result-player.dead {
  opacity: 0.6;
}

.rp-role {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ai-light);
}

.rp-name {
  font-size: 0.9rem;
  color: var(--text-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rp-status {
  font-size: 0.8rem;
  color: var(--text-secondary);
  text-align: center;
}

.rp-result {
  font-size: 1rem;
  text-align: center;
}

.result-actions {
  display: flex;
  gap: 12px;
}

.btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 20px;
  font-size: 0.95rem;
  font-weight: 600;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: var(--font-sans);
}

.btn-icon {
  font-size: 1.1rem;
}

.btn-return {
  background: linear-gradient(135deg, var(--status-success), #059669);
  color: white;
  box-shadow: 0 4px 16px rgba(54, 211, 153, 0.3);
}

.btn-return:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(54, 211, 153, 0.4);
}

.btn-lobby {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: var(--border-medium);
}

.btn-lobby:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  transform: translateY(-2px);
}

@media (max-width: 600px) {
  .game-result-card {
    padding: 28px 20px 20px;
  }

  .result-title {
    font-size: 1.4rem;
  }

  .result-player {
    grid-template-columns: 60px 1fr 45px 24px;
    gap: 6px;
    padding: 10px 12px;
  }

  .result-actions {
    flex-direction: column;
  }
}
</style>
