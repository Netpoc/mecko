<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const online = ref(navigator.onLine)

function sync() {
  online.value = navigator.onLine
}

onMounted(() => {
  window.addEventListener('online', sync)
  window.addEventListener('offline', sync)
})

onUnmounted(() => {
  window.removeEventListener('online', sync)
  window.removeEventListener('offline', sync)
})
</script>

<template>
  <div v-if="!online" class="offline-banner" role="status" aria-live="polite">
    <span class="offline-dot" aria-hidden="true" />
    You are offline. The app stays usable; changes sync when you are back online.
  </div>
</template>
