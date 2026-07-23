<template>
  <div class="player-grid">
    <div
      v-for="player in sortedPlayers"
      :key="player.id || player.socketId"
      class="player-card"
      :class="{
        alive: player.isAlive !== false,
        dead: player.isAlive === false,
        me: (player.id || player.socketId) === myId,
        host: (player.socketId || player.id) === hostId,
      }"
    >
      <!-- Seat number badge (top-left) -->
      <div class="seat-num-badge">
        {{ player.seatNum || ((player.seatIndex !== undefined ? player.seatIndex : 0) + 1) + '号' }}
      </div>

      <div class="player-avatar">
        {{ (player.username || '?')[0] }}
      </div>
      <div class="player-name">{{ player.username }}</div>
      <div class="player-badges">
        <span v-if="(player.socketId || player.id) === hostId" class="badge badge-host">👑</span>
        <span v-if="player.isAI" class="badge badge-ai">🤖</span>
        <span v-if="showReady && player.isReady" class="badge badge-ready">✅</span>
        <span v-if="player.isAlive === false" class="badge badge-dead">💀</span>
        <span v-if="showRoles && roles[player.id || player.socketId]" class="badge badge-role">
          {{ roleNames[roles[player.id || player.socketId]] }}
        </span>
      </div>
      <button
        v-if="isHost && player.isAI"
        class="btn-remove-ai"
        @click="$emit('removeAI', player.socketId)"
        title="删除AI玩家"
      >
        ✕
      </button>
    </div>
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
})

defineEmits(['removeAI'])

// Sort players by seatIndex so they always appear in order
const sortedPlayers = computed(() => {
  return [...props.players].sort((a, b) => {
    const aSeat = a.seatIndex !== undefined ? a.seatIndex : 999
    const bSeat = b.seatIndex !== undefined ? b.seatIndex : 999
    return aSeat - bSeat
  })
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
