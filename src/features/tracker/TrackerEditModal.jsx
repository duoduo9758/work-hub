import { useState, useEffect } from 'react'
import Modal from '../../shared/components/Modal'
import Button from '../../shared/components/Button'
import './TrackerEditModal.css'

// ═══════════════════════════════════════════════════════════════════════════
// TrackerEditModal — create / edit a tracker
//
// Props:
//   tracker     - existing tracker object (null = create mode)
//   totalCount  - current number of trackers (for 10-item limit check)
//   onSave      - (formData) => Promise<void>
//   onClose     - () => void
// ═══════════════════════════════════════════════════════════════════════════
export default function TrackerEditModal({ tracker, totalCount, onSave, onClose }) {
  const isEdit = Boolean(tracker)

  const [title, setTitle] = useState(tracker?.title ?? '')
  const [startDate, setStartDate] = useState(tracker?.startDate ?? '')
  const [endDate, setEndDate] = useState(tracker?.endDate ?? '')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  // Focus title on open
  useEffect(() => {
    const input = document.getElementById('tracker-title-input')
    if (input) input.focus()
  }, [])

  function validate() {
    if (!title.trim()) return 'タイトルを入力してください'
    if (title.trim().length > 30) return '30文字以内で入力してください'
    if (!startDate) return '開始日を入力してください'
    if (!endDate) return '終了日を入力してください'
    if (startDate >= endDate) return '終了日は開始日より後にしてください'
    if (!isEdit && totalCount >= 10) return '最大10件まで登録できます。不要なものを削除してください'
    return null
  }

  async function handleSave() {
    const err = validate()
    if (err) { setError(err); return }

    setSaving(true)
    setError(null)
    try {
      await onSave({ title: title.trim(), startDate, endDate })
      onClose()
    } catch (e) {
      setError('保存に失敗しました。再試行してください')
      setSaving(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !saving) handleSave()
  }

  return (
    <Modal isOpen={true} title={isEdit ? 'トラッカーを編集' : '新規トラッカー'} onClose={onClose}>
      <div className="tracker-edit-modal">
        {/* Title */}
        <div className="tracker-edit-modal__field">
          <label className="tracker-edit-modal__label" htmlFor="tracker-title-input">
            タイトル
          </label>
          <input
            id="tracker-title-input"
            type="text"
            className="tracker-edit-modal__input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={30}
            placeholder="例：プロジェクト期間"
          />
          <span className="tracker-edit-modal__char-count">
            {title.length}/30
          </span>
        </div>

        {/* Start date */}
        <div className="tracker-edit-modal__field">
          <label className="tracker-edit-modal__label" htmlFor="tracker-start-input">
            開始日
          </label>
          <input
            id="tracker-start-input"
            type="date"
            className="tracker-edit-modal__input"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>

        {/* End date */}
        <div className="tracker-edit-modal__field">
          <label className="tracker-edit-modal__label" htmlFor="tracker-end-input">
            終了日
          </label>
          <input
            id="tracker-end-input"
            type="date"
            className="tracker-edit-modal__input"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>

        {/* Error */}
        {error && <p className="tracker-edit-modal__error">{error}</p>}

        {/* Actions */}
        <div className="tracker-edit-modal__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            キャンセル
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
