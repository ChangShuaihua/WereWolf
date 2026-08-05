<template>
  <div class="countdown-bar">
    <div class="countdown-fill" :style="{ width: percent + '%' }" :class="urgencyClass"></div>
    <span class="countdown-text">{{ remaining }}s</span>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'

const props = defineProps({
  timeout: { type: Number, default: 60 },
  phase: { type: String, default: '' },
})

const remaining = ref(0)
let timer = null

const percent = computed(() => {
  if (!props.timeout) return 0
  return (remaining.value / props.timeout) * 100
})

const urgencyClass = computed(() => {
  if (percent.value < 25) return 'danger'
  if (percent.value < 50) return 'warning'
  return 'safe'
})

// W17: immediate:true 确保组件挂载后立即启动倒计时，避免初始空白
watch([() => props.timeout, () => props.phase], ([newTimeout]) => {
  remaining.value = newTimeout
  startCountdown()
}, { immediate: true })

function startCountdown() {
  clearInterval(timer)
  timer = setInterval(() => {
    if (remaining.value > 0) {
      remaining.value--
    } else {
      clearInterval(timer)
    }
  }, 1000)
}

onUnmounted(() => clearInterval(timer))
</script>
