import { CD_MINUTES_MIN, CD_MINUTES_MAX, CD_SECONDS_MIN, CD_SECONDS_MAX } from './timer-state'
import './TimerScreen.css'

export default function TimerCountdownInput({ minutes, seconds, onChange, disabled }) {
  function handleMinutes(e) {
    const v = Math.max(CD_MINUTES_MIN, Math.min(CD_MINUTES_MAX, parseInt(e.target.value, 10) || 0))
    onChange(v, seconds)
  }
  function handleSeconds(e) {
    const v = Math.max(CD_SECONDS_MIN, Math.min(CD_SECONDS_MAX, parseInt(e.target.value, 10) || 0))
    onChange(minutes, v)
  }

  return (
    <div className="timer-cd-input" aria-label="カウントダウン設定">
      <input
        type="number"
        className="timer-cd-input__num"
        value={minutes}
        min={CD_MINUTES_MIN}
        max={CD_MINUTES_MAX}
        onChange={handleMinutes}
        disabled={disabled}
        aria-label="分"
      />
      <span className="timer-cd-input__sep">:</span>
      <input
        type="number"
        className="timer-cd-input__num"
        value={String(seconds).padStart(2, '0')}
        min={CD_SECONDS_MIN}
        max={CD_SECONDS_MAX}
        onChange={handleSeconds}
        disabled={disabled}
        aria-label="秒"
      />
    </div>
  )
}
