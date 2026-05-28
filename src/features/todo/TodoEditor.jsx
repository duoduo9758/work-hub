import { useState, useCallback, useRef, useEffect } from 'react'
import Button from '../../shared/components/Button'
import TodoRow from './TodoRow'
import {
  setLineText,
  appendLine,
  splitLineAtCursor,
  mergeLineWithPrev,
  deleteLine as actDeleteLine,
  pasteMultiline,
  makeNewLine,
  toggleChecked,
  toggleHasCheckbox,
} from './todo-actions'
import { LINE_MAX_PER_PROJECT } from './todo-store'
import { useUndoRedo } from './useUndoRedo'
import './TodoEditor.css'

// ═══════════════════════════════════════════════════════════════════════════
// TodoEditor — owns the lines[] state for the currently open project.
//
// Props:
//   lines                 - current line array
//   onLinesChange(lines)  - notify parent of new array (parent persists via debounce)
//   readonly              - disable edits during conflict (optional)
// ═══════════════════════════════════════════════════════════════════════════
export default function TodoEditor({ lines, onLinesChange, readonly = false }) {
  const [focusRequest, setFocusRequest] = useState(null) // { id, pos }
  const [transientError, setTransientError] = useState(null)
  const containerRef = useRef(null)

  // Undo/Redo (AC-TODO-L22 / L29-L37) — snapshots are pushed BEFORE each
  // structural change. Text edits do NOT push (handled by textarea native undo).
  const { push, undo, redo } = useUndoRedo({ max: 50 })

  // Keep lines fresh inside the keyboard handler closure
  const linesRef = useRef(lines)
  useEffect(() => { linesRef.current = lines }, [lines])

  const showError = useCallback((msg) => {
    setTransientError(msg)
    // Auto-clear after 4s
    setTimeout(() => setTransientError(null), 4000)
  }, [])

  // ── Editor mutations ────────────────────────────────────────────────
  const handleChangeText = useCallback((id, text) => {
    onLinesChange(setLineText(lines, id, text))
  }, [lines, onLinesChange])

  const handleSplit = useCallback((id, cursorPos) => {
    if (lines.length >= LINE_MAX_PER_PROJECT) {
      showError(`1プロジェクト最大${LINE_MAX_PER_PROJECT}行です。プロジェクトを分けてください`)
      return
    }
    push(lines)
    const { lines: next, newId } = splitLineAtCursor(lines, id, cursorPos)
    onLinesChange(next)
    if (newId) setFocusRequest({ id: newId, pos: 0 })
  }, [lines, onLinesChange, showError, push])

  const handleMerge = useCallback((id) => {
    const { lines: next, focusId, focusPos } = mergeLineWithPrev(lines, id)
    if (focusId == null) return // no prev (first line) — do nothing
    push(lines)
    onLinesChange(next)
    setFocusRequest({ id: focusId, pos: focusPos })
  }, [lines, onLinesChange, push])

  const handleDelete = useCallback((id) => {
    const idx = lines.findIndex(l => l.id === id)
    if (idx === -1) return
    push(lines)
    const next = actDeleteLine(lines, id)
    onLinesChange(next)
    // Focus previous line if exists, otherwise next
    if (next.length === 0) return
    const focusIdx = idx > 0 ? idx - 1 : 0
    const focusLine = next[focusIdx]
    if (focusLine) {
      setFocusRequest({ id: focusLine.id, pos: focusLine.text.length })
    }
  }, [lines, onLinesChange, push])

  const handlePaste = useCallback((id, cursorPos, pastedText) => {
    // Pre-check overall line count
    const segmentCount = pastedText.split(/\r\n|\r|\n/).length
    if (lines.length + segmentCount - 1 > LINE_MAX_PER_PROJECT) {
      showError(`1プロジェクト最大${LINE_MAX_PER_PROJECT}行です。ペーストを中止しました`)
      return
    }
    push(lines)
    const { lines: next, focusId, focusPos } = pasteMultiline(lines, id, cursorPos, pastedText)
    onLinesChange(next)
    if (focusId) setFocusRequest({ id: focusId, pos: focusPos })
  }, [lines, onLinesChange, showError, push])

  const handleAddRow = useCallback(() => {
    if (lines.length >= LINE_MAX_PER_PROJECT) {
      showError(`1プロジェクト最大${LINE_MAX_PER_PROJECT}行です`)
      return
    }
    push(lines)
    const newLine = makeNewLine()
    onLinesChange([...lines, newLine])
    setFocusRequest({ id: newLine.id, pos: 0 })
  }, [lines, onLinesChange, showError, push])

  // ── Checkbox toggles (v2b) — signal `quick: true` so parent uses 500ms save
  const handleToggleChecked = useCallback((id) => {
    push(lines)
    onLinesChange(toggleChecked(lines, id), { quick: true })
  }, [lines, onLinesChange, push])

  const handleToggleHasCheckbox = useCallback((id) => {
    push(lines)
    onLinesChange(toggleHasCheckbox(lines, id), { quick: true })
  }, [lines, onLinesChange, push])

  const focusConsumed = useCallback(() => setFocusRequest(null), [])

  // ── Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z handler (AC-TODO-L22 / L29-L34) ───
  // Document-level so focus on add-row button etc. still works, but scoped
  // to the editor container so other tabs are unaffected.
  useEffect(() => {
    function handler(e) {
      // IME composition → skip entirely (AC-TODO-L34)
      if (e.isComposing || e.keyCode === 229) return
      // OS key-repeat → skip (one press = one step)
      if (e.repeat) return

      // Scope: only act when focus is inside this editor's container
      if (!containerRef.current?.contains(document.activeElement)) return

      // Readonly (conflict) → no-op (SPEC 6-11)
      if (readonly) return

      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const k = e.key.toLowerCase()

      const isUndo = k === 'z' && !e.shiftKey
      const isRedoShiftZ = k === 'z' && e.shiftKey
      const isRedoY = k === 'y'

      if (isUndo) {
        // AC-TODO-L30 — empty stack: do NOT preventDefault, native undo runs
        const prev = undo(linesRef.current)
        if (prev == null) return
        e.preventDefault()
        // Sync linesRef so a rapid follow-up Ctrl+Y sees post-undo lines.
        linesRef.current = prev
        onLinesChange(prev)
      } else if (isRedoY || isRedoShiftZ) {
        const next = redo(linesRef.current)
        if (next == null) return
        e.preventDefault()
        linesRef.current = next
        onLinesChange(next)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [readonly, undo, redo, onLinesChange])

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={'todo-editor' + (readonly ? ' todo-editor--readonly' : '')}
    >
      {transientError && (
        <div className="todo-editor__error" role="alert">{transientError}</div>
      )}

      {lines.length === 0 ? (
        <div className="todo-editor__empty">
          <p className="todo-editor__empty-text">
            まだ何も書かれていません。タップして書き始めましょう
          </p>
          <Button variant="primary" onClick={handleAddRow}>
            + 新規行
          </Button>
        </div>
      ) : (
        <>
          <div className="todo-editor__rows">
            {lines.map(line => (
              <TodoRow
                key={line.id}
                line={line}
                focusRequest={focusRequest}
                onChangeText={handleChangeText}
                onSplit={handleSplit}
                onMergeWithPrev={handleMerge}
                onDeleteLine={handleDelete}
                onMultilinePaste={handlePaste}
                onLineTooLong={showError}
                onFocusConsumed={focusConsumed}
                onToggleChecked={handleToggleChecked}
                onToggleHasCheckbox={handleToggleHasCheckbox}
              />
            ))}
          </div>

          <button
            type="button"
            className="todo-editor__add-row-btn"
            onClick={handleAddRow}
          >
            + 新規行
          </button>
        </>
      )}
    </div>
  )
}
