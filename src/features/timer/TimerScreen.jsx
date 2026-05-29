import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MODE_UP, MODE_DOWN,
  loadMode, saveMode,
  loadSound, saveSound,
  loadCdSetting, saveCdSetting,
  loadSnapshot, saveSnapshot, clearSnapshot,
  calcElapsedMs, calcRemainingMs,
  formatCountUp, formatCountDown,
} from './timer-state'
import { initAudioContext, playFinishSound } from '../../lib/audio'
import TimerDisplay from './TimerDisplay'
import TimerControls from './TimerControls'
import TimerModeToggle from './TimerModeToggle'
import TimerCountdownInput from './TimerCountdownInput'
import TimerSoundToggle from './TimerSoundToggle'
import './TimerScreen.css'

const TICK_MS = 200 // UI refresh interval

export default function TimerScreen() {
  const [mode, setMode] = useState(loadMode)
  const [soundOn, setSoundOn] = useState(loadSound)
  const [cdMinutes, setCdMinutes] = useState(() => loadCdSetting().minutes)
  const [cdSeconds, setCdSeconds] = useState(() => loadCdSetting().seconds)

  // running = snapshot exists; finished = countdown reached 0
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  // Initial display matches the loaded mode (avoid showing h:mm:ss in down mode)
  const [displayText, setDisplayText] = useState(() => {
    const m = loadMode()
    if (m === MODE_UP) return '0:00:00'
    const { minutes, seconds } = loadCdSetting()
    return formatCountDown((minutes * 60 + seconds) * 1000)
  })

  const snapshotRef = useRef(null)   // in-memory mirror of persisted snapshot
  const intervalRef = useRef(null)
  const soundOnRef = useRef(soundOn) // stable ref for interval closure
  const finishedFiredRef = useRef(false)

  useEffect(() => { soundOnRef.current = soundOn }, [soundOn])

  // ── Tick — recompute display ───────────────────────────────────────────
  const tick = useCallback(() => {
    const snap = snapshotRef.current
    if (!snap) return
    const elapsed = calcElapsedMs(snap)

    if (snap.mode === MODE_UP) {
      setDisplayText(formatCountUp(elapsed))
    } else {
      const remaining = calcRemainingMs(snap.cdTotalMs, elapsed)
      setDisplayText(formatCountDown(remaining))
      if (remaining === 0 && !finishedFiredRef.current) {
        finishedFiredRef.current = true
        setFinished(true)
        setRunning(false)
        clearSnapshot()
        snapshotRef.current = null
        stopInterval()
        document.title = '時間です — Work Hub'
        if (soundOnRef.current) playFinishSound()
      }
    }
  }, [])

  function stopInterval() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  function startInterval() {
    stopInterval()
    intervalRef.current = setInterval(tick, TICK_MS)
  }

  // ── On mount: check for orphaned snapshot (tab close during run) ───────
  useEffect(() => {
    const snap = loadSnapshot()
    if (!snap) return

    const elapsed = calcElapsedMs(snap)
    const alreadyDone = snap.mode === MODE_DOWN && elapsed >= snap.cdTotalMs

    const msg = alreadyDone
      ? 'タイマーが終了していました。リセットします。'
      : `タイマーが実行中でした（${snap.mode === MODE_UP ? formatCountUp(elapsed) : formatCountDown(calcRemainingMs(snap.cdTotalMs, elapsed))}）。\n停止状態で復帰します。`

    window.alert(msg)
    clearSnapshot()

    if (!alreadyDone) {
      // Restore elapsed as a stopped state
      const stoppedSnap = { ...snap, startedAt: Date.now(), elapsedMs: elapsed }
      snapshotRef.current = stoppedSnap
      setMode(snap.mode)
      setRunning(false)
      if (snap.mode === MODE_UP) setDisplayText(formatCountUp(elapsed))
      else setDisplayText(formatCountDown(calcRemainingMs(snap.cdTotalMs, elapsed)))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      stopInterval()
      document.title = 'Work Hub'
    }
  }, [])

  // ── Handlers ───────────────────────────────────────────────────────────
  function handleStart() {
    const cdTotalMs = (cdMinutes * 60 + cdSeconds) * 1000
    if (mode === MODE_DOWN && cdTotalMs === 0) return

    initAudioContext()
    finishedFiredRef.current = false
    setFinished(false)

    const prevElapsed = snapshotRef.current?.elapsedMs ?? 0

    const snap = {
      startedAt: Date.now(),
      elapsedMs: prevElapsed,
      mode,
      cdTotalMs,
    }
    snapshotRef.current = snap
    saveSnapshot(snap)
    setRunning(true)
    startInterval()
    tick()
  }

  function handleStop() {
    const snap = snapshotRef.current
    if (!snap) return
    const elapsed = calcElapsedMs(snap)
    // Persist the elapsed so Resume works after tab reload
    const stoppedSnap = { ...snap, startedAt: Date.now(), elapsedMs: elapsed }
    snapshotRef.current = stoppedSnap
    clearSnapshot() // not running — no need to persist
    stopInterval()
    setRunning(false)
  }

  function handleReset() {
    stopInterval()
    clearSnapshot()
    snapshotRef.current = null
    finishedFiredRef.current = false
    setRunning(false)
    setFinished(false)
    document.title = 'Work Hub'
    if (mode === MODE_UP) setDisplayText('0:00:00')
    else setDisplayText(formatCountDown((cdMinutes * 60 + cdSeconds) * 1000))
  }

  function handleModeChange(newMode) {
    if (running) return
    setMode(newMode)
    saveMode(newMode)
    finishedFiredRef.current = false
    setFinished(false)
    snapshotRef.current = null
    if (newMode === MODE_UP) setDisplayText('0:00:00')
    else setDisplayText(formatCountDown((cdMinutes * 60 + cdSeconds) * 1000))
    document.title = 'Work Hub'
  }

  function handleCdChange(m, s) {
    setCdMinutes(m)
    setCdSeconds(s)
    saveCdSetting(m, s)
    if (!running && !finished) {
      // Reset any in-memory elapsed so a fresh Start uses the new total cleanly.
      snapshotRef.current = null
      setDisplayText(formatCountDown((m * 60 + s) * 1000))
    }
    // If running countdown, re-anchor snapshot so remaining recalculates
    if (running && mode === MODE_DOWN) {
      const elapsed = snapshotRef.current ? calcElapsedMs(snapshotRef.current) : 0
      const newSnap = {
        startedAt: Date.now(),
        elapsedMs: elapsed,
        mode: MODE_DOWN,
        cdTotalMs: (m * 60 + s) * 1000,
      }
      snapshotRef.current = newSnap
      saveSnapshot(newSnap)
    }
  }

  function handleSoundChange(on) {
    setSoundOn(on)
    saveSound(on)
  }

  return (
    <div className="timer-screen">
      <TimerModeToggle mode={mode} onChange={handleModeChange} disabled={running} />

      {mode === MODE_DOWN && (
        <TimerCountdownInput
          minutes={cdMinutes}
          seconds={cdSeconds}
          onChange={handleCdChange}
          disabled={running}
        />
      )}

      <TimerDisplay text={displayText} finished={finished} />

      <TimerControls
        running={running}
        finished={finished}
        onStart={handleStart}
        onStop={handleStop}
        onReset={handleReset}
      />

      <TimerSoundToggle on={soundOn} onChange={handleSoundChange} />
    </div>
  )
}
