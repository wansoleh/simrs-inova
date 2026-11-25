import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, clearSession, getToken, readUser, setSession as persistSession } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readUser())
  const [booting, setBooting] = useState(() => Boolean(getToken() && !readUser()))

  useEffect(() => {
    let active = true
    if (!getToken()) {
      setBooting(false)
      return undefined
    }
    if (readUser()) {
      setBooting(false)
      return undefined
    }
    api
      .get('/auth/me')
      .then(({ data }) => {
        if (active) setUser(data.data)
      })
      .catch(() => {
        if (active) {
          clearSession()
          setUser(null)
        }
      })
      .finally(() => {
        if (active) setBooting(false)
      })
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password })
    persistSession(data.data)
    setUser(data.data.user)
    return data.data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // token tetap dihapus di sisi klien
    }
    clearSession()
    setUser(null)
  }, [])

  const hasPermission = useCallback(
    (permission) => {
      if (!permission) return true
      const permissions = user?.permissions || []
      return permissions.includes('*') || permissions.includes(permission)
    },
    [user],
  )

  const value = useMemo(
    () => ({ user, login, logout, hasPermission, booting, isAuthenticated: Boolean(user) }),
    [user, login, logout, hasPermission, booting],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth harus dipakai di dalam AuthProvider')
  return context
}
