import Modal from './Modal'
import Button from './Button'
import './ConfirmDialog.css'

export default function ConfirmDialog({
  isOpen,
  message,
  subMessage,
  onConfirm,
  onCancel,
  confirmLabel = '削除',
  cancelLabel = 'キャンセル',
  danger = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel}>
      <div className="confirm-dialog">
        <p className="confirm-dialog__message">{message}</p>
        {subMessage && <p className="confirm-dialog__sub">{subMessage}</p>}
        <div className="confirm-dialog__actions">
          <Button variant="tertiary" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant="primary" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  )
}
