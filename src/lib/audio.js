// AudioContext lazy init — must be called inside a user gesture handler
let ctx = null

export function initAudioContext() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  }
  ctx = new (window.AudioContext || window.webkitAudioContext)()
  return ctx
}

// Short 3-beep finish sound (~0.6s total)
export function playFinishSound() {
  const audioCtx = ctx
  if (!audioCtx || audioCtx.state === 'suspended') return

  const beepAt = (startTime, freq = 880, duration = 0.12) => {
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, startTime)
    gain.gain.setValueAtTime(0.3, startTime)
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
    osc.start(startTime)
    osc.stop(startTime + duration)
  }

  const now = audioCtx.currentTime
  beepAt(now, 880, 0.15)
  beepAt(now + 0.2, 880, 0.15)
  beepAt(now + 0.4, 1100, 0.2)
}
