<script setup>
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useVehiclesStore } from '../stores/vehicles'
import OfflineBanner from '../components/OfflineBanner.vue'

const vehicles = useVehiclesStore()

onMounted(() => {
  vehicles.fetchAll()
})
</script>

<template>
  <div class="page">
    <OfflineBanner />
    <header class="page-header row-between">
      <div>
        <h1>Vehicles</h1>
        <p class="muted">Select a vehicle to log mileage and view service guidance.</p>
      </div>
      <RouterLink to="/vehicles/new" class="btn btn-primary">Add vehicle</RouterLink>
    </header>

    <p v-if="vehicles.loading" aria-live="polite">Loading…</p>
    <p v-else-if="vehicles.error" class="error-text" role="alert">{{ vehicles.error }}</p>

    <ul v-else class="vehicle-grid">
      <li v-for="v in vehicles.list" :key="v.id" class="card vehicle-card">
        <RouterLink :to="{ name: 'vehicle-detail', params: { id: v.id } }" class="vehicle-card-link">
          <h2>{{ v.nickname }}</h2>
          <p class="muted">{{ v.make }} {{ v.model }} · {{ v.year }}</p>
          <p class="odo">{{ v.current_odometer_mi.toLocaleString() }} mi</p>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
