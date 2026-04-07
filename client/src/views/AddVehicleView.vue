<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useVehiclesStore } from '../stores/vehicles'
import OfflineBanner from '../components/OfflineBanner.vue'

const router = useRouter()
const vehicles = useVehiclesStore()

const nickname = ref('')
const make = ref('')
const model = ref('')
const year = ref(new Date().getFullYear())
const current_odometer_km = ref(0)
const last_service_odometer_km = ref('')
const last_service_date = ref('')
const localError = ref('')
const saving = ref(false)

async function submit() {
  localError.value = ''
  saving.value = true
  try {
    const payload = {
      nickname: nickname.value.trim(),
      make: make.value.trim(),
      model: model.value.trim(),
      year: Number(year.value),
      current_odometer_km: Number(current_odometer_km.value),
      last_service_odometer_km: last_service_odometer_km.value
        ? Number(last_service_odometer_km.value)
        : null,
      last_service_date: last_service_date.value || null,
    }
    const row = await vehicles.createVehicle(payload)
    router.replace({ name: 'vehicle-detail', params: { id: row.id } })
  } catch (e) {
    localError.value = e.data?.error || e.message || 'Could not save vehicle'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page narrow">
    <OfflineBanner />
    <header class="page-header">
      <h1>Add vehicle</h1>
      <p class="muted">Current odometer starts your mileage history.</p>
    </header>

    <form class="card stack" @submit.prevent="submit">
      <div>
        <label class="label" for="nick">Nickname</label>
        <input id="nick" v-model="nickname" class="input" required maxlength="120" />
      </div>
      <div class="row-2">
        <div>
          <label class="label" for="make">Make</label>
          <input id="make" v-model="make" class="input" required />
        </div>
        <div>
          <label class="label" for="model">Model</label>
          <input id="model" v-model="model" class="input" required />
        </div>
      </div>
      <div class="row-2">
        <div>
          <label class="label" for="year">Year</label>
          <input id="year" v-model.number="year" class="input" type="number" min="1980" required />
        </div>
        <div>
          <label class="label" for="odo">Current odometer (km)</label>
          <input id="odo" v-model.number="current_odometer_km" class="input" type="number" min="0" required />
        </div>
      </div>
      <fieldset class="fieldset">
        <legend class="label">Last service (optional)</legend>
        <p class="hint">Improves oil-change estimates.</p>
        <div class="row-2">
          <div>
            <label class="label" for="ls-odo">Odometer at last service</label>
            <input id="ls-odo" v-model="last_service_odometer_km" class="input" type="number" min="0" />
          </div>
          <div>
            <label class="label" for="ls-date">Date</label>
            <input id="ls-date" v-model="last_service_date" class="input" type="date" />
          </div>
        </div>
      </fieldset>
      <p v-if="localError" class="error-text" role="alert">{{ localError }}</p>
      <button type="submit" class="btn btn-primary" :disabled="saving">
        {{ saving ? 'Saving…' : 'Save vehicle' }}
      </button>
    </form>
  </div>
</template>
