import { useState, useRef, useEffect } from 'react'
import Button from '../../shared/components/Button'
import { PROJECT_MAX } from './todo-store'
import './ProjectSidebar.css'

// ═══════════════════════════════════════════════════════════════════════════
// ProjectSidebar — project list.
//   PC (≥ 640px): left sidebar, always-expanded list.
//   Mobile (< 640px): collapsed bar at top showing current project name; tap
//     to open a dropdown list overlay. Tapping outside or selecting a project
//     closes it.
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const rootRef = useRef(null)

  // Close mobile dropdown when clicking outside
  useEffect(() => {
    if (!mobileOpen) return
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setMobileOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('touchstart', onDocClick)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('touchstart', onDocClick)
    }
  }, [mobileOpen])

  const current = projects.find(p => p.id === selectedProjectId)

  const handleSelectInDropdown = (id) => {
    onSelect(id)
    setMobileOpen(false)
  }

  return (
    <aside
      ref={rootRef}
      className={
        'project-sidebar' + (mobileOpen ? ' project-sidebar--mobile-open' : '')
      }
    >
      {/* Mobile collapsed header — tap to expand the dropdown */}
      <button
        type="button"
        className="project-sidebar__mobile-toggle"
        onClick={() => setMobileOpen(o => !o)}
        aria-expanded={mobileOpen}
        aria-label="プロジェクト一覧を開く"
      >
        <span className="project-sidebar__mobile-toggle-name">
          {current?.name ?? 'プロジェクト未選択'}
        </span>
        <span className="project-sidebar__mobile-toggle-chevron" aria-hidden="true">
          {mobileOpen ? '▲' : '▼'}
        </span>
      </button>

      {/* Header (PC always visible; mobile shown inside the dropdown panel) */}
      <div className="project-sidebar__panel">
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
                    onClick={() => handleSelectInDropdown(p.id)}
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
      </div>
    </aside>
  )
}
