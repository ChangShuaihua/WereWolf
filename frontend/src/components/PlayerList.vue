<template>
  <div class="player-grid">
    <div
      v-for="player in players"
      :key="player.id || player.socketId"
      class="player-card"
      :class="{
        alive: player.isAlive !== false,
        dead: player.isAlive === false,
        me: (player.id || player.socketId) === myId,
        host: (player.socketId || player.id) === hostId,
      }"
    >
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
defineProps({
  players: { type: Array, default: () => [] },
  myId: { type: String, default: '' },
  hostId: { type: String, default: '' },
  showReady: { type: Boolean, default: false },
  showRoles: { type: Boolean, default: false },
  roles: { type: Object, default: () => ({}) },
  isHost: { type: Boolean, default: false },
})

defineEmits(['removeAI'])

const roleNames = {
  werewolf: '🐺狼人',
  villager: '👨‍🌾村民',
  seer: '🔮预言家',
  witch: '🧪女巫',
  hunter: '🏹猎人',
  guard: '🛡️守卫',
}
</script>
