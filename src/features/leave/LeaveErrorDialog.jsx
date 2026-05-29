import Modal from '../../shared/components/Modal'
import Button from '../../shared/components/Button'

// ═══════════════════════════════════════════════════════════════════════════
// LeaveErrorDialog — generic error dialog for SHORTAGE / CONFLICT / other.
// AC-LEAVE-05 / 06 / 07 / 27.
// ═══════════════════════════════════════════════════════════════════════════
export default function LeaveErrorDialog({ title, message, onClose }) {
  return (
    <Modal isOpen={true} title={title ?? 'エラー'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', minWidth: '280px' }}>
        <p style={{ margin: 0, color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="primary" onClick={onClose}>OK</Button>
        </div>
      </div>
    </Modal>
  )
}
