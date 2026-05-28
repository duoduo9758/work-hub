import './Button.css'

// variant: "primary" | "secondary" | "tertiary"
export default function Button({
  variant = 'secondary',
  children,
  disabled,
  onClick,
  type = 'button',
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      className={`btn btn--${variant} ${className}`}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  )
}
