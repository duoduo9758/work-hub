import { useRef, useEffect, useState } from 'react'
import { LINE_MAX_CHARS } from './todo-store'
import './TodoRow.css'

// ═══════════════════════════════════════════════════════════════════════════
// TodoRow — single editable line in the Todo editor
//
// Auto-resize textarea (max 6 line-heights), IME-safe Enter/Backspace,
// 500-char limit, multi-line paste delegated to parent.
//
// Props:
//   line                 - { id, text, hasCheckbox, checked, indent }
//   focusRequest         - { id, pos } | null  — parent requests focus at pos
//   onChangeText(id, text)
//   onSplit(id, cursorPos)       — Enter at cursorPos
//   onMergeWithPrev(id)          — Backspace at position 0 (text may be empty or not)
//   onDeleteLine(id)             — explicit delete button (PC only, hidden on mobile v2d)
//   onMultilinePaste(id, cursorPos, pastedText) — pasted text contains \n
//   onLineTooLong(reason)        — error display ("1行500文字以内で入力してください")
//   onFocusConsumed()            — call after parent's focusRequest applied
//   onToggleChecked(id)          — checkbox click (v2b)
//   onToggleHasCheckbox(id)      — Ctrl+1 / Cmd+1 (v2b)
//   onIncreaseIndent(id)         — Tab (v2c)
//   onDecreaseIndent(id)         — Shift+Tab (v2c)
// ═══════════════════════════════════════════════════════════════════════════
const MAX_VISIBLE_LINES = 6
const LINE_HEIGHT_PX = 22 // matches CSS line-height

export default function TodoRow({
  line,
  focusRequest,
  onChangeText,
  onSplit,
  onMergeWithPrev,
  onDeleteLine,
  onMultilinePaste,
  onLineTooLong,
  onFocusConsumed,
  onToggleChecked,
  onToggleHasCheckbox,
  onIncreaseIndent,
  onDecreaseIndent,
}) {
  const taRef = useRef(null)
  const isComposingRef = useRef(false)
  // Track previous text so we can revert on too-long input (AC-TODO-L24)
  const [prevText, setPrevText] = useState(line.text)

  // ── Auto-resize ─────────────────────────────────────────────────────
  // Skip when the textarea isn't in layout (parent display:none, e.g. the
  // Todo tab is hidden behind Tracker). Otherwise scrollHeight reads 0 and
  // we'd lock the row to height:0px, hiding the text after the user later
  // switches to Todo. An IntersectionObserver below re-runs autoResize when
  // the textarea becomes visible.
  function autoResize(el) {
    if (!el) return
    if (el.offsetParent === null) return // hidden — leave CSS default
    el.style.height = 'auto'
    if (el.scrollHeight === 0) return // belt-and-suspenders
    const maxHeight = LINE_HEIGHT_PX * MAX_VISIBLE_LINES + 10 // padding tolerance
    const newHeight = Math.min(el.scrollHeight, maxHeight)
    el.style.height = newHeight + 'px'
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }

  // Resize on mount and whenever text changes
  useEffect(() => {
    autoResize(taRef.current)
    setPrevText(line.text)
  }, [line.text])

  // Re-run autoResize when the textarea becomes visible (tab switch from
  // Tracker to Todo, or any display:none → visible transition).
  useEffect(() => {
    const el = taRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(en => en.isIntersecting)) {
        autoResize(el)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // ── Focus request from parent (e.g. after split/merge) ──────────────
  useEffect(() => {
    if (!focusRequest || focusRequest.id !== line.id) return
    const el = taRef.current
    if (!el) return
    el.focus()
    const pos = Math.max(0, Math.min(focusRequest.pos ?? 0, el.value.length))
    // setSelectionRange must happen after focus
    requestAnimationFrame(() => {
      try {
        el.setSelectionRange(pos, pos)
      } catch {
        /* some browsers throw if not yet focused */
      }
    })
    onFocusConsumed?.()
  }, [focusRequest, line.id, onFocusConsumed])

  // ── Input handler with 500-char enforcement ─────────────────────────
  function handleInput(e) {
    const newText = e.target.value
    if (newText.length > LINE_MAX_CHARS) {
      // Revert and notify
      e.target.value = prevText
      onLineTooLong?.(`1行${LINE_MAX_CHARS}文字以内で入力してください`)
      return
    }
    onChangeText(line.id, newText)
    autoResize(e.target)
  }

  // ── Key handler: Enter / Backspace, IME-suppressed ──────────────────
  function handleKeyDown(e) {
    // IME composition: do nothing
    if (isComposingRef.current || e.nativeEvent?.isComposing) return

    // Ctrl+1 / Cmd+1 → toggle hasCheckbox on this line (AC-TODO-L21 v2b)
    if ((e.ctrlKey || e.metaKey) && (e.key === '1' || e.code === 'Digit1')) {
      e.preventDefault()
      onToggleHasCheckbox?.(line.id)
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const pos = e.target.selectionStart ?? line.text.length
      onSplit(line.id, pos)
      return
    }

    if (e.key === 'Backspace') {
      const pos = e.target.selectionStart ?? 0
      const selEnd = e.target.selectionEnd ?? 0
      if (pos === 0 && selEnd === 0) {
        // At line start → merge with previous (whether text is empty or not)
        e.preventDefault()
        onMergeWithPrev(line.id)
      }
      // else: default 1-char delete
      return
    }

    // Tab / Shift+Tab → indent ± (AC-TODO-L08 / L09 / L19 / L20, v2c).
    // IME check above already exits, so AC-L17 (IME中のTab無視) holds.
    if (e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) {
        onDecreaseIndent?.(line.id)
      } else {
        onIncreaseIndent?.(line.id)
      }
      return
    }
  }

  // ── Paste handler: detect multi-line and delegate ───────────────────
  function handlePaste(e) {
    const text = e.clipboardData?.getData('text/plain') ?? ''
    if (text.includes('\n') || text.includes('\r')) {
      e.preventDefault()
      const pos = e.target.selectionStart ?? line.text.length
      try {
        onMultilinePaste(line.id, pos, text)
      } catch (err) {
        if (err?.code === 'LINE_TOO_LONG') {
          onLineTooLong?.(
            `${err.lineIndex}行目が${LINE_MAX_CHARS}文字を超えています。ペーストを中止しました`
          )
        } else {
          onLineTooLong?.('ペーストに失敗しました')
        }
      }
      return
    }
    // Single-line paste: let default behavior run, but check length after
    // (handleInput will catch and revert if needed)
  }

  // ── Composition (IME) handlers ──────────────────────────────────────
  function handleCompositionStart() { isComposingRef.current = true }
  function handleCompositionEnd(e) {
    isComposingRef.current = false
    // Trigger input handler to capture final composed text & length check
    handleInput(e)
  }

  const isEmpty = line.text.length === 0

  return (
    <div
      className="todo-row"
      style={{ paddingLeft: `${line.indent * 24}px` }}
    >
      {/* Checkbox — click toggles checked (AC-TODO-L20 v2b) */}
      {line.hasCheckbox && (
        <button
          type="button"
          className={
            'todo-row__checkbox' +
            (line.checked ? ' todo-row__checkbox--checked' : '')
          }
          onClick={() => onToggleChecked?.(line.id)}
          aria-label={line.checked ? '完了を解除' : '完了にする'}
          aria-pressed={line.checked}
        />
      )}

      <textarea
        ref={taRef}
        className={
          'todo-row__textarea' +
          (line.checked && line.hasCheckbox ? ' todo-row__textarea--checked' : '')
        }
        value={line.text}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        rows={1}
        spellCheck={false}
        placeholder={isEmpty ? '...' : ''}
        aria-label="行の内容"
      />

      <button
        type="button"
        className="todo-row__delete-btn"
        onClick={() => onDeleteLine(line.id)}
        aria-label="行を削除"
        title="行を削除"
      >
        ×
      </button>

      {/* Mobile-only checkbox-toggle button: replaces Ctrl+1 which mobile
          doesn't have. Shown only ≤639px via CSS. (AC-TODO-M03) */}
      <button
        type="button"
        className="todo-row__chk-toggle-btn"
        onClick={() => onToggleHasCheckbox?.(line.id)}
        aria-label={line.hasCheckbox ? 'チェックボックスを外す' : 'チェックボックスを付ける'}
        title={line.hasCheckbox ? 'チェックボックスを外す' : 'チェックボックスを付ける'}
      >
        {line.hasCheckbox ? '☑' : '☐'}
      </button>
    </div>
  )
}
