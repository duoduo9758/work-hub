// ★ All date arithmetic uses JST calendar days (Asia/Tokyo)
import { getTodayJST, daysDiffJST } from '../../lib/date'

// ═══════════════════════════════════════════════════════════════════════════
// calcTracker: compute display values for a single tracker
//
// Rules (from SPEC 5-4):
//   totalDays  = endDate - startDate
//   elapsed    = today - startDate, clamped [0, totalDays]
//   remaining  = endDate - today,   clamped to 0 minimum
//   progress   = round(elapsed / totalDays * 100)
//   isEnded    = today > endDate  (the day AFTER endDate = "終了")
// ═══════════════════════════════════════════════════════════════════════════
export function calcTracker(tracker) {
  const today = getTodayJST()
  const totalDays = daysDiffJST(tracker.startDate, tracker.endDate)

  if (totalDays <= 0) {
    // Corrupted tracker — safe fallback
    return { totalDays: 0, elapsed: 0, remaining: 0, progress: 0, isEnded: false }
  }

  const rawElapsed = daysDiffJST(tracker.startDate, today)
  const elapsed = Math.max(0, Math.min(rawElapsed, totalDays))

  const rawRemaining = daysDiffJST(today, tracker.endDate)
  const remaining = Math.max(0, rawRemaining)

  // isEnded: today is strictly after endDate (endDate itself is 100%, not "終了")
  const isEnded = today > tracker.endDate

  const progress = Math.round((elapsed / totalDays) * 100)

  return { totalDays, elapsed, remaining, progress, isEnded }
}
