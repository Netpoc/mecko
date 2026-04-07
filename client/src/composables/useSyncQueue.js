import { onMounted, onUnmounted, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useVehiclesStore } from '../stores/vehicles'

/** Flush pending offline vehicles / service activities when online or after login. */
export function useSyncQueue() {
  const auth = useAuthStore()
  const vehicles = useVehiclesStore()

  async function flush() {
    if (!auth.isAuthenticated) return
    await vehicles.flushSyncQueue()
  }

  function onOnline() {
    void flush()
  }

  onMounted(() => {
    window.addEventListener('online', onOnline)
    void flush()
  })

  onUnmounted(() => {
    window.removeEventListener('online', onOnline)
  })

  watch(
    () => auth.isAuthenticated,
    (ok) => {
      if (ok) void flush()
    }
  )
}
