/**
 * Persist pending mutations while offline; flush to the API when back online.
 */
import { get, set } from 'idb-keyval'

const QUEUE_KEY = 'mecko-sync-queue'

function cloneForStorage(value) {
  if (value === undefined || value === null) return value
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return null
  }
}

export async function loadQueue() {
  const q = await get(QUEUE_KEY)
  return Array.isArray(q) ? q : []
}

export async function saveQueue(queue) {
  await set(QUEUE_KEY, cloneForStorage(queue) ?? [])
}

export function makeOfflineVehicleId() {
  return `offline-${crypto.randomUUID()}`
}

export function makeOfflineActivityId() {
  return `offline-${crypto.randomUUID()}`
}

export function remapVehicleIdInQueue(queue, oldId, newId) {
  return queue.map((op) => {
    if (op.type === 'service_activity' && op.vehicleClientId === oldId) {
      return { ...op, vehicleClientId: newId }
    }
    return op
  })
}

export async function enqueueVehicleCreate(clientId, payload) {
  const q = await loadQueue()
  q.push({
    type: 'vehicle_create',
    clientId,
    payload,
    createdAt: new Date().toISOString(),
  })
  await saveQueue(q)
}

export async function enqueueServiceActivity(vehicleClientId, payload, previewRow) {
  const q = await loadQueue()
  q.push({
    type: 'service_activity',
    vehicleClientId,
    localActivityId: previewRow.id,
    payload,
    previewRow,
    createdAt: new Date().toISOString(),
  })
  await saveQueue(q)
}

/** Remove a pending service activity (e.g. user deleted before sync). */
export async function removeServiceActivityFromQueue(vehicleClientId, localActivityId) {
  const q = await loadQueue()
  const next = q.filter(
    (o) =>
      !(
        o.type === 'service_activity' &&
        o.vehicleClientId === vehicleClientId &&
        o.localActivityId === localActivityId
      )
  )
  await saveQueue(next)
}

export function getPendingActivitiesForVehicle(queue, vehicleId) {
  return queue
    .filter((o) => o.type === 'service_activity' && o.vehicleClientId === vehicleId)
    .map((o) => o.previewRow)
}

export async function clearSyncQueue() {
  await saveQueue([])
}
