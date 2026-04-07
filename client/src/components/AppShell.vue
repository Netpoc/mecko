<script setup>
import { computed } from 'vue'
import { useRoute, useRouter, RouterLink, RouterView } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const showNav = computed(() => auth.isAuthenticated && route.name !== 'login')

function logout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="app-root">
    <a href="#main-content" class="skip-link">Skip to main content</a>
    <header v-if="showNav" class="app-header">
      <div class="header-inner">
        <RouterLink to="/" class="brand" aria-label="Mecko home">
          <img src="/favicon.svg" width="32" height="32" alt="" />
          <span>Mecko</span>
        </RouterLink>
        <nav class="nav" aria-label="Primary">
          <RouterLink to="/">Dashboard</RouterLink>
          <RouterLink to="/vehicles">Vehicles</RouterLink>
          <RouterLink to="/settings">Settings</RouterLink>
          <button type="button" class="btn-text" @click="logout">Log out</button>
        </nav>
      </div>
    </header>
    <main id="main-content" class="main" tabindex="-1">
      <RouterView />
    </main>
  </div>
</template>
