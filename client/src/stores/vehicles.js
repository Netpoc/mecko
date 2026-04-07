import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api/http'
import { set as idbSet } from 'idb-keyval'

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

export const useVehiclesStore = defineStore('vehicles', () => {
  const list = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      list.value = await api('/api/vehicles')
      await writeReminderSnapshot(list.value)
    } catch (e) {
      error.value = e.data?.error || e.message || 'Could not load vehicles'
      if (e.status === 0 || !navigator.onLine) {
        error.value = 'You appear offline — showing last synced data if available.'
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
    return row
  }

  async function updateVehicle(id, patch) {
    const row = await api(`/api/vehicles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    list.value = list.value.map((v) => (v.id === id ? row : v))
    await writeReminderSnapshot(list.value)
    return row
  }

  async function deleteVehicle(id) {
    await api(`/api/vehicles/${id}`, { method: 'DELETE' })
    list.value = list.value.filter((v) => v.id !== id)
    await writeReminderSnapshot(list.value)
  }

  async function addMileage(id, odometer_km, note) {
    const data = await api(`/api/vehicles/${id}/mileage`, {
      method: 'POST',
      body: JSON.stringify({ odometer_km, note: note || null }),
    })
    list.value = list.value.map((v) => (v.id === id ? data.vehicle : v))
    await writeReminderSnapshot(list.value)
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
    return row
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
  }
})
