<template>
  <div class="login-container">
    <button class="login-theme-toggle" @click="themeStore.toggleTheme()" :title="themeStore.isDark ? '切换到亮色模式' : '切换到暗色模式'">
      <span v-if="themeStore.isDark" class="login-theme-icon">☀️</span>
      <span v-else class="login-theme-icon">🌙</span>
    </button>

    <div class="login-bg">
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
        <div class="hero-features">
          <div class="feature-item">
            <span class="feature-icon">🎯</span>
            <span class="feature-text">智能AI对手</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">🎨</span>
            <span class="feature-text">多种人格可选</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">⚡</span>
            <span class="feature-text">实时互动</span>
          </div>
        </div>
      </div>

      <div class="login-form-wrapper">
        <div class="login-form-card">
          <div class="card-header">
            <h2>{{ isLogin ? '欢迎回来' : '创建账号' }}</h2>
            <p class="card-subtitle">{{ isLogin ? '登录进入狼人世界' : '开启你的游戏之旅' }}</p>
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
              <label class="input-label">密码</label>
              <div class="input-wrapper">
                <span class="input-icon">🔒</span>
                <input 
                  v-model="password" 
                  type="password" 
                  :placeholder="isLogin ? '请输入密码' : '请输入密码（至少6位）'" 
                  minlength="6"
                  required 
                />
              </div>
              <span v-if="!isLogin" class="input-hint">密码长度至少6位，建议包含字母和数字</span>
            </div>

            <div v-if="!isLogin" class="input-group">
              <label class="input-label">确认密码</label>
              <div class="input-wrapper">
                <span class="input-icon">🔐</span>
                <input 
                  v-model="confirmPassword" 
                  type="password" 
                  placeholder="请再次输入密码" 
                  minlength="6"
                  required 
                />
              </div>
            </div>

            <p v-if="error" class="error-message">
              <span class="error-icon">✕</span>
              {{ error }}
            </p>

            <button type="submit" class="btn btn-ai btn-lg btn-block" :disabled="loading">
              <span v-if="loading" class="loading-spinner"></span>
              {{ loading ? '处理中...' : (isLogin ? '登 录' : '注 册') }}
            </button>
          </form>

          <div class="form-footer">
            <span class="toggle-text">{{ isLogin ? '还没有账号？' : '已有账号？' }}</span>
            <button 
              class="toggle-link" 
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
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '../stores/user'
import { useThemeStore } from '../stores/theme'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const themeStore = useThemeStore()

const isLogin = ref(true)
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const forceLogoutMsg = ref('')

onMounted(() => {
  if (route.query.forceLogout === '1') {
    forceLogoutMsg.value = route.query.message || '您的账号已在其他设备登录'
  }
})

function handleToggle() {
  isLogin.value = !isLogin.value
  error.value = ''
  password.value = ''
  confirmPassword.value = ''
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
  loading.value = true
  try {
    if (!isLogin.value) {
      if (password.value.length < 6) {
        error.value = '密码长度至少6位'
        loading.value = false
        return
      }
      if (password.value !== confirmPassword.value) {
        error.value = '两次输入的密码不一致'
        loading.value = false
        return
      }
    }

    if (isLogin.value) {
      await userStore.login(username.value, password.value)
    } else {
      await userStore.register(username.value, password.value)
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
  overflow: hidden;
  background: var(--bg-primary);
  transition: background 0.3s ease;
}

[data-theme="dark"] .login-container {
  background: linear-gradient(180deg, #080A0F 0%, #0D1018 50%, #11141C 100%);
}

[data-theme="light"] .login-container {
  background: linear-gradient(180deg, #e8f4f8 0%, #f0f4f8 50%, #f5f0f8 100%);
}

.login-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
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
  background: linear-gradient(135deg, #F5F7FA, #8B93A7);
  border-radius: 50%;
  box-shadow: 
    0 0 60px rgba(255, 255, 255, 0.3),
    0 0 100px rgba(155, 109, 255, 0.2),
    inset -20px -20px 40px rgba(0, 0, 0, 0.1);
}

.moon-glow {
  position: absolute;
  top: 10%;
  right: 13%;
  width: 160px;
  height: 160px;
  background: radial-gradient(circle, rgba(155, 109, 255, 0.3) 0%, transparent 70%);
  border-radius: 50%;
  animation: glow 4s ease-in-out infinite;
}

.mountain-layer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40%;
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
  height: 25%;
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
  background: radial-gradient(circle, rgba(155, 109, 255, 0.8) 0%, transparent 70%);
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
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 60px 40px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;
}

.login-hero {
  color: var(--text-primary);
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 40px;
}

.logo-icon {
  font-size: 4rem;
  filter: drop-shadow(0 0 20px var(--ai-glow));
  animation: pulse 3s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { filter: drop-shadow(0 0 20px var(--ai-glow)); }
  50% { filter: drop-shadow(0 0 40px var(--ai-glow)); }
}

.brand-text-group {
  display: flex;
  flex-direction: column;
}

.brand-title {
  font-size: 2.8rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--ai-light) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
}

.brand-subtitle {
  font-size: 1.1rem;
  color: var(--text-secondary);
  letter-spacing: 0.15em;
  margin: 0;
}

.hero-features {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 40px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  background: var(--bg-secondary);
  border: var(--border-thin);
  border-radius: var(--radius-lg);
  transition: all 0.3s ease;
}

.feature-item:hover {
  background: var(--bg-tertiary);
  border-color: var(--ai-primary);
  transform: translateX(8px);
}

.feature-icon {
  font-size: 1.8rem;
}

.feature-text {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.login-form-wrapper {
  position: relative;
  display: flex;
  justify-content: center;
}

.login-form-card {
  width: 100%;
  max-width: 420px;
  background: var(--bg-card);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: var(--border-medium);
  border-radius: var(--radius-xl);
  padding: 48px 40px;
  box-shadow: var(--shadow-lg);
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
  margin-bottom: 36px;
}

.card-header h2 {
  font-size: 1.8rem;
  font-weight: 700;
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
  gap: 20px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-secondary);
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
  background: var(--bg-secondary);
  border: var(--border-medium);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 0.95rem;
  transition: all 0.2s;
  outline: none;
}

.input-wrapper input:hover {
  border-color: var(--text-tertiary);
  background: var(--bg-tertiary);
}

.input-wrapper input:focus {
  border-color: var(--ai-primary);
  box-shadow: 0 0 0 3px var(--ai-glow);
  background: var(--bg-tertiary);
}

.input-wrapper input::placeholder {
  color: var(--text-tertiary);
}

.input-hint {
  font-size: 0.78rem;
  color: var(--text-tertiary);
  margin-top: 2px;
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

.btn-ai {
  position: relative;
  overflow: hidden;
}

.btn-ai::after {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    45deg,
    transparent 30%,
    rgba(255, 255, 255, 0.1) 50%,
    transparent 70%
  );
  animation: shimmer 3s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.form-footer {
  text-align: center;
  margin-top: 28px;
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
  border: none;
  color: var(--ai-light);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s;
}

.toggle-link:hover {
  color: var(--ai-primary);
  text-decoration: underline;
}

.form-decoration {
  position: absolute;
  top: -20px;
  right: -20px;
  width: 100px;
  height: 100px;
  pointer-events: none;
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

@media (max-width: 900px) {
  .login-content {
    grid-template-columns: 1fr;
    padding: 40px 20px;
    gap: 40px;
  }
  
  .login-hero {
    text-align: center;
  }
  
  .brand-logo {
    justify-content: center;
  }
  
  .hero-features {
    display: none;
  }
  
  .wolf-silhouette {
    width: 120px;
    height: 90px;
    left: 50%;
    transform: translateX(-50%);
  }
  
  .moon {
    width: 80px;
    height: 80px;
    top: 8%;
    right: 10%;
  }
}

.login-theme-toggle {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: var(--border-thin);
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 0;
  box-shadow: var(--shadow-md);
}

.login-theme-toggle:hover {
  background: var(--bg-tertiary);
  transform: scale(1.1);
  box-shadow: var(--shadow-lg);
}

.login-theme-toggle:active {
  transform: scale(0.95);
}

.login-theme-icon {
  font-size: 1.3rem;
  transition: transform 0.3s ease;
}

.login-theme-toggle:hover .login-theme-icon {
  transform: rotate(20deg);
}
</style>
