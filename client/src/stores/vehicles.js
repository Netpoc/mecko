import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api/http'
import { set as idbSet } from 'idb-keyval'
import { useAuthStore } from './auth'
import {
  saveVehiclesForUser,
  loadVehiclesForUser,
  saveAdvisoryForUser,
  removeAdvisoryCache,
} from '../lib/deviceCache'

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

export const useVehiclesStore = defineStore('vehicles', () => {
  const list = ref([])
  const loading = ref(false)
  const error = ref(null)

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
      const fresh = await api('/api/vehicles')
      list.value = fresh
      if (uid) await saveVehiclesForUser(uid, fresh)
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

  async function createVehicle(payload) {
    const row = await api('/api/vehicles', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    list.value = [row, ...list.value.filter((v) => v.id !== row.id)]
    await writeReminderSnapshot(list.value)
    await persistList()
    return row
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
    await api(`/api/vehicles/${id}`, { method: 'DELETE' })
    list.value = list.value.filter((v) => v.id !== id)
    await removeAdvisoryCache(id)
    await writeReminderSnapshot(list.value)
    await persistList()
  }

  async function addMileage(id, odometer_km, note) {
    const data = await api(`/api/vehicles/${id}/mileage`, {
      method: 'POST',
      body: JSON.stringify({ odometer_km, note: note || null }),
    })
    list.value = list.value.map((v) => (v.id === id ? data.vehicle : v))
    await writeReminderSnapshot(list.value)
    await persistList()
    return data
  }

  async function getMileageHistory(id) {
    return api(`/api/vehicles/${id}/mileage`)
  }

  async function getRecommendations(id) {
    return api(`/api/vehicles/${id}/recommendations`)
  }

  async function fetchOne(id) {
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
    return api(`/api/vehicles/${vehicleId}/service-activities`)
  }

  async function addServiceActivity(vehicleId, body) {
    return api(`/api/vehicles/${vehicleId}/service-activities`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  async function deleteServiceActivity(vehicleId, activityId) {
    await api(`/api/vehicles/${vehicleId}/service-activities/${activityId}`, {
      method: 'DELETE',
    })
  }

  return {
    list,
    loading,
    error,
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
  }
})
