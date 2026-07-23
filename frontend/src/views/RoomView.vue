<template>
  <div class="room-page">
    <div class="room-main">
      <!-- Room header -->
      <div class="room-header">
        <button class="btn btn-sm" @click="handleLeave">← 返回大厅</button>
        <div class="room-title">
          <h2>房间 {{ roomStore.roomCode }}</h2>
          <span class="room-mode-badge">{{ roomStore.maxPlayers }}人局</span>
          <button class="btn btn-sm" @click="copyCode">📋 复制房间号</button>
        </div>
        <div class="room-header-info">
          <span>{{ roomStore.players.length }}/{{ roomStore.maxPlayers }} 玩家</span>
        </div>
      </div>

      <!-- Player list -->
      <div class="seat-grid-wrapper">
        <div class="seat-grid-title">👥 玩家列表</div>
        <div class="seat-grid" :class="`seat-grid-${roomStore.maxPlayers}`">
          <div
            v-for="seat in occupiedSeats"
            :key="seat.seatIndex"
            class="seat-card seat-occupied"
            :class="{
              'seat-me': seat.socketId === socket.id,
              'seat-host': seat.isHost,
              'seat-ready': seat.isReady,
              'seat-ai': seat.isAI,
            }"
          >
            <div class="seat-number-occupied">{{ seat.seatIndex + 1 }}号</div>
            <div class="seat-avatar" :class="{ 'ai-avatar': seat.isAI }">
              {{ seat.username?.charAt(0).toUpperCase() || '?' }}
            </div>
            <div class="seat-name">{{ seat.username }}</div>
            <div class="seat-badges">
              <span v-if="seat.isHost" class="badge badge-host">👑</span>
              <span v-if="seat.isAI" class="badge badge-ai">🤖</span>
              <span v-if="seat.isReady" class="badge badge-ready">✅</span>
            </div>
            <!-- Remove AI button for host -->
            <button
              v-if="roomStore.isHost() && seat.isAI"
              class="btn-remove-seat"
              @click.stop="handleRemoveAI(seat.socketId)"
              title="移除AI玩家"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="room-actions">
        <div class="actions-left">
          <button
            class="btn"
            :class="myIsReady ? 'btn-ready' : 'btn-secondary'"
            @click="roomStore.toggleReady()"
          >
            {{ myIsReady ? '✅ 已准备' : '📌 准备' }}
          </button>
        </div>

        <div v-if="roomStore.isHost()" class="actions-right">
          <div class="add-ai-container">
            <select v-model="selectedAgentId" class="agent-select">
              <option value="">随机智能体</option>
              <option v-for="agent in aiAgents" :key="agent.id" :value="agent.id">
                {{ agent.avatar }} {{ agent.name }}
              </option>
            </select>
            <button
              class="btn btn-secondary"
              :disabled="roomStore.players.length >= roomStore.maxPlayers"
              @click="handleAddAI"
            >
              🤖 添加AI玩家
            </button>
          </div>

          <button
            class="btn btn-primary"
            :disabled="!roomStore.allReady()"
            @click="roomStore.startGame()"
          >
            {{ roomStore.players.length >= roomStore.maxPlayers ? '🎮 开始游戏' : `需要${roomStore.maxPlayers}人 (当前${roomStore.players.length})` }}
          </button>
        </div>
      </div>
    </div>

    <!-- Chat sidebar -->
    <div class="room-sidebar">
      <section class="game-section chat-section">
        <div class="section-header">
          <h3>💬 房间聊天</h3>
        </div>
        <ChatBox :messages="roomStore.chat" @send="roomStore.sendChat" />
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useRoomStore } from '../stores/room'
import { useGameStore } from '../stores/game'
import { useUserStore } from '../stores/user'
import socket, { authenticate } from '../socket'
import api from '../api'
import ChatBox from '../components/ChatBox.vue'

const router = useRouter()
const route = useRoute()
const roomStore = useRoomStore()
const gameStore = useGameStore()
const userStore = useUserStore()
const loading = ref(true)
const aiAgents = ref([])
const selectedAgentId = ref('')

const myIsReady = computed(() => {
  const me = roomStore.players.find(p => p.socketId === socket.id)
  return me?.isReady || false
})

const occupiedSeats = computed(() => {
  return roomStore.seats.filter(s => s.occupied)
})

function _onGameStarted() { router.push(`/game/${roomStore.roomCode}`) }

function handleAddAI() {
  roomStore.addAIPlayer(selectedAgentId.value)
}

function handleRemoveAI(aiSocketId) {
  roomStore.removeAIPlayer(aiSocketId)
}

async function fetchRoomInfo() {
  const code = route.params.code
  if (!code) {
    router.push('/lobby')
    return
  }

  try {
    const { data } = await api.get(`/room/${code}`)
    roomStore.roomCode = data.code
    roomStore.hostId = data.hostId
    roomStore.players = data.players
    roomStore.seats = data.seats || []
    roomStore.chat = data.chat || []
    roomStore.maxPlayers = Number(data.maxPlayers) || 6
  } catch (e) {
    console.error('Failed to fetch room info:', e)
    router.push('/lobby')
    return
  }

  loading.value = false
}

async function fetchAIAgents() {
  try {
    const response = await fetch('/api/ai-agents');
    aiAgents.value = await response.json();
  } catch (err) {
    console.error('Failed to fetch AI agents:', err);
  }
}

onMounted(async () => {
  if (!socket.connected) socket.connect()

  roomStore.bindEvents()
  gameStore.bindEvents()
  socket.on('game_started', _onGameStarted)

  if (userStore.user) {
    await authenticate(userStore.user.id, userStore.user.username)
  }

  await fetchRoomInfo()
  await fetchAIAgents()

  roomStore.joinRoom(roomStore.roomCode)
})

onUnmounted(() => {
  socket.off('game_started', _onGameStarted)
})

function handleLeave() {
  roomStore.leaveRoom()
  router.push('/lobby')
}

function copyCode() {
  navigator.clipboard.writeText(roomStore.roomCode).catch(() => {})
  alert('房间号已复制')
}
</script>
