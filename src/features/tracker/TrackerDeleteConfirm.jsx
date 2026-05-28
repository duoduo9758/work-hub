import ConfirmDialog from '../../shared/components/ConfirmDialog'

// ═══════════════════════════════════════════════════════════════════════════
// TrackerDeleteConfirm — wraps ConfirmDialog with pinned-tracker warning
//
// Only rendered when visible (parent controls mounting).
// Always passes isOpen={true} since it's mounted-when-shown pattern.
//
// Props:
//   tracker   - tracker to delete
//   isPinned  - whether this tracker is currently pinned
//   onConfirm - () => void
//   onClose   - () => void
// ═══════════════════════════════════════════════════════════════════════════
export default function TrackerDeleteConfirm({ tracker, isPinned, onConfirm, onClose }) {
  return (
    <ConfirmDialog
      isOpen={true}
      message={`「${tracker.title}」を削除しますか？`}
      subMessage={isPinned ? 'ピン留め中です。削除すると進捗バーが消えます。' : undefined}
      confirmLabel="削除"
      cancelLabel="キャンセル"
      onConfirm={onConfirm}
      onCancel={onClose}
      danger={true}
    />
  )
}
