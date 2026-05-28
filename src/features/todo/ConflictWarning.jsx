import Modal from '../../shared/components/Modal'
import Button from '../../shared/components/Button'

// ═══════════════════════════════════════════════════════════════════════════
// ConflictWarning — shown when version conflict detected on save (AC-TODO-C01)
//
// Props:
//   onReload   - reload server state, discard local edits
//   onClose    - close modal (user keeps editing, no auto-save)
// ═══════════════════════════════════════════════════════════════════════════
export default function ConflictWarning({ onReload, onClose }) {
  return (
    <Modal isOpen={true} title="他端末で更新されています" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        <p style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--color-text)' }}>
          このプロジェクトは別の端末で更新されました。
        </p>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          「再読み込み」を押すとサーバー側の最新内容で上書きされ、今編集中の内容は失われます。
          先にコピーしてから再読み込みしてください。
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)' }}>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button variant="primary" onClick={onReload}>
            再読み込み
          </Button>
        </div>
      </div>
    </Modal>
  )
}
