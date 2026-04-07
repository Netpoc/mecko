<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import {
  requestNotificationPermission,
  registerPeriodicMileageCheck,
} from '../composables/useMileageReminders'
import OfflineBanner from '../components/OfflineBanner.vue'

const perm = ref(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')
const periodic = ref('')
const refreshing = ref(false)

async function enableNotifications() {
  const r = await requestNotificationPermission()
  perm.value = r
  if (r === 'granted') {
    const reg = await registerPeriodicMileageCheck()
    periodic.value = reg.ok
      ? 'Background mileage check registered (Chrome/Edge; requires installed PWA and engagement).'
      : `Background sync not available: ${reg.reason}. Foreground reminders still run while the app is open.`
  }
}

onMounted(async () => {
  if ('serviceWorker' in navigator) {
    refreshing.value = true
    try {
      const reg = await navigator.serviceWorker.ready
      periodic.value =
        'periodicSync' in reg
          ? 'Periodic background sync is supported in this browser.'
          : 'Periodic background sync is not supported — use the installed app on Chrome/Edge for best results.'
    } finally {
      refreshing.value = false
    }
  }
})
</script>

<template>
  <div class="page narrow">
    <OfflineBanner />
    <header class="page-header">
      <h1>Settings</h1>
      <p class="muted">Notifications and offline behaviour.</p>
    </header>

    <section class="card stack">
      <h2>Mileage reminders</h2>
      <p>
        After a week without a new odometer reading, Mecko reminds you weekly. From the third week
        onward, reminders target morning hours (about 6–11) until you log mileage.
      </p>
      <p class="muted">
        Status:
        <strong v-if="perm === 'granted'">Notifications allowed</strong>
        <strong v-else-if="perm === 'denied'">Notifications blocked — enable them in browser settings.</strong>
        <strong v-else-if="perm === 'unsupported'">Not supported in this environment.</strong>
        <strong v-else>Not yet requested</strong>
      </p>
      <button
        v-if="perm !== 'denied' && perm !== 'unsupported'"
        type="button"
        class="btn btn-primary"
        @click="enableNotifications"
      >
        Enable notifications &amp; background check
      </button>
      <p v-if="periodic && perm === 'granted'" class="hint">{{ periodic }}</p>
      <p v-else-if="refreshing" class="muted">Checking browser capabilities…</p>
      <p v-else class="hint">{{ periodic }}</p>
    </section>

    <section class="card stack">
      <h2>Data on this device</h2>
      <p>
        Your vehicle list, mileage history, and advisory summaries are saved in this browser’s
        storage after each successful sync so lists load faster and you can review the last known
        data offline. Logging out clears that saved data from this device.
      </p>
      <p>
        The <RouterLink to="/guide">maintenance guide</RouterLink> is available anytime in the app and
        works fully offline once the page has been opened at least once.
      </p>
    </section>

    <section class="card stack">
      <h2>Offline</h2>
      <p>
        The app shell and recent API responses are also cached by the service worker. New mileage
        entries still need a network connection to reach the server.
      </p>
    </section>

    <section class="card stack">
      <h2>Install app</h2>
      <p>
        Use your browser’s “Install” or “Add to Home Screen” option to get the app icon and
        standalone window. Chrome desktop: install icon in the address bar.
      </p>
    </section>
  </div>
</template>
