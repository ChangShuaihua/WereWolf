<template>
  <div class="login-container">
    <div class="login-bg">
      <div class="night-atmosphere" aria-hidden="true">
        <span class="moon-breath"></span>
        <span class="star-field"></span>
      </div>
      <div class="stars"></div>
      <div class="moon"></div>
      <div class="moon-glow"></div>
      <div class="mountain-layer"></div>
      <div class="mountain-layer-2"></div>
      <div class="wolf-silhouette"></div>
      <div class="mist"></div>
      <div class="particles">
        <span v-for="i in 20" :key="i" class="particle" :style="getParticleStyle(i)"></span>
      </div>
    </div>

    <div class="login-content">
      <div class="login-hero">
        <div class="brand-logo">
          <span class="logo-icon">🐺</span>
          <div class="brand-text-group">
            <h1 class="brand-title">Werewolf AI</h1>
            <p class="brand-subtitle">AI 驱动的狼人杀</p>
          </div>
        </div>
      </div>

      <div class="login-form-wrapper">
        <div class="login-form-card">
          <div class="card-header">
            <h2>{{ isLogin ? '欢迎来到 Werewolf AI' : '创建账号' }}</h2>
            <p class="card-subtitle">{{ isLogin ? '登录账号，进入黑夜对局' : '创建一个账号，加入黑夜对局' }}</p>
          </div>

          <div v-if="forceLogoutMsg" class="force-logout-alert">
            <span class="alert-icon">⚠️</span>
            <span>{{ forceLogoutMsg }}</span>
          </div>

          <form @submit.prevent="handleSubmit" class="login-form">
            <div class="input-group">
              <label class="input-label">用户名</label>
              <div class="input-wrapper">
                <span class="input-icon">👤</span>
                <input 
                  v-model="username" 
                  type="text" 
                  placeholder="请输入用户名" 
                  maxlength="20" 
                  required 
                />
              </div>
            </div>

            <div class="input-group">
              <label class="input-label">{{ passwordLabel }}</label>
              <div class="input-wrapper">
                <span class="input-icon">🔒</span>
                <input
                  ref="passwordInput"
                  v-model="passwordDraft"
                  type="password"
                  :placeholder="passwordPlaceholder"
                  :autocomplete="isLogin ? 'current-password' : 'new-password'"
                  minlength="6"
                  required
                />
              </div>
              <span v-if="!isLogin" class="input-hint">{{ passwordHint }}</span>
              <button
                v-if="!isLogin && confirming"
                type="button"
                class="password-back"
                @click="resetPasswordStep"
              >
                重新输入密码
              </button>
            </div>

            <p v-if="error" class="error-message">
              <span class="error-icon">✕</span>
              {{ error }}
            </p>

            <button type="submit" class="btn btn-ai btn-lg btn-block login-submit" :disabled="loading">
              <span v-if="loading" class="loading-spinner"></span>
              {{ loading ? '处理中...' : submitLabel }}
            </button>
          </form>

          <div class="form-footer">
            <span class="toggle-text">{{ isLogin ? '还没有账号？' : '已有账号？' }}</span>
            <button 
              class="toggle-link"
              :class="{ 'toggle-link-accent': isLogin }"
              @click.prevent="handleToggle"
            >
              {{ isLogin ? '立即创建' : '前往登录' }}
            </button>
          </div>
        </div>

        <div class="form-decoration">
          <div class="decoration-ring"></div>
          <div class="decoration-ring-2"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '../stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const isLogin = ref(true)
const username = ref('')
const password = ref('')
const passwordDraft = ref('')
const confirming = ref(false)
const passwordInput = ref(null)
const loading = ref(false)
const error = ref('')
const forceLogoutMsg = ref('')

const passwordLabel = computed(() => {
  if (isLogin.value || !confirming.value) return '密码'
  return '确认密码'
})

const passwordPlaceholder = computed(() => {
  if (isLogin.value) return '请输入密码'
  if (!confirming.value) return '请输入密码（至少6位）'
  return '请再次输入密码'
})

const passwordHint = computed(() => {
  if (!confirming.value) return '密码长度至少6位，建议包含字母和数字'
  return '请再输入一次刚才的密码'
})

const submitLabel = computed(() => {
  if (isLogin.value) return '登录'
  if (!confirming.value) return '下一步'
  return '注册'
})

onMounted(() => {
  if (route.query.forceLogout === '1') {
    forceLogoutMsg.value = route.query.message || '您的账号已在其他设备登录'
  }
})

function resetPasswordStep() {
  confirming.value = false
  password.value = ''
  passwordDraft.value = ''
  error.value = ''
  nextTick(() => passwordInput.value?.focus())
}

function handleToggle() {
  isLogin.value = !isLogin.value
  error.value = ''
  password.value = ''
  passwordDraft.value = ''
  confirming.value = false
}

function getParticleStyle(i) {
  const size = Math.random() * 4 + 2
  const left = Math.random() * 100
  const delay = Math.random() * 10
  const duration = Math.random() * 15 + 10
  return {
    width: `${size}px`,
    height: `${size}px`,
    left: `${left}%`,
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`
  }
}

async function handleSubmit() {
  error.value = ''

  if (!isLogin.value && !confirming.value) {
    if (passwordDraft.value.length < 6) {
      error.value = '密码长度至少6位'
      return
    }
    password.value = passwordDraft.value
    passwordDraft.value = ''
    confirming.value = true
    await nextTick()
    passwordInput.value?.focus()
    return
  }

  loading.value = true
  try {
    if (!isLogin.value && passwordDraft.value !== password.value) {
      error.value = '两次输入的密码不一致'
      loading.value = false
      return
    }

    const secret = isLogin.value ? passwordDraft.value : password.value
    if (isLogin.value) {
      await userStore.login(username.value, secret)
    } else {
      await userStore.register(username.value, secret)
    }
    router.push('/lobby')
  } catch (err) {
    error.value = err.response?.data?.message || '操作失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  position: relative;
  overflow-x: hidden;
  overflow-y: auto;
  background: #070a12;
}

.login-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(7, 10, 18, 0.12) 0%, rgba(7, 10, 18, 0.02) 36%, rgba(7, 10, 18, 0.42) 100%),
    url('/bg.png') center 28% / cover no-repeat;
}

.night-atmosphere {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.moon-breath {
  position: absolute;
  top: 6%;
  left: 46%;
  width: 240px;
  height: 240px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(196, 52, 42, 0.34) 0%, rgba(196, 52, 42, 0.08) 46%, transparent 72%);
  filter: blur(6px);
  animation: moonBreath 7s ease-in-out infinite;
}

.star-field {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(1.4px 1.4px at 18% 14%, rgba(255, 244, 220, 0.9), transparent),
    radial-gradient(1.2px 1.2px at 72% 11%, rgba(255, 255, 255, 0.8), transparent),
    radial-gradient(1.6px 1.6px at 84% 22%, rgba(255, 220, 180, 0.85), transparent),
    radial-gradient(1px 1px at 30% 28%, rgba(255, 255, 255, 0.7), transparent),
    radial-gradient(1.3px 1.3px at 58% 8%, rgba(255, 236, 210, 0.75), transparent);
  animation: starTwinkle 6.5s ease-in-out infinite;
}

@keyframes moonBreath {
  0%, 100% { opacity: 0.4; transform: scale(0.96); }
  50% { opacity: 0.9; transform: scale(1.08); }
}

@keyframes starTwinkle {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 0.95; }
}

@media (prefers-reduced-motion: reduce) {
  .moon-breath,
  .star-field,
  .login-form-card {
    animation: none;
  }
}

.stars,
.moon,
.moon-glow,
.mountain-layer,
.mountain-layer-2,
.wolf-silhouette,
.mist,
.particles {
  display: none;
}

.stars {
  position: absolute;
  inset: 0;
  background-image: 
    radial-gradient(1px 1px at 20px 30px, rgba(255,255,255,0.8), transparent),
    radial-gradient(1px 1px at 60px 70px, rgba(255,255,255,0.6), transparent),
    radial-gradient(1px 1px at 120px 40px, rgba(255,255,255,0.9), transparent),
    radial-gradient(2px 2px at 180px 100px, rgba(255,255,255,0.7), transparent),
    radial-gradient(1px 1px at 240px 60px, rgba(255,255,255,0.5), transparent),
    radial-gradient(1px 1px at 300px 150px, rgba(255,255,255,0.8), transparent),
    radial-gradient(2px 2px at 360px 80px, rgba(255,255,255,0.6), transparent),
    radial-gradient(1px 1px at 420px 120px, rgba(255,255,255,0.9), transparent);
  background-repeat: repeat;
  background-size: 500px 200px;
  animation: twinkle 8s ease-in-out infinite;
}

@keyframes twinkle {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

.moon {
  position: absolute;
  top: 12%;
  right: 15%;
  width: 120px;
  height: 120px;
  background: radial-gradient(circle at 35% 35%, #f7f1e4, #c4b49a 62%, #8d7b62);
  border-radius: 50%;
  box-shadow:
    0 0 48px rgba(244, 228, 196, 0.35),
    inset -18px -14px 28px rgba(70, 52, 28, 0.18);
}

.moon-glow {
  position: absolute;
  top: 10%;
  right: 13%;
  width: 160px;
  height: 160px;
  background: radial-gradient(circle, rgba(212, 180, 120, 0.35) 0%, transparent 70%);
  border-radius: 50%;
  animation: glow 4s ease-in-out infinite;
}

.mountain-layer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 26%;
  mask-image: linear-gradient(to top, #000 18%, transparent 92%);
  -webkit-mask-image: linear-gradient(to top, #000 18%, transparent 92%);
  background: 
    linear-gradient(135deg, transparent 40%, rgba(13, 16, 24, 0.9) 100%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320'%3E%3Cpath fill='%230D1018' d='M0,224L48,208C96,192,192,160,288,170.7C384,181,480,235,576,240C672,245,768,203,864,181.3C960,160,1056,160,1152,176C1248,192,1344,224,1392,240L1440,256L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z'%3E%3C/path%3E%3C/svg%3E") no-repeat bottom center;
  background-size: cover;
  opacity: 0.8;
}

.mountain-layer-2 {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 16%;
  mask-image: linear-gradient(to top, #000 30%, transparent 100%);
  -webkit-mask-image: linear-gradient(to top, #000 30%, transparent 100%);
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320'%3E%3Cpath fill='%23080A0F' d='M0,288L60,266.7C120,245,240,203,360,213.3C480,224,600,288,720,272C840,256,960,160,1080,149.3C1200,139,1320,213,1380,250.7L1440,288L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z'%3E%3C/path%3E%3C/svg%3E") no-repeat bottom center;
  background-size: cover;
}

.wolf-silhouette {
  position: absolute;
  bottom: 8%;
  left: 8%;
  width: 180px;
  height: 140px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 150'%3E%3Cpath fill='%23080A0F' d='M45,150 L50,80 L35,60 L25,35 L30,20 L45,35 L55,25 L60,10 L70,5 L75,15 L85,10 L90,25 L100,35 L115,20 L120,10 L130,5 L140,15 L150,10 L160,25 L170,45 L165,60 L155,75 L160,95 L170,110 L175,130 L170,150 Z'/%3E%3Cpath fill='%23080A0F' d='M60,90 L55,120 L50,150 L70,150 L75,120 L80,90 Z'/%3E%3Cpath fill='%23080A0F' d='M110,90 L105,120 L100,150 L120,150 L125,120 L130,90 Z'/%3E%3C/svg%3E") no-repeat bottom center;
  background-size: contain;
  opacity: 0.9;
  filter: drop-shadow(0 0 20px rgba(0, 0, 0, 0.5));
  animation: wolfBreathing 4s ease-in-out infinite;
}

@keyframes wolfBreathing {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

.mist {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 30%;
  background: linear-gradient(0deg, rgba(8, 10, 15, 0.8) 0%, transparent 100%);
  animation: mistFlow 20s linear infinite;
}

@keyframes mistFlow {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50px); }
}

.particles {
  position: absolute;
  inset: 0;
}

.particle {
  position: absolute;
  background: radial-gradient(circle, rgba(212, 180, 120, 0.75) 0%, transparent 70%);
  border-radius: 50%;
  animation: float linear infinite;
}

@keyframes float {
  0% {
    transform: translateY(100vh) translateX(0);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(-20px) translateX(30px);
    opacity: 0;
  }
}

.login-content {
  position: relative;
  z-index: 10;
  width: min(440px, 100%);
  margin: 0 auto;
  min-height: 100vh;
  padding: 28px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.login-hero {
  color: #f7f3ec;
  text-align: center;
}

.brand-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  margin: 0;
}

.logo-icon {
  font-size: 2.7rem;
  line-height: 1;
  margin-bottom: -4px;
  filter: drop-shadow(0 0 18px rgba(198, 161, 94, 0.45));
}

.brand-text-group {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.brand-title {
  font-family: var(--font-display);
  font-size: clamp(2.2rem, 4vw, 2.8rem);
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #f7f3ec;
  margin: 0;
  line-height: 1.05;
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.45);
}

.brand-subtitle {
  font-size: 0.92rem;
  letter-spacing: 0.22em;
  margin: 8px 0 0;
  color: #f7f3ec;
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.45);
}

.login-form-wrapper {
  position: relative;
  display: flex;
  justify-content: center;
  width: 100%;
}

.login-form-card {
  width: 100%;
  max-width: 420px;
  background: rgba(8, 12, 22, 0.22);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(212, 175, 110, 0.62);
  border-radius: 28px;
  padding: 28px 28px 20px;
  box-shadow:
    0 0 28px rgba(176, 48, 42, 0.28),
    0 0 64px rgba(92, 36, 78, 0.22),
    0 24px 50px rgba(0, 0, 0, 0.28),
    inset 0 0 0 1px rgba(212, 175, 110, 0.12);
  animation: cardFadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes cardFadeIn {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card-header {
  text-align: center;
  margin-bottom: 12px;
}

.card-header h2 {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.card-subtitle {
  font-size: 0.95rem;
  color: var(--text-secondary);
}

.force-logout-alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: rgba(245, 185, 66, 0.1);
  border: 1px solid rgba(245, 185, 66, 0.3);
  border-radius: var(--radius-md);
  color: var(--status-warning);
  font-size: 0.9rem;
  margin-bottom: 24px;
}

.alert-icon {
  font-size: 1.1rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: #efe6d6;
  letter-spacing: 0.02em;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 16px;
  font-size: 1.1rem;
  opacity: 0.7;
  pointer-events: none;
}

.input-wrapper input {
  width: 100%;
  height: 48px;
  padding: 0 16px 0 48px;
  background: rgba(8, 10, 18, 0.72);
  border: 1px solid rgba(212, 175, 110, 0.62);
  border-radius: 14px;
  color: #f7f3ec;
  font-family: var(--font-sans);
  font-size: 0.95rem;
  transition: all 0.2s;
  outline: none;
}

.input-wrapper input:hover {
  border-color: rgba(196, 92, 84, 0.9);
  background: rgba(18, 10, 16, 0.78);
  box-shadow: 0 0 0 1px rgba(140, 42, 58, 0.35);
}

.input-wrapper input:focus {
  border-color: #e7c27a;
  box-shadow: 0 0 0 3px rgba(160, 48, 62, 0.38), 0 0 18px rgba(231, 194, 122, 0.22);
  background: rgba(12, 8, 14, 0.84);
}

.input-wrapper input::placeholder {
  color: #e4d9c8;
}

.input-hint {
  font-size: 0.78rem;
  color: #e4d9c8;
  margin-top: 2px;
}

.password-back {
  align-self: flex-start;
  margin-top: 2px;
  padding: 0;
  border: none;
  background: none;
  color: #e7c27a;
  font-size: 0.78rem;
  cursor: pointer;
}

.password-back:hover {
  color: #fff6df;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(229, 57, 53, 0.1);
  border: 1px solid rgba(229, 57, 53, 0.3);
  border-radius: var(--radius-md);
  color: var(--status-error);
  font-size: 0.88rem;
  margin: 0;
}

.error-icon {
  font-weight: bold;
}

.loading-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.login-form-card .login-submit {
  margin-top: 8px;
  background: transparent;
  color: #f4e7d0;
  border: 1px solid rgba(212, 175, 110, 0.85);
  box-shadow: none;
  letter-spacing: 0.42em;
  text-indent: 0.42em;
}

.login-form-card .login-submit:hover:not(:disabled) {
  background: rgba(212, 175, 110, 0.16);
  color: #fff8ea;
  box-shadow: 0 0 18px rgba(231, 194, 122, 0.38), 0 0 28px rgba(176, 48, 42, 0.32);
}

.form-footer {
  text-align: center;
  margin-top: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.toggle-text {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.toggle-link {
  background: none;
  border: 1px solid transparent;
  color: #e7c27a;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s, background 0.2s, box-shadow 0.2s, border-color 0.2s;
}

.toggle-link-accent {
  color: #ffe7b0;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 4px 12px;
  border-radius: 999px;
  border-color: rgba(231, 194, 122, 0.7);
  background: rgba(176, 48, 42, 0.28);
  text-shadow: 0 0 12px rgba(231, 194, 122, 0.45);
}

.toggle-link:hover,
.toggle-link-accent:hover {
  color: #fff6df;
  background: rgba(176, 48, 42, 0.42);
  border-color: rgba(255, 214, 150, 0.9);
  box-shadow: 0 0 16px rgba(176, 48, 42, 0.4);
  text-decoration: none;
}

.form-decoration {
  display: none;
}

.decoration-ring {
  position: absolute;
  inset: 0;
  border: 2px solid var(--ai-primary);
  border-radius: 50%;
  opacity: 0.3;
  animation: rotate 10s linear infinite;
}

.decoration-ring-2 {
  position: absolute;
  inset: 15px;
  border: 1px solid var(--werewolf-primary);
  border-radius: 50%;
  opacity: 0.5;
  animation: rotate 6s linear infinite reverse;
}

@keyframes rotate {
  to { transform: rotate(360deg); }
}

@media (min-width: 901px) {
  .login-content {
    width: min(560px, 100%);
    gap: 28px;
  }

  .logo-icon {
    font-size: 3rem;
    margin-bottom: -6px;
  }

  .brand-title {
    font-size: 3.1rem;
  }

  .brand-subtitle {
    font-size: 1rem;
    margin-top: 10px;
  }

  .login-form-card {
    max-width: 560px;
    padding: 40px 44px 32px;
    border-radius: 32px;
  }

  .card-header {
    margin-bottom: 22px;
  }

  .card-header h2 {
    font-size: 1.9rem;
    letter-spacing: 0.04em;
  }

  .card-subtitle {
    font-size: 1.05rem;
  }

  .login-form {
    gap: 20px;
  }

  .input-label {
    font-size: 0.95rem;
  }

  .input-wrapper input {
    height: 56px;
    font-size: 1.05rem;
    border-radius: 16px;
  }

  .login-form-card .login-submit {
    height: 58px;
    margin-top: 12px;
    font-size: 1.15rem;
  }

  .form-footer {
    margin-top: 22px;
  }

  .toggle-text,
  .toggle-link {
    font-size: 1rem;
  }
}

@media (max-width: 900px) {
  .login-container {
    height: 100%;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .login-content {
    min-height: 100%;
    padding: 36px 20px;
  }
}

@media (max-width: 600px) {
  .login-content {
    padding: calc(24px + env(safe-area-inset-top, 0px)) 16px calc(20px + env(safe-area-inset-bottom, 0px));
    gap: 20px;
  }

  .brand-logo {
    gap: 12px;
    margin-bottom: 0;
  }

  .logo-icon {
    font-size: 2.6rem;
  }

  .brand-title {
    font-size: 1.85rem;
    white-space: normal;
  }

  .brand-subtitle {
    letter-spacing: 0.12em;
    font-size: 0.8rem;
  }

  .login-form-card {
    padding: 28px 18px;
  }

  .card-header {
    margin-bottom: 24px;
  }

  .card-header h2 {
    font-size: 1.6rem;
  }
}
</style>
