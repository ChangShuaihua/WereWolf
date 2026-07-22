<template>
  <div class="chat-box">
    <h4>💬 聊天</h4>
    <div class="chat-messages" ref="chatContainer">
      <div v-if="messages.length === 0" class="chat-empty">暂无消息</div>
      <div v-for="(msg, i) in messages" :key="i" class="chat-msg" :class="{ 'ai-msg': msg.isAI, 'system-msg': msg.isSystem }">
        <span v-if="msg.isSystem" class="chat-system">{{ msg.message }}</span>
        <template v-else>
          <span class="chat-user">{{ msg.isAI ? '🤖 ' : '' }}{{ msg.username }}:</span>
          <span class="chat-text">{{ msg.message }}</span>
        </template>
      </div>
    </div>
    <form class="chat-input" @submit.prevent="sendMsg">
      <input v-model="text" placeholder="输入消息..." maxlength="200" />
      <button type="submit" class="btn btn-sm">发送</button>
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
.chat-system {
  color: #3b82f6;
  font-weight: bold;
  font-size: 14px;
  text-align: center;
  display: block;
  padding: 4px 0;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 4px;
  margin: 4px 0;
}
</style>
