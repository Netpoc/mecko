<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useVehiclesStore } from '../stores/vehicles'
import OfflineBanner from '../components/OfflineBanner.vue'

const route = useRoute()
const router = useRouter()
const vehicles = useVehiclesStore()

const id = computed(() => route.params.id)
const vehicle = computed(() => vehicles.list.find((v) => v.id === id.value))
const loading = ref(true)
const loadError = ref('')

const odometer = ref(0)
const note = ref('')
const saving = ref(false)
const formError = ref('')

const svcOdo = ref('')
const svcDate = ref('')
const svcSaving = ref(false)

const history = ref([])
const recs = ref(null)
const recsError = ref('')

watch(
  vehicle,
  (v) => {
    if (v) {
      odometer.value = v.current_odometer_km
      svcOdo.value =
        v.last_service_odometer_km != null ? String(v.last_service_odometer_km) : ''
      svcDate.value = v.last_service_date ? v.last_service_date.slice(0, 10) : ''
    }
  },
  { immediate: true }
)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    await vehicles.fetchAll()
    if (!vehicle.value) {
      await vehicles.fetchOne(id.value)
    }
    if (!vehicles.list.find((v) => v.id === id.value)) {
      loadError.value = 'Vehicle not found.'
      return
    }
    history.value = await vehicles.getMileageHistory(id.value)
    try {
      recs.value = await vehicles.getRecommendations(id.value)
      recsError.value = ''
    } catch (e) {
      recs.value = null
      recsError.value = e.data?.error || e.message || 'Could not load recommendations'
    }
  } catch (e) {
    loadError.value = e.data?.error || e.message || 'Failed to load'
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function submitMileage() {
  formError.value = ''
  saving.value = true
  try {
    await vehicles.addMileage(id.value, Number(odometer.value), note.value.trim() || null)
    note.value = ''
    history.value = await vehicles.getMileageHistory(id.value)
    recs.value = await vehicles.getRecommendations(id.value)
  } catch (e) {
    formError.value = e.data?.error || e.message || 'Could not save mileage'
  } finally {
    saving.value = false
  }
}

async function saveLastService() {
  formError.value = ''
  svcSaving.value = true
  try {
    await vehicles.updateVehicle(id.value, {
      last_service_odometer_km: svcOdo.value ? Number(svcOdo.value) : null,
      last_service_date: svcDate.value || null,
    })
    recs.value = await vehicles.getRecommendations(id.value)
  } catch (e) {
    formError.value = e.data?.error || e.message || 'Could not update service info'
  } finally {
    svcSaving.value = false
  }
}

async function removeVehicle() {
  if (!confirm('Delete this vehicle and its mileage history? This cannot be undone.')) return
  try {
    await vehicles.deleteVehicle(id.value)
    router.replace({ name: 'vehicles' })
  } catch (e) {
    formError.value = e.data?.error || e.message || 'Could not delete'
  }
}

function severityClass(s) {
  if (s === 'due') return 'pill pill-warn'
  if (s === 'watch') return 'pill pill-info'
  if (s === 'ok') return 'pill pill-ok'
  return 'pill'
}
</script>

<template>
  <div class="page">
    <OfflineBanner />
    <p v-if="loading" aria-live="polite">Loading…</p>
    <p v-else-if="loadError" class="error-text" role="alert">{{ loadError }}</p>

    <template v-else-if="vehicle">
      <header class="page-header">
        <RouterLink to="/vehicles" class="back-link">← Vehicles</RouterLink>
        <h1>{{ vehicle.nickname }}</h1>
        <p class="muted">{{ vehicle.make }} {{ vehicle.model }} · {{ vehicle.year }}</p>
      </header>

      <section class="card stack" aria-labelledby="mileage-heading">
        <h2 id="mileage-heading">Log mileage</h2>
        <p class="muted">
          Last reading: {{ vehicle.current_odometer_km.toLocaleString() }} km
          <span v-if="vehicle.last_mileage_at">
            · {{ new Date(vehicle.last_mileage_at).toLocaleString() }}
          </span>
        </p>
        <form class="stack" @submit.prevent="submitMileage">
          <div>
            <label class="label" for="new-odo">Current odometer (km)</label>
            <input
              id="new-odo"
              v-model.number="odometer"
              class="input"
              type="number"
              :min="vehicle.current_odometer_km"
              required
            />
          </div>
          <div>
            <label class="label" for="mile-note">Note (optional)</label>
            <input id="mile-note" v-model="note" class="input" maxlength="500" />
          </div>
          <p v-if="formError" class="error-text" role="alert">{{ formError }}</p>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save mileage' }}
          </button>
        </form>
      </section>

      <section class="card stack" aria-labelledby="svc-heading">
        <h2 id="svc-heading">Last service (for oil timing)</h2>
        <p class="hint">Optional — improves oil-change estimates when combined with mileage trend.</p>
        <form class="stack" @submit.prevent="saveLastService">
          <div class="row-2">
            <div>
              <label class="label" for="svc-odo">Odometer at last service</label>
              <input id="svc-odo" v-model="svcOdo" class="input" type="number" min="0" />
            </div>
            <div>
              <label class="label" for="svc-d">Service date</label>
              <input id="svc-d" v-model="svcDate" class="input" type="date" />
            </div>
          </div>
          <button type="submit" class="btn btn-primary" :disabled="svcSaving">
            {{ svcSaving ? 'Saving…' : 'Save service info' }}
          </button>
        </form>
      </section>

      <section v-if="recs" class="card stack" aria-labelledby="rec-heading">
        <h2 id="rec-heading">Service &amp; component guidance</h2>
        <p class="hint">
          Based on your recent mileage trend and vehicle age. Always follow your owner’s manual and a
          qualified mechanic.
        </p>
        <ul class="rec-list">
          <li v-for="(item, i) in recs.items" :key="i" class="rec-item">
            <span :class="severityClass(item.severity)">{{ item.severity }}</span>
            <div>
              <strong>{{ item.title }}</strong>
              <p class="muted">{{ item.detail }}</p>
            </div>
          </li>
        </ul>
      </section>
      <p v-else-if="recsError" class="error-text">{{ recsError }}</p>

      <section class="card" aria-labelledby="hist-heading">
        <h2 id="hist-heading">Mileage history</h2>
        <ul class="history-list">
          <li v-for="e in history" :key="e.id">
            <span>{{ e.odometer_km.toLocaleString() }} km</span>
            <span class="muted">{{ new Date(e.recorded_at).toLocaleString() }}</span>
            <span v-if="e.note" class="muted">{{ e.note }}</span>
          </li>
        </ul>
      </section>

      <section class="card danger-zone">
        <h2>Danger zone</h2>
        <button type="button" class="btn btn-danger" @click="removeVehicle">Delete vehicle</button>
      </section>
    </template>
  </div>
</template>
