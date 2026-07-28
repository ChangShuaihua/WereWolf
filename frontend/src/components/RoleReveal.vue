<template>
  <div class="role-reveal-overlay">
    <div class="role-reveal-card" :class="`role-${role}`">
      <div class="role-reveal-icon">{{ roleIcon }}</div>
      <h2 class="role-reveal-title">你的身份是</h2>
      <h1 class="role-reveal-name">{{ roleName }}</h1>
      <p class="role-reveal-desc">{{ roleDesc }}</p>
      <button class="role-reveal-btn" @click="$emit('close')">知道了</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  role: String,
  roleName: String,
})

defineEmits(['close'])

const roleIcons = {
  werewolf: '🐺',
  villager: '👨‍🌾',
  seer: '🔮',
  witch: '🧪',
  hunter: '🏹',
  guard: '🛡️',
}

const roleDescs = {
  werewolf: '每晚可以选择击杀一名玩家，白天伪装成村民',
  villager: '没有特殊能力，通过推理找出狼人',
  seer: '每晚可以查验一名玩家的身份',
  witch: '拥有一瓶解药和一瓶毒药，各限用一次',
  hunter: '被淘汰时可以开枪带走一名玩家',
  guard: '每晚可以守护一名玩家，不能连续守护同一人',
}

const roleIcon = computed(() => roleIcons[props.role] || '❓')
const roleDesc = computed(() => roleDescs[props.role] || '')
</script>

<style scoped>
.role-reveal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(8, 10, 15, 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 24px;
  animation: overlayFadeIn 0.3s ease;
}

@keyframes overlayFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.role-reveal-card {
  width: 100%;
  max-width: 400px;
  background: var(--glass-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: var(--border-medium);
  border-radius: var(--radius-xl);
  padding: 48px 32px 36px;
  text-align: center;
  animation: cardPopIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes cardPopIn {
  0% {
    opacity: 0;
    transform: scale(0.8) translateY(20px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.role-reveal-card.role-werewolf {
  border-color: var(--werewolf-primary);
  box-shadow: 0 0 60px rgba(229, 57, 53, 0.3), 0 20px 60px rgba(0, 0, 0, 0.5);
}

.role-reveal-card.role-villager {
  border-color: var(--villager-primary);
  box-shadow: 0 0 60px var(--villager-glow), 0 20px 60px rgba(0, 0, 0, 0.5);
}

.role-reveal-card.role-seer {
  border-color: var(--ai-primary);
  box-shadow: 0 0 60px var(--ai-glow), 0 20px 60px rgba(0, 0, 0, 0.5);
}

.role-reveal-card.role-witch {
  border-color: #8b5cf6;
  box-shadow: 0 0 60px rgba(139, 92, 246, 0.3), 0 20px 60px rgba(0, 0, 0, 0.5);
}

.role-reveal-card.role-hunter {
  border-color: var(--status-warning);
  box-shadow: 0 0 60px rgba(245, 185, 66, 0.3), 0 20px 60px rgba(0, 0, 0, 0.5);
}

.role-reveal-card.role-guard {
  border-color: #38bdf8;
  box-shadow: 0 0 60px rgba(56, 189, 248, 0.3), 0 20px 60px rgba(0, 0, 0, 0.5);
}

.role-reveal-icon {
  font-size: 5rem;
  line-height: 1;
  margin-bottom: 20px;
  animation: iconFloat 3s ease-in-out infinite;
  filter: drop-shadow(0 0 20px currentColor);
}

@keyframes iconFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.role-werewolf .role-reveal-icon { color: var(--werewolf-light); }
.role-villager .role-reveal-icon { color: var(--villager-light); }
.role-seer .role-reveal-icon { color: var(--ai-light); }
.role-witch .role-reveal-icon { color: #a78bfa; }
.role-hunter .role-reveal-icon { color: var(--status-warning); }
.role-guard .role-reveal-icon { color: #38bdf8; }

.role-reveal-title {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin: 0 0 8px;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.role-reveal-name {
  font-size: 2rem;
  font-weight: 800;
  margin: 0 0 20px;
  color: #f1f5f9;
}

.role-reveal-desc {
  font-size: 0.95rem;
  color: var(--text-secondary);
  line-height: 1.7;
  margin: 0 0 32px;
}

.role-reveal-btn {
  width: 100%;
  padding: 14px 32px;
  font-size: 1rem;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, var(--ai-primary), var(--ai-secondary));
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: var(--font-sans);
  box-shadow: 0 4px 20px var(--ai-glow);
}

.role-reveal-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 28px var(--ai-glow);
}

.role-reveal-btn:active {
  transform: translateY(0);
}

.role-werewolf .role-reveal-btn {
  background: linear-gradient(135deg, var(--werewolf-primary), var(--werewolf-secondary));
  box-shadow: 0 4px 20px var(--werewolf-glow);
}

.role-villager .role-reveal-btn {
  background: linear-gradient(135deg, var(--villager-primary), var(--villager-secondary));
  box-shadow: 0 4px 20px var(--villager-glow);
}

.role-seer .role-reveal-btn {
  background: linear-gradient(135deg, var(--ai-primary), var(--ai-secondary));
  box-shadow: 0 4px 20px var(--ai-glow);
}

.role-witch .role-reveal-btn {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
}

.role-hunter .role-reveal-btn {
  background: linear-gradient(135deg, var(--status-warning), #d97706);
  box-shadow: 0 4px 20px rgba(245, 185, 66, 0.4);
}

.role-guard .role-reveal-btn {
  background: linear-gradient(135deg, #38bdf8, #0284c7);
  box-shadow: 0 4px 20px rgba(56, 189, 248, 0.4);
}
</style>
