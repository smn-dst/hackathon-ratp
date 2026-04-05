<script setup lang="ts">
definePageMeta({ middleware: [] })

const { connexion, user, chargerProfil, routeParRole } = useAuth()

const email = ref('')
const password = ref('')
const loading = ref(false)
const erreur = ref('')
const showPwd = ref(false)

onMounted(async () => {
  if (user.value) {
    const p = await chargerProfil()
    if (p?.actif) await navigateTo(routeParRole(p.role))
  }
})

async function handleLogin() {
  if (!email.value || !password.value) {
    erreur.value = 'Veuillez renseigner votre email et votre mot de passe.'
    return
  }
  erreur.value = ''
  loading.value = true
  try {
    const route = await connexion(email.value.trim(), password.value)
    await navigateTo(route)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    erreur.value = msg === 'Invalid login credentials'
      ? 'Email ou mot de passe incorrect.'
      : msg || 'Une erreur est survenue.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-dash">
    <header class="login-header">
      <div class="header-brand">
        <div class="logo-circle">
          <svg width="20" height="20" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <circle cx="14" cy="14" r="13" stroke="white" stroke-width="2" />
            <path d="M8 14 Q14 6 20 14 Q14 22 8 14Z" fill="white" opacity="0.9" />
          </svg>
        </div>
        <span class="brand-text"><span class="brand-signal">Signal</span><span class="brand-ratp">RATP</span></span>
        <div class="brand-sep" />
        <span class="role-pill">Connexion</span>
      </div>
    </header>

    <main class="login-main">
      <div class="card login-card">
        <h1 class="login-title">Connexion</h1>
        <p class="login-sub">Accédez à votre espace de gestion des signalements</p>

        <form class="form" @submit.prevent="handleLogin">
          <div class="field">
            <label class="field-label" for="login-email">Adresse email</label>
            <div class="input-wrap">
              <svg class="input-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M2.5 5.5A1.5 1.5 0 014 4h12a1.5 1.5 0 011.5 1.5v9A1.5 1.5 0 0116 16H4a1.5 1.5 0 01-1.5-1.5v-9z"
                  stroke="currentColor" stroke-width="1.4" />
                <path d="M2.5 6l7.5 5 7.5-5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
              </svg>
              <input id="login-email" v-model="email" type="email" class="input" placeholder="votre@email.fr"
                autocomplete="email" :disabled="loading" />
            </div>
          </div>

          <div class="field">
            <label class="field-label" for="login-password">Mot de passe</label>
            <div class="input-wrap input-wrap-password">
              <svg class="input-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect x="4" y="9" width="12" height="8" rx="1.5" stroke="currentColor" stroke-width="1.4" />
                <path d="M7 9V6.5a3 3 0 016 0V9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                <circle cx="10" cy="13" r="1.2" fill="currentColor" />
              </svg>
              <input id="login-password" v-model="password" :type="showPwd ? 'text' : 'password'" class="input"
                placeholder="••••••••" autocomplete="current-password" :disabled="loading" />
              <button type="button" class="eye-btn" aria-label="Afficher ou masquer le mot de passe"
                @click="showPwd = !showPwd">
                <svg v-if="!showPwd" viewBox="0 0 20 20" fill="none">
                  <path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z" stroke="currentColor"
                    stroke-width="1.4" />
                  <circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.4" />
                </svg>
                <svg v-else viewBox="0 0 20 20" fill="none">
                  <path
                    d="M3 3l14 14M8.5 8.6A2.5 2.5 0 0012 12M5.3 5.4C3.6 6.7 2 10 2 10s3 5.5 8 5.5c1.6 0 3-.4 4.2-1.1M10 4.5c4.2.3 7.2 5 7.2 5"
                    stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <Transition name="err">
            <div v-if="erreur" class="erreur-block">
              <svg viewBox="0 0 16 16" fill="none" class="err-icon" aria-hidden="true">
                <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.4" />
                <path d="M8 5v3.5M8 11h.01" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
              </svg>
              {{ erreur }}
            </div>
          </Transition>

          <button type="submit" class="btn-login" :disabled="loading">
            <span v-if="loading" class="spinner" />
            <span v-else>Se connecter</span>
          </button>
        </form>

        <div class="login-footer">
          <div class="role-badges">
            <span class="role-badge">Manager</span>
            <span class="role-badge">RH / Juridique</span>
            <span class="role-badge">COM</span>
            <span class="role-badge role-admin">Admin</span>
          </div>
          <p class="footer-note">Accès réservé aux équipes RATP autorisées</p>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.login-dash {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f0f4f8;
  font-family: 'DM Sans', sans-serif;
  color: #1a1a2e;
}

.login-header {
  background: #1b3f8b;
  padding: 0 24px;
  height: 56px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #00a88f;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.brand-text {
  display: flex;
  gap: 3px;
}

.brand-signal {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
}

.brand-ratp {
  font-size: 16px;
  font-weight: 700;
  color: #00a88f;
}

.brand-sep {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.2);
}

.role-pill {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.login-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}

.card {
  background: #fff;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.login-card {
  width: 100%;
  max-width: 420px;
  padding: 28px 28px 24px;
  animation: card-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes card-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.login-title {
  font-size: 22px;
  font-weight: 700;
  color: #1b3f8b;
  margin-bottom: 6px;
}

.login-sub {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 24px;
  line-height: 1.5;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
}

.input-wrap {
  position: relative;
}

.input-wrap-password .input {
  padding-right: 42px;
}

.input-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: #94a3b8;
  pointer-events: none;
}

.input {
  width: 100%;
  padding: 10px 12px 10px 40px;
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  color: #1a1a2e;
  outline: none;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}

.input::placeholder {
  color: #94a3b8;
}

.input:hover:not(:disabled) {
  border-color: #cbd5e1;
}

.input:focus {
  background: #fff;
  border-color: #1b3f8b;
  box-shadow: 0 0 0 3px rgba(27, 63, 139, 0.12);
}

.input:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.eye-btn {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: #94a3b8;
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: color 0.15s, background 0.15s;
}

.eye-btn:hover {
  color: #64748b;
  background: #f1f5f9;
}

.eye-btn svg {
  width: 18px;
  height: 18px;
}

.erreur-block {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(226, 75, 74, 0.04);
  border-radius: 12px;
  border: 1px solid rgba(226, 75, 74, 0.2);
  font-size: 13px;
  color: #b91c1c;
  line-height: 1.45;
}

.err-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 1px;
  color: #e24b4a;
}

.err-enter-active,
.err-leave-active {
  transition: all 0.2s;
}

.err-enter-from,
.err-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.btn-login {
  width: 100%;
  padding: 10px 14px;
  min-height: 44px;
  background: #1b3f8b;
  border: 1.5px solid #1b3f8b;
  border-radius: 8px;
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  margin-top: 4px;
  transition: background 0.15s, border-color 0.15s, opacity 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-login:hover:not(:disabled) {
  background: #153570;
  border-color: #153570;
}

.btn-login:active:not(:disabled) {
  opacity: 0.92;
}

.btn-login:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.login-footer {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e2e8f0;
  text-align: center;
}

.role-badges {
  display: flex;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.role-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1.5px solid #e2e8f0;
  background: #f8fafc;
  color: #64748b;
}

.role-admin {
  background: #1b3f8b;
  border-color: #1b3f8b;
  color: #fff;
}

.footer-note {
  font-size: 11px;
  color: #94a3b8;
}
</style>