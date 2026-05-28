import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../shared/contexts/AuthContext'
import { useMeta } from '../../shared/contexts/MetaContext'
import { loadTrackers, saveTracker } from './tracker-store'
import { deleteTrackerWithPin } from '../../lib/tracker-actions'
import TrackerCard from './TrackerCard'
import TrackerEditModal from './TrackerEditModal'
import TrackerDeleteConfirm from './TrackerDeleteConfirm'
import Button from '../../shared/components/Button'
import Spinner from '../../shared/components/Spinner'
import ErrorMessage from '../../shared/components/ErrorMessage'
import './TrackerList.css'

// ═══════════════════════════════════════════════════════════════════════════
// TrackerList — S1 screen: tracker list, add/edit/delete, pin management
// ═══════════════════════════════════════════════════════════════════════════
export default function TrackerList({ onTrackersChange }) {
  const { accessCode } = useAuth()
  const { pinnedTrackerId, pinTracker, unpinTracker } = useMeta()

  const [trackers, setTrackers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Modal state
  const [editTarget, setEditTarget] = useState(undefined) // undefined=closed, null=new, tracker=edit
  const [deleteTarget, setDeleteTarget] = useState(null)  // null=closed, tracker=confirm
  const [actionError, setActionError] = useState(null)

  // Helper: update trackers state and notify parent (for HeaderBar)
  function updateTrackers(newTrackers) {
    setTrackers(newTrackers)
    onTrackersChange?.(newTrackers)
  }

  // ── Load trackers on mount ─────────────────────────────────────────────
  const fetchTrackers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await loadTrackers(accessCode)
      // Sort by endDate ascending (soonest first)
      data.sort((a, b) => a.endDate.localeCompare(b.endDate))
      updateTrackers(data)
    } catch (e) {
      setError('データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessCode])

  useEffect(() => { fetchTrackers() }, [fetchTrackers])

  // ── Pin / Unpin ────────────────────────────────────────────────────────
  async function handlePin(trackerId) {
    setActionError(null)
    try {
      if (pinnedTrackerId === trackerId) {
        await unpinTracker()
      } else {
        await pinTracker(trackerId)
      }
    } catch (e) {
      setActionError('ピン留めの更新に失敗しました')
    }
  }

  // ── Save (create or update) ────────────────────────────────────────────
  async function handleSave(formData) {
    const isEdit = Boolean(editTarget?.id)
    const trackerData = isEdit
      ? { ...editTarget, ...formData }
      : formData

    const saved = await saveTracker(accessCode, trackerData)

    setTrackers(prev => {
      const next = isEdit
        ? prev.map(t => t.id === saved.id ? saved : t).sort((a, b) => a.endDate.localeCompare(b.endDate))
        : [...prev, saved].sort((a, b) => a.endDate.localeCompare(b.endDate))
      onTrackersChange?.(next)
      return next
    })
  }

  // ── Delete ─────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return
    setActionError(null)
    try {
      await deleteTrackerWithPin(accessCode, deleteTarget.id)
      setTrackers(prev => {
        const next = prev.filter(t => t.id !== deleteTarget.id)
        onTrackersChange?.(next)
        return next
      })
      setDeleteTarget(null)
    } catch (e) {
      setActionError('削除に失敗しました。再試行してください')
      setDeleteTarget(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="tracker-list__loading">
        <Spinner size="md" />
      </div>
    )
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={fetchTrackers} />
  }

  return (
    <div className="tracker-list">
      {/* Action error */}
      {actionError && (
        <p className="tracker-list__action-error">{actionError}</p>
      )}

      {/* Add button */}
      <div className="tracker-list__toolbar">
        <Button
          variant="primary"
          onClick={() => setEditTarget(null)}
          disabled={trackers.length >= 10}
        >
          新規追加
        </Button>
        {trackers.length >= 10 && (
          <span className="tracker-list__limit-note">上限10件に達しました</span>
        )}
      </div>

      {/* Tracker cards */}
      {trackers.length === 0 ? (
        <p className="tracker-list__empty">
          トラッカーがありません。「新規追加」で作成してください。
        </p>
      ) : (
        <ul className="tracker-list__cards">
          {trackers.map(tracker => (
            <li key={tracker.id} className="tracker-list__card-item">
              <TrackerCard
                tracker={tracker}
                isPinned={pinnedTrackerId === tracker.id}
                onPin={() => handlePin(tracker.id)}
                onEdit={() => setEditTarget(tracker)}
                onDelete={() => setDeleteTarget(tracker)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Edit / create modal */}
      {editTarget !== undefined && (
        <TrackerEditModal
          tracker={editTarget}
          totalCount={trackers.length}
          onSave={handleSave}
          onClose={() => setEditTarget(undefined)}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <TrackerDeleteConfirm
          tracker={deleteTarget}
          isPinned={pinnedTrackerId === deleteTarget.id}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
