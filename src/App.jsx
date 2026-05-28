import { useState, useCallback } from 'react'
import { AuthProvider, useAuth } from './shared/contexts/AuthContext'
import { MetaProvider } from './shared/contexts/MetaContext'
import LoginScreen from './screens/LoginScreen'
import HeaderBar from './screens/HeaderBar'
import TrackerList from './features/tracker/TrackerList'
import TodoScreen from './features/todo/TodoScreen'
import Spinner from './shared/components/Spinner'
import './App.css'

// Tabs registry — v2a adds 'todo' as active. Leave / Timer come in v3 / v4.
const TABS = [
  { id: 'tracker', label: 'トラッカー', enabled: true },
  { id: 'todo', label: 'Todo', enabled: true },
  { id: 'leave', label: '休暇', enabled: false },
  { id: 'timer', label: 'タイマー', enabled: false },
]

// ═══════════════════════════════════════════════════════════════════════════
// AppInner — rendered inside AuthProvider
// ═══════════════════════════════════════════════════════════════════════════
function AppInner() {
  const { isInitializing, isLoggedIn, accessCode, initialPinnedId, logout } = useAuth()
  const [trackers, setTrackers] = useState([])
  const [currentTab, setCurrentTab] = useState('tracker')

  const handleTrackersChange = useCallback((updatedTrackers) => {
    setTrackers(updatedTrackers)
  }, [])

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
        <HeaderBar trackers={trackers} />

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
              onClick={() => tab.enabled && setCurrentTab(tab.id)}
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
        </main>

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
// App — root
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
