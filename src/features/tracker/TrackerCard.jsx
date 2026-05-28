import { calcTracker } from './tracker-calc'
import Button from '../../shared/components/Button'
import './TrackerCard.css'

// ═══════════════════════════════════════════════════════════════════════════
// TrackerCard — single tracker display card (S1 screen)
//
// Props:
//   tracker  - tracker document object
//   isPinned - whether this tracker is currently pinned in the header
//   onPin    - () => void  (toggle pin)
//   onEdit   - () => void
//   onDelete - () => void
// ═══════════════════════════════════════════════════════════════════════════
export default function TrackerCard({ tracker, isPinned, onPin, onEdit, onDelete }) {
  const { totalDays, elapsed, remaining, progress, isEnded } = calcTracker(tracker)

  return (
    <div className={`tracker-card${isPinned ? ' tracker-card--pinned' : ''}`}>
      {/* Header: title + pin button */}
      <div className="tracker-card__header">
        <h3 className="tracker-card__title">{tracker.title}</h3>
        <button
          className={`tracker-card__pin-btn${isPinned ? ' tracker-card__pin-btn--active' : ''}`}
          onClick={onPin}
          aria-label={isPinned ? 'ピン解除' : 'ピン留め'}
          title={isPinned ? 'ピン解除' : 'ピン留め'}
        >
          {isPinned ? '◉' : '○'}
        </button>
      </div>

      {/* Date range */}
      <p className="tracker-card__dates">
        {tracker.startDate} 〜 {tracker.endDate}
      </p>

      {/* Progress bar */}
      <div className="tracker-card__bar-wrap" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="tracker-card__bar-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Stats row */}
      <div className="tracker-card__stats">
        {isEnded ? (
          <span className="tracker-card__ended">終了</span>
        ) : (
          <span className="tracker-card__detail">
            経過{elapsed}日 / 全{totalDays}日（残{remaining}日）
          </span>
        )}
        <span className="tracker-card__percent">{progress}%</span>
      </div>

      {/* Action buttons */}
      <div className="tracker-card__actions">
        <Button variant="tertiary" onClick={onEdit}>編集</Button>
        <Button variant="tertiary" onClick={onDelete} className="tracker-card__delete-btn">削除</Button>
      </div>
    </div>
  )
}
