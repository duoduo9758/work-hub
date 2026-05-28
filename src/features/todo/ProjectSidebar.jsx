import Button from '../../shared/components/Button'
import { PROJECT_MAX } from './todo-store'
import './ProjectSidebar.css'

// ═══════════════════════════════════════════════════════════════════════════
// ProjectSidebar — list of projects (PC: left sidebar / Mobile: top dropdown)
//   For v2a we render as a sidebar; mobile-specific styling is in v2d.
//
// Props:
//   projects[]              - list (sorted by createdAt desc by store)
//   selectedProjectId       - currently selected
//   onSelect(projectId)
//   onAdd()                 - opens create modal
//   onEdit(project)         - opens edit modal for a project
//   onDelete(project)       - opens delete confirm
// ═══════════════════════════════════════════════════════════════════════════
export default function ProjectSidebar({
  projects, selectedProjectId, onSelect, onAdd, onEdit, onDelete,
}) {
  const limitReached = projects.length >= PROJECT_MAX

  return (
    <aside className="project-sidebar">
      <div className="project-sidebar__header">
        <h2 className="project-sidebar__title">プロジェクト</h2>
        <Button
          variant="primary"
          onClick={onAdd}
          disabled={limitReached}
        >
          + 追加
        </Button>
      </div>

      {limitReached && (
        <p className="project-sidebar__limit">上限{PROJECT_MAX}件に達しました</p>
      )}

      {projects.length === 0 ? (
        <p className="project-sidebar__empty">
          プロジェクトがありません。「+ 追加」で作成してください。
        </p>
      ) : (
        <ul className="project-sidebar__list">
          {projects.map(p => {
            const active = p.id === selectedProjectId
            return (
              <li
                key={p.id}
                className={
                  'project-sidebar__item' +
                  (active ? ' project-sidebar__item--active' : '')
                }
              >
                <button
                  className="project-sidebar__name-btn"
                  onClick={() => onSelect(p.id)}
                  title={p.name}
                >
                  {p.name}
                </button>
                <div className="project-sidebar__row-actions">
                  <button
                    type="button"
                    className="project-sidebar__icon-btn"
                    onClick={() => onEdit(p)}
                    aria-label="編集"
                    title="編集"
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    className="project-sidebar__icon-btn project-sidebar__icon-btn--danger"
                    onClick={() => onDelete(p)}
                    aria-label="削除"
                    title="削除"
                  >
                    削除
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
