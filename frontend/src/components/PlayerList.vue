<template>
  <div class="player-grid" :class="gridClass">
    <!-- W19: 使用预计算的 seatList，避免模板内多次调用 getPlayer -->
    <template v-for="seat in seatList" :key="seat.seatNum">
      <div
        v-if="seat.player"
        class="player-card"
        :class="{
          alive: seat.player.isAlive !== false,
          'is-dead': seat.player.isAlive === false,
          me: (seat.player.id || seat.player.socketId) === myId,
          host: (seat.player.socketId || seat.player.id) === hostId,
          targetable: seat.targetable,
          current: seat.current,
        }"
      >
        <div class="seat-num-badge">
          {{ seat.seatNum }}号
        </div>

        <div class="player-avatar" :class="{ 'is-dead-avatar': seat.player.isAlive === false }">
          {{ (seat.player.username || '?')[0] }}
          <span v-if="seat.player.isAlive === false" class="avatar-skull">💀</span>
        </div>
        <div class="player-name" :class="{ 'is-dead-name': seat.player.isAlive === false }">{{ seat.player.username }}</div>
        <div class="player-badges">
          <span v-if="(seat.player.socketId || seat.player.id) === hostId" class="badge badge-host">👑</span>
          <span v-if="seat.player.isAI" class="badge badge-ai">🤖</span>
          <span v-if="showReady && seat.player.isReady" class="badge badge-ready">✅</span>
          <span v-if="seat.player.isAlive === false" class="badge badge-dead">💀 已淘汰</span>
          <span v-if="showRoles && roles[seat.player.id || seat.player.socketId]" class="badge badge-role">
            {{ roleNames[roles[seat.player.id || seat.player.socketId]] }}
          </span>
        </div>
      </div>
      <div v-else class="player-card player-card-empty">
        <div class="seat-num-badge">{{ seat.seatNum }}号</div>
        <div class="player-avatar empty-avatar">—</div>
        <div class="player-name empty-name">等待中</div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  players: { type: Array, default: () => [] },
  myId: { type: String, default: '' },
  hostId: { type: String, default: '' },
  showReady: { type: Boolean, default: false },
  showRoles: { type: Boolean, default: false },
  roles: { type: Object, default: () => ({}) },
  isHost: { type: Boolean, default: false },
  maxPlayers: { type: Number, default: 6 },
  candidates: { type: Array, default: () => [] },
  currentSpeaker: { type: String, default: '' },
})

defineEmits(['removeAI'])

const gridClass = computed(() => {
  return `grid-${props.maxPlayers}`
})

// W19: 一次性计算座位列表（含 player/targetable/current），避免模板重复调用
const seatList = computed(() => {
  const map = {}
  for (const p of props.players) {
    const seat = p.seatIndex !== undefined ? p.seatIndex : (p.seatNum !== undefined ? p.seatNum - 1 : 999)
    map[seat] = p
  }
  const list = []
  for (let i = 0; i < props.maxPlayers; i++) {
    const player = map[i] || null
    const targetable = (() => {
      if (!player || player.isAlive === false) return false
      if (props.candidates && props.candidates.length > 0) {
        return props.candidates.some(c => (c.id || c.socketId) === (player.id || player.socketId))
      }
      return false
    })()
    const current = (() => {
      if (!player) return false
      if (props.currentSpeaker) {
        return (player.id || player.socketId) === props.currentSpeaker
      }
      return false
    })()
    list.push({ seatNum: i + 1, player, targetable, current })
  }
  return list
})

const roleNames = {
  werewolf: '🐺狼人',
  villager: '👨‍🌾村民',
  seer: '🔮预言家',
  witch: '🧪女巫',
  hunter: '🏹猎人',
  guard: '🛡️守卫',
}
</script>

<style scoped>
.player-grid {
  display: grid;
  gap: 12px;
}

.player-grid.grid-6 {
  grid-template-columns: repeat(3, 1fr);
}

.player-grid.grid-8 {
  grid-template-columns: repeat(4, 1fr);
}

.player-grid.grid-12 {
  grid-template-columns: repeat(4, 1fr);
}

.player-card {
  position: relative;
  padding: 12px;
  background: var(--bg-secondary);
  border: var(--border-thin);
  border-radius: var(--radius-md);
  text-align: center;
  transition: all 0.2s;
  min-height: 90px;
}

.player-card:hover:not(.is-dead):not(.player-card-empty) {
  background: var(--bg-tertiary);
  border-color: var(--text-tertiary);
}

.player-card.is-current {
  background: rgba(79, 140, 255, 0.15);
  border-color: rgba(79, 140, 255, 0.4);
  box-shadow: 0 0 16px rgba(79, 140, 255, 0.2);
}

.player-card.is-dead {
  background: rgba(80, 20, 20, 0.25);
  border-color: rgba(180, 40, 40, 0.5);
  opacity: 0.7;
  position: relative;
  overflow: hidden;
}

.player-card.is-dead::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 6px,
    rgba(180, 40, 40, 0.15) 6px,
    rgba(180, 40, 40, 0.15) 12px
  );
  pointer-events: none;
}

.player-card.is-dead .player-avatar {
  background: rgba(100, 30, 30, 0.5) !important;
  filter: grayscale(1);
  opacity: 0.6;
}

.player-card.is-dead .player-name {
  text-decoration: line-through;
  text-decoration-color: rgba(200, 60, 60, 0.8);
  color: var(--text-tertiary);
}

.avatar-skull {
  position: absolute;
  bottom: -2px;
  right: -2px;
  font-size: 0.7rem;
  filter: drop-shadow(0 0 4px rgba(255, 100, 100, 0.8));
  animation: skullPulse 2s ease-in-out infinite;
}

@keyframes skullPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}

.is-dead-name {
  text-decoration: line-through;
  text-decoration-color: rgba(200, 60, 60, 0.8);
}

.badge-dead {
  background: rgba(180, 40, 40, 0.3);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  color: #ff8080;
  font-weight: 600;
  font-size: 0.68rem;
  border: 1px solid rgba(200, 60, 60, 0.4);
}

.player-card.is-targetable {
  border-color: rgba(229, 57, 53, 0.4);
  animation: targetPulse 1.5s ease-in-out infinite;
  cursor: pointer;
}

@keyframes targetPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(229, 57, 53, 0.3); }
  50% { box-shadow: 0 0 0 6px rgba(229, 57, 53, 0); }
}

.player-card-empty {
  opacity: 0.4;
  border-style: dashed;
  cursor: default;
}

.player-card-empty:hover {
  opacity: 0.5;
}

.seat-num-badge {
  position: absolute;
  top: 6px;
  left: 8px;
  font-size: 0.7rem;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-weight: 600;
}

.player-avatar {
  width: 32px;
  height: 32px;
  margin: 0 auto 6px;
  background: var(--bg-tertiary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
  position: relative;
}

.empty-avatar {
  background: var(--bg-secondary);
  color: var(--text-tertiary);
}

.player-name {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

.empty-name {
  color: var(--text-tertiary);
  font-style: italic;
}

.player-badges {
  display: flex;
  justify-content: center;
  gap: 4px;
  margin-top: 4px;
}

.badge {
  font-size: 0.72rem;
}

.badge-role {
  background: var(--bg-tertiary);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
}
</style>
