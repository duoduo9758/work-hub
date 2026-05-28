import ConfirmDialog from '../../shared/components/ConfirmDialog'

// ═══════════════════════════════════════════════════════════════════════════
// ProjectDeleteConfirm — confirms project deletion (with unsaved-change warning)
// AC-TODO-P06 / P08
// ═══════════════════════════════════════════════════════════════════════════
export default function ProjectDeleteConfirm({ project, hasUnsavedChanges, onConfirm, onClose }) {
  const subMessage = hasUnsavedChanges
    ? '未保存の変更も含めて削除します。中身（行データ）もすべて消えます。'
    : 'プロジェクト内のすべての行データが削除されます。元に戻せません。'

  return (
    <ConfirmDialog
      isOpen={true}
      message={`「${project.name}」を削除しますか？`}
      subMessage={subMessage}
      confirmLabel="削除"
      cancelLabel="キャンセル"
      onConfirm={onConfirm}
      onCancel={onClose}
      danger={true}
    />
  )
}
