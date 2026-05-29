import { useMeta } from '../shared/contexts/MetaContext'
import { calcTracker } from '../features/tracker/tracker-calc'
import './HeaderBar.css'

// ═══════════════════════════════════════════════════════════════════════════
// HeaderBar — global header showing the pinned tracker progress bar
//
// - Hidden entirely when no tracker is pinned (AC-TRK-14)
// - PC:     title | progress bar | 残N日/全N日 | 47%
// - Mobile: title | thin bar    | 残N日       | 47%
// - Unpin is done from the Tracker card itself (no × button in the header)
//
// Props:
//   trackers - array of tracker objects (needed to find pinned tracker data)
// ═══════════════════════════════════════════════════════════════════════════
export default function HeaderBar({ trackers }) {
  const { pinnedTrackerId } = useMeta()

  // Find pinned tracker from the array
  const pinned = trackers?.find(t => t.id === pinnedTrackerId) ?? null

  if (!pinned) {
    // No pin: render hidden placeholder to prevent layout jump (AC-TRK-27)
    return <div className="header-bar header-bar--hidden" aria-hidden="true" />
  }

  const { totalDays, remaining, progress, isEnded } = calcTracker(pinned)

  return (
    <header className="header-bar">
      <div className="header-bar__inner">
        {/* Title */}
        <span className="header-bar__title" title={pinned.title}>
          {pinned.title}
        </span>

        {/* Progress bar */}
        <div className="header-bar__bar-wrap" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="header-bar__bar-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Stats (PC shows full, mobile shows compact) */}
        {isEnded ? (
          <span className="header-bar__stat header-bar__ended">終了</span>
        ) : (
          <>
            {/* Full stats (PC only via CSS) */}
            <span className="header-bar__stat header-bar__stat--full">
              残{remaining}日/全{totalDays}日
            </span>
            {/* Compact stats (Mobile only via CSS) */}
            <span className="header-bar__stat header-bar__stat--compact">
              残{remaining}日
            </span>
          </>
        )}

        <span className="header-bar__percent">{progress}%</span>
      </div>
    </header>
  )
}
