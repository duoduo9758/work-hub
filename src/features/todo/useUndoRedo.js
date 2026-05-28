import { useRef, useCallback } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// useUndoRedo — past/future snapshot stack for structural lines[] changes.
//
// API:
//   const { push, undo, redo, clear, canUndo, canRedo } = useUndoRedo({ max: 50 })
//
//   - push(snapshot)        : save BEFORE applying a structural change.
//                             Clears the future stack (standard undo/redo).
//   - undo(currentSnapshot) : returns past[-1] or null. Pushes currentSnapshot
//                             onto future so redo can reverse it.
//   - redo(currentSnapshot) : returns future[-1] or null. Pushes currentSnapshot
//                             onto past so undo can reverse it again.
//   - clear()               : wipe both stacks (project switch / conflict reload).
//   - canUndo()/canRedo()   : synchronous boolean reads.
//
// Snapshot shape is opaque to this hook — caller chooses (typically the lines
// array). We hold references, not deep clones, so the caller MUST treat
// snapshots as immutable (todo-actions.js already returns fresh arrays).
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_MAX = 50

export function useUndoRedo({ max = DEFAULT_MAX } = {}) {
  const pastRef = useRef([])
  const futureRef = useRef([])

  const push = useCallback((snapshot) => {
    pastRef.current.push(snapshot)
    if (pastRef.current.length > max) {
      // Drop oldest to honor the configured limit (AC-TODO-L31)
      pastRef.current.shift()
    }
    // Any new structural change invalidates the redo stack (AC-TODO-L35)
    futureRef.current = []
  }, [max])

  const undo = useCallback((currentSnapshot) => {
    if (pastRef.current.length === 0) return null
    const prev = pastRef.current.pop()
    futureRef.current.push(currentSnapshot)
    return prev
  }, [])

  const redo = useCallback((currentSnapshot) => {
    if (futureRef.current.length === 0) return null
    const next = futureRef.current.pop()
    pastRef.current.push(currentSnapshot)
    return next
  }, [])

  const clear = useCallback(() => {
    pastRef.current = []
    futureRef.current = []
  }, [])

  const canUndo = useCallback(() => pastRef.current.length > 0, [])
  const canRedo = useCallback(() => futureRef.current.length > 0, [])

  return { push, undo, redo, clear, canUndo, canRedo }
}
