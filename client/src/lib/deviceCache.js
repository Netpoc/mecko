/**
 * Persist vehicles and advisory data on-device (IndexedDB) for faster loads and offline viewing.
 */
import { get, set, del, keys } from 'idb-keyval'

const VEHICLES_KEY = 'mecko-vehicles'

function advisoryKey(vehicleId) {
  return `mecko-advisory-${vehicleId}`
}

/** Plain JSON clone so IndexedDB structured clone never sees Vue/Pinia Proxy objects. */
function cloneForStorage(value) {
  if (value === undefined || value === null) return value
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return null
  }
}

export async function saveVehiclesForUser(userId, list) {
  if (!userId) return
  const plain = cloneForStorage(list ?? [])
  await set(VEHICLES_KEY, {
    userId,
    list: plain,
    savedAt: new Date().toISOString(),
  })
}

/** @returns {Promise<{ userId: string, list: unknown[], savedAt: string } | null>} */
export async function loadVehiclesForUser(expectedUserId) {
  if (!expectedUserId) return null
  const row = await get(VEHICLES_KEY)
  if (!row || row.userId !== expectedUserId) return null
  return row
}

export async function saveAdvisoryForUser(userId, vehicleId, { history, recs }) {
  if (!userId || !vehicleId) return
  const plainHistory = cloneForStorage(history ?? [])
  const plainRecs = recs == null ? null : cloneForStorage(recs)
  await set(advisoryKey(vehicleId), {
    userId,
    vehicleId,
    history: plainHistory,
    recs: plainRecs,
    savedAt: new Date().toISOString(),
  })
}

/** @returns {Promise<{ history: unknown[], recs: unknown, savedAt: string } | null>} */
export async function loadAdvisoryForUser(expectedUserId, vehicleId) {
  if (!expectedUserId || !vehicleId) return null
  const row = await get(advisoryKey(vehicleId))
  if (!row || row.userId !== expectedUserId) return null
  return row
}

export async function removeAdvisoryCache(vehicleId) {
  await del(advisoryKey(vehicleId))
}

/** Clear cached vehicles, per-vehicle advisory, and PWA reminder snapshot (privacy / account switch). */
export async function clearVehicleCaches() {
  const ks = await keys()
  for (const k of ks) {
    const s = String(k)
    if (
      s === VEHICLES_KEY ||
      s.startsWith('mecko-advisory-') ||
      s === 'mecko-reminder-snapshot' ||
      s === 'mecko-sync-queue'
    ) {
      await del(k)
    }
  }
}
