import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../shared/contexts/AuthContext'
import { useDebounceSave } from '../../hooks/useDebounceSave'
import {
  loadProjects, loadProject, createProject, updateProjectName,
  deleteProject, saveProjectLines,
} from './todo-store'
import ProjectSidebar from './ProjectSidebar'
import ProjectEditModal from './ProjectEditModal'
import ProjectDeleteConfirm from './ProjectDeleteConfirm'
import TodoEditor from './TodoEditor'
import SaveStatusBadge from './SaveStatusBadge'
import ConflictWarning from './ConflictWarning'
import Spinner from '../../shared/components/Spinner'
import ErrorMessage from '../../shared/components/ErrorMessage'
import './TodoScreen.css'

// ═══════════════════════════════════════════════════════════════════════════
// TodoScreen — S2: Todo main
//
// Layout: Sidebar (projects) + Editor (lines of selected project)
// Owns: projects[], selectedProjectId, currentProject (with lines + version)
// ═══════════════════════════════════════════════════════════════════════════
export default function TodoScreen() {
  const { accessCode } = useAuth()

  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [currentProject, setCurrentProject] = useState(null) // { id, name, lines, version, ... }
  const [linesLocal, setLinesLocal] = useState([])           // editor's working copy

  const [loadingList, setLoadingList] = useState(true)
  const [loadingProject, setLoadingProject] = useState(false)
  const [listError, setListError] = useState(null)
  const [projectError, setProjectError] = useState(null)

  // Modal state
  const [editTarget, setEditTarget] = useState(undefined) // undefined=closed, null=new, project=edit
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showConflict, setShowConflict] = useState(false)

  // Track baseVersion in a ref so onSave closure always sees latest
  const baseVersionRef = useRef(1)
  const linesRef = useRef([])
  const currentProjectIdRef = useRef(null)

  useEffect(() => { linesRef.current = linesLocal }, [linesLocal])
  useEffect(() => {
    baseVersionRef.current = currentProject?.version ?? 1
    currentProjectIdRef.current = currentProject?.id ?? null
  }, [currentProject])

  // ── Save callback (used by useDebounceSave) ─────────────────────────
  const handleSave = useCallback(async () => {
    const projId = currentProjectIdRef.current
    if (!projId) return
    try {
      const updated = await saveProjectLines(
        accessCode,
        projId,
        linesRef.current,
        baseVersionRef.current,
      )
      // Sync local state with server result (version bumped, timestamps updated)
      baseVersionRef.current = updated.version
      setCurrentProject(prev => prev && prev.id === updated.id ? updated : prev)
    } catch (e) {
      // Re-throw so useDebounceSave can transition to failed/conflict
      throw e
    }
  }, [accessCode])

  const {
    status: saveStatus,
    markDirty,
    forceSave,
    retry,
    markSaved,
    reset: resetSaveStatus,
  } = useDebounceSave({
    onSave: handleSave,
    delay: 1500,
    saveOnVisibilityChange: true,
    saveOnPagehide: true,
  })

  // Show conflict modal when status flips to conflict
  useEffect(() => {
    if (saveStatus === 'conflict') setShowConflict(true)
  }, [saveStatus])

  // ── Load project list on mount ──────────────────────────────────────
  const fetchProjects = useCallback(async () => {
    setLoadingList(true)
    setListError(null)
    try {
      const data = await loadProjects(accessCode)
      setProjects(data)
      // Auto-select first if nothing selected
      if (data.length > 0 && !selectedProjectId) {
        setSelectedProjectId(data[0].id)
      }
    } catch (e) {
      setListError('プロジェクト一覧の取得に失敗しました')
    } finally {
      setLoadingList(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessCode])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  // ── Load single project when selection changes ──────────────────────
  useEffect(() => {
    if (!selectedProjectId) {
      setCurrentProject(null)
      setLinesLocal([])
      resetSaveStatus()
      return
    }
    let cancelled = false
    setLoadingProject(true)
    setProjectError(null)
    loadProject(accessCode, selectedProjectId)
      .then(p => {
        if (cancelled) return
        if (!p) {
          setProjectError('プロジェクトが見つかりません')
          setCurrentProject(null)
          setLinesLocal([])
        } else {
          setCurrentProject(p)
          setLinesLocal(p.lines ?? [])
          resetSaveStatus()
        }
      })
      .catch(() => {
        if (!cancelled) setProjectError('プロジェクトの取得に失敗しました')
      })
      .finally(() => { if (!cancelled) setLoadingProject(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessCode, selectedProjectId])

  // ── Editor change handler ───────────────────────────────────────────
  // opts.quick=true → checkbox toggles, save within 500ms (v2b)
  const handleLinesChange = useCallback((next, opts) => {
    setLinesLocal(next)
    markDirty(opts?.quick ? 500 : undefined)
  }, [markDirty])

  // ── Project switch (with force save of unsaved) ─────────────────────
  const handleSelect = useCallback(async (projectId) => {
    if (projectId === selectedProjectId) return
    if (saveStatus === 'dirty' || saveStatus === 'failed') {
      await forceSave()
    }
    setSelectedProjectId(projectId)
  }, [selectedProjectId, saveStatus, forceSave])

  // ── Project create ──────────────────────────────────────────────────
  const handleCreateProject = useCallback(async (name) => {
    const created = await createProject(accessCode, name)
    setProjects(prev => [created, ...prev]) // createdAt desc — newest on top
    setSelectedProjectId(created.id)
  }, [accessCode])

  // ── Project rename ──────────────────────────────────────────────────
  const handleEditProject = useCallback(async (name) => {
    if (!editTarget) return
    const updated = await updateProjectName(
      accessCode,
      editTarget.id,
      name,
      editTarget.version,
    )
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))
    if (currentProject?.id === updated.id) {
      setCurrentProject(updated)
      baseVersionRef.current = updated.version
    }
  }, [accessCode, editTarget, currentProject])

  // ── Project delete ──────────────────────────────────────────────────
  const handleDeleteProject = useCallback(async () => {
    if (!deleteTarget) return
    try {
      await deleteProject(accessCode, deleteTarget.id, deleteTarget.version)
      const remaining = projects.filter(p => p.id !== deleteTarget.id)
      setProjects(remaining)
      if (selectedProjectId === deleteTarget.id) {
        const nextSel = remaining.length > 0 ? remaining[0].id : null
        setSelectedProjectId(nextSel)
      }
      setDeleteTarget(null)
    } catch (e) {
      const msg = e?.code === 'CONFLICT'
        ? '他端末で更新されています。再読み込みしてください'
        : '削除に失敗しました。再試行してください'
      setProjectError(msg)
      setDeleteTarget(null)
    }
  }, [accessCode, deleteTarget, projects, selectedProjectId])

  // ── Conflict: reload server state ───────────────────────────────────
  const handleConflictReload = useCallback(async () => {
    if (!selectedProjectId) {
      setShowConflict(false)
      return
    }
    try {
      const fresh = await loadProject(accessCode, selectedProjectId)
      if (fresh) {
        setCurrentProject(fresh)
        setLinesLocal(fresh.lines ?? [])
        baseVersionRef.current = fresh.version
        markSaved()
      }
    } catch {
      setProjectError('再読み込みに失敗しました')
    } finally {
      setShowConflict(false)
    }
  }, [accessCode, selectedProjectId, markSaved])

  // ── Render ──────────────────────────────────────────────────────────
  if (loadingList) {
    return (
      <div className="todo-screen__loading">
        <Spinner size="md" />
      </div>
    )
  }
  if (listError) {
    return <ErrorMessage message={listError} onRetry={fetchProjects} />
  }

  // Determine if current project has unsaved changes
  const hasUnsaved = saveStatus === 'dirty' || saveStatus === 'failed'

  return (
    <div className="todo-screen">
      <ProjectSidebar
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelect={handleSelect}
        onAdd={() => setEditTarget(null)}
        onEdit={(p) => setEditTarget(p)}
        onDelete={(p) => setDeleteTarget(p)}
      />

      <div className="todo-screen__main">
        {/* Header bar: project name + save status */}
        <div className="todo-screen__header">
          <h2 className="todo-screen__project-name">
            {currentProject?.name ?? (selectedProjectId ? '...' : 'プロジェクト未選択')}
          </h2>
          <SaveStatusBadge status={saveStatus} onRetry={retry} />
        </div>

        {/* Body: editor or messages */}
        {projectError && (
          <ErrorMessage
            message={projectError}
            onRetry={() => {
              setProjectError(null)
              if (selectedProjectId) {
                // re-trigger by toggling
                const id = selectedProjectId
                setSelectedProjectId(null)
                setTimeout(() => setSelectedProjectId(id), 0)
              }
            }}
          />
        )}

        {!projectError && !selectedProjectId && (
          <div className="todo-screen__empty">
            <p>左のサイドバーからプロジェクトを選択するか、「+ 追加」で作成してください。</p>
          </div>
        )}

        {!projectError && loadingProject && (
          <div className="todo-screen__loading">
            <Spinner size="md" />
          </div>
        )}

        {!projectError && !loadingProject && currentProject && (
          <TodoEditor
            lines={linesLocal}
            onLinesChange={handleLinesChange}
            readonly={saveStatus === 'conflict'}
          />
        )}
      </div>

      {/* Modals */}
      {editTarget !== undefined && (
        <ProjectEditModal
          project={editTarget}
          totalCount={projects.length}
          onSave={editTarget ? handleEditProject : handleCreateProject}
          onClose={() => setEditTarget(undefined)}
        />
      )}

      {deleteTarget && (
        <ProjectDeleteConfirm
          project={deleteTarget}
          hasUnsavedChanges={deleteTarget.id === selectedProjectId && hasUnsaved}
          onConfirm={handleDeleteProject}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {showConflict && (
        <ConflictWarning
          onReload={handleConflictReload}
          onClose={() => setShowConflict(false)}
        />
      )}
    </div>
  )
}
