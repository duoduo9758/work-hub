import { useState, useCallback } from 'react'
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
    const { lines: next, newId } = splitLineAtCursor(lines, id, cursorPos)
    onLinesChange(next)
    if (newId) setFocusRequest({ id: newId, pos: 0 })
  }, [lines, onLinesChange, showError])

  const handleMerge = useCallback((id) => {
    const { lines: next, focusId, focusPos } = mergeLineWithPrev(lines, id)
    if (focusId == null) return // no prev (first line) — do nothing
    onLinesChange(next)
    setFocusRequest({ id: focusId, pos: focusPos })
  }, [lines, onLinesChange])

  const handleDelete = useCallback((id) => {
    const idx = lines.findIndex(l => l.id === id)
    if (idx === -1) return
    const next = actDeleteLine(lines, id)
    onLinesChange(next)
    // Focus previous line if exists, otherwise next
    if (next.length === 0) return
    const focusIdx = idx > 0 ? idx - 1 : 0
    const focusLine = next[focusIdx]
    if (focusLine) {
      setFocusRequest({ id: focusLine.id, pos: focusLine.text.length })
    }
  }, [lines, onLinesChange])

  const handlePaste = useCallback((id, cursorPos, pastedText) => {
    // Pre-check overall line count
    const segmentCount = pastedText.split(/\r\n|\r|\n/).length
    if (lines.length + segmentCount - 1 > LINE_MAX_PER_PROJECT) {
      showError(`1プロジェクト最大${LINE_MAX_PER_PROJECT}行です。ペーストを中止しました`)
      return
    }
    const { lines: next, focusId, focusPos } = pasteMultiline(lines, id, cursorPos, pastedText)
    onLinesChange(next)
    if (focusId) setFocusRequest({ id: focusId, pos: focusPos })
  }, [lines, onLinesChange, showError])

  const handleAddRow = useCallback(() => {
    if (lines.length >= LINE_MAX_PER_PROJECT) {
      showError(`1プロジェクト最大${LINE_MAX_PER_PROJECT}行です`)
      return
    }
    const newLine = makeNewLine()
    onLinesChange([...lines, newLine])
    setFocusRequest({ id: newLine.id, pos: 0 })
  }, [lines, onLinesChange, showError])

  // ── Checkbox toggles (v2b) — signal `quick: true` so parent uses 500ms save
  const handleToggleChecked = useCallback((id) => {
    onLinesChange(toggleChecked(lines, id), { quick: true })
  }, [lines, onLinesChange])

  const handleToggleHasCheckbox = useCallback((id) => {
    onLinesChange(toggleHasCheckbox(lines, id), { quick: true })
  }, [lines, onLinesChange])

  const focusConsumed = useCallback(() => setFocusRequest(null), [])

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className={'todo-editor' + (readonly ? ' todo-editor--readonly' : '')}>
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
