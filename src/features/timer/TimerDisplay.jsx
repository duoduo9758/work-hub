import './TimerScreen.css'

export default function TimerDisplay({ text, finished }) {
  return (
    <div className={'timer-display' + (finished ? ' timer-display--finished' : '')}>
      <span className="timer-display__time">{text}</span>
      {finished && <p className="timer-display__msg">時間です</p>}
    </div>
  )
}
