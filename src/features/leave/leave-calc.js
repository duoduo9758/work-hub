import { getCurrentLeaveYear, isInLeaveYear } from '../../lib/date'

// ═══════════════════════════════════════════════════════════════════════════
// leave-calc — pure functions for leave-record math.
//   - Balance:        Σ(adjustment.hours) − Σ(use の合計時間)
//                     where use合計時間 = days*8 + hours
//   - Display format: "X日 Y時間"  (X = floor(|h|/8), Y = |h|%8, sign "-")
//   - 5-day rule:     count Σ(paid.use.days) within current leave year
//   - This-year used: Σ((days*8 + hours)) of (type=use, in current leave year)
//
// All inputs are plain leaveRecord objects:
//   { id, type:'use'|'adjustment', leaveType:'paid'|'sick',
//     days?, hours, date, note?, ... }
// No Firestore here — store/actions handle persistence.
// ═══════════════════════════════════════════════════════════════════════════

export const HOURS_PER_DAY = 8
export const PAID_FULL_DAYS_REQUIRED = 5
export const ADJUSTMENT_HOURS_MIN = -9999
export const ADJUSTMENT_HOURS_MAX = 9999
export const ADJUSTMENT_BIG_THRESHOLD_HOURS = 80 // |10日0時間|
export const USE_HOURS_PART_MAX = 7              // Y∈0..7
export const NOTE_MAX_LENGTH = 30

// ── Single record → total hours (signed) ────────────────────────────────
// use records contribute negatively to balance (consumed).
// adjustment records contribute their signed hours directly.
export function recordHours(record) {
  if (!record) return 0
  if (record.type === 'use') {
    const d = Number(record.days ?? 0)
    const h = Number(record.hours ?? 0)
    return -(d * HOURS_PER_DAY + h)
  }
  if (record.type === 'adjustment') {
    return Number(record.hours ?? 0)
  }
  return 0
}

// ── Balance across a list (filtered by leaveType outside) ───────────────
export function calcBalance(records, leaveType) {
  let total = 0
  for (const r of records) {
    if (r.leaveType !== leaveType) continue
    total += recordHours(r)
  }
  return total
}

// ── Format hours → "X日 Y時間" with optional sign ───────────────────────
//   160  → "20日 0時間"
//   9    → "1日 1時間"
//   0    → "0日 0時間"
//   -5   → "-0日 5時間"
//   -12  → "-1日 4時間"
export function formatHours(hours) {
  const sign = hours < 0 ? '-' : ''
  const abs = Math.abs(Math.trunc(hours))
  const d = Math.floor(abs / HOURS_PER_DAY)
  const h = abs % HOURS_PER_DAY
  return `${sign}${d}日 ${h}時間`
}

// Without sign — for display of a magnitude (e.g. shortage amount)
export function formatHoursAbs(hours) {
  return formatHours(Math.abs(hours)).replace(/^-/, '')
}

// ── This-year usage (use records within current leave year) ─────────────
//   Returns total signed hours USED (positive number).
export function calcUsedThisLeaveYear(records, leaveType, leaveYear = null) {
  const yr = leaveYear ?? getCurrentLeaveYear()
  let total = 0
  for (const r of records) {
    if (r.type !== 'use') continue
    if (r.leaveType !== leaveType) continue
    if (!isInLeaveYear(r.date, yr)) continue
    total += Number(r.days ?? 0) * HOURS_PER_DAY + Number(r.hours ?? 0)
  }
  return total
}

// ── Full-day count (paid only, within leave year) for the 5-day rule ────
// Sum of `days` field across paid use records — `hours` parts ignored.
// AC-LEAVE-Y05 / Y10 (adjustment excluded by type filter)
export function calcFullDaysPaid(records, leaveYear = null) {
  const yr = leaveYear ?? getCurrentLeaveYear()
  let total = 0
  for (const r of records) {
    if (r.type !== 'use') continue
    if (r.leaveType !== 'paid') continue
    if (!isInLeaveYear(r.date, yr)) continue
    total += Number(r.days ?? 0)
  }
  return total
}

// ── Check: does the current leave year have any adjustment records? ─────
// Used by AC-LEAVE-32 ("年度付与を入力してください" warning).
export function hasCurrentYearAdjustment(records, leaveType, leaveYear = null) {
  const yr = leaveYear ?? getCurrentLeaveYear()
  for (const r of records) {
    if (r.type !== 'adjustment') continue
    if (r.leaveType !== leaveType) continue
    if (!isInLeaveYear(r.date, yr)) continue
    return true
  }
  return false
}

// ── Filter records by leave year (for history tabs) ─────────────────────
// `mode`: 'current' (current year) | 'past' (anything before current year)
//          | 'all' (no filter)
export function filterRecordsByYear(records, mode, leaveYear = null) {
  if (mode === 'all') return records
  const yr = leaveYear ?? getCurrentLeaveYear()
  if (mode === 'current') {
    return records.filter(r => isInLeaveYear(r.date, yr))
  }
  if (mode === 'past') {
    return records.filter(r => r.date < `${yr}-09-01`)
  }
  return records
}

// ── Sort: date desc, then createdAt desc (matches DATA.md indexing) ─────
export function sortRecords(records) {
  return [...records].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    const ac = a.createdAt ?? 0
    const bc = b.createdAt ?? 0
    return bc - ac
  })
}

// ── Validators ──────────────────────────────────────────────────────────
// Use input — returns { ok: true } or { ok: false, error: string }
export function validateUseInput({ days, hours, date, note }) {
  if (date === undefined || date === null || date === '') {
    return { ok: false, error: '日付を選択してください' }
  }
  if (!Number.isInteger(days) || !Number.isInteger(hours)) {
    return { ok: false, error: '整数で入力してください' }
  }
  if (days < 0) {
    return { ok: false, error: '日数は0以上で入力してください' }
  }
  if (hours < 0 || hours > USE_HOURS_PART_MAX) {
    return { ok: false, error: `時間は0〜${USE_HOURS_PART_MAX}の整数で入力してください。8時間以上は日数欄を使ってください` }
  }
  if (days === 0 && hours === 0) {
    return { ok: false, error: '日数または時間を入力してください' }
  }
  if (note && note.length > NOTE_MAX_LENGTH) {
    return { ok: false, error: `メモは${NOTE_MAX_LENGTH}文字以内で入力してください` }
  }
  return { ok: true }
}

// Adjustment input — hours integer in [MIN, MAX], non-zero
export function validateAdjustmentInput({ hours, date, note }) {
  if (date === undefined || date === null || date === '') {
    return { ok: false, error: '日付を選択してください' }
  }
  if (!Number.isInteger(hours)) {
    return { ok: false, error: '整数で入力してください' }
  }
  if (hours === 0) {
    return { ok: false, error: '日数または時間を入力してください' }
  }
  if (hours < ADJUSTMENT_HOURS_MIN || hours > ADJUSTMENT_HOURS_MAX) {
    return { ok: false, error: `調整時間は${ADJUSTMENT_HOURS_MIN}〜${ADJUSTMENT_HOURS_MAX}の範囲で入力してください` }
  }
  if (note && note.length > NOTE_MAX_LENGTH) {
    return { ok: false, error: `メモは${NOTE_MAX_LENGTH}文字以内で入力してください` }
  }
  return { ok: true }
}

// ── Convert adjustment X日Y時間 input → signed hours ────────────────────
// UI lets user enter days + hours separately for symmetry with use.
// e.g. days=1, hours=4, sign='+' → +12 hours.
export function adjustmentInputToHours({ sign, days, hours }) {
  const magnitude = Number(days) * HOURS_PER_DAY + Number(hours)
  return sign === '-' ? -magnitude : magnitude
}

// ── "Big adjustment" predicate for confirm dialog ───────────────────────
// AC-LEAVE-31: |hours| >= 80 (= 10日0時間 相当) triggers extra confirm
export function isBigAdjustment(hours) {
  return Math.abs(hours) >= ADJUSTMENT_BIG_THRESHOLD_HOURS
}

// ── Net balance change for a hypothetical save (preview / validation) ───
// Given the current records and a proposed record (new or edited),
// return what the new balance would be for that leaveType.
//
// For edits, pass `replacingId` so the existing record contribution is
// removed before adding the proposed one.
//
// For deletes, pass `proposed = null` and `replacingId` of the record
// to be removed.
export function projectedBalance(records, leaveType, proposed, replacingId = null) {
  let total = 0
  for (const r of records) {
    if (r.leaveType !== leaveType) continue
    if (replacingId && r.id === replacingId) continue
    total += recordHours(r)
  }
  if (proposed && proposed.leaveType === leaveType) {
    total += recordHours(proposed)
  }
  return total
}
