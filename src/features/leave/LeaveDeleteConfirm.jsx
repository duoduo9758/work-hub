import Modal from '../../shared/components/Modal'
import Button from '../../shared/components/Button'
import { formatHours } from './leave-calc'

const LABEL = { paid: '有給', sick: '傷病' }

// ═══════════════════════════════════════════════════════════════════════════
// LeaveDeleteConfirm — confirm before deleting a leave record.
// AC-LEAVE-18.
// ═══════════════════════════════════════════════════════════════════════════
export default function LeaveDeleteConfirm({ record, onConfirm, onClose }) {
  const isUse = record.type === 'use'
  let amountStr
  if (isUse) {
    const total = Number(record.days ?? 0) * 8 + Number(record.hours ?? 0)
    amountStr = formatHours(total)
  } else {
    const h = Number(record.hours ?? 0)
    amountStr = (h > 0 ? '+' : '') + formatHours(h)
  }

  return (
    <Modal isOpen={true} title="削除の確認" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', minWidth: '280px' }}>
        <p style={{ margin: 0, color: 'var(--color-text)' }}>
          以下の{isUse ? '取得' : '調整'}レコードを削除しますか？
        </p>
        <div style={{
          padding: 'var(--space-md)',
          background: 'var(--color-bg)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)',
          fontSize: 'var(--text-sm)',
        }}>
          <div>{record.date} / {LABEL[record.leaveType] ?? record.leaveType} / {amountStr}</div>
          {record.note && <div style={{ color: 'var(--color-text-muted)', marginTop: '4px' }}>{record.note}</div>}
        </div>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          削除後は残量が再計算されます。
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)' }}>
          <Button variant="secondary" onClick={onClose}>キャンセル</Button>
          <Button variant="primary" onClick={onConfirm}>削除</Button>
        </div>
      </div>
    </Modal>
  )
}
