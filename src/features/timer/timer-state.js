// Timer state — pure logic + localStorage persistence.
// Uses Date.now() diff so background tab throttling doesn't cause drift.
//
// ─────────────────────────────────────────────────────────────────────────
// State machine (DO NOT change semantics during v5 UI polish)
// ─────────────────────────────────────────────────────────────────────────
//   idle      : no snapshot. Display shows 0:00:00 (up) or formatted cd total (down)
//   running   : snapshot persisted. startedAt + accumulated elapsedMs progresses
//   paused    : Stop pressed mid-run. snapshotRef retains elapsedMs in memory,
//               but persisted snapshot is cleared (Stop is in-memory pause only;
//               page reload after Stop = idle, not resume)
//   finished  : countdown reached 0. Snapshot cleared, finishedFiredRef set,
//               display shows red + "時間です" + tab title changed
//   reset     : transitions back to idle. elapsedMs=0, all refs cleared,
//               tab title restored
//
// Page restore after tab-close-during-run:
//   Loaded snapshot is treated as paused (NOT auto-resumed).
//   User must press Start again to continue.
//
// Stored keys:
//   workHub_timer_mode      'up' | 'down'
//   workHub_timer_sound     'on' | 'off'
//   workHub_timer_cdMinutes number (countdown set minutes, 0-99)
//   workHub_timer_cdSeconds number (countdown set seconds, 0-59)
//   workHub_timer_snapshot  JSON { startedAt, elapsedMs, mode, cdTotalMs } | null

import { safeGetItem, safeSetItem, safeRemoveItem } from '../../lib/storage'

export const MODE_UP   = 'up'
export const MODE_DOWN = 'down'
export const CD_MINUTES_MIN = 0
export const CD_MINUTES_MAX = 99
export const CD_SECONDS_MIN = 0
export const CD_SECONDS_MAX = 59
export const CD_DEFAULT_MINUTES = 5
export const CD_DEFAULT_SECONDS = 0

// ── Snapshot (running state persisted to localStorage) ──────────────────
// snapshot = { startedAt: ms, elapsedMs: ms, mode: 'up'|'down', cdTotalMs: ms }
// elapsedMs = how many ms had elapsed BEFORE this run segment started.
// null = timer is not running.

export function saveSnapshot(snapshot) {
  safeSetItem('workHub_timer_snapshot', JSON.stringify(snapshot))
}

export function loadSnapshot() {
  const raw = safeGetItem('workHub_timer_snapshot')
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export function clearSnapshot() {
  safeRemoveItem('workHub_timer_snapshot')
}

// ── Settings persistence ─────────────────────────────────────────────────
export function loadMode() {
  return safeGetItem('workHub_timer_mode') ?? MODE_UP
}
export function saveMode(mode) {
  safeSetItem('workHub_timer_mode', mode)
}

export function loadSound() {
  const v = safeGetItem('workHub_timer_sound')
  return v === null ? true : v === 'on'
}
export function saveSound(on) {
  safeSetItem('workHub_timer_sound', on ? 'on' : 'off')
}

export function loadCdSetting() {
  const m = parseInt(safeGetItem('workHub_timer_cdMinutes'), 10)
  const s = parseInt(safeGetItem('workHub_timer_cdSeconds'), 10)
  return {
    minutes: isNaN(m) ? CD_DEFAULT_MINUTES : Math.max(CD_MINUTES_MIN, Math.min(CD_MINUTES_MAX, m)),
    seconds: isNaN(s) ? CD_DEFAULT_SECONDS : Math.max(CD_SECONDS_MIN, Math.min(CD_SECONDS_MAX, s)),
  }
}
export function saveCdSetting(minutes, seconds) {
  safeSetItem('workHub_timer_cdMinutes', String(minutes))
  safeSetItem('workHub_timer_cdSeconds', String(seconds))
}

// ── Elapsed calculation (call every 200ms from setInterval) ─────────────
// Returns elapsed ms from the current running snapshot.
export function calcElapsedMs(snapshot) {
  if (!snapshot) return 0
  const sinceStart = Date.now() - snapshot.startedAt
  return Math.max(0, snapshot.elapsedMs + sinceStart)
}

// ── Format ms → display string ───────────────────────────────────────────
// Up mode:   "0:00:00"  (h:mm:ss)
// Down mode: "mm:ss"    (no hours)
export function formatCountUp(ms) {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatCountDown(remainingMs) {
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── Remaining ms for countdown ───────────────────────────────────────────
export function calcRemainingMs(cdTotalMs, elapsedMs) {
  return Math.max(0, cdTotalMs - elapsedMs)
}
