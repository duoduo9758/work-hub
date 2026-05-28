import './Spinner.css'

export default function Spinner({ size = 'md' }) {
  return <div className={`spinner spinner--${size}`} aria-label="読み込み中" />
}
