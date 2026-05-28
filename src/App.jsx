import { useState, useCallback } from 'react'
import { AuthProvider, useAuth } from './shared/contexts/AuthContext'
import { MetaProvider } from './shared/contexts/MetaContext'
import LoginScreen from './screens/LoginScreen'
import HeaderBar from './screens/HeaderBar'
import TrackerList from './features/tracker/TrackerList'
import Spinner from './shared/components/Spinner'
import './App.css'

// ═══════════════════════════════════════════════════════════════════════════
// AppInner — rendered inside AuthProvider, reads auth context
// ═══════════════════════════════════════════════════════════════════════════
function AppInner() {
  const { isInitializing, isLoggedIn, accessCode, initialPinnedId, logout } = useAuth()

  // ★ trackers state lives here so HeaderBar can access the pinned tracker's data
  const [trackers, setTrackers] = useState([])

  const handleTrackersChange = useCallback((updatedTrackers) => {
    setTrackers(updatedTrackers)
  }, [])

  // ── Initializing (auto-login in progress) ─────────────────────────────
  if (isInitializing) {
    return (
      <div className="app-init">
        <Spinner size="lg" />
      </div>
    )
  }

  // ── Not logged in ──────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return <LoginScreen />
  }

  // ── Logged in ──────────────────────────────────────────────────────────
  return (
    <MetaProvider accessCode={accessCode} initialPinnedId={initialPinnedId}>
      <div className="app-layout">
        {/* Sticky header with pinned tracker bar */}
        <HeaderBar trackers={trackers} />

        {/* Main content area */}
        <main className="app-main">
          {/* v1: TrackerList only. BottomNav + tabs added in v2+ */}
          <TrackerList onTrackersChange={handleTrackersChange} />
        </main>

        {/* Logout — temp bottom link (will be replaced by nav in v2+) */}
        <footer className="app-footer">
          <button className="app-footer__logout" onClick={logout}>
            ログアウト
          </button>
        </footer>
      </div>
    </MetaProvider>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// App — root: AuthProvider wraps everything
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
