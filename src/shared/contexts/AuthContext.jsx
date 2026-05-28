import { createContext, useContext, useState, useEffect } from 'react'
import { safeGetItem, safeSetItem, safeRemoveItem } from '../../lib/storage'
import { uuid } from '../../lib/uuid'
import { ensureSchema } from '../../lib/migration'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [accessCode, setAccessCode] = useState(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [loginError, setLoginError] = useState(null)
  // pinnedTrackerId from ensureSchema, passed to MetaContext
  const [initialPinnedId, setInitialPinnedId] = useState(null)

  // Ensure browser-level clientId exists (not user-scoped)
  useEffect(() => {
    if (!safeGetItem('workHub_clientId')) {
      safeSetItem('workHub_clientId', uuid())
    }
  }, [])

  // Auto-login from localStorage on mount
  useEffect(() => {
    const savedCode = safeGetItem('workHub_accessCode')
    if (savedCode) {
      performLogin(savedCode, true).catch(() => {
        setIsInitializing(false)
      })
    } else {
      setIsInitializing(false)
    }
  }, [])

  async function performLogin(code, isAuto = false) {
    setLoginError(null)
    try {
      const result = await ensureSchema(code)
      setAccessCode(code)
      setInitialPinnedId(result.pinnedTrackerId ?? null)
      setIsLoggedIn(true)
      safeSetItem('workHub_accessCode', code)
      return result
    } catch (e) {
      if (!isAuto) {
        setLoginError('データの読み込みに失敗しました。再試行してください')
      }
      safeRemoveItem('workHub_accessCode')
      throw e
    } finally {
      setIsInitializing(false)
    }
  }

  function logout() {
    const code = accessCode
    if (code) {
      // Clear all user-scoped localStorage keys
      const timerKeys = [
        'timer_state', 'timer_mode', 'timer_startedAt',
        'timer_countdown_seconds', 'timer_last_countdown_seconds', 'timer_sound_enabled',
      ]
      timerKeys.forEach(k => safeRemoveItem(`workHub_${code}_${k}`))
    }
    safeRemoveItem('workHub_accessCode')
    setAccessCode(null)
    setInitialPinnedId(null)
    setIsLoggedIn(false)
  }

  return (
    <AuthContext.Provider value={{
      accessCode,
      isLoggedIn,
      isInitializing,
      loginError,
      initialPinnedId,
      login: performLogin,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
