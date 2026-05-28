// localStorage safe wrapper - handles private browsing / disabled storage
export function safeGetItem(key, defaultValue = null) {
  try {
    const v = localStorage.getItem(key)
    return v === null ? defaultValue : v
  } catch {
    return defaultValue
  }
}

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (e) {
    if (import.meta.env?.DEV) {
      console.warn('localStorage write failed', e)
    }
    return false
  }
}

export function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

// Returns "workHub_${accessCode}_${suffix}"
export function getNamespacedKey(accessCode, suffix) {
  return `workHub_${accessCode}_${suffix}`
}
