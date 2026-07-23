import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import socket from '../socket'
import { useRoomStore } from './room'

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
  const hunterPrompt = ref(null)
  const currentSpeaker = ref(null)
  const speakerName = ref('')
  const currentNightRole = ref(null)

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
    // Use the actual phase if provided (for reconnection), otherwise default to NIGHT
    phase.value = data.phase || 'NIGHT'
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
    currentSpeaker.value = data.currentSpeaker || null
    speakerName.value = data.speakerName || ''
  }

  function _onSpeakerChange(data) {
    console.log('[gameStore] speaker_change', data)
    currentSpeaker.value = data.currentSpeaker || null
    speakerName.value = data.speakerName || ''
  }

  function _onNightActionPrompt(data) {
    console.log('[gameStore] night_action_prompt', data)
    nightActionPrompt.value = data
  }

  function _onNightRoleTurn(data) {
    console.log('[gameStore] night_role_turn', data)
    currentNightRole.value = data
  }

  function _onNightRoleDone(data) {
    console.log('[gameStore] night_role_done', data)
    currentNightRole.value = null
  }

  function _onSeerResult(data) {
    seerResult.value = data
  }

  function _onNightResult(data) {
    console.log('[gameStore] night_result', data)
    if (data.deaths) {
      data.deaths.forEach(d => {
        const p = players.value.find(pl => pl.id === d.id || pl.socketId === d.id)
        if (p) p.isAlive = false
      })
    }
    message.value = data.message
    nightActionPrompt.value = null
  }

  function _onHunterTrigger(data) {
    console.log('[gameStore] hunter_trigger', data)
    hunterPrompt.value = data
  }

  function _onHunterResult(data) {
    console.log('[gameStore] hunter_result', data)
    if (data.target) {
      const p = players.value.find(pl => pl.id === data.target.id || pl.socketId === data.target.id)
      if (p) p.isAlive = false
    }
    message.value = data.message
    hunterPrompt.value = null
  }

  function _onVoteUpdate(data) {
    votedCount.value = data.votedCount
    totalVoters.value = data.totalCount
  }

  function _onVoteResult(data) {
    console.log('[gameStore] vote_result', data)
    if (data.eliminated) {
      const p = players.value.find(pl => pl.id === data.eliminated.id || pl.socketId === data.eliminated.id)
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
    socket.off('hunter_trigger', _onHunterTrigger)
    socket.off('hunter_result', _onHunterResult)
    socket.off('vote_update', _onVoteUpdate)
    socket.off('vote_result', _onVoteResult)
    socket.off('game_over', _onGameOver)
    socket.off('player_disconnected', _onPlayerDisconnected)
    socket.off('speaker_change', _onSpeakerChange)

    socket.on('game_started', _onGameStarted)
    socket.on('phase_change', _onPhaseChange)
    socket.on('night_action_prompt', _onNightActionPrompt)
    socket.on('night_role_turn', _onNightRoleTurn)
    socket.on('night_role_done', _onNightRoleDone)
    socket.on('seer_result', _onSeerResult)
    socket.on('night_result', _onNightResult)
    socket.on('hunter_trigger', _onHunterTrigger)
    socket.on('hunter_result', _onHunterResult)
    socket.on('vote_update', _onVoteUpdate)
    socket.on('vote_result', _onVoteResult)
    socket.on('game_over', _onGameOver)
    socket.on('player_disconnected', _onPlayerDisconnected)
    socket.on('speaker_change', _onSpeakerChange)

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

  function submitHunterShoot(targetId) {
    socket.emit('hunter_shoot', { targetId })
  }

  function submitVote(targetId) {
    socket.emit('vote', { targetId })
  }

  function skipDay() {
    socket.emit('skip_day')
  }

  function sendChat(message) {
    const roomStore = useRoomStore()
    socket.emit('chat', { message, roomCode: roomStore.roomCode })
  }

  function nextSpeaker() {
    const roomStore = useRoomStore()
    socket.emit('next_speaker', { roomCode: roomStore.roomCode })
  }

  function skipSpeaking() {
    const roomStore = useRoomStore()
    socket.emit('skip_speaking', { roomCode: roomStore.roomCode })
  }

  return {
    phase, myRole, myRoleName, players, timeout, message, nightCount,
    candidates, votedCount, totalVoters, gameOver, seerResult, nightActionPrompt, hunterPrompt,
    currentSpeaker, speakerName, currentNightRole,
    isNight, isDay, isVote, isEnd, myPlayer, alivePlayers,
    bindEvents, unbindEvents,
    submitNightAction, submitHunterShoot, submitVote, skipDay, sendChat,
    nextSpeaker, skipSpeaking,
  }
})
