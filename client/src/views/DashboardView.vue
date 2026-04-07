<script setup>
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useVehiclesStore } from '../stores/vehicles'
import OfflineBanner from '../components/OfflineBanner.vue'

const vehicles = useVehiclesStore()

function weeksSince(iso) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return (Date.now() - t) / (7 * 24 * 60 * 60 * 1000)
}

const attention = computed(() => {
  return (vehicles.list || []).filter((v) => {
    const w = weeksSince(v.last_mileage_at)
    return w != null && w >= 1
  })
})

onMounted(() => {
  vehicles.fetchAll()
})
</script>

<template>
  <div class="page">
    <OfflineBanner />
    <header class="page-header">
      <h1>Dashboard</h1>
      <p class="muted">Quick view of mileage reminders and shortcuts.</p>
    </header>

    <section v-if="vehicles.loading" class="card" aria-busy="true">
      <p>Loading your vehicles…</p>
    </section>
    <p v-else-if="vehicles.error" class="error-text" role="alert">{{ vehicles.error }}</p>

    <section v-if="!vehicles.loading && attention.length" class="card alert-card" aria-labelledby="att-heading">
      <h2 id="att-heading">Needs mileage update</h2>
      <p class="muted">
        After one week without a new reading, we nudge weekly; from week three, morning reminders
        (6–11) until you log mileage.
      </p>
      <ul class="list-plain">
        <li v-for="v in attention" :key="v.id">
          <RouterLink :to="{ name: 'vehicle-detail', params: { id: v.id } }">
            {{ v.nickname }} — update odometer
          </RouterLink>
        </li>
      </ul>
    </section>

    <section class="card">
      <h2>Maintenance guide</h2>
      <p class="muted">
        General how-tos for oil, fluids, tires, brakes, and more — tailored tips still live on each
        vehicle page.
      </p>
      <RouterLink to="/guide" class="btn btn-primary mt-1">Open maintenance guide</RouterLink>
    </section>

    <section class="card">
      <h2>Your vehicles</h2>
      <p v-if="!vehicles.list.length" class="muted">No vehicles yet.</p>
      <ul v-else class="vehicle-grid">
        <li v-for="v in vehicles.list" :key="v.id" class="mini-card">
          <RouterLink :to="{ name: 'vehicle-detail', params: { id: v.id } }" class="mini-link">
            <strong>{{ v.nickname }}</strong>
            <span class="muted">{{ v.make }} {{ v.model }} ({{ v.year }})</span>
            <span>{{ v.current_odometer_mi.toLocaleString() }} mi</span>
          </RouterLink>
        </li>
      </ul>
      <RouterLink to="/vehicles/new" class="btn btn-primary mt-1">Add vehicle</RouterLink>
    </section>
  </div>
</template>
