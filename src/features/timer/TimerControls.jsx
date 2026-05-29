import './TimerScreen.css'

// Button variant depends on timer state:
//   idle/stopped: Start = primary, Stop = disabled, Reset = disabled
//   running:      Start = disabled, Stop = primary, Reset = secondary
//   finished:     Start = secondary (restart), Stop = disabled, Reset = primary

export default function TimerControls({ running, finished, onStart, onStop, onReset }) {
  return (
    <div className="timer-controls">
      <button
        type="button"
        className={'timer-controls__btn' + (!running && !finished ? ' timer-controls__btn--primary' : running ? ' timer-controls__btn--dim' : ' timer-controls__btn--secondary')}
        onClick={onStart}
        disabled={running}
        aria-label="スタート"
      >
        スタート
      </button>
      <button
        type="button"
        className={'timer-controls__btn' + (running ? ' timer-controls__btn--primary' : ' timer-controls__btn--dim')}
        onClick={onStop}
        disabled={!running}
        aria-label="ストップ"
      >
        ストップ
      </button>
      <button
        type="button"
        className={'timer-controls__btn' + (finished ? ' timer-controls__btn--primary' : ' timer-controls__btn--secondary')}
        onClick={onReset}
        disabled={running && !finished}
        aria-label="リセット"
      >
        リセット
      </button>
    </div>
  )
}
