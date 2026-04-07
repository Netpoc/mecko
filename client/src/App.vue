<script setup>
import AppShell from './components/AppShell.vue'
import { useMileageReminders } from './composables/useMileageReminders'
import { useSyncQueue } from './composables/useSyncQueue'

useMileageReminders()
useSyncQueue()
</script>

<template>
  <AppShell />
</template>
