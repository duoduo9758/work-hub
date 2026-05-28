import { useState, useRef, useEffect, useCallback } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// useDebounceSave — 6-state save machine for Todo / Leave / other features
// DATA.md 8b-4 reference
//
// States: idle | dirty | saving | saving_slow | saved | failed | conflict
//
// API:
//   const { status, markDirty, forceSave, retry, markSaved, markConflict, reset }
//     = useDebounceSave({ onSave, delay = 1500, saveOnVisibilityChange, saveOnPagehide })
//
//   - markDirty()   : called on every user edit
//   - forceSave()   : called on project switch / before logout (returns Promise)
//   - retry()       : called from "再試行" button after failure
//   - markSaved()   : called by component after a "reload from server" replaces local state
//   - markConflict(): explicitly mark conflict (component can also throw {code:'CONFLICT'} in onSave)
//   - reset()       : reset to idle (e.g. when switching projects, after the saved state)
//
//   onSave must throw with `error.code === 'CONFLICT'` on version conflict
// ═══════════════════════════════════════════════════════════════════════════

const SLOW_THRESHOLD_MS = 10000

export function useDebounceSave({
  onSave,
  delay = 1500,
  saveOnVisibilityChange = true,
  saveOnPagehide = true,
} = {}) {
  const [status, setStatusState] = useState('idle')

  // Refs (synchronous reads for state machine, survive re-renders)
  const statusRef = useRef('idle')
  const debounceTimerRef = useRef(null)
  const slowTimerRef = useRef(null)
  const pendingDirtyRef = useRef(false)
  const onSaveRef = useRef(onSave)

  // Keep onSave ref fresh (component can pass new closures each render)
  useEffect(() => { onSaveRef.current = onSave }, [onSave])

  // ── Internal helpers ──────────────────────────────────────────────────
  function setStatus(next) {
    statusRef.current = next
    setStatusState(next)
  }

  function clearDebounce() {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
  }

  function clearSlow() {
    if (slowTimerRef.current) {
      clearTimeout(slowTimerRef.current)
      slowTimerRef.current = null
    }
  }

  // Core save routine — locks against re-entry
  const performSave = useCallback(async () => {
    // Lock: if already saving, set pendingDirty and return
    if (statusRef.current === 'saving' || statusRef.current === 'saving_slow') {
      pendingDirtyRef.current = true
      return
    }
    // Don't auto-save in conflict
    if (statusRef.current === 'conflict') return

    clearDebounce()
    setStatus('saving')
    pendingDirtyRef.current = false

    // Slow indicator (10s)
    slowTimerRef.current = setTimeout(() => {
      if (statusRef.current === 'saving') {
        setStatus('saving_slow')
      }
    }, SLOW_THRESHOLD_MS)

    try {
      if (typeof onSaveRef.current !== 'function') {
        throw new Error('onSave is not a function')
      }
      await onSaveRef.current()
      clearSlow()
      if (pendingDirtyRef.current) {
        // Edits arrived during save — restart debounce
        pendingDirtyRef.current = false
        setStatus('dirty')
        debounceTimerRef.current = setTimeout(() => performSave(), delay)
      } else {
        setStatus('saved')
      }
    } catch (e) {
      clearSlow()
      if (e && e.code === 'CONFLICT') {
        setStatus('conflict')
      } else {
        setStatus('failed')
      }
    }
  }, [delay])

  // ── Public API ────────────────────────────────────────────────────────
  // markDirty(customDelay?) — if customDelay is a number, use it instead of
  // the configured `delay` for the next debounced save. Used by checkbox
  // toggles which want a snappier 500ms cadence (AC-TODO-L20 v2b).
  const markDirty = useCallback((customDelay) => {
    if (statusRef.current === 'saving' || statusRef.current === 'saving_slow') {
      pendingDirtyRef.current = true
      return
    }
    if (statusRef.current === 'conflict') {
      // Edit allowed but no auto-save (per DATA.md state table)
      return
    }
    setStatus('dirty')
    clearDebounce()
    const d = typeof customDelay === 'number' ? customDelay : delay
    debounceTimerRef.current = setTimeout(() => performSave(), d)
  }, [delay, performSave])

  const forceSave = useCallback(async () => {
    if (statusRef.current === 'conflict') return
    if (statusRef.current === 'saving' || statusRef.current === 'saving_slow') {
      // Pending save will pick up latest content after it completes
      return
    }
    if (statusRef.current === 'dirty' || statusRef.current === 'failed') {
      clearDebounce()
      await performSave()
    }
  }, [performSave])

  const retry = useCallback(async () => {
    if (statusRef.current === 'failed') {
      await performSave()
    }
  }, [performSave])

  // Called by component when it has replaced local state with fresh server data
  // (e.g. user clicked "再読み込み" in conflict warning)
  const markSaved = useCallback(() => {
    clearDebounce()
    clearSlow()
    pendingDirtyRef.current = false
    setStatus('saved')
  }, [])

  const markConflict = useCallback(() => {
    clearDebounce()
    clearSlow()
    setStatus('conflict')
  }, [])

  // Called when switching context (e.g. project change). Resets to idle.
  const reset = useCallback(() => {
    clearDebounce()
    clearSlow()
    pendingDirtyRef.current = false
    setStatus('idle')
  }, [])

  // ── visibilitychange / pagehide → force save (best effort) ────────────
  useEffect(() => {
    if (!saveOnVisibilityChange && !saveOnPagehide) return

    function handler() {
      // Only force-save in dirty state. Conflict / saving paths are locked.
      if (statusRef.current === 'dirty') {
        performSave()
      }
    }

    if (saveOnVisibilityChange) document.addEventListener('visibilitychange', handler)
    if (saveOnPagehide) window.addEventListener('pagehide', handler)
    return () => {
      if (saveOnVisibilityChange) document.removeEventListener('visibilitychange', handler)
      if (saveOnPagehide) window.removeEventListener('pagehide', handler)
    }
  }, [saveOnVisibilityChange, saveOnPagehide, performSave])

  // ── Cleanup on unmount ────────────────────────────────────────────────
  useEffect(() => () => { clearDebounce(); clearSlow() }, [])

  return { status, markDirty, forceSave, retry, markSaved, markConflict, reset }
}
