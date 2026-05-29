import { useState } from 'react'
import Modal from '../../shared/components/Modal'
import Button from '../../shared/components/Button'
import { validateUseInput, USE_HOURS_PART_MAX, NOTE_MAX_LENGTH } from './leave-calc'
import { getTodayJST } from '../../lib/date'
import './LeaveModal.css'

// ═══════════════════════════════════════════════════════════════════════════
// LeaveUseModal — add/edit a "use" leave record.
// Form fields: leaveType (paid/sick), days, hours (0..7), date, note
//
// Props:
//   mode   - 'add' | 'edit'
//   record - existing record (for edit)
//   onSave - async (recordData) => boolean (true = saved + close)
//   onClose
// ═══════════════════════════════════════════════════════════════════════════
export default function LeaveUseModal({ mode, record, onSave, onClose }) {
  const isEdit = mode === 'edit'
  const [leaveType, setLeaveType] = useState(record?.leaveType ?? 'paid')
  const [days, setDays] = useState(record?.days ?? 0)
  const [hours, setHours] = useState(record?.hours ?? 0)
  const [date, setDate] = useState(record?.date ?? getTodayJST())
  const [note, setNote] = useState(record?.note ?? '')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setError(null)
    // Validate
    const v = validateUseInput({
      days: Number(days),
      hours: Number(hours),
      date,
      note,
    })
    if (!v.ok) { setError(v.error); return }

    setSaving(true)
    const ok = await onSave({
      type: 'use',
      leaveType,
      days: Number(days),
      hours: Number(hours),
      date,
      note: note?.trim() || '',
    })
    if (!ok) setSaving(false)
    // If saved, the parent closes the modal.
  }

  return (
    <Modal isOpen={true} title={isEdit ? '取得を編集' : '取得を追加'} onClose={onClose}>
      <div className="leave-modal">
        {/* Leave type */}
        <div className="leave-modal__field">
          <label className="leave-modal__label">休暇種別</label>
          <div className="leave-modal__radio-group" role="radiogroup">
            <label className="leave-modal__radio">
              <input
                type="radio"
                name="leaveType"
                value="paid"
                checked={leaveType === 'paid'}
                onChange={() => setLeaveType('paid')}
              />
              有給
            </label>
            <label className="leave-modal__radio">
              <input
                type="radio"
                name="leaveType"
                value="sick"
                checked={leaveType === 'sick'}
                onChange={() => setLeaveType('sick')}
              />
              傷病
            </label>
          </div>
        </div>

        {/* Days + Hours (X日 Y時間 layout) */}
        <div className="leave-modal__field">
          <label className="leave-modal__label">取得時間</label>
          <div className="leave-modal__dh-group">
            <input
              type="number"
              className="leave-modal__num"
              value={days}
              min={0}
              step={1}
              onChange={e => setDays(e.target.value === '' ? '' : Math.floor(Number(e.target.value)))}
              aria-label="日数"
            />
            <span className="leave-modal__unit">日</span>
            <input
              type="number"
              className="leave-modal__num"
              value={hours}
              min={0}
              max={USE_HOURS_PART_MAX}
              step={1}
              onChange={e => setHours(e.target.value === '' ? '' : Math.floor(Number(e.target.value)))}
              aria-label="時間"
            />
            <span className="leave-modal__unit">時間</span>
          </div>
          <span className="leave-modal__hint">時間は 0〜{USE_HOURS_PART_MAX}（8時間以上は日数欄）</span>
        </div>

        {/* Date */}
        <div className="leave-modal__field">
          <label className="leave-modal__label" htmlFor="leave-use-date">日付</label>
          <input
            id="leave-use-date"
            type="date"
            className="leave-modal__input"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        {/* Note */}
        <div className="leave-modal__field">
          <label className="leave-modal__label" htmlFor="leave-use-note">
            メモ（任意）
          </label>
          <input
            id="leave-use-note"
            type="text"
            className="leave-modal__input"
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={NOTE_MAX_LENGTH}
            placeholder="午前 / 午後 / 年末連休 等"
          />
          <span className="leave-modal__char-count">{note.length}/{NOTE_MAX_LENGTH}</span>
        </div>

        {error && <p className="leave-modal__error" role="alert">{error}</p>}

        <div className="leave-modal__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>キャンセル</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
