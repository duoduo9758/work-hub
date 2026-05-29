import { createContext, useContext, useCallback, useRef } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// UnsavedChangesContext — coordinates "is there unsaved work?" between
// features (currently Todo) and the surrounding shell (tab switch, logout).
//
// Pattern: a feature registers a guard `{ hasUnsaved, forceSave }`. Before
// the shell does something that would discard unsaved work, it calls
// `ensureSaved()`. The context iterates guards, prompts the user when any
// reports unsaved, and either saves (forceSave), discards (returns true so
// the action proceeds), or cancels (returns false).
//
// Confirmation is via window.confirm() to avoid a custom modal here.
// Returns:
//   true  — caller may proceed (no unsaved, or user chose save/discard)
//   false — caller must abort (user cancelled, or save failed and user
//            chose to abort)
// ═══════════════════════════════════════════════════════════════════════════
const UnsavedChangesContext = createContext(null)

export function UnsavedChangesProvider({ children }) {
  const guardsRef = useRef(new Set())

  const register = useCallback((guard) => {
    guardsRef.current.add(guard)
    return () => { guardsRef.current.delete(guard) }
  }, [])

  const ensureSaved = useCallback(async () => {
    for (const guard of guardsRef.current) {
      let hasUnsaved
      try {
        hasUnsaved = guard.hasUnsaved()
      } catch {
        hasUnsaved = false
      }
      if (!hasUnsaved) continue

      // First prompt: save / discard / cancel
      const choice = window.confirm(
        '未保存の変更があります。\n' +
        'OK = 保存して続行 / キャンセル = この場で止まる'
      )
      if (!choice) return false

      try {
        await guard.forceSave()
      } catch {
        // Save failed — ask whether to discard or stay
        const discard = window.confirm(
          '保存に失敗しました。\n' +
          'OK = 変更を破棄して続行 / キャンセル = この場で止まる'
        )
        if (!discard) return false
      }
    }
    return true
  }, [])

  return (
    <UnsavedChangesContext.Provider value={{ register, ensureSaved }}>
      {children}
    </UnsavedChangesContext.Provider>
  )
}

export function useUnsavedChanges() {
  const ctx = useContext(UnsavedChangesContext)
  if (!ctx) {
    // Allow calling without a provider — return no-op guards so we don't
    // crash in tests or alternate mount trees.
    return {
      register: () => () => {},
      ensureSaved: async () => true,
    }
  }
  return ctx
}
