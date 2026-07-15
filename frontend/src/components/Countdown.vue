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

watch([() => props.timeout, () => props.phase], ([newTimeout]) => {
  remaining.value = newTimeout
  startCountdown()
})

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
