import './TimerScreen.css'

export default function TimerModeToggle({ mode, onChange, disabled }) {
  return (
    <div className="timer-mode-toggle" role="group" aria-label="タイマーモード">
      <button
        className={'timer-mode-toggle__btn' + (mode === 'up' ? ' timer-mode-toggle__btn--active' : '')}
        onClick={() => onChange('up')}
        disabled={disabled}
        type="button"
      >
        カウントアップ
      </button>
      <button
        className={'timer-mode-toggle__btn' + (mode === 'down' ? ' timer-mode-toggle__btn--active' : '')}
        onClick={() => onChange('down')}
        disabled={disabled}
        type="button"
      >
        カウントダウン
      </button>
    </div>
  )
}
