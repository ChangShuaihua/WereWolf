<template>
  <div class="chat-box">
    <div class="chat-messages" ref="chatContainer">
      <div v-if="messages.length === 0" class="chat-empty">
        <span class="empty-icon">💬</span>
        <p>暂无消息，开始聊天吧</p>
      </div>
      <!-- W18: 使用 timestamp+username+index 组合 key，避免列表变动时复用错位 -->
      <div v-for="(msg, i) in messages" :key="(msg.timestamp || '') + '_' + (msg.username || '') + '_' + i" class="chat-msg" :class="{ 'ai-msg': msg.isAI, 'system-msg': msg.isSystem }">
        <span v-if="msg.isSystem" class="chat-system">{{ msg.message }}</span>
        <template v-else>
          <span class="chat-user">{{ msg.isAI ? '🤖 ' : '' }}{{ msg.username }}:</span>
          <span class="chat-text">{{ msg.message }}</span>
        </template>
      </div>
    </div>
    <div v-if="!canSpeak" class="chat-disabled-hint">
      {{ disabledHint }}
    </div>
    <form class="chat-input" @submit.prevent="sendMsg" :class="{ 'is-disabled': !canSpeak }">
      <input 
        v-model="text" 
        :placeholder="canSpeak ? '输入消息...' : disabledHint"
        maxlength="200"
        class="chat-input-field"
        :disabled="!canSpeak"
      />
      <button type="submit" class="chat-send-btn" :disabled="!text.trim() || !canSpeak">
        <span>发送</span>
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import socket from '../socket'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  phase: { type: String, default: 'WAITING' },
  currentSpeaker: { type: String, default: null },
  isAlive: { type: Boolean, default: true },
})

const emit = defineEmits(['send'])

const text = ref('')
const chatContainer = ref(null)

// Game phase labels
const PHASE_LABELS = {
  WAITING: '等待中',
  NIGHT: '夜晚',
  LAST_WILL: '死亡遗言',
  DISCUSSION: '自由讨论',
  DAY: '轮流发言',
  VOTE: '投票',
  END: '游戏结束',
}

// Check if player can speak
const canSpeak = computed(() => {
  const phase = props.phase
  const mySocketId = socket.id
  
  // Waiting phase: everyone can speak
  if (phase === 'WAITING') return true
  
  // Night, vote, end phases: no one can speak
  if (phase === 'NIGHT' || phase === 'VOTE' || phase === 'END') return false
  
  // Dead player cannot speak (even during last will)
  if (!props.isAlive) return false
  
  // Last will phase: only current dead speaker can speak
  if (phase === 'LAST_WILL') {
    return props.currentSpeaker === mySocketId
  }
  
  // Discussion phase: everyone can speak
  if (phase === 'DISCUSSION') return true
  
  // Day phase (ordered speaking): only current speaker can speak
  if (phase === 'DAY') {
    return props.currentSpeaker === mySocketId
  }
  
  return false
})

// Hint message when chat is disabled
const disabledHint = computed(() => {
  const phase = props.phase
  
  if (phase === 'WAITING') return ''
  if (phase === 'NIGHT') return '🌙 夜晚阶段不能发言'
  if (phase === 'VOTE') return '🗳️ 投票阶段不能发言'
  if (phase === 'END') return '🏆 游戏已结束'
  if (phase === 'LAST_WILL') {
    if (!props.isAlive) return '💀 你已死亡，不能发言'
    return '💀 现在是其他人的死亡遗言阶段'
  }
  if (phase === 'DISCUSSION') {
    if (!props.isAlive) return '💀 你已死亡，不能发言'
    return ''
  }
  if (phase === 'DAY') {
    if (!props.isAlive) return '💀 你已死亡，不能发言'
    return '🎤 现在轮到其他人发言'
  }
  
  return '当前阶段不能发言'
})

function sendMsg() {
  if (!canSpeak.value) return
  const msg = text.value.trim()
  if (!msg) return
  emit('send', msg)
  text.value = ''
}

watch(() => props.messages.length, async () => {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
})
</script>

<style scoped>
.chat-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: 100%;
  gap: 12px;
  padding: 16px;
  box-sizing: border-box;
  overflow: hidden;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 6px;
  min-height: 0;
  max-height: 100%;
}

.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-tertiary);
  gap: 8px;
}

.chat-empty .empty-icon {
  font-size: 2rem;
  opacity: 0.5;
}

.chat-empty p {
  margin: 0;
  font-size: 0.9rem;
}

.chat-msg {
  padding: 10px 14px;
  background: var(--bg-secondary);
  border: var(--border-thin);
  border-radius: var(--radius-md);
  font-size: 0.88rem;
  line-height: 1.5;
  word-break: break-word;
  transition: background 0.2s;
}

.chat-msg:hover {
  background: var(--bg-tertiary);
}

.chat-msg.ai-msg {
  background: rgba(155, 109, 255, 0.08);
  border-color: rgba(155, 109, 255, 0.2);
}

.chat-user {
  font-weight: 600;
  font-size: 0.82rem;
  color: var(--ai-light);
  margin-right: 6px;
}

.chat-text {
  color: var(--text-primary);
}

.chat-system {
  display: block;
  text-align: center;
  padding: 6px 12px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  color: #60a5fa;
  font-weight: 500;
}

.chat-input {
  display: flex;
  gap: 10px;
  padding-top: 8px;
  border-top: var(--border-thin);
  flex-shrink: 0;
  position: sticky;
  bottom: 0;
  background: var(--bg-primary, var(--glass-bg));
  z-index: 1;
}

.chat-input-field {
  flex: 1;
  height: 40px;
  padding: 0 14px;
  background: var(--bg-secondary);
  border: var(--border-thin);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.88rem;
  font-family: var(--font-sans);
  outline: none;
  transition: all 0.2s;
}

.chat-input-field::placeholder {
  color: var(--text-tertiary);
}

.chat-input-field:hover {
  border-color: var(--text-tertiary);
}

.chat-input-field:focus {
  border-color: var(--ai-primary);
  background: var(--bg-tertiary);
  box-shadow: 0 0 0 3px var(--ai-glow);
}

.chat-send-btn {
  height: 40px;
  padding: 0 18px;
  background: linear-gradient(135deg, var(--ai-primary), var(--ai-secondary));
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-sans);
}

.chat-send-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--ai-glow);
}

.chat-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: var(--text-tertiary);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

/* Disabled hint */
.chat-disabled-hint {
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  color: #f87171;
  text-align: center;
  font-weight: 500;
}

/* Chat input disabled state */
.chat-input.is-disabled {
  opacity: 0.6;
}

.chat-input.is-disabled .chat-input-field {
  background: var(--bg-secondary);
  cursor: not-allowed;
}

.chat-input.is-disabled .chat-input-field:disabled {
  background: var(--bg-secondary);
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.chat-input.is-disabled .chat-input-field:disabled::placeholder {
  color: var(--text-tertiary);
}

.chat-input.is-disabled .chat-send-btn {
  background: var(--bg-tertiary);
  cursor: not-allowed;
}

.chat-input.is-disabled .chat-send-btn:disabled {
  opacity: 0.5;
}
</style>
