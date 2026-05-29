import { formatHours, recordHours } from './leave-calc'
import './LeaveRecordRow.css'

// ═══════════════════════════════════════════════════════════════════════════
// LeaveRecordRow — single line in the history list.
//   use:        "2026-12-20  有給  3日 0時間  年末連休   [編集][削除]"
//   adjustment: "2026-04-01  有給  +20日 0時間  年度付与  [編集][削除]"
//                              ↑sign always shown for adjustments
// ═══════════════════════════════════════════════════════════════════════════
const LEAVE_TYPE_LABEL = { paid: '有給', sick: '傷病' }

export default function LeaveRecordRow({ record, onEdit, onDelete }) {
  const isUse = record.type === 'use'
  const leaveTypeLabel = LEAVE_TYPE_LABEL[record.leaveType] ?? record.leaveType

  // Use: show absolute (X日Y時間 — always positive). Adjustment: show signed.
  let amountStr
  if (isUse) {
    const totalHours = Number(record.days ?? 0) * 8 + Number(record.hours ?? 0)
    amountStr = formatHours(totalHours)
  } else {
    const h = Number(record.hours ?? 0)
    const formatted = formatHours(h)
    amountStr = h > 0 ? '+' + formatted : formatted // negative already has "-"
  }

  return (
    <li className="leave-row">
      <span className="leave-row__date">{record.date}</span>
      <span className="leave-row__type">{leaveTypeLabel}</span>
      <span className={'leave-row__amount' +
        (!isUse ? ' leave-row__amount--adjust' : '')}>
        {amountStr}
      </span>
      <span className="leave-row__note" title={record.note ?? ''}>
        {record.note ?? ''}
      </span>
      <div className="leave-row__actions">
        <button
          type="button"
          className="leave-row__btn"
          onClick={() => onEdit?.(record)}
        >
          編集
        </button>
        <button
          type="button"
          className="leave-row__btn leave-row__btn--danger"
          onClick={() => onDelete?.(record)}
        >
          削除
        </button>
      </div>
    </li>
  )
}
