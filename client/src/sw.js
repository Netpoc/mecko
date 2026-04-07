/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  precacheAndRoute,
} from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { clientsClaim } from 'workbox-core'
import { get, set } from 'idb-keyval'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Redeploy-safe navigation caching:
// Prefer network for the app shell so we don't serve a stale index.html that references
// hashed assets which no longer exist after a new deployment (common cause of 404s).
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'pages',
      networkTimeoutSeconds: 5,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24,
        }),
      ],
    })
  )
)

self.addEventListener('install', () => self.skipWaiting())
clientsClaim()

registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font',
  new CacheFirst({
    cacheName: 'assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  })
)

const API_BASE =
  typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
    : ''

if (API_BASE) {
  registerRoute(
    ({ url }) => url.href.startsWith(API_BASE) && url.pathname.startsWith('/api/'),
    new NetworkFirst({
      cacheName: 'mecko-api',
      networkTimeoutSeconds: 5,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 80,
          maxAgeSeconds: 60 * 60 * 24,
        }),
      ],
    })
  )
}

function weeksSince(iso) {
  if (!iso) return 999
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 999
  return (Date.now() - t) / (7 * 24 * 60 * 60 * 1000)
}

const SNAPSHOT_KEY = 'mecko-reminder-snapshot'
const NUDGE_STATE_KEY = 'mecko-nudge-state'

async function maybeNotifyMileage() {
  try {
    const snap = await get(SNAPSHOT_KEY)
    if (!snap || !Array.isArray(snap.vehicles)) return
    const state = (await get(NUDGE_STATE_KEY)) || {}
    const hour = new Date().getHours()

    for (const v of snap.vehicles) {
      const w = weeksSince(v.last_mileage_at)
      if (w < 1) continue

      const last = state[v.id] ? new Date(state[v.id]).getTime() : 0
      const minMs = w >= 3 ? 20 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
      if (last && Date.now() - last < minMs) continue

      if (w >= 3 && (hour < 6 || hour > 11)) continue

      const title = 'Mecko — mileage check'
      const body =
        w >= 3
          ? `${v.nickname}: enter your current odometer (daily reminder until updated).`
          : `${v.nickname}: weekly mileage update — enter your current odometer.`
      const tag = `mileage-${v.id}`
      await self.registration.showNotification(title, {
        body,
        tag,
        renotify: true,
        icon: '/pwa-icon.svg',
        badge: '/favicon.svg',
      })
      state[v.id] = new Date().toISOString()
    }
    await set(NUDGE_STATE_KEY, state)
  } catch (e) {
    console.warn('mileage notify', e)
  }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'mileage-check') {
    event.waitUntil(maybeNotifyMileage())
  }
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
