<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useVehiclesStore } from '../stores/vehicles'
import { loadAdvisoryForUser } from '../lib/deviceCache'
import { ACTIVITY_TYPE_LABELS, QUICK_ACTIVITY_TYPES } from '../constants/serviceActivities'
import OfflineBanner from '../components/OfflineBanner.vue'
import Modal from '../components/Modal.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const vehicles = useVehiclesStore()

const id = computed(() => route.params.id)
const vehicle = computed(() => vehicles.list.find((v) => v.id === id.value))
const loading = ref(true)
const loadError = ref('')
const dataFromDevice = ref(false)

const odometer = ref(0)
const note = ref('')
const saving = ref(false)
const formError = ref('')
const showMileageModal = ref(false)

const svcOdo = ref('')
const svcDate = ref('')
const svcSaving = ref(false)

const history = ref([])
const recs = ref(null)
const recsError = ref('')

const activities = ref([])
const activitySubmitting = ref(false)
const activityForm = ref({
  activity_type: 'spark_plug_change',
  notes: '',
  obd_codes: '',
  performed_at: '',
  odometer_mi: '',
})

const showObdFields = computed(() =>
  ['obdii_scan', 'obdii_error_fix'].includes(activityForm.value.activity_type)
)

function todayInputDate() {
  const d = new Date()
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

watch(
  vehicle,
  (v) => {
    if (v) {
      odometer.value = v.current_odometer_mi
      svcOdo.value =
        v.last_service_odometer_mi != null ? String(v.last_service_odometer_mi) : ''
      svcDate.value = v.last_service_date ? v.last_service_date.slice(0, 10) : ''
    }
  },
  { immediate: true }
)

async function loadServiceActivities() {
  try {
    activities.value = await vehicles.getServiceActivities(id.value)
  } catch {
    /* offline or error — keep prior list */
  }
}

async function load() {
  loading.value = true
  loadError.value = ''
  dataFromDevice.value = false
  activityForm.value.performed_at = todayInputDate()
  const uid = auth.user?.id
  if (uid) {
    const local = await loadAdvisoryForUser(uid, id.value)
    if (local && ((local.history && local.history.length) || local.recs)) {
      history.value = Array.isArray(local.history) ? local.history : []
      recs.value = local.recs ?? null
      dataFromDevice.value = true
    }
  }

  await vehicles.fetchAll()

  let networkOk = true
  try {
    if (!vehicle.value) await vehicles.fetchOne(id.value)
  } catch (e) {
    networkOk = false
    if (!vehicle.value) {
      loadError.value = e.data?.error || e.message || 'Failed to load vehicle'
      loading.value = false
      return
    }
  }

  if (!vehicles.list.find((v) => v.id === id.value)) {
    loadError.value = 'Vehicle not found.'
    loading.value = false
    return
  }

  try {
    history.value = await vehicles.getMileageHistory(id.value)
  } catch {
    networkOk = false
  }

  try {
    recs.value = await vehicles.getRecommendations(id.value)
    recsError.value = ''
  } catch (e) {
    networkOk = false
    recsError.value = e.data?.error || e.message || 'Could not load recommendations'
    if (!recs.value) recs.value = null
  }

  await loadServiceActivities()

  if (networkOk) dataFromDevice.value = false
  await vehicles.saveLocalAdvisorySnapshot(id.value, history.value, recs.value)
  loading.value = false
}

onMounted(load)

watch(
  () => vehicles.lastVehicleIdReplacement,
  (ev) => {
    if (!ev) return
    if (String(route.params.id) === ev.from) {
      router.replace({ name: 'vehicle-detail', params: { id: ev.to } })
    }
    vehicles.clearLastVehicleIdReplacement()
  }
)

function setQuickType(t) {
  activityForm.value.activity_type = t
}

async function submitActivity() {
  formError.value = ''
  activitySubmitting.value = true
  try {
    const f = activityForm.value
    const body = {
      activity_type: f.activity_type,
      notes: f.notes.trim() || null,
      obd_codes: showObdFields.value ? f.obd_codes.trim() || null : null,
      performed_at: f.performed_at ? new Date(f.performed_at).toISOString() : null,
      odometer_mi: f.odometer_mi === '' || f.odometer_mi == null ? null : Number(f.odometer_mi),
    }
    await vehicles.addServiceActivity(id.value, body)
    f.notes = ''
    f.obd_codes = ''
    f.odometer_mi = ''
    f.performed_at = todayInputDate()
    await loadServiceActivities()
  } catch (e) {
    formError.value = e.data?.error || e.message || 'Could not save activity'
  } finally {
    activitySubmitting.value = false
  }
}

async function markRecDone(item) {
  formError.value = ''
  activitySubmitting.value = true
  try {
    await vehicles.addServiceActivity(id.value, {
      activity_type: 'recommendation_completed',
      recommendation_ref: {
        title: item.title,
        type: item.type,
        severity: item.severity,
        detail: item.detail,
      },
      notes: null,
    })
    await loadServiceActivities()
  } catch (e) {
    formError.value = e.data?.error || e.message || 'Could not log completion'
  } finally {
    activitySubmitting.value = false
  }
}

async function removeActivity(activityId) {
  if (!confirm('Remove this service log entry?')) return
  try {
    await vehicles.deleteServiceActivity(id.value, activityId)
    await loadServiceActivities()
  } catch (e) {
    formError.value = e.data?.error || e.message || 'Could not delete entry'
  }
}

function activityLabel(row) {
  return ACTIVITY_TYPE_LABELS[row.activity_type] || row.title
}

async function submitMileage() {
  formError.value = ''
  saving.value = true
  try {
    await vehicles.addMileage(id.value, Number(odometer.value), note.value.trim() || null)
    note.value = ''
    history.value = await vehicles.getMileageHistory(id.value)
    recs.value = await vehicles.getRecommendations(id.value)
    await vehicles.saveLocalAdvisorySnapshot(id.value, history.value, recs.value)
    dataFromDevice.value = false
    showMileageModal.value = false
  } catch (e) {
    formError.value = e.data?.error || e.message || 'Could not save mileage'
  } finally {
    saving.value = false
  }
}

async function openMileageModal() {
  formError.value = ''
  showMileageModal.value = true
  await nextTick()
}

async function saveLastService() {
  formError.value = ''
  svcSaving.value = true
  try {
    await vehicles.updateVehicle(id.value, {
      last_service_odometer_mi: svcOdo.value ? Number(svcOdo.value) : null,
      last_service_date: svcDate.value || null,
    })
    recs.value = await vehicles.getRecommendations(id.value)
    await vehicles.saveLocalAdvisorySnapshot(id.value, history.value, recs.value)
    dataFromDevice.value = false
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
      <p v-if="dataFromDevice" class="device-cache-banner" role="status">
        Showing saved data from this device. Connect to the internet to refresh mileage history and
        advisories from the server.
      </p>
      <header class="page-header">
        <RouterLink to="/vehicles" class="back-link">← Vehicles</RouterLink>
        <h1>{{ vehicle.nickname }}</h1>
        <p class="muted">{{ vehicle.make }} {{ vehicle.model }} · {{ vehicle.year }}</p>
      </header>

      <details class="card collapsible" open>
        <summary>
          Log mileage
          <span class="collapsible-chevron" aria-hidden="true">▶</span>
        </summary>
        <div class="collapsible-body stack">
          <p class="muted">
            Last reading: {{ vehicle.current_odometer_mi.toLocaleString() }} mi
            <span v-if="vehicle.last_mileage_at">
              · {{ new Date(vehicle.last_mileage_at).toLocaleString() }}
            </span>
          </p>
          <button type="button" class="btn btn-primary" @click="openMileageModal">
            Enter current odometer
          </button>
        </div>
      </details>

      <Modal
        v-model="showMileageModal"
        title="Update odometer"
        description="Enter your current odometer reading in miles. This updates reminders and improves service timing estimates."
      >
        <form class="stack" @submit.prevent="submitMileage">
          <div>
            <label class="label" for="new-odo">Current odometer (mi)</label>
            <input
              id="new-odo"
              data-autofocus
              v-model.number="odometer"
              class="input"
              type="number"
              :min="vehicle.current_odometer_mi"
              required
            />
          </div>
          <div>
            <label class="label" for="mile-note">Note (optional)</label>
            <input id="mile-note" v-model="note" class="input" maxlength="500" />
          </div>
          <div class="row-2">
            <button type="button" class="btn btn-secondary" @click="showMileageModal = false">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Saving…' : 'Save mileage' }}
            </button>
          </div>
        </form>
      </Modal>

      <details class="card collapsible">
        <summary>
          Last service (oil timing)
          <span class="collapsible-chevron" aria-hidden="true">▶</span>
        </summary>
        <div class="collapsible-body stack">
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
        </div>
      </details>

      <details class="card collapsible" open>
        <summary>
          Service activities
          <span class="collapsible-chevron" aria-hidden="true">▶</span>
        </summary>
        <div class="collapsible-body stack">
          <p class="muted">
            Record work you have done (plugs, OBD scans, fixes, tires, brake fluid). Service log syncs
            to your account when online.
          </p>
          <div class="quick-actions" role="group" aria-label="Quick add activity type">
            <button
              v-for="q in QUICK_ACTIVITY_TYPES"
              :key="q.type"
              type="button"
              class="btn btn-secondary"
              @click="setQuickType(q.type)"
            >
              {{ q.label }}
            </button>
          </div>
          <form class="stack" @submit.prevent="submitActivity">
            <div>
              <label class="label" for="act-type">Activity type</label>
              <select id="act-type" v-model="activityForm.activity_type" class="input">
                <option value="spark_plug_change">Spark plug change</option>
                <option value="obdii_scan">OBD-II scan / codes recorded</option>
                <option value="obdii_error_fix">Error code fix / repair</option>
                <option value="tire_replacement">Tire replacement</option>
                <option value="brake_fluid_change">Brake fluid change</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div v-if="showObdFields">
              <label class="label" for="act-obd">OBD codes (e.g. P0301, P0420)</label>
              <input
                id="act-obd"
                v-model="activityForm.obd_codes"
                class="input"
                maxlength="500"
                placeholder="Comma or space separated"
              />
            </div>
            <div>
              <label class="label" for="act-notes">Notes / error report</label>
              <textarea
                id="act-notes"
                v-model="activityForm.notes"
                class="input textarea"
                rows="3"
                maxlength="2000"
                placeholder="What was done, scan results, parts used…"
              />
            </div>
            <div class="row-2">
              <div>
                <label class="label" for="act-date">Date performed</label>
                <input id="act-date" v-model="activityForm.performed_at" class="input" type="date" />
              </div>
              <div>
                <label class="label" for="act-odo">Odometer (optional)</label>
                <input
                  id="act-odo"
                  v-model="activityForm.odometer_mi"
                  class="input"
                  type="number"
                  min="0"
                  placeholder="mi"
                />
              </div>
            </div>
            <button type="submit" class="btn btn-primary" :disabled="activitySubmitting">
              {{ activitySubmitting ? 'Saving…' : 'Add to service log' }}
            </button>
          </form>

          <ul class="service-log-list">
            <li v-for="a in activities" :key="a.id" class="service-log-item">
              <div class="service-log-head">
                <div>
                  <strong>{{ activityLabel(a) }}</strong>
                  <span v-if="a.title !== activityLabel(a)" class="muted"> — {{ a.title }}</span>
                  <p v-if="a.obd_codes" class="service-log-meta">Codes: {{ a.obd_codes }}</p>
                  <p v-if="a.notes" class="muted">{{ a.notes }}</p>
                  <template v-if="a.recommendation_ref">
                    <p class="service-log-meta">
                      Completed recommendation: {{ a.recommendation_ref.title }}
                    </p>
                    <p v-if="a.recommendation_ref.detail" class="muted small-detail">
                      {{ a.recommendation_ref.detail }}
                    </p>
                  </template>
                  <p class="service-log-meta">
                    {{ new Date(a.performed_at).toLocaleString() }}
                    <span v-if="a.odometer_mi != null"> · {{ a.odometer_mi.toLocaleString() }} mi</span>
                  </p>
                </div>
                <button
                  type="button"
                  class="btn-text"
                  :aria-label="'Remove log entry ' + activityLabel(a)"
                  @click="removeActivity(a.id)"
                >
                  Remove
                </button>
              </div>
            </li>
          </ul>
          <p v-if="!activities.length" class="muted">No service activities logged yet.</p>
        </div>
      </details>

      <details v-if="recs" class="card collapsible">
        <summary>
          Service &amp; component guidance
          <span class="collapsible-chevron" aria-hidden="true">▶</span>
        </summary>
        <div class="collapsible-body stack">
          <p class="hint">
            Based on your recent mileage trend and vehicle age. Always follow your owner’s manual and a
            qualified mechanic.
          </p>
          <ul class="rec-list">
            <li v-for="(item, i) in recs.items" :key="i" class="rec-item rec-item-actions">
              <span :class="severityClass(item.severity)">{{ item.severity }}</span>
              <div class="rec-body">
                <strong>{{ item.title }}</strong>
                <p class="muted">{{ item.detail }}</p>
                <button
                  type="button"
                  class="btn btn-secondary rec-done-btn"
                  :disabled="activitySubmitting"
                  @click="markRecDone(item)"
                >
                  Log recommended fix done
                </button>
              </div>
            </li>
          </ul>
        </div>
      </details>
      <p v-else-if="recsError" class="error-text">{{ recsError }}</p>

      <details class="card collapsible">
        <summary>
          Mileage history
          <span class="collapsible-chevron" aria-hidden="true">▶</span>
        </summary>
        <div class="collapsible-body">
          <ul class="history-list">
            <li v-for="e in history" :key="e.id">
              <span>{{ e.odometer_mi.toLocaleString() }} mi</span>
              <span class="muted">{{ new Date(e.recorded_at).toLocaleString() }}</span>
              <span v-if="e.note" class="muted">{{ e.note }}</span>
            </li>
          </ul>
          <p v-if="!history.length" class="muted">No entries yet.</p>
        </div>
      </details>

      <details class="card collapsible danger-zone">
        <summary>
          Danger zone
          <span class="collapsible-chevron" aria-hidden="true">▶</span>
        </summary>
        <div class="collapsible-body">
          <button type="button" class="btn btn-danger" @click="removeVehicle">Delete vehicle</button>
        </div>
      </details>

      <p v-if="formError" class="error-text" role="alert">{{ formError }}</p>
    </template>
  </div>
</template>

<style scoped>
.textarea {
  min-height: 5rem;
  resize: vertical;
  padding-top: calc(var(--space) * 1.5);
  padding-bottom: calc(var(--space) * 1.5);
}

.rec-item-actions {
  grid-template-columns: auto 1fr;
}

.rec-body {
  min-width: 0;
}

.rec-done-btn {
  margin-top: calc(var(--space) * 1.5);
}

.small-detail {
  font-size: 0.875rem;
  margin: var(--space) 0 0;
}

.service-log-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: calc(var(--space) * 2);
}
</style>
