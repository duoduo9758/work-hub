import Button from './Button'
import './ErrorMessage.css'

export default function ErrorMessage({ message, onRetry }) {
  return (
    <div className="error-message">
      <p className="error-message__text">
        {message || 'データの取得に失敗しました。再読み込みしてください'}
      </p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>再試行</Button>
      )}
    </div>
  )
}
