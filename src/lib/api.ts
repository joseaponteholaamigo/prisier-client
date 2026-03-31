import axios from 'axios'
import mockApi from '../mocks/mockApi'

const USE_MOCK = import.meta.env.VITE_MOCK_MODE === 'true'

const realApi = axios.create({
  baseURL: 'http://localhost:5001/api',
  headers: { 'Content-Type': 'application/json' },
})

realApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Mutex para evitar múltiples refresh simultáneos
let isRefreshing = false
let pendingRequests: Array<(token: string) => void> = []

function onRefreshed(token: string) {
  pendingRequests.forEach(cb => cb(token))
  pendingRequests = []
}

realApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      // Si ya hay un refresh en curso, encolar esta petición
      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingRequests.push((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(realApi(originalRequest))
          })
        })
      }

      isRefreshing = true
      try {
        const accessToken = localStorage.getItem('access_token')
        const refreshToken = localStorage.getItem('refresh_token')
        const { data } = await axios.post('http://localhost:5001/api/auth/refresh', {
          accessToken,
          refreshToken,
        })
        localStorage.setItem('access_token', data.accessToken)
        localStorage.setItem('refresh_token', data.refreshToken)
        isRefreshing = false
        onRefreshed(data.accessToken)
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
        return realApi(originalRequest)
      } catch {
        isRefreshing = false
        pendingRequests = []
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api: any = USE_MOCK ? mockApi : realApi

export default api
