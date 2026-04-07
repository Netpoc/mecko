<script setup>
import AppShell from './components/AppShell.vue'
import { useMileageReminders } from './composables/useMileageReminders'

useMileageReminders()
</script>

<template>
  <AppShell />
</template>
