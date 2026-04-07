const base = () =>
  (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') || 'http://localhost:3001'

export function getToken() {
  return localStorage.getItem('mecko_token')
}

export function setToken(t) {
  if (t) localStorage.setItem('mecko_token', t)
  else localStorage.removeItem('mecko_token')
}

export async function api(path, options = {}) {
  const url = `${base()}${path.startsWith('/') ? path : `/${path}`}`
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(url, { ...options, headers })
  const text = await res.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }
  }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Request failed')
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}
