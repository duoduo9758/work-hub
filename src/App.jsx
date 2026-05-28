function App() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      flexDirection: 'column',
      gap: '8px',
    }}>
      <h1 style={{
        fontSize: 'var(--text-hero)',
        fontWeight: '600',
        color: 'var(--color-text)',
        letterSpacing: '-0.5px',
      }}>
        work-hub
      </h1>
      <p style={{
        fontSize: 'var(--text-base)',
        color: 'var(--color-text-muted)',
      }}>
        v0 initialized
      </p>
    </div>
  )
}

export default App
