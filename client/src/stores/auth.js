import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api, setToken, getToken } from '../api/http'
import { clearVehicleCaches } from '../lib/deviceCache'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(getToken())
  const user = ref(null)
  const loading = ref(false)
  const error = ref(null)

  const isAuthenticated = computed(() => Boolean(token.value))

  async function bootstrap() {
    if (!token.value) return
    try {
      loading.value = true
      user.value = await api('/api/me')
    } catch {
      token.value = null
      setToken(null)
      user.value = null
    } finally {
      loading.value = false
    }
  }

  async function login(email, password) {
    error.value = null
    loading.value = true
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      token.value = data.token
      setToken(data.token)
      user.value = data.user
      return true
    } catch (e) {
      error.value = e.data?.error || e.message || 'Login failed'
      return false
    } finally {
      loading.value = false
    }
  }

  async function register(email, password) {
    error.value = null
    loading.value = true
    try {
      const data = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      token.value = data.token
      setToken(data.token)
      user.value = data.user
      return true
    } catch (e) {
      error.value = e.data?.error || e.message || 'Registration failed'
      return false
    } finally {
      loading.value = false
    }
  }

  function logout() {
    void clearVehicleCaches().catch(() => {})
    token.value = null
    user.value = null
    setToken(null)
  }

  return {
    token,
    user,
    loading,
    error,
    isAuthenticated,
    bootstrap,
    login,
    register,
    logout,
  }
})
