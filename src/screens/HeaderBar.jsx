import { useMeta } from '../shared/contexts/MetaContext'
import { calcTracker } from '../features/tracker/tracker-calc'
import './HeaderBar.css'

// ═══════════════════════════════════════════════════════════════════════════
// HeaderBar — global header
//
// - Always rendered (hosts the logout button on the right)
// - When a tracker is pinned: shows progress bar + stats inline
// - When no pin: only logout button is visible (pin content area is empty)
// - PC:     title | progress bar | 残N日/全N日 | 47% | [ログアウト]
// - Mobile: title | thin bar    | 残N日       | 47% | [ログアウト]
// - Unpin is done from the Tracker card itself (no × button in the header)
//
// Props:
//   trackers - array of tracker objects (needed to find pinned tracker data)
//   onLogout - logout handler (already wraps unsaved-changes guard)
// ═══════════════════════════════════════════════════════════════════════════
export default function HeaderBar({ trackers, onLogout }) {
  const { pinnedTrackerId } = useMeta()

  const pinned = trackers?.find(t => t.id === pinnedTrackerId) ?? null
  const pinData = pinned ? calcTracker(pinned) : null

  return (
    <header className="header-bar">
      <div className="header-bar__inner">
        {pinned && pinData ? (
          <>
            <span className="header-bar__title" title={pinned.title}>
              {pinned.title}
            </span>

            <div className="header-bar__bar-wrap" role="progressbar" aria-valuenow={pinData.progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="header-bar__bar-fill" style={{ width: `${pinData.progress}%` }} />
            </div>

            {pinData.isEnded ? (
              <span className="header-bar__stat header-bar__ended">終了</span>
            ) : (
              <>
                <span className="header-bar__stat header-bar__stat--full">
                  残{pinData.remaining}日/全{pinData.totalDays}日
                </span>
                <span className="header-bar__stat header-bar__stat--compact">
                  残{pinData.remaining}日
                </span>
              </>
            )}

            <span className="header-bar__percent">{pinData.progress}%</span>
          </>
        ) : (
          /* No pin: fill the space so logout stays right-aligned */
          <span className="header-bar__empty" aria-hidden="true" />
        )}

        <button
          type="button"
          className="header-bar__logout"
          onClick={onLogout}
          aria-label="ログアウト"
          title="ログアウト"
        >
          ログアウト
        </button>
      </div>
    </header>
  )
}
