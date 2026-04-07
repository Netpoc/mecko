import { onMounted, onUnmounted } from 'vue'
import { useVehiclesStore } from '../stores/vehicles'

function weeksSince(iso) {
  if (!iso) return 999
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 999
  return (Date.now() - t) / (7 * 24 * 60 * 60 * 1000)
}

let lastForegroundNudge = {}

export function useMileageReminders() {
  const vehicles = useVehiclesStore()
  let timer = null

  function tick() {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const list = vehicles.list || []
    const hour = new Date().getHours()
    for (const v of list) {
      const w = weeksSince(v.last_mileage_at)
      if (w < 1) continue
      const last = lastForegroundNudge[v.id] || 0
      const minMs = w >= 3 ? 20 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
      if (Date.now() - last < minMs) continue
      if (w >= 3 && (hour < 6 || hour > 11)) continue
      const body =
        w >= 3
          ? `${v.nickname}: enter your current odometer (daily reminder).`
          : `${v.nickname}: weekly mileage check — enter your current odometer.`
      try {
        new Notification('Mecko — mileage check', { body, tag: `fg-mileage-${v.id}` })
        lastForegroundNudge[v.id] = Date.now()
      } catch (_) {
        /* ignore */
      }
    }
  }

  onMounted(() => {
    tick()
    timer = window.setInterval(tick, 60 * 60 * 1000)
    window.addEventListener('online', tick)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') tick()
    })
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
    window.removeEventListener('online', tick)
  })

  return { tick }
}

export async function registerPeriodicMileageCheck() {
  if (!('serviceWorker' in navigator)) return { ok: false, reason: 'no-sw' }
  const reg = await navigator.serviceWorker.ready
  if (!reg.periodicSync) return { ok: false, reason: 'no-periodic-sync' }
  try {
    await reg.periodicSync.register('mileage-check', {
      minInterval: 24 * 60 * 60 * 1000,
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: e.message || 'register-failed' }
  }
}

export async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  const r = await Notification.requestPermission()
  return r
}
