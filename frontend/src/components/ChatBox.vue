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
    <form class="chat-input" @submit.prevent="sendMsg">
      <input 
        v-model="text" 
        placeholder="输入消息..." 
        maxlength="200"
        class="chat-input-field"
      />
      <button type="submit" class="chat-send-btn" :disabled="!text.trim()">
        <span>发送</span>
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  messages: { type: Array, default: () => [] },
})

const emit = defineEmits(['send'])

const text = ref('')
const chatContainer = ref(null)

function sendMsg() {
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
  gap: 12px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 6px;
  min-height: 0;
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
  padding-top: 12px;
  border-top: var(--border-thin);
  flex-shrink: 0;
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
</style>
