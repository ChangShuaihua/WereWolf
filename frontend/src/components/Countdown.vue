<template>
  <div class="countdown-bar">
    <div class="countdown-fill" :style="{ width: percent + '%' }" :class="urgencyClass"></div>
    <span class="countdown-text">{{ remaining }}s</span>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { countdownPercent, countdownUrgency } from '../utils/countdown.js'

const props = defineProps({
  timeout: { type: Number, default: 60 },
  phase: { type: String, default: '' },
})

const remaining = ref(0)
let timer = null

const percent = computed(() => countdownPercent(remaining.value, props.timeout))

const urgencyClass = computed(() => countdownUrgency(percent.value))

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

<style scoped>
.countdown-bar {
  position: relative;
  width: clamp(88px, 16vw, 180px);
  height: 24px;
  overflow: hidden;
  background: var(--bg-secondary);
  border: var(--border-medium);
  border-radius: 999px;
}

.countdown-fill {
  height: 100%;
  border-radius: inherit;
  transition: width 1s linear;
}

.countdown-fill.safe { background: var(--status-success); }
.countdown-fill.warning { background: var(--status-warning); }
.countdown-fill.danger { background: var(--status-error); }

.countdown-text {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: .72rem;
  font-weight: 700;
  text-shadow: 0 1px 2px var(--bg-primary);
}

@media (max-width: 768px) {
  .countdown-bar { width: 72px; height: 22px; }
}
</style>
