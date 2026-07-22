<template>
  <div class="lobby">
    <header class="lobby-header">
      <h1>🐺 狼人杀</h1>
      <div class="header-actions">
        <button class="btn-workshop" @click="$router.push('/workshop')">
          🤖 AI工坊
        </button>
        <button class="btn-profile" @click="$router.push('/profile')">
          👤 {{ userStore.user?.username }}
        </button>
      </div>
    </header>
    <div class="panel room-panel">
      <h3>🏠 游戏房间</h3>
      <div class="create-row">
        <button class="btn btn-primary" @click="handleCreateRoom" :disabled="creating">
          {{ creating ? '创建中...' : '创建房间' }}
        </button>
        <div class="join-row">
          <input
            v-model="joinCode"
            type="text"
            placeholder="输入房间号"
            maxlength="6"
            class="code-input"
            @keyup.enter="handleJoinRoom()"
          />
          <button class="btn btn-secondary" @click="handleJoinRoom()" :disabled="!joinCode">
            加入
          </button>
        </div>
      </div>

      <div v-if="rooms.length === 0" class="empty">暂无可用房间，请创建一个</div>
      <div v-else class="room-list">
        <div
          v-for="room in rooms"
          :key="room.code"
          class="room-item"
          @click="handleJoinRoom(room.code)"
        >
          <div class="room-code">{{ room.code }}</div>
          <div class="room-info">
            <span>房主: {{ room.hostUsername }}</span>
            <span>{{ room.playerCount }}/{{ room.maxPlayers }} 人</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomStore } from '../stores/room'
import { useUserStore } from '../stores/user'
import socket, { authenticate } from '../socket'
import api from '../api'

const router = useRouter()
const roomStore = useRoomStore()
const userStore = useUserStore()

const rooms = ref([])
const joinCode = ref('')
const creating = ref(false)

function _onRoomJoined(data) { router.push(`/room/${data.code}`) }

function _onRoomCreated(data) {
  rooms.value.unshift(data)
}

function _onRoomDeleted(data) {
  rooms.value = rooms.value.filter(r => r.code !== data.code)
}

function refreshRooms() {
  api.get('/rooms').then(({ data }) => {
    rooms.value = data.rooms
  }).catch(() => {})
}

onMounted(async () => {
  if (!socket.connected) socket.connect()

  if (userStore.user) {
    await authenticate(userStore.user.id, userStore.user.username)
  }

  try {
    const { data: roomData } = await api.get('/rooms')
    rooms.value = roomData.rooms
  } catch (e) { /* ignore */ }

  roomStore.bindEvents()
  socket.on('room_joined', _onRoomJoined)
  socket.on('room_created', _onRoomCreated)
  socket.on('room_deleted', _onRoomDeleted)
})

onUnmounted(() => {
  socket.off('room_joined', _onRoomJoined)
  socket.off('room_created', _onRoomCreated)
  socket.off('room_deleted', _onRoomDeleted)
})

async function handleCreateRoom() {
  creating.value = true
  roomStore.createRoom()
  setTimeout(() => { creating.value = false }, 3000)
}

function handleJoinRoom(code) {
  const c = code || joinCode.value.toUpperCase()
  if (!c) return
  roomStore.joinRoom(c)
}
</script>
