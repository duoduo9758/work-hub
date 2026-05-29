import { useState, useCallback } from 'react'
import { AuthProvider, useAuth } from './shared/contexts/AuthContext'
import { MetaProvider } from './shared/contexts/MetaContext'
import { UnsavedChangesProvider, useUnsavedChanges } from './shared/contexts/UnsavedChangesContext'
import LoginScreen from './screens/LoginScreen'
import HeaderBar from './screens/HeaderBar'
import TrackerList from './features/tracker/TrackerList'
import TodoScreen from './features/todo/TodoScreen'
import LeaveScreen from './features/leave/LeaveScreen'
import TimerScreen from './features/timer/TimerScreen'
import Spinner from './shared/components/Spinner'
import './App.css'

// Tabs registry — v3 enables 'leave'. Timer comes in v4.
const TABS = [
  { id: 'tracker', label: 'トラッカー', enabled: true },
  { id: 'todo', label: 'Todo', enabled: true },
  { id: 'leave', label: '休暇', enabled: true },
  { id: 'timer', label: 'タイマー', enabled: true },
]

// ═══════════════════════════════════════════════════════════════════════════
// AppInner — rendered inside AuthProvider
// ═══════════════════════════════════════════════════════════════════════════
function AppInner() {
  const { isInitializing, isLoggedIn, accessCode, initialPinnedId, logout } = useAuth()
  const { ensureSaved } = useUnsavedChanges()
  const [trackers, setTrackers] = useState([])
  const [currentTab, setCurrentTab] = useState('tracker')

  const handleTrackersChange = useCallback((updatedTrackers) => {
    setTrackers(updatedTrackers)
  }, [])

  // Tab change with unsaved-changes guard (AC-TODO-S09).
  const handleTabClick = useCallback(async (tabId) => {
    if (tabId === currentTab) return
    const ok = await ensureSaved()
    if (!ok) return
    setCurrentTab(tabId)
  }, [currentTab, ensureSaved])

  // Logout with unsaved-changes guard.
  const handleLogout = useCallback(async () => {
    const ok = await ensureSaved()
    if (!ok) return
    logout()
  }, [ensureSaved, logout])

  if (isInitializing) {
    return (
      <div className="app-init">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isLoggedIn) {
    return <LoginScreen />
  }

  return (
    <MetaProvider accessCode={accessCode} initialPinnedId={initialPinnedId}>
      <div className="app-layout">
        <HeaderBar trackers={trackers} onLogout={handleLogout} />

        {/* Tab navigation */}
        <nav className="app-tabs" role="tablist" aria-label="主要機能">
          {TABS.map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={currentTab === tab.id}
              disabled={!tab.enabled}
              className={
                'app-tabs__btn' +
                (currentTab === tab.id ? ' app-tabs__btn--active' : '') +
                (!tab.enabled ? ' app-tabs__btn--disabled' : '')
              }
              onClick={() => tab.enabled && handleTabClick(tab.id)}
              title={tab.enabled ? tab.label : `${tab.label}（近日公開）`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Main content area. Each tab pane is always mounted to preserve
            cross-tab data (e.g. HeaderBar needs trackers even when on Todo). */}
        <main className="app-main">
          <div
            className="app-pane"
            style={{ display: currentTab === 'tracker' ? 'block' : 'none' }}
            aria-hidden={currentTab !== 'tracker'}
          >
            <TrackerList onTrackersChange={handleTrackersChange} />
          </div>
          <div
            className="app-pane app-pane--flex"
            style={{ display: currentTab === 'todo' ? 'flex' : 'none' }}
            aria-hidden={currentTab !== 'todo'}
          >
            <TodoScreen />
          </div>
          <div
            className="app-pane app-pane--flex"
            style={{ display: currentTab === 'leave' ? 'flex' : 'none' }}
            aria-hidden={currentTab !== 'leave'}
          >
            <LeaveScreen />
          </div>
          <div
            className="app-pane"
            style={{ display: currentTab === 'timer' ? 'block' : 'none' }}
            aria-hidden={currentTab !== 'timer'}
          >
            <TimerScreen />
          </div>
        </main>
      </div>
    </MetaProvider>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// App — root
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  return (
    <AuthProvider>
      <UnsavedChangesProvider>
        <AppInner />
      </UnsavedChangesProvider>
    </AuthProvider>
  )
}
