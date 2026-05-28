// ★ JST date utilities - NO external libraries (no dayjs, date-fns-tz)
// ★ NEVER use: new Date("YYYY-MM-DD"), toLocaleDateString, getMonth() etc.

// Returns today as "YYYY-MM-DD" in Asia/Tokyo timezone
export function getTodayJST() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]))
  return `${map.year}-${map.month}-${map.day}`
}

// Parse "YYYY-MM-DD" as UTC midnight (avoids timezone interpretation)
function parseYmdAsUTC(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

// Calendar day difference between two "YYYY-MM-DD" strings
export function daysDiffJST(startDate, endDate) {
  return Math.round((parseYmdAsUTC(endDate) - parseYmdAsUTC(startDate)) / 86400000)
}

// ── Leave year (9/1 - 8/31, company-specific rule) ──────────────────────────

export function getCurrentLeaveYear() {
  const today = getTodayJST()
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  return month >= 9 ? year : year - 1
}

export function getLeaveYearStart(leaveYear) {
  return `${leaveYear}-09-01`
}

export function getLeaveYearEnd(leaveYear) {
  return `${leaveYear + 1}-08-31`
}

export function isInLeaveYear(date, leaveYear) {
  return date >= getLeaveYearStart(leaveYear) && date <= getLeaveYearEnd(leaveYear)
}
