<template>
  <div class="chat-box">
    <h4>💬 聊天</h4>
    <div class="chat-messages" ref="chatContainer">
      <div v-if="messages.length === 0" class="chat-empty">暂无消息</div>
      <div v-for="(msg, i) in messages" :key="i" class="chat-msg">
        <span class="chat-user">{{ msg.username }}:</span>
        <span class="chat-text">{{ msg.message }}</span>
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
