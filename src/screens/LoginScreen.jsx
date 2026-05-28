import { useState } from 'react'
import { useAuth } from '../shared/contexts/AuthContext'
import Button from '../shared/components/Button'
import Spinner from '../shared/components/Spinner'
import './LoginScreen.css'

// ─── Validation rules (AC-AUTH-02 ~ AC-AUTH-04) ───────────────────────────
const ACCESS_CODE_RE = /^[a-zA-Z0-9_-]+$/

function validateCode(code) {
  if (!code) return null // Empty: button disabled separately
  if (code.length < 8) return '8文字以上で入力してください'
  if (code.length > 64) return '64文字以内で入力してください'
  if (!ACCESS_CODE_RE.test(code)) return '英数字、アンダースコア、ハイフンのみ使用可能です'
  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// LoginScreen — S0: access code login
// ═══════════════════════════════════════════════════════════════════════════
export default function LoginScreen() {
  const { login, loginError } = useAuth()
  const [code, setCode] = useState('')
  const [localError, setLocalError] = useState(null)
  const [loading, setLoading] = useState(false)

  const validationError = validateCode(code)
  const canSubmit = code.length > 0 && !validationError && !loading

  async function handleLogin() {
    if (!canSubmit) return
    setLocalError(null)
    setLoading(true)
    try {
      await login(code)
      // On success, AuthContext sets isLoggedIn=true → App renders main screen
    } catch {
      // loginError is set inside AuthContext; local loading must be cleared
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleLogin()
  }

  function handleChange(e) {
    setCode(e.target.value)
    setLocalError(null)
  }

  const displayError = localError || loginError

  return (
    <div className="login-screen">
      <div className="login-screen__card">
        {/* App title */}
        <h1 className="login-screen__title">work-hub</h1>

        {/* Input */}
        <div className="login-screen__field">
          <label className="login-screen__label" htmlFor="access-code-input">
            アクセスコード
          </label>
          <input
            id="access-code-input"
            type="text"
            className={`login-screen__input${validationError && code ? ' login-screen__input--error' : ''}`}
            value={code}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="例：my-work-hub-2026"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={loading}
          />
          {/* Inline validation message (only after user types something) */}
          {validationError && code && (
            <p className="login-screen__field-error">{validationError}</p>
          )}
          <p className="login-screen__hint">
            英数字・アンダースコア・ハイフン、8〜64文字
          </p>
        </div>

        {/* Server/Auth error */}
        {displayError && !validationError && (
          <p className="login-screen__error">{displayError}</p>
        )}

        {/* Submit button */}
        <Button
          variant="primary"
          onClick={handleLogin}
          disabled={!canSubmit}
          className="login-screen__submit"
        >
          {loading ? '処理中...' : 'ログイン'}
        </Button>
      </div>
    </div>
  )
}
