import { useState } from 'react'
import Modal from '../../shared/components/Modal'
import Button from '../../shared/components/Button'
import {
  adjustmentInputToHours, isBigAdjustment, formatHours,
  validateAdjustmentInput, NOTE_MAX_LENGTH,
  ADJUSTMENT_HOURS_MIN, ADJUSTMENT_HOURS_MAX, USE_HOURS_PART_MAX,
} from './leave-calc'
import { getTodayJST } from '../../lib/date'
import './LeaveModal.css'

// ═══════════════════════════════════════════════════════════════════════════
// LeaveAdjustModal — add/edit an "adjustment" leave record.
// Form fields: leaveType, sign (+/-), days, hours (0..7), date, note
// hours is stored as signed integer in [-9999, 9999].
//
// For edit, derive sign + |days|/|hours| from the stored signed `hours`.
//
// Props:
//   mode   - 'add' | 'edit'
//   record - existing record (for edit)
//   onSave - async (recordData) => boolean
//   onClose
// ═══════════════════════════════════════════════════════════════════════════
function splitSigned(signedHours) {
  const sign = signedHours < 0 ? '-' : '+'
  const abs = Math.abs(Math.trunc(signedHours))
  return { sign, days: Math.floor(abs / 8), hours: abs % 8 }
}

export default function LeaveAdjustModal({ mode, record, onSave, onClose }) {
  const isEdit = mode === 'edit'
  const initial = record ? splitSigned(Number(record.hours ?? 0)) : { sign: '+', days: 0, hours: 0 }

  const [leaveType, setLeaveType] = useState(record?.leaveType ?? 'paid')
  const [sign, setSign] = useState(initial.sign)
  const [days, setDays] = useState(initial.days)
  const [hours, setHours] = useState(initial.hours)
  const [date, setDate] = useState(record?.date ?? getTodayJST())
  const [note, setNote] = useState(record?.note ?? '')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setError(null)
    const signedHours = adjustmentInputToHours({
      sign, days: Number(days), hours: Number(hours),
    })
    const v = validateAdjustmentInput({ hours: signedHours, date, note })
    if (!v.ok) { setError(v.error); return }

    // Big-adjustment confirmation (AC-LEAVE-31)
    if (isBigAdjustment(signedHours)) {
      const formatted = formatHours(signedHours)
      const ok = window.confirm(`大きな調整です。\n${formatted} を保存しますか？`)
      if (!ok) return
    }

    setSaving(true)
    const ok = await onSave({
      type: 'adjustment',
      leaveType,
      hours: signedHours,
      date,
      note: note?.trim() || null,
    })
    if (!ok) setSaving(false)
  }

  return (
    <Modal isOpen={true} title={isEdit ? '調整を編集' : '調整を追加'} onClose={onClose}>
      <div className="leave-modal">
        {/* Leave type */}
        <div className="leave-modal__field">
          <label className="leave-modal__label">休暇種別</label>
          <div className="leave-modal__radio-group" role="radiogroup">
            <label className="leave-modal__radio">
              <input type="radio" name="adjustLeaveType" value="paid"
                checked={leaveType === 'paid'} onChange={() => setLeaveType('paid')} />
              有給
            </label>
            <label className="leave-modal__radio">
              <input type="radio" name="adjustLeaveType" value="sick"
                checked={leaveType === 'sick'} onChange={() => setLeaveType('sick')} />
              傷病
            </label>
          </div>
        </div>

        {/* Sign + days + hours */}
        <div className="leave-modal__field">
          <label className="leave-modal__label">調整量</label>
          <div className="leave-modal__dh-group">
            <select
              className="leave-modal__sign"
              value={sign}
              onChange={e => setSign(e.target.value)}
              aria-label="符号"
            >
              <option value="+">+ 加算</option>
              <option value="-">- 減算</option>
            </select>
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
          <span className="leave-modal__hint">
            時間は 0〜{USE_HOURS_PART_MAX}。範囲は ±{Math.abs(ADJUSTMENT_HOURS_MIN)}時間まで
          </span>
        </div>

        {/* Date */}
        <div className="leave-modal__field">
          <label className="leave-modal__label" htmlFor="leave-adj-date">日付</label>
          <input
            id="leave-adj-date"
            type="date"
            className="leave-modal__input"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        {/* Note */}
        <div className="leave-modal__field">
          <label className="leave-modal__label" htmlFor="leave-adj-note">
            用途（任意）
          </label>
          <input
            id="leave-adj-note"
            type="text"
            className="leave-modal__input"
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={NOTE_MAX_LENGTH}
            placeholder="年度付与 / 繰越 / 誤計上修正 等"
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
