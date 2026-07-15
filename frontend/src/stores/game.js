import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import socket from '../socket'

export const useGameStore = defineStore('game', () => {
  const phase = ref('WAITING')
  const myRole = ref('')
  const myRoleName = ref('')
  const players = ref([])
  const timeout = ref(0)
  const message = ref('')
  const nightCount = ref(0)
  const candidates = ref([])
  const votedCount = ref(0)
  const totalVoters = ref(0)
  const gameOver = ref(null)
  const seerResult = ref(null)
  const nightActionPrompt = ref(null)

  const isNight = computed(() => phase.value === 'NIGHT')
  const isDay = computed(() => phase.value === 'DAY')
  const isVote = computed(() => phase.value === 'VOTE')
  const isEnd = computed(() => phase.value === 'END')

  const myPlayer = computed(() =>
    players.value.find(p => (p.id || p.socketId) === socket.id)
  )

  const alivePlayers = computed(() =>
    players.value.filter(p => p.isAlive)
  )

  // ---- named handlers ----
  function _onGameStarted(data) {
    console.log('[gameStore] game_started', data)
    myRole.value = data.role
    myRoleName.value = data.roleName
    players.value = data.players
    phase.value = 'NIGHT'
    gameOver.value = null
  }

  function _onPhaseChange(data) {
    console.log('[gameStore] phase_change', data)
    phase.value = data.phase
    timeout.value = data.timeout
    message.value = data.message || ''
    if (data.nightCount) nightCount.value = data.nightCount
    if (data.candidates) candidates.value = data.candidates
    votedCount.value = 0
    totalVoters.value = data.candidates?.length || 0
    seerResult.value = null
    nightActionPrompt.value = null
  }

  function _onNightActionPrompt(data) {
    console.log('[gameStore] night_action_prompt', data)
    nightActionPrompt.value = data
  }

  function _onSeerResult(data) {
    seerResult.value = data
  }

  function _onNightResult(data) {
    console.log('[gameStore] night_result', data)
    if (data.deaths) {
      data.deaths.forEach(d => {
        const p = players.value.find(pl => pl.id === d.id)
        if (p) p.isAlive = false
      })
    }
    message.value = data.message
    nightActionPrompt.value = null
  }

  function _onVoteUpdate(data) {
    votedCount.value = data.votedCount
    totalVoters.value = data.totalCount
  }

  function _onVoteResult(data) {
    console.log('[gameStore] vote_result', data)
    if (data.eliminated) {
      const p = players.value.find(pl => pl.id === data.eliminated.id)
      if (p) p.isAlive = false
    }
    message.value = data.message
    candidates.value = []
  }

  function _onGameOver(data) {
    console.log('[gameStore] game_over', data)
    gameOver.value = data
    phase.value = 'END'
    players.value = data.players
  }

  function _onPlayerDisconnected(data) {
    const p = players.value.find(pl => pl.id === data.id)
    if (p) p.isAlive = false
  }

  // ---- bind / unbind ----
  function bindEvents() {
    socket.off('game_started', _onGameStarted)
    socket.off('phase_change', _onPhaseChange)
    socket.off('night_action_prompt', _onNightActionPrompt)
    socket.off('seer_result', _onSeerResult)
    socket.off('night_result', _onNightResult)
    socket.off('vote_update', _onVoteUpdate)
    socket.off('vote_result', _onVoteResult)
    socket.off('game_over', _onGameOver)
    socket.off('player_disconnected', _onPlayerDisconnected)

    socket.on('game_started', _onGameStarted)
    socket.on('phase_change', _onPhaseChange)
    socket.on('night_action_prompt', _onNightActionPrompt)
    socket.on('seer_result', _onSeerResult)
    socket.on('night_result', _onNightResult)
    socket.on('vote_update', _onVoteUpdate)
    socket.on('vote_result', _onVoteResult)
    socket.on('game_over', _onGameOver)
    socket.on('player_disconnected', _onPlayerDisconnected)

    console.log('[gameStore] events bound, socket.id=', socket.id)
  }

  function unbindEvents() {
    socket.off('game_started', _onGameStarted)
    socket.off('phase_change', _onPhaseChange)
    socket.off('night_action_prompt', _onNightActionPrompt)
    socket.off('seer_result', _onSeerResult)
    socket.off('night_result', _onNightResult)
    socket.off('vote_update', _onVoteUpdate)
    socket.off('vote_result', _onVoteResult)
    socket.off('game_over', _onGameOver)
    socket.off('player_disconnected', _onPlayerDisconnected)
  }

  function submitNightAction({ action, targetId }) {
    socket.emit('night_action', { action, targetId })
  }

  function submitVote(targetId) {
    socket.emit('vote', { targetId })
  }

  function skipDay() {
    socket.emit('skip_day')
  }

  function sendChat(message) {
    socket.emit('chat', { message })
  }

  return {
    phase, myRole, myRoleName, players, timeout, message, nightCount,
    candidates, votedCount, totalVoters, gameOver, seerResult, nightActionPrompt,
    isNight, isDay, isVote, isEnd, myPlayer, alivePlayers,
    bindEvents, unbindEvents,
    submitNightAction, submitVote, skipDay, sendChat,
  }
})
