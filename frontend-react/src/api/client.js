import axios from 'axios'

export const TOKEN_KEY = 'simrs_token'
export const REFRESH_KEY = 'simrs_refresh'
export const USER_KEY = 'simrs_user'

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setSession({ access_token, refresh_token, user }) {
  localStorage.setItem(TOKEN_KEY, access_token)
  if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token)
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
}

export function readUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

let refreshing = null

async function refreshToken() {
  const token = localStorage.getItem(REFRESH_KEY)
  if (!token) throw new Error('Sesi berakhir')
  if (!refreshing) {
    refreshing = axios
      .post('/api/v1/auth/refresh', { refresh_token: token })
      .then(({ data }) => {
        setSession(data.data)
        return data.data.access_token
      })
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

function attachInterceptors(instance) {
  instance.interceptors.request.use((config) => {
    const token = getToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    config.headers['X-Request-Id'] = uuid()
    return config
  })
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config || {}
      const status = error.response?.status
      const url = original.url || ''
      if (status === 401 && !original._retry && !url.includes('/auth/login') && !url.includes('/auth/refresh')) {
        original._retry = true
        try {
          const token = await refreshToken()
          original.headers = original.headers || {}
          original.headers.Authorization = `Bearer ${token}`
          return instance(original)
        } catch {
          clearSession()
          if (window.location.pathname !== '/login') window.location.assign('/login')
        }
      }
      return Promise.reject(error)
    },
  )
}

export const api = axios.create({ baseURL: '/api/v1', timeout: 30_000 })
export const nodeApi = axios.create({ baseURL: '/svc/v1', timeout: 30_000 })
attachInterceptors(api)
attachInterceptors(nodeApi)

export function errorMessage(error, fallback = 'Terjadi kesalahan. Silakan coba lagi.') {
  const data = error?.response?.data
  if (data?.message) return data.message
  if (error?.code === 'ERR_NETWORK') return 'Tidak dapat terhubung ke server. Periksa koneksi layanan.'
  return error?.message || fallback
}

export function fieldErrors(error) {
  const errors = error?.response?.data?.errors
  if (!Array.isArray(errors)) return []
  return errors
}

export async function downloadPdf(path, filename) {
  const response = await api.get(path, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export { uuid }

export async function openPdf(path) {
  const response = await api.get(path, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const win = window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return win
}
