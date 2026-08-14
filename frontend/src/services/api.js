import axios from 'axios'

// In production (Render), VITE_API_URL points to the deployed Flask backend.
// In development, Vite proxy forwards /api → localhost:5000.
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

const api = axios.create({
  baseURL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach token on every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally — but NOT for auth endpoints themselves
// (a 401 on /auth/login means wrong credentials, not an expired session)
api.interceptors.response.use(
  res => res,
  err => {
    const url = err.config?.url || ''
    const isAuthEndpoint = url.includes('/auth/login') ||
                           url.includes('/auth/register') ||
                           url.includes('/auth/change-password')

    if (err.response?.status === 401 && !isAuthEndpoint) {
      // Session expired — clear token and redirect to login
      localStorage.removeItem('token')
      delete api.defaults.headers.common['Authorization']
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
