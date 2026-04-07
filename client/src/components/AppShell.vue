<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter, RouterLink, RouterView } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const showNav = computed(() => auth.isAuthenticated && route.name !== 'login')
const navOpen = ref(false)
const showBackToTop = ref(false)

const SCROLL_THRESHOLD = 320

function updateBackToTop() {
  showBackToTop.value =
    window.scrollY > SCROLL_THRESHOLD || document.documentElement.scrollTop > SCROLL_THRESHOLD
}

function scrollToTop() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
  const main = document.getElementById('main-content')
  if (main) {
    main.focus({ preventScroll: true })
  }
}

watch(
  () => route.fullPath,
  () => {
    navOpen.value = false
    requestAnimationFrame(() => updateBackToTop())
  }
)

onMounted(() => {
  window.addEventListener('scroll', updateBackToTop, { passive: true })
  updateBackToTop()
})

onUnmounted(() => {
  window.removeEventListener('scroll', updateBackToTop)
})

function toggleNav() {
  navOpen.value = !navOpen.value
}

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
        <button
          type="button"
          class="nav-toggle"
          :aria-expanded="navOpen"
          aria-controls="site-nav"
          @click="toggleNav"
        >
          <span class="nav-toggle-bars" aria-hidden="true" />
          <span class="sr-only">{{ navOpen ? 'Close menu' : 'Open menu' }}</span>
        </button>
        <nav
          id="site-nav"
          class="nav"
          :class="{ 'nav--open': navOpen }"
          aria-label="Primary"
        >
          <RouterLink to="/" @click="navOpen = false">Dashboard</RouterLink>
          <RouterLink to="/vehicles" @click="navOpen = false">Vehicles</RouterLink>
          <RouterLink to="/guide" @click="navOpen = false">Maintenance guide</RouterLink>
          <RouterLink to="/settings" @click="navOpen = false">Settings</RouterLink>
          <button type="button" class="btn-text nav-logout" @click="logout">Log out</button>
        </nav>
      </div>
    </header>
    <main id="main-content" class="main" tabindex="-1">
      <RouterView />
    </main>
    <button
      v-show="showBackToTop"
      type="button"
      class="fab-to-top"
      aria-label="Back to top"
      title="Back to top"
      @click="scrollToTop"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  </div>
</template>
