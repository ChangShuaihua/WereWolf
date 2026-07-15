<template>
  <div class="game-page">
    <!-- Role Reveal Overlay -->
    <RoleReveal v-if="showRoleReveal" :role="gameStore.myRole" :roleName="gameStore.myRoleName" @close="showRoleReveal = false" />

    <!-- Phase Indicator -->
    <div class="game-top-bar">
      <div class="phase-badge" :class="phaseClass">
        {{ phaseLabel }}
        <span v-if="gameStore.nightCount && gameStore.isNight">第{{ gameStore.nightCount }}夜</span>
      </div>
      <div class="role-badge" v-if="gameStore.myRole">
        {{ roleIcon }} {{ gameStore.myRoleName }}
      </div>
      <Countdown :timeout="gameStore.timeout" :phase="gameStore.phase" />
      <div class="message-bar" v-if="gameStore.message">{{ gameStore.message }}</div>
    </div>

    <div class="game-body">
      <!-- Player Grid -->
      <PlayerList
        :players="gameStore.players"
        :myId="socket.id"
        :showRoles="gameStore.isEnd"
        :roles="gameOverRoles"
        :aliveFilter="null"
      />

      <!-- Action Panels by Phase -->
      <NightPanel
        v-if="gameStore.isNight && gameStore.myPlayer?.isAlive"
        :prompt="gameStore.nightActionPrompt"
        :seerResult="gameStore.seerResult"
        @action="gameStore.submitNightAction"
      />

      <DayPanel
        v-if="gameStore.isDay"
        :message="gameStore.message"
        :isAlive="gameStore.myPlayer?.isAlive"
        @skip="gameStore.skipDay()"
      />

      <VotePanel
        v-if="gameStore.isVote && gameStore.myPlayer?.isAlive"
        :candidates="gameStore.candidates"
        :votedCount="gameStore.votedCount"
        :totalVoters="gameStore.totalVoters"
        @vote="gameStore.submitVote"
      />
    </div>

    <!-- Chat sidebar -->
    <div class="game-sidebar">
      <ChatBox :messages="roomStore.chat" @send="handleChat" />
    </div>

    <!-- Game Over -->
    <GameResult v-if="gameStore.isEnd" :result="gameStore.gameOver" @back="goToLobby" @returnRoom="returnToRoom" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/game'
import { useRoomStore } from '../stores/room'
import socket from '../socket'
import PlayerList from '../components/PlayerList.vue'
import ChatBox from '../components/ChatBox.vue'
import RoleReveal from '../components/RoleReveal.vue'
import Countdown from '../components/Countdown.vue'
import NightPanel from '../components/NightPanel.vue'
import DayPanel from '../components/DayPanel.vue'
import VotePanel from '../components/VotePanel.vue'
import GameResult from '../components/GameResult.vue'

const router = useRouter()
const gameStore = useGameStore()
const roomStore = useRoomStore()

const showRoleReveal = ref(true)
const gameChat = ref([])

const phaseLabel = computed(() => {
  const labels = { WAITING: '等待中', NIGHT: '🌙 夜晚', DAY: '☀️ 白天', VOTE: '🗳️ 投票', END: '游戏结束' }
  return labels[gameStore.phase] || gameStore.phase
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

const gameOverRoles = computed(() => {
  if (!gameStore.gameOver) return {}
  const map = {}
  gameStore.gameOver.players.forEach(p => { map[p.id] = p.role })
  return map
})

onMounted(() => {
  if (!roomStore.roomCode) {
    router.push('/lobby')
    return
  }

  roomStore.bindEvents()

  // Show role reveal
  showRoleReveal.value = true
  setTimeout(() => { showRoleReveal.value = false }, 5000)
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
