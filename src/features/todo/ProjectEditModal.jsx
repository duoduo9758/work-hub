import { useState, useEffect } from 'react'
import Modal from '../../shared/components/Modal'
import Button from '../../shared/components/Button'
import { PROJECT_MAX } from './todo-store'
import './ProjectEditModal.css'

// ═══════════════════════════════════════════════════════════════════════════
// ProjectEditModal — create / edit a Todo project
//   - project: null = create, object = edit
//   - totalCount: current count (for PROJECT_MAX check on create)
//   - onSave: async (name) => void
// ═══════════════════════════════════════════════════════════════════════════
export default function ProjectEditModal({ project, totalCount, onSave, onClose }) {
  const isEdit = Boolean(project)
  const [name, setName] = useState(project?.name ?? '')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const el = document.getElementById('project-name-input')
    if (el) {
      el.focus()
      el.select?.()
    }
  }, [])

  function validate() {
    const trimmed = name.trim()
    if (!trimmed) return 'プロジェクト名を入力してください'
    if (trimmed.length > 30) return '30文字以内で入力してください'
    if (!isEdit && totalCount >= PROJECT_MAX) {
      return `最大${PROJECT_MAX}件までです。不要なプロジェクトを削除してください`
    }
    return null
  }

  async function handleSave() {
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true)
    setError(null)
    try {
      await onSave(name.trim())
      onClose()
    } catch (e) {
      if (e?.code === 'CONFLICT') {
        setError('他端末で更新されています。閉じて再読み込みしてください')
      } else {
        setError('保存に失敗しました。再試行してください')
      }
      setSaving(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !saving) handleSave()
  }

  return (
    <Modal isOpen={true} title={isEdit ? 'プロジェクトを編集' : '新規プロジェクト'} onClose={onClose}>
      <div className="project-edit-modal">
        <div className="project-edit-modal__field">
          <label className="project-edit-modal__label" htmlFor="project-name-input">
            プロジェクト名
          </label>
          <input
            id="project-name-input"
            type="text"
            className="project-edit-modal__input"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={30}
            placeholder="例：プロジェクトA"
          />
          <span className="project-edit-modal__char-count">{name.length}/30</span>
        </div>

        {error && <p className="project-edit-modal__error">{error}</p>}

        <div className="project-edit-modal__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>キャンセル</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
