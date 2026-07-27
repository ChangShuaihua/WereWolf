<template>
  <div class="player-grid" :class="gridClass">
    <template v-for="i in maxPlayers" :key="i">
      <div
        v-if="getPlayer(i - 1)"
        class="player-card"
        :class="{
          alive: getPlayer(i - 1).isAlive !== false,
          dead: getPlayer(i - 1).isAlive === false,
          me: (getPlayer(i - 1).id || getPlayer(i - 1).socketId) === myId,
          host: (getPlayer(i - 1).socketId || getPlayer(i - 1).id) === hostId,
          targetable: isTargetable(getPlayer(i - 1)),
          current: isCurrent(getPlayer(i - 1)),
        }"
      >
        <div class="seat-num-badge">
          {{ i }}号
        </div>

        <div class="player-avatar">
          {{ (getPlayer(i - 1).username || '?')[0] }}
        </div>
        <div class="player-name">{{ getPlayer(i - 1).username }}</div>
        <div class="player-badges">
          <span v-if="(getPlayer(i - 1).socketId || getPlayer(i - 1).id) === hostId" class="badge badge-host">👑</span>
          <span v-if="getPlayer(i - 1).isAI" class="badge badge-ai">🤖</span>
          <span v-if="showReady && getPlayer(i - 1).isReady" class="badge badge-ready">✅</span>
          <span v-if="getPlayer(i - 1).isAlive === false" class="badge badge-dead">💀</span>
          <span v-if="showRoles && roles[getPlayer(i - 1).id || getPlayer(i - 1).socketId]" class="badge badge-role">
            {{ roleNames[roles[getPlayer(i - 1).id || getPlayer(i - 1).socketId]] }}
          </span>
        </div>
      </div>
      <div v-else class="player-card player-card-empty">
        <div class="seat-num-badge">{{ i }}号</div>
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

const playerBySeat = computed(() => {
  const map = {}
  for (const p of props.players) {
    const seat = p.seatIndex !== undefined ? p.seatIndex : (p.seatNum !== undefined ? p.seatNum - 1 : 999)
    map[seat] = p
  }
  return map
})

function getPlayer(seatIndex) {
  return playerBySeat.value[seatIndex] || null
}

function isTargetable(player) {
  if (!player || player.isAlive === false) return false
  if (props.candidates && props.candidates.length > 0) {
    return props.candidates.some(c => (c.id || c.socketId) === (player.id || player.socketId))
  }
  return false
}

function isCurrent(player) {
  if (!player) return false
  if (props.currentSpeaker) {
    return (player.id || player.socketId) === props.currentSpeaker
  }
  return false
}

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
  background: rgba(255, 255, 255, 0.03);
  border: var(--border-thin);
  border-radius: var(--radius-md);
  text-align: center;
  transition: all 0.2s;
  min-height: 90px;
}

.player-card:hover:not(.is-dead):not(.player-card-empty) {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.15);
}

.player-card.is-current {
  background: rgba(79, 140, 255, 0.15);
  border-color: rgba(79, 140, 255, 0.4);
  box-shadow: 0 0 16px rgba(79, 140, 255, 0.2);
}

.player-card.is-dead {
  opacity: 0.4;
  filter: grayscale(0.7);
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
  background: rgba(255, 255, 255, 0.08);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
}

.empty-avatar {
  background: rgba(255, 255, 255, 0.03);
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

.badge-dead {
  opacity: 0.6;
}

.badge-role {
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
}
</style>
