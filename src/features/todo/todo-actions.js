import { uuid } from '../../lib/uuid'
import { LINE_MAX_CHARS } from './todo-store'

// ═══════════════════════════════════════════════════════════════════════════
// todo-actions — Pure functions for line array manipulation
//   (no Firestore here — see todo-store.js for persistence)
// All functions are immutable: return new arrays, never mutate input.
// ═══════════════════════════════════════════════════════════════════════════

export function makeNewLine(overrides = {}) {
  return {
    id: uuid(),
    text: '',
    hasCheckbox: false,
    checked: false,
    indent: 0,
    ...overrides,
  }
}

// ── Update text of a specific line ──────────────────────────────────────
export function setLineText(lines, lineId, text) {
  return lines.map(l => (l.id === lineId ? { ...l, text } : l))
}

// ── Toggle checked on a line (only takes effect when hasCheckbox=true) ──
export function toggleChecked(lines, lineId) {
  return lines.map(l => {
    if (l.id !== lineId) return l
    if (!l.hasCheckbox) return l
    return { ...l, checked: !l.checked }
  })
}

// ── Toggle hasCheckbox on a line (Ctrl+1) ───────────────────────────────
// When turning OFF, clear `checked` so a future re-enable starts unchecked.
export function toggleHasCheckbox(lines, lineId) {
  return lines.map(l => {
    if (l.id !== lineId) return l
    const next = !l.hasCheckbox
    return { ...l, hasCheckbox: next, checked: next ? l.checked : false }
  })
}

// ── Append a new empty line at end ──────────────────────────────────────
export function appendLine(lines) {
  return [...lines, makeNewLine()]
}

// ── Insert a new line right after the given lineId, return { lines, newId }
export function insertLineAfter(lines, lineId) {
  const idx = lines.findIndex(l => l.id === lineId)
  if (idx === -1) return { lines, newId: null }
  const newLine = makeNewLine()
  const next = [...lines.slice(0, idx + 1), newLine, ...lines.slice(idx + 1)]
  return { lines: next, newId: newLine.id }
}

// ── Delete a single line by id ──────────────────────────────────────────
export function deleteLine(lines, lineId) {
  return lines.filter(l => l.id !== lineId)
}

// ── Split a line at cursor position (Enter behavior, AC-TODO-L05) ───────
// Original line keeps text BEFORE cursor.
// New line BELOW it gets text AFTER cursor.
// New line inherits NOTHING from original (hasCheckbox/checked/indent reset).
// Per SPEC: "新しい下行に入る" — only text moves. Returns { lines, newId }.
export function splitLineAtCursor(lines, lineId, cursorPos) {
  const idx = lines.findIndex(l => l.id === lineId)
  if (idx === -1) return { lines, newId: null }
  const orig = lines[idx]
  const before = orig.text.slice(0, cursorPos)
  const after = orig.text.slice(cursorPos)
  const updatedOrig = { ...orig, text: before }
  // New line inherits indent from original (visual continuity, common UX)
  // but hasCheckbox/checked reset (user expectation: new line is fresh)
  const newLine = makeNewLine({ text: after, indent: orig.indent })
  const next = [
    ...lines.slice(0, idx),
    updatedOrig,
    newLine,
    ...lines.slice(idx + 1),
  ]
  return { lines: next, newId: newLine.id }
}

// ── Merge line with previous (Backspace at line start, AC-TODO-L07/L25) ──
// Result keeps PREV line's hasCheckbox/checked/indent, concatenates text.
// Returns { lines, focusId, focusPos } — focus moves to prev line at the
// boundary between old prev.text and current.text.
export function mergeLineWithPrev(lines, lineId) {
  const idx = lines.findIndex(l => l.id === lineId)
  if (idx <= 0) return { lines, focusId: null, focusPos: 0 } // no prev or not found
  const prev = lines[idx - 1]
  const curr = lines[idx]
  const merged = {
    ...prev,
    text: prev.text + curr.text,
    // hasCheckbox/checked/indent retained from prev (already in spread)
  }
  const next = [
    ...lines.slice(0, idx - 1),
    merged,
    ...lines.slice(idx + 1),
  ]
  return { lines: next, focusId: prev.id, focusPos: prev.text.length }
}

// ── Multi-line paste (AC-TODO-L23/L26) ──────────────────────────────────
// Splits pasted text by newline. If any segment exceeds 500 chars, throws.
// Inserts segments at cursor position within the target line.
//
// Behavior:
//   - target line's text is split at cursor: before + paste-first / paste-last + after
//   - first paste segment is concatenated to "before" (becomes new text of target line)
//   - last paste segment is concatenated to "after" (becomes new last inserted line)
//   - middle paste segments become full new lines between
// Returns { lines, focusId, focusPos } — focus = end of the last inserted segment.
export function pasteMultiline(lines, lineId, cursorPos, pastedText) {
  const segments = pastedText.split(/\r\n|\r|\n/)
  // Validate per-segment length
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].length > LINE_MAX_CHARS) {
      const err = new Error(`Line ${i + 1} exceeds ${LINE_MAX_CHARS} chars`)
      err.code = 'LINE_TOO_LONG'
      err.lineIndex = i + 1
      throw err
    }
  }
  const idx = lines.findIndex(l => l.id === lineId)
  if (idx === -1) return { lines, focusId: null, focusPos: 0 }
  const target = lines[idx]
  const before = target.text.slice(0, cursorPos)
  const after = target.text.slice(cursorPos)

  if (segments.length === 1) {
    // Single-line paste: just splice in, no new rows
    const merged = before + segments[0] + after
    if (merged.length > LINE_MAX_CHARS) {
      const err = new Error('Line exceeds max chars after paste')
      err.code = 'LINE_TOO_LONG'
      err.lineIndex = 1
      throw err
    }
    const updated = { ...target, text: merged }
    const next = [...lines.slice(0, idx), updated, ...lines.slice(idx + 1)]
    const focusPos = (before + segments[0]).length
    return { lines: next, focusId: target.id, focusPos }
  }

  // Multi-line: first segment merges with `before`, last segment merges with `after`
  const firstText = before + segments[0]
  const lastText = segments[segments.length - 1] + after
  if (firstText.length > LINE_MAX_CHARS) {
    const err = new Error('First line exceeds max chars after paste')
    err.code = 'LINE_TOO_LONG'
    err.lineIndex = 1
    throw err
  }
  if (lastText.length > LINE_MAX_CHARS) {
    const err = new Error('Last line exceeds max chars after paste')
    err.code = 'LINE_TOO_LONG'
    err.lineIndex = segments.length
    throw err
  }

  const firstLine = { ...target, text: firstText }
  const middleLines = segments.slice(1, -1).map(t => makeNewLine({ text: t, indent: target.indent }))
  const lastLine = makeNewLine({ text: lastText, indent: target.indent })

  const next = [
    ...lines.slice(0, idx),
    firstLine,
    ...middleLines,
    lastLine,
    ...lines.slice(idx + 1),
  ]
  // Focus = position right after the last pasted segment, before `after`
  const focusPos = segments[segments.length - 1].length
  return { lines: next, focusId: lastLine.id, focusPos }
}
