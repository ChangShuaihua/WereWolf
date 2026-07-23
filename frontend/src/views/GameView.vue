<template>
  <div class="game-page">
    <!-- Loading overlay -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>正在重新连接到游戏...</p>
    </div>

    <template v-else>
    <!-- Role Reveal Overlay -->
    <RoleReveal v-if="showRoleReveal" :role="gameStore.myRole" :roleName="gameStore.myRoleName" @close="showRoleReveal = false" />

    <!-- Top Bar -->
    <header class="game-header">
      <div class="game-header-left">
        <div class="phase-indicator" :class="phaseClass">
          <span class="phase-icon">{{ phaseIcon }}</span>
          <span class="phase-text">{{ phaseLabel }}</span>
          <span v-if="gameStore.nightCount && gameStore.isNight" class="night-number">第{{ gameStore.nightCount }}夜</span>
        </div>
      </div>

      <div class="game-header-center">
        <div class="my-role" v-if="gameStore.myRole">
          <span class="role-emoji">{{ roleIcon }}</span>
          <span class="role-name">{{ gameStore.myRoleName }}</span>
        </div>
        <Countdown v-if="gameStore.isNight" :timeout="gameStore.timeout" :phase="gameStore.phase" />
      </div>

      <div class="game-header-right">
        <div class="game-message" v-if="gameStore.message">{{ gameStore.message }}</div>
      </div>
    </header>

    <!-- Main Content -->
    <div class="game-main">
      <!-- Left Panel: Player List & Action Panels -->
      <div class="game-left-panel">
        <!-- Player Grid -->
        <section class="game-section player-section">
          <div class="section-header">
            <h3>👥 玩家列表</h3>
            <span class="section-badge">{{ aliveCount }}/{{ gameStore.players.length }} 存活</span>
          </div>
          <div class="player-grid-wrapper">
            <PlayerList
              :players="gameStore.players"
              :myId="socket.id"
              :showRoles="gameStore.isEnd"
              :roles="gameOverRoles"
              :aliveFilter="null"
            />
          </div>
        </section>

        <!-- Action Panels -->
        <section class="game-section action-section">
          <NightPanel
            v-if="gameStore.isNight && gameStore.myPlayer?.isAlive"
            :prompt="gameStore.nightActionPrompt"
            :seerResult="gameStore.seerResult"
            :currentNightRole="gameStore.currentNightRole"
            @action="gameStore.submitNightAction"
          />

          <HunterPanel
            v-if="gameStore.hunterPrompt"
            :prompt="gameStore.hunterPrompt"
            @shoot="gameStore.submitHunterShoot"
          />

          <DayPanel
            v-if="gameStore.isDay"
            :message="gameStore.message"
            :isAlive="gameStore.myPlayer?.isAlive"
            :currentSpeaker="gameStore.currentSpeaker"
            :speakerName="gameStore.speakerName"
            :mySocketId="socket.id"
            @skip="gameStore.skipSpeaking()"
            @next="gameStore.nextSpeaker()"
            @skipDay="gameStore.skipDay()"
          />

          <VotePanel
            v-if="gameStore.isVote && gameStore.myPlayer?.isAlive"
            :candidates="gameStore.candidates"
            :votedCount="gameStore.votedCount"
            :totalVoters="gameStore.totalVoters"
            @vote="gameStore.submitVote"
          />
        </section>
      </div>

      <!-- Right Panel: Chat -->
      <aside class="game-right-panel">
        <section class="game-section chat-section">
          <div class="section-header">
            <h3>💬 聊天</h3>
          </div>
          <ChatBox :messages="roomStore.chat" @send="handleChat" />
        </section>
      </aside>
    </div>

    <!-- Game Over -->
    <GameResult v-if="gameStore.isEnd" :result="gameStore.gameOver" @back="goToLobby" @returnRoom="returnToRoom" />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGameStore } from '../stores/game'
import { useRoomStore } from '../stores/room'
import { useUserStore } from '../stores/user'
import socket, { authenticate } from '../socket'
import PlayerList from '../components/PlayerList.vue'
import ChatBox from '../components/ChatBox.vue'
import RoleReveal from '../components/RoleReveal.vue'
import Countdown from '../components/Countdown.vue'
import NightPanel from '../components/NightPanel.vue'
import DayPanel from '../components/DayPanel.vue'
import VotePanel from '../components/VotePanel.vue'
import GameResult from '../components/GameResult.vue'
import HunterPanel from '../components/HunterPanel.vue'

const router = useRouter()
const route = useRoute()
const gameStore = useGameStore()
const roomStore = useRoomStore()
const userStore = useUserStore()

const showRoleReveal = ref(false)
const gameChat = ref([])
const roleRevealed = ref(false)
const loading = ref(true)

const phaseLabel = computed(() => {
  const labels = { WAITING: '等待中', NIGHT: '夜晚', DAY: '白天', VOTE: '投票', END: '游戏结束' }
  return labels[gameStore.phase] || gameStore.phase
})

const phaseIcon = computed(() => {
  const icons = { WAITING: '⏳', NIGHT: '🌙', DAY: '☀️', VOTE: '🗳️', END: '🏆' }
  return icons[gameStore.phase] || '❓'
})

const phaseClass = computed(() => gameStore.phase.toLowerCase())

const roleIcons = {
  werewolf: '🐺',
  villager: '👨‍🌾',
  seer: '🔮',
  witch: '🧪',
  hunter: '🏹',
  guard: '🛡️',
}

const roleIcon = computed(() => roleIcons[gameStore.myRole] || '❓')

const aliveCount = computed(() => gameStore.players.filter(p => p.isAlive).length)

const gameOverRoles = computed(() => {
  if (!gameStore.gameOver) return {}
  const map = {}
  gameStore.gameOver.players.forEach(p => { map[p.id] = p.role })
  return map
})

async function reconnectToRoom() {
  const code = route.params.code
  if (!code) {
    router.push('/lobby')
    return
  }

  if (!socket.connected) socket.connect()

  roomStore.bindEvents()
  gameStore.bindEvents()

  if (userStore.user) {
    await authenticate(userStore.user.id, userStore.user.username)
  }

  // Wait for socket connection
  await new Promise((resolve) => {
    if (socket.connected) {
      resolve()
    } else {
      socket.once('connect', resolve)
      setTimeout(resolve, 3000)
    }
  })

  // Join room - this will trigger room_joined event which sets roomCode
  roomStore.joinRoom(code)

  // Wait a bit for the room_joined event to process
  setTimeout(() => {
    if (roomStore.roomCode) {
      loading.value = false
    } else {
      router.push('/lobby')
    }
  }, 500)
}

onMounted(async () => {
  await reconnectToRoom()

  if (!roomStore.roomCode) {
    return
  }

  if (!roleRevealed.value && gameStore.myRole) {
    showRoleReveal.value = true
    roleRevealed.value = true
    setTimeout(() => { showRoleReveal.value = false }, 5000)
  }
})

function handleChat(message) {
  gameStore.sendChat(message)
}

function goToLobby() {
  socket.emit('leave_room', { roomCode: roomStore.roomCode })
  router.push('/lobby')
}

function returnToRoom() {
  socket.emit('reset_game')
  router.push(`/room/${roomStore.roomCode}`)
}
</script>
