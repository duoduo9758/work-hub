import { useEffect, useState } from 'react'
import './SaveStatusBadge.css'

// ═══════════════════════════════════════════════════════════════════════════
// SaveStatusBadge — visual indicator for useDebounceSave status
// AC-TODO-S01..S05
//
// Props:
//   status   - 'idle' | 'dirty' | 'saving' | 'saving_slow' | 'saved' | 'failed' | 'conflict'
//   onRetry  - () => void (shown when status === 'failed')
//   savedAt  - Date | null (used to display HH:MM in 'saved' state)
// ═══════════════════════════════════════════════════════════════════════════
export default function SaveStatusBadge({ status, onRetry, savedAt }) {
  // Track last save time locally if parent doesn't provide
  const [internalSavedAt, setInternalSavedAt] = useState(null)
  useEffect(() => {
    if (status === 'saved' && !savedAt) {
      setInternalSavedAt(new Date())
    }
  }, [status, savedAt])

  const displaySavedAt = savedAt ?? internalSavedAt

  function fmt(d) {
    if (!d) return ''
    const h = d.getHours().toString().padStart(2, '0')
    const m = d.getMinutes().toString().padStart(2, '0')
    return `${h}:${m}`
  }

  let cls = 'save-status-badge'
  let text = ''
  let showRetry = false

  switch (status) {
    case 'idle':
      cls += ' save-status-badge--idle'
      text = ''
      break
    case 'dirty':
      cls += ' save-status-badge--dirty'
      text = '未保存の変更あり'
      break
    case 'saving':
      cls += ' save-status-badge--saving'
      text = '保存中...'
      break
    case 'saving_slow':
      cls += ' save-status-badge--saving'
      text = '保存に時間がかかっています...'
      break
    case 'saved':
      cls += ' save-status-badge--saved'
      text = displaySavedAt ? `保存済み ${fmt(displaySavedAt)}` : '保存済み'
      break
    case 'failed':
      cls += ' save-status-badge--failed'
      text = '保存失敗'
      showRetry = true
      break
    case 'conflict':
      cls += ' save-status-badge--conflict'
      text = '他端末で更新されています'
      break
    default:
      text = ''
  }

  if (!text) return null

  return (
    <div className={cls} role="status" aria-live="polite">
      <span className="save-status-badge__text">{text}</span>
      {showRetry && (
        <button
          type="button"
          className="save-status-badge__retry"
          onClick={onRetry}
        >
          再試行
        </button>
      )}
    </div>
  )
}
