<template>
  <div class="night-panel">
    <div v-if="!prompt" class="night-waiting">
      <p>🌙 夜晚阶段 - 等待你的行动提示...</p>
      <div v-if="currentNightRole" class="night-role-info">
        <p>{{ currentNightRole.message }}</p>
        <div class="timer-bar">
          <div class="timer-progress" :style="{ width: nightTimerPercent + '%' }"></div>
          <span class="timer-text">⏱️ {{ nightTimeLeft }}秒</span>
        </div>
      </div>
    </div>

    <div v-else-if="actionDone" class="action-done">
      <p class="action-message">✅ 你的行动已确认</p>
      <div class="confirmed-info">
        <p v-if="completedAction === 'save'">💚 使用解药救了 <strong>{{ completedTargetName }}</strong></p>
        <p v-else-if="completedAction === 'poison'">💀 对 <strong>{{ completedTargetName }}</strong> 使用了毒药</p>
        <p v-else-if="completedAction === 'kill'">🗡️ 选择击杀 <strong>{{ completedTargetName }}</strong></p>
        <p v-else-if="completedAction === 'guard'">🛡️ 选择守护 <strong>{{ completedTargetName }}</strong></p>
        <p v-else-if="completedAction === 'check'">🔮 选择查验 <strong>{{ completedTargetName }}</strong></p>
      </div>
      <div v-if="seerResult" class="seer-result">
        <p>🔮 查验结果：{{ seerResult.message }}</p>
      </div>
    </div>

    <div v-else class="night-actions">
      <div class="timer-bar">
        <div class="timer-progress" :style="{ width: timerPercent + '%' }"></div>
        <span class="timer-text">⏱️ {{ timeLeft }}秒</span>
      </div>
      
      <p class="action-message">{{ prompt.message }}</p>
      
      <div v-if="prompt.isWerewolfTeam && prompt.teammates && prompt.teammates.length > 0" class="teammates-info">
        <p>🐺 你的队友：{{ prompt.teammates.map(t => t.username).join('、') }}</p>
      </div>

      <!-- Witch special: show killed info + save/poison options with toggle -->
      <div v-if="prompt.action === 'witch'" class="witch-options">
        <div class="witch-mode-toggle">
          <button
            class="btn btn-mode"
            :class="{ active: witchMode === 'save' }"
            :disabled="!prompt.canSave || actionDone"
            @click="witchMode = 'save'"
          >
            💚 解药模式
          </button>
          <button
            class="btn btn-mode"
            :class="{ active: witchMode === 'poison' }"
            :disabled="!prompt.canPoison || actionDone"
            @click="witchMode = 'poison'"
          >
            💀 毒药模式
          </button>
        </div>

        <div v-if="witchMode === 'save' && prompt.canSave" class="save-option">
          <p v-if="prompt.killed">
            今晚 <strong>{{ prompt.killed.username }}</strong> 被杀，是否使用解药？
          </p>
          <button class="btn btn-warn" @click="confirmSave">💚 使用解药</button>
          <button class="btn btn-secondary" @click="confirmSkip">跳过</button>
        </div>

        <div v-if="witchMode === 'poison' && prompt.canPoison" class="poison-option">
          <p>选择下毒目标：</p>
          <div class="target-grid">
            <button
              v-for="t in prompt.targets"
              :key="t.id"
              class="btn btn-target"
              :class="{ selected: selectedTarget === t.id, disabled: actionDone }"
              :disabled="actionDone"
              @click="selectTarget(t.id)"
            >
              {{ t.username }}
            </button>
          </div>
          <div v-if="selectedTarget" class="action-confirm">
            <button class="btn btn-danger" @click="confirmAction">💀 确认下毒</button>
            <button class="btn btn-secondary" @click="selectedTarget = null">取消</button>
          </div>
        </div>
      </div>

      <!-- Other roles: simple target selection with highlight -->
      <div v-else class="target-grid">
        <button
          v-for="t in prompt.targets"
          :key="t.id"
          class="btn btn-target"
          :class="{ selected: selectedTarget === t.id, disabled: actionDone }"
          :disabled="actionDone"
          @click="selectTarget(t.id)"
        >
          {{ t.username }}
        </button>
        <div v-if="selectedTarget" class="action-confirm">
          <button class="btn btn-primary" @click="confirmAction">确认选择</button>
          <button class="btn btn-secondary" @click="selectedTarget = null">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'

const props = defineProps({
  prompt: { type: Object, default: null },
  seerResult: { type: Object, default: null },
  currentNightRole: { type: Object, default: null },
})

const emit = defineEmits(['action'])

const witchMode = ref('save')
const selectedTarget = ref(null)
const actionDone = ref(false)
const completedAction = ref(null)
const timeLeft = ref(30)
const nightTimeLeft = ref(30)
const timerInterval = ref(null)
const nightTimerInterval = ref(null)

const completedTargetName = computed(() => {
  if (!props.prompt?.targets || !selectedTarget.value) return ''
  const target = props.prompt.targets.find(t => t.id === selectedTarget.value)
  return target?.username || ''
})

const timerPercent = computed(() => {
  return (timeLeft.value / 30) * 100
})

const nightTimerPercent = computed(() => {
  return (nightTimeLeft.value / 30) * 100
})

watch(() => props.prompt, (newPrompt) => {
  if (newPrompt) {
    timeLeft.value = newPrompt.timeout || 30
    startTimer()
  } else {
    clearInterval(timerInterval.value)
  }
}, { immediate: true })

watch(() => props.currentNightRole, (newRole) => {
  if (newRole) {
    nightTimeLeft.value = newRole.timeout || 30
    startNightTimer()
  } else {
    clearInterval(nightTimerInterval.value)
    nightTimeLeft.value = 0
  }
}, { immediate: true })

function startTimer() {
  clearInterval(timerInterval.value)
  timerInterval.value = setInterval(() => {
    if (timeLeft.value > 0) {
      timeLeft.value--
    } else {
      clearInterval(timerInterval.value)
    }
  }, 1000)
}

function startNightTimer() {
  clearInterval(nightTimerInterval.value)
  nightTimerInterval.value = setInterval(() => {
    if (nightTimeLeft.value > 0) {
      nightTimeLeft.value--
    } else {
      clearInterval(nightTimerInterval.value)
    }
  }, 1000)
}

onUnmounted(() => {
  clearInterval(timerInterval.value)
  clearInterval(nightTimerInterval.value)
})

function selectTarget(targetId) {
  if (actionDone.value) return
  selectedTarget.value = selectedTarget.value === targetId ? null : targetId
}

function confirmAction() {
  let action, targetId
  
  if (props.prompt.action === 'witch' && witchMode.value === 'poison') {
    action = 'poison'
    targetId = selectedTarget.value
  } else if (props.prompt.action === 'witch' && witchMode.value === 'save') {
    action = 'save'
    targetId = props.prompt?.killed?.id
  } else {
    action = props.prompt.action
    targetId = selectedTarget.value
  }
  
  emit('action', { action, targetId })
  completedAction.value = action
  actionDone.value = true
}

function confirmSave() {
  emit('action', { action: 'save', targetId: props.prompt?.killed?.id })
  completedAction.value = 'save'
  actionDone.value = true
}

function confirmSkip() {
  emit('action', { action: 'skip' })
  completedAction.value = 'skip'
  actionDone.value = true
}
</script>

<style scoped>
.night-panel {
  background: rgba(0, 0, 0, 0.8);
  padding: 20px;
  border-radius: 12px;
  color: #fff;
}

.night-waiting {
  text-align: center;
  padding: 40px;
}

.night-role-info {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 8px;
  padding: 15px;
  margin-top: 15px;
}

.night-role-info p {
  margin: 5px 0;
  font-size: 16px;
}

.role-players {
  color: #60a5fa;
  font-weight: bold;
}

.action-done {
  text-align: center;
  padding: 30px;
}

.action-done .action-message {
  font-size: 20px;
  margin-bottom: 15px;
  color: #4ade80;
}

.confirmed-info {
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
  border-radius: 8px;
  padding: 15px;
}

.confirmed-info p {
  margin: 5px 0;
  font-size: 16px;
}

.confirmed-info strong {
  color: #4ade80;
}

.seer-result {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 8px;
  padding: 15px;
  margin-top: 15px;
  text-align: center;
}

.seer-result p {
  margin: 0;
  font-size: 18px;
  font-weight: bold;
  color: #60a5fa;
}

.night-actions {
  padding: 10px;
}

.timer-bar {
  position: relative;
  height: 25px;
  background: #374151;
  border-radius: 12px;
  margin-bottom: 15px;
  overflow: hidden;
}

.timer-progress {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #10b981);
  transition: width 1s linear;
}

.timer-text {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #fff;
  font-size: 14px;
  font-weight: bold;
  z-index: 1;
}

.action-message {
  font-size: 16px;
  margin-bottom: 15px;
  text-align: center;
}

.teammates-info {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  padding: 10px;
  text-align: center;
  margin-bottom: 15px;
}

.teammates-info p {
  margin: 0;
  color: #fca5a5;
  font-size: 14px;
}

.witch-options {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.witch-mode-toggle {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.btn-mode {
  padding: 10px 25px;
  border: 2px solid #4a5568;
  border-radius: 8px;
  background: #2d3748;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-mode:hover:not(:disabled) {
  border-color: #718096;
}

.btn-mode.active {
  border-color: #4ade80;
  background: rgba(74, 222, 128, 0.2);
}

.btn-mode:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.save-option {
  text-align: center;
}

.save-option p {
  margin-bottom: 15px;
}

.target-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.btn-target {
  padding: 10px 20px;
  border: 2px solid #ddd;
  border-radius: 8px;
  background: #333;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-target:hover:not(:disabled) {
  border-color: #4ade80;
  background: #444;
}

.btn-target.selected {
  border-color: #4ade80;
  background: #4ade80;
  color: #000;
  font-weight: bold;
}

.btn-target.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-confirm {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 20px;
  width: 100%;
}

.btn-primary {
  background: #3b82f6;
  color: #fff;
  border: none;
  padding: 12px 30px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-danger {
  background: #dc2626;
  color: #fff;
  border: none;
  padding: 12px 30px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}

.btn-danger:hover {
  background: #b91c1c;
}

.btn-warn {
  background: #eab308;
  color: #000;
  border: none;
  padding: 12px 30px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}

.btn-warn:hover {
  background: #ca8a04;
}

.btn-secondary {
  background: #6b7280;
  color: #fff;
  border: none;
  padding: 12px 30px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}

.btn-secondary:hover {
  background: #4b5563;
}
</style>
