import { useEffect } from 'react'
import './Modal.css'

export default function Modal({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        {title && <div className="modal-header"><h3 className="modal-title">{title}</h3></div>}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
