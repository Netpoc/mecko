import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, getToken } from '../api/http'
import { set as idbSet } from 'idb-keyval'
import { useAuthStore } from './auth'
import {
  saveVehiclesForUser,
  loadVehiclesForUser,
  saveAdvisoryForUser,
  removeAdvisoryCache,
  loadAdvisoryForUser,
} from '../lib/deviceCache'
import { DEFAULT_ACTIVITY_TITLES } from '../constants/serviceActivities'
import {
  loadQueue,
  saveQueue,
  remapVehicleIdInQueue,
  enqueueVehicleCreate,
  enqueueServiceActivity,
  getPendingActivitiesForVehicle,
  makeOfflineVehicleId,
  makeOfflineActivityId,
  removeServiceActivityFromQueue,
} from '../lib/syncQueue'

const SNAPSHOT_KEY = 'mecko-reminder-snapshot'

async function writeReminderSnapshot(list) {
  try {
    await idbSet(SNAPSHOT_KEY, {
      vehicles: (list || []).map((v) => ({
        id: v.id,
        nickname: v.nickname,
        last_mileage_at: v.last_mileage_at,
      })),
      updatedAt: new Date().toISOString(),
    })
  } catch (_) {
    /* idb optional */
  }
}

function authUserId() {
  try {
    return useAuthStore().user?.id ?? null
  } catch {
    return null
  }
}

function isNetworkFailure(e) {
  return (
    e?.status === 0 ||
    (typeof e?.message === 'string' && e.message.includes('Failed to fetch'))
  )
}

function buildSyntheticActivityRow(vehicleId, localActivityId, body) {
  const performed_at = body.performed_at
    ? new Date(body.performed_at).toISOString()
    : new Date().toISOString()
  let title =
    (body.title && String(body.title).trim()) ||
    DEFAULT_ACTIVITY_TITLES[body.activity_type] ||
    'Service activity'
  if (body.activity_type === 'recommendation_completed' && body.recommendation_ref?.title) {
    title = `Done: ${body.recommendation_ref.title}`
  }
  const now = new Date().toISOString()
  return {
    id: localActivityId,
    vehicle_id: vehicleId,
    activity_type: body.activity_type,
    title,
    notes: body.notes ?? null,
    obd_codes: body.obd_codes ?? null,
    recommendation_ref: body.recommendation_ref ?? null,
    odometer_mi: body.odometer_mi ?? null,
    performed_at,
    created_at: now,
  }
}

function mergeActivities(server, pending) {
  const map = new Map()
  for (const r of [...server, ...pending]) {
    if (r?.id) map.set(r.id, r)
  }
  return [...map.values()].sort((a, b) => {
    const ta = new Date(a.performed_at || a.created_at).getTime()
    const tb = new Date(b.performed_at || b.created_at).getTime()
    return tb - ta
  })
}

/** Keep not-yet-synced vehicles when replacing the list from GET /vehicles. */
function mergeServerVehiclesWithOffline(fresh, previousList) {
  const offline = (previousList || []).filter((v) => String(v.id).startsWith('offline-'))
  const seen = new Set(fresh.map((v) => v.id))
  const merged = [...offline.filter((v) => !seen.has(v.id)), ...fresh]
  merged.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  return merged
}

export const useVehiclesStore = defineStore('vehicles', () => {
  const list = ref([])
  const loading = ref(false)
  const error = ref(null)
  /** Set when an offline vehicle id is replaced after sync (for router redirect). */
  const lastVehicleIdReplacement = ref(null)

  async function persistList() {
    const uid = authUserId()
    if (uid && list.value.length) await saveVehiclesForUser(uid, list.value)
  }

  async function fetchAll() {
    const uid = authUserId()
    loading.value = true
    error.value = null
    if (uid) {
      const cached = await loadVehiclesForUser(uid)
      if (cached?.list?.length) list.value = cached.list
    }
    try {
      const previous = list.value
      const fresh = await api('/api/vehicles')
      list.value = mergeServerVehiclesWithOffline(fresh, previous)
      if (uid) await saveVehiclesForUser(uid, list.value)
      await writeReminderSnapshot(list.value)
    } catch (e) {
      const offline = e.status === 0 || !navigator.onLine
      if (uid) {
        const fallback = await loadVehiclesForUser(uid)
        if (fallback?.list?.length) {
          list.value = fallback.list
          error.value = offline
            ? 'Offline — showing data saved on this device. Reconnect to sync.'
            : 'Could not refresh — showing data saved on this device.'
        } else {
          error.value =
            e.data?.error || e.message || 'Could not load vehicles'
          if (offline) {
            error.value = 'You appear offline and no saved vehicles were found on this device.'
          }
        }
      } else {
        error.value = e.data?.error || e.message || 'Could not load vehicles'
      }
    } finally {
      loading.value = false
    }
  }

  async function createVehicleOffline(payload) {
    const clientId = makeOfflineVehicleId()
    const now = new Date().toISOString()
    const mileageEntryId = makeOfflineActivityId()
    const row = {
      id: clientId,
      nickname: payload.nickname,
      make: payload.make,
      model: payload.model,
      year: payload.year,
      current_odometer_mi: payload.current_odometer_mi,
      last_mileage_at: now,
      last_service_odometer_mi: payload.last_service_odometer_mi ?? null,
      last_service_date: payload.last_service_date ?? null,
      created_at: now,
      offline_initial_mileage: {
        id: mileageEntryId,
        vehicle_id: clientId,
        odometer_mi: payload.current_odometer_mi,
        recorded_at: now,
        note: 'Initial odometer',
      },
    }
    await enqueueVehicleCreate(clientId, payload)
    list.value = [row, ...list.value.filter((v) => v.id !== row.id)]
    await writeReminderSnapshot(list.value)
    await persistList()
    return row
  }

  async function createVehicle(payload) {
    if (!navigator.onLine) {
      return createVehicleOffline(payload)
    }
    try {
      const row = await api('/api/vehicles', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      list.value = [row, ...list.value.filter((v) => v.id !== row.id)]
      await writeReminderSnapshot(list.value)
      await persistList()
      return row
    } catch (e) {
      if (isNetworkFailure(e)) {
        return createVehicleOffline(payload)
      }
      throw e
    }
  }

  async function updateVehicle(id, patch) {
    const row = await api(`/api/vehicles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    list.value = list.value.map((v) => (v.id === id ? row : v))
    await writeReminderSnapshot(list.value)
    await persistList()
    return row
  }

  async function deleteVehicle(id) {
    if (String(id).startsWith('offline-')) {
      let queue = await loadQueue()
      queue = queue.filter(
        (o) =>
          !(
            (o.type === 'vehicle_create' && o.clientId === id) ||
            (o.type === 'service_activity' && o.vehicleClientId === id)
          )
      )
      await saveQueue(queue)
      list.value = list.value.filter((v) => v.id !== id)
      await removeAdvisoryCache(id)
      await writeReminderSnapshot(list.value)
      await persistList()
      return
    }
    await api(`/api/vehicles/${id}`, { method: 'DELETE' })
    list.value = list.value.filter((v) => v.id !== id)
    await removeAdvisoryCache(id)
    await writeReminderSnapshot(list.value)
    await persistList()
  }

  async function addMileage(id, odometer_mi, note) {
    const data = await api(`/api/vehicles/${id}/mileage`, {
      method: 'POST',
      body: JSON.stringify({ odometer_mi, note: note || null }),
    })
    list.value = list.value.map((v) => (v.id === id ? data.vehicle : v))
    await writeReminderSnapshot(list.value)
    await persistList()
    return data
  }

  async function getMileageHistory(id) {
    if (String(id).startsWith('offline-')) {
      const v = list.value.find((x) => x.id === id)
      if (v?.offline_initial_mileage) return [v.offline_initial_mileage]
      return []
    }
    return api(`/api/vehicles/${id}/mileage`)
  }

  async function getRecommendations(id) {
    if (String(id).startsWith('offline-')) {
      const v = list.value.find((x) => x.id === id)
      if (!v) {
        const err = new Error('Vehicle not found')
        err.status = 404
        throw err
      }
      const now = new Date()
      const ageYears = Math.max(0, now.getFullYear() - Number(v.year))
      return {
        generatedAt: now.toISOString(),
        ageYears,
        miPerWeek: null,
        miPerDay: null,
        items: [],
      }
    }
    return api(`/api/vehicles/${id}/recommendations`)
  }

  async function fetchOne(id) {
    if (String(id).startsWith('offline-')) {
      const row = list.value.find((v) => v.id === id)
      if (row) return row
      const err = new Error('Vehicle not found')
      err.status = 404
      throw err
    }
    const row = await api(`/api/vehicles/${id}`)
    const idx = list.value.findIndex((v) => v.id === id)
    if (idx >= 0) list.value[idx] = row
    else list.value = [row, ...list.value]
    await writeReminderSnapshot(list.value)
    await persistList()
    return row
  }

  /** Save mileage history + advisory payload for offline / quick display */
  async function saveLocalAdvisorySnapshot(vehicleId, history, recs) {
    const uid = authUserId()
    if (!uid) return
    await saveAdvisoryForUser(uid, vehicleId, { history, recs })
  }

  async function getServiceActivities(vehicleId) {
    const queue = await loadQueue()
    const pending = getPendingActivitiesForVehicle(queue, vehicleId)
    let server = []
    try {
      if (navigator.onLine && !String(vehicleId).startsWith('offline-')) {
        server = await api(`/api/vehicles/${vehicleId}/service-activities`)
      }
    } catch (e) {
      if (!isNetworkFailure(e) && e.status !== 404) throw e
      server = []
    }
    return mergeActivities(server, pending)
  }

  async function addServiceActivity(vehicleId, body) {
    const localId = makeOfflineActivityId()
    const previewRow = buildSyntheticActivityRow(vehicleId, localId, body)
    if (!navigator.onLine) {
      await enqueueServiceActivity(vehicleId, body, previewRow)
      return previewRow
    }
    try {
      return await api(`/api/vehicles/${vehicleId}/service-activities`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    } catch (e) {
      if (isNetworkFailure(e)) {
        await enqueueServiceActivity(vehicleId, body, previewRow)
        return previewRow
      }
      throw e
    }
  }

  async function deleteServiceActivity(vehicleId, activityId) {
    if (String(activityId).startsWith('offline-')) {
      await removeServiceActivityFromQueue(vehicleId, activityId)
      return
    }
    await api(`/api/vehicles/${vehicleId}/service-activities/${activityId}`, {
      method: 'DELETE',
    })
  }

  /**
   * Upload queued vehicle creates and service activities (FIFO).
   * Call when the app is online and after login.
   */
  async function flushSyncQueue() {
    if (!navigator.onLine || !getToken()) return
    let queue = await loadQueue()
    if (!queue.length) return

    const uid = authUserId()

    while (queue.length) {
      const op = queue[0]
      if (op.type === 'vehicle_create') {
        try {
          const row = await api('/api/vehicles', {
            method: 'POST',
            body: JSON.stringify(op.payload),
          })
          queue = remapVehicleIdInQueue(queue.slice(1), op.clientId, row.id)
          list.value = list.value.map((v) => (v.id === op.clientId ? row : v))
          lastVehicleIdReplacement.value = { from: op.clientId, to: row.id }
          await writeReminderSnapshot(list.value)
          await persistList()
          if (uid) {
            const cached = await loadAdvisoryForUser(uid, op.clientId)
            if (cached) {
              await saveAdvisoryForUser(uid, row.id, {
                history: cached.history,
                recs: cached.recs,
              })
              await removeAdvisoryCache(op.clientId)
            }
          }
          await saveQueue(queue)
        } catch (e) {
          if (e.status === 401 || e.status === 403) break
          if (e.status >= 400 && e.status < 500) {
            queue = queue.slice(1)
            await saveQueue(queue)
            continue
          }
          break
        }
      } else if (op.type === 'service_activity') {
        let vid = op.vehicleClientId
        if (String(vid).startsWith('offline-')) {
          break
        }
        try {
          await api(`/api/vehicles/${vid}/service-activities`, {
            method: 'POST',
            body: JSON.stringify(op.payload),
          })
          queue = queue.slice(1)
          await saveQueue(queue)
        } catch (e) {
          if (e.status === 401 || e.status === 403) break
          if (e.status >= 400 && e.status < 500) {
            queue = queue.slice(1)
            await saveQueue(queue)
            continue
          }
          break
        }
      } else {
        queue = queue.slice(1)
        await saveQueue(queue)
      }
    }

    if (navigator.onLine && getToken()) {
      try {
        await fetchAll()
      } catch {
        /* ignore */
      }
    }
  }

  function clearLastVehicleIdReplacement() {
    lastVehicleIdReplacement.value = null
  }

  return {
    list,
    loading,
    error,
    lastVehicleIdReplacement,
    clearLastVehicleIdReplacement,
    fetchAll,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    addMileage,
    getMileageHistory,
    getRecommendations,
    fetchOne,
    saveLocalAdvisorySnapshot,
    getServiceActivities,
    addServiceActivity,
    deleteServiceActivity,
    flushSyncQueue,
  }
})
