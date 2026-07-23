<template>
  <div class="lobby">
    <!-- Game mode zones -->
    <div class="zones-grid">
      <!-- 6人专区 -->
      <div class="zone-card">
        <div class="zone-header zone-6">
          <div class="zone-icon">👥</div>
          <div class="zone-info">
            <h2>6人专区</h2>
            <p class="zone-desc">2狼人 · 预言家 · 女巫 · 猎人 · 村民</p>
          </div>
        </div>
        <div class="zone-body">
          <button class="btn btn-create-zone" @click="handleCreateRoom(6)" :disabled="creating">
            {{ creating === 6 ? '创建中...' : '+ 创建6人房间' }}
          </button>
          <div class="zone-rooms">
            <div v-if="getZoneRooms(6).length === 0" class="zone-empty">暂无房间</div>
            <div
              v-for="room in getZoneRooms(6)"
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

      <!-- 8人专区 -->
      <div class="zone-card">
        <div class="zone-header zone-8">
          <div class="zone-icon">🔥</div>
          <div class="zone-info">
            <h2>8人专区</h2>
            <p class="zone-desc">3狼人 · 预言家 · 女巫 · 守卫 · 2村民</p>
          </div>
        </div>
        <div class="zone-body">
          <button class="btn btn-create-zone" @click="handleCreateRoom(8)" :disabled="creating">
            {{ creating === 8 ? '创建中...' : '+ 创建8人房间' }}
          </button>
          <div class="zone-rooms">
            <div v-if="getZoneRooms(8).length === 0" class="zone-empty">暂无房间</div>
            <div
              v-for="room in getZoneRooms(8)"
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

      <!-- 12人专区 -->
      <div class="zone-card">
        <div class="zone-header zone-12">
          <div class="zone-icon">⚔️</div>
          <div class="zone-info">
            <h2>12人专区</h2>
            <p class="zone-desc">4狼人 · 预言家 · 女巫 · 守卫 · 猎人 · 4村民</p>
          </div>
        </div>
        <div class="zone-body">
          <button class="btn btn-create-zone" @click="handleCreateRoom(12)" :disabled="creating">
            {{ creating === 12 ? '创建中...' : '+ 创建12人房间' }}
          </button>
          <div class="zone-rooms">
            <div v-if="getZoneRooms(12).length === 0" class="zone-empty">暂无房间</div>
            <div
              v-for="room in getZoneRooms(12)"
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
const creating = ref(0) // 0=none, or the player count being created

function getZoneRooms(mode) {
  return rooms.value.filter(r => Number(r.maxPlayers) === Number(mode))
}

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

async function handleCreateRoom(mode) {
  creating.value = mode
  roomStore.createRoom(mode)
  setTimeout(() => { creating.value = 0 }, 3000)
}

function handleJoinRoom(code) {
  if (!code) return
  roomStore.joinRoom(code)
}
</script>
