import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../shared/contexts/AuthContext'
import { loadLeaveRecords } from './leave-store'
import {
  addLeaveRecord, editLeaveRecord, deleteLeaveRecord,
} from './leave-actions'
import LeaveSummary from './LeaveSummary'
import LeaveHistoryTabs from './LeaveHistoryTabs'
import LeaveUseModal from './LeaveUseModal'
import LeaveAdjustModal from './LeaveAdjustModal'
import LeaveDeleteConfirm from './LeaveDeleteConfirm'
import LeaveErrorDialog from './LeaveErrorDialog'
import Button from '../../shared/components/Button'
import Spinner from '../../shared/components/Spinner'
import ErrorMessage from '../../shared/components/ErrorMessage'
import { formatHours } from './leave-calc'
import './LeaveScreen.css'

// ═══════════════════════════════════════════════════════════════════════════
// LeaveScreen — S3 (休暇管理). Top-level screen owning leaveRecords[] state.
// Layout:
//   [Summary] [+取得 / +調整 buttons] [Use/Adjust tab + year filter] [list]
// ═══════════════════════════════════════════════════════════════════════════
export default function LeaveScreen() {
  const { accessCode } = useAuth()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  // History tab + filter state
  const [historyTab, setHistoryTab] = useState('use')
  const [yearFilter, setYearFilter] = useState('current')

  // Modals
  const [useModal, setUseModal] = useState(null)        // null | { mode:'add' } | { mode:'edit', record }
  const [adjustModal, setAdjustModal] = useState(null)  // same shape
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [errorDialog, setErrorDialog] = useState(null)  // { message }

  // ── Load all records on mount ───────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await loadLeaveRecords(accessCode)
      setRecords(data)
    } catch (e) {
      setLoadError('休暇レコードの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [accessCode])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  // ── Error helpers ───────────────────────────────────────────────────
  const showShortage = useCallback((hours) => {
    setErrorDialog({
      title: '残量不足',
      message: `残量が ${formatHours(hours).replace(/^-/, '')} 不足します。保存できません。`,
    })
  }, [])

  const showConflict = useCallback(() => {
    setErrorDialog({
      title: '更新に失敗しました',
      message: '他端末で更新されています。再読み込みしてください。',
    })
  }, [])

  const showGenericError = useCallback((msg) => {
    setErrorDialog({ title: 'エラー', message: msg ?? '保存に失敗しました。再試行してください。' })
  }, [])

  // ── Save handlers ───────────────────────────────────────────────────
  // record shape: { type, leaveType, days?, hours, date, note }
  const handleAdd = useCallback(async (record) => {
    try {
      const saved = await addLeaveRecord(accessCode, record)
      setRecords(prev => [saved, ...prev])
      return true
    } catch (e) {
      if (e?.code === 'SHORTAGE') showShortage(e.shortageHours)
      else if (e?.code === 'CONFLICT') showConflict()
      else showGenericError()
      return false
    }
  }, [accessCode, showShortage, showConflict, showGenericError])

  const handleEdit = useCallback(async (record, originalId, baseVersion) => {
    try {
      const updated = await editLeaveRecord(accessCode, originalId, baseVersion, record)
      setRecords(prev => prev.map(r => r.id === originalId ? updated : r))
      return true
    } catch (e) {
      if (e?.code === 'SHORTAGE') showShortage(e.shortageHours)
      else if (e?.code === 'CONFLICT') showConflict()
      else showGenericError()
      return false
    }
  }, [accessCode, showShortage, showConflict, showGenericError])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    try {
      await deleteLeaveRecord(accessCode, deleteTarget.id, deleteTarget.version)
      setRecords(prev => prev.filter(r => r.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (e) {
      setDeleteTarget(null)
      if (e?.code === 'SHORTAGE') showShortage(e.shortageHours)
      else if (e?.code === 'CONFLICT') showConflict()
      else showGenericError('削除に失敗しました。再試行してください。')
    }
  }, [accessCode, deleteTarget, showShortage, showConflict, showGenericError])

  // Open the right modal based on record.type for edit
  const handleRowEdit = useCallback((record) => {
    if (record.type === 'use') setUseModal({ mode: 'edit', record })
    else setAdjustModal({ mode: 'edit', record })
  }, [])

  const handleRowDelete = useCallback((record) => {
    setDeleteTarget(record)
  }, [])

  // ── Render ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="leave-screen leave-screen--loading">
        <Spinner size="md" />
      </div>
    )
  }
  if (loadError) {
    return <ErrorMessage message={loadError} onRetry={fetchRecords} />
  }

  return (
    <div className="leave-screen">
      <LeaveSummary records={records} />

      <div className="leave-screen__actions">
        <Button variant="primary" onClick={() => setUseModal({ mode: 'add' })}>
          + 取得
        </Button>
        <Button variant="secondary" onClick={() => setAdjustModal({ mode: 'add' })}>
          + 調整
        </Button>
      </div>

      <LeaveHistoryTabs
        records={records}
        currentTab={historyTab}
        onTabChange={setHistoryTab}
        yearFilter={yearFilter}
        onYearFilterChange={setYearFilter}
        onEdit={handleRowEdit}
        onDelete={handleRowDelete}
      />

      {useModal && (
        <LeaveUseModal
          mode={useModal.mode}
          record={useModal.mode === 'edit' ? useModal.record : null}
          onSave={async (rec) => {
            const ok = useModal.mode === 'edit'
              ? await handleEdit(rec, useModal.record.id, useModal.record.version)
              : await handleAdd(rec)
            if (ok) setUseModal(null)
            return ok
          }}
          onClose={() => setUseModal(null)}
        />
      )}

      {adjustModal && (
        <LeaveAdjustModal
          mode={adjustModal.mode}
          record={adjustModal.mode === 'edit' ? adjustModal.record : null}
          onSave={async (rec) => {
            const ok = adjustModal.mode === 'edit'
              ? await handleEdit(rec, adjustModal.record.id, adjustModal.record.version)
              : await handleAdd(rec)
            if (ok) setAdjustModal(null)
            return ok
          }}
          onClose={() => setAdjustModal(null)}
        />
      )}

      {deleteTarget && (
        <LeaveDeleteConfirm
          record={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {errorDialog && (
        <LeaveErrorDialog
          title={errorDialog.title}
          message={errorDialog.message}
          onClose={() => {
            setErrorDialog(null)
            // For conflict, also reload data to get fresh state
            if (errorDialog.title === '更新に失敗しました') fetchRecords()
          }}
        />
      )}
    </div>
  )
}
