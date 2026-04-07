<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const panelRef = ref(null)
let lastActive = null

function close() {
  emit('update:modelValue', false)
}

function onKeydown(e) {
  if (!props.modelValue) return
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
    return
  }
  if (e.key !== 'Tab') return
  const root = panelRef.value
  if (!root) return
  const focusables = root.querySelectorAll(
    'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex=\"-1\"])'
  )
  if (!focusables.length) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      lastActive = document.activeElement
      document.documentElement.classList.add('modal-open')
      await nextTick()
      const root = panelRef.value
      if (root) {
        const auto = root.querySelector('[data-autofocus]')
        if (auto && auto.focus) auto.focus()
        else root.focus()
      }
    } else {
      document.documentElement.classList.remove('modal-open')
      if (lastActive && lastActive.focus) lastActive.focus()
      lastActive = null
    }
  }
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-backdrop" role="presentation" @click.self="close">
      <section
        ref="panelRef"
        class="modal-panel"
        role="dialog"
        aria-modal="true"
        :aria-label="title || 'Dialog'"
        tabindex="-1"
      >
        <header class="modal-header">
          <div class="modal-header-text">
            <h2 v-if="title" class="modal-title">{{ title }}</h2>
            <p v-if="description" class="modal-desc">{{ description }}</p>
          </div>
          <button type="button" class="btn-icon" aria-label="Close" @click="close">
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div class="modal-body">
          <slot />
        </div>
      </section>
    </div>
  </Teleport>
</template>

