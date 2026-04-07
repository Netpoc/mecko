<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const mode = ref('login')

async function submit() {
  const ok =
    mode.value === 'login'
      ? await auth.login(email.value.trim(), password.value)
      : await auth.register(email.value.trim(), password.value)
  if (ok) {
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.replace(redirect || '/')
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card card">
      <h1 class="auth-title">{{ mode === 'login' ? 'Sign in' : 'Create account' }}</h1>
      <p class="muted">Manage mileage, reminders, and service timing for your cars.</p>
      <form class="stack" @submit.prevent="submit">
        <div>
          <label class="label" for="email">Email</label>
          <input
            id="email"
            v-model="email"
            class="input"
            type="email"
            autocomplete="email"
            required
          />
        </div>
        <div>
          <label class="label" for="password">Password</label>
          <input
            id="password"
            v-model="password"
            class="input"
            type="password"
            autocomplete="current-password"
            minlength="8"
            required
          />
          <p v-if="mode === 'register'" class="hint">At least 8 characters.</p>
        </div>
        <p v-if="auth.error" class="error-text" role="alert">{{ auth.error }}</p>
        <button type="submit" class="btn btn-primary btn-block" :disabled="auth.loading">
          {{ auth.loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Register' }}
        </button>
      </form>
      <p class="switch-mode">
        <button type="button" class="btn-text" @click="mode = mode === 'login' ? 'register' : 'login'">
          {{
            mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'
          }}
        </button>
      </p>
    </div>
  </div>
</template>
