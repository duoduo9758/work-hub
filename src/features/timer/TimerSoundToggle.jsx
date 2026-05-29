import './TimerScreen.css'

export default function TimerSoundToggle({ on, onChange }) {
  return (
    <button
      type="button"
      className={'timer-sound-toggle' + (on ? ' timer-sound-toggle--on' : ' timer-sound-toggle--off')}
      onClick={() => onChange(!on)}
      aria-label={on ? '音 ON（クリックでOFF）' : '音 OFF（クリックでON）'}
    >
      {on ? '音 ON' : '音 OFF'}
    </button>
  )
}
