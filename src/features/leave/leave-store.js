import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'

// ═══════════════════════════════════════════════════════════════════════════
// leave-store — Firestore read-side for leaveRecords
// Schema: DATA.md §2-2 users/{accessCode}/leaveRecords/{recordId}
// Write-side (add/edit/delete with transaction + balance check) lives in
// leave-actions.js.
//
// Note: we do NOT use Firestore orderBy here. Sorting by (date desc,
// createdAt desc) needs a composite index that isn't deployed; doing it
// client-side via sortRecords() in leave-calc keeps the data tier simple
// and the expected record count is small (<500/user).
// ═══════════════════════════════════════════════════════════════════════════

function recordsCol(accessCode) {
  return collection(db, `users/${accessCode}/leaveRecords`)
}

// ── Load all leave records (caller sorts via leave-calc.sortRecords) ────
export async function loadLeaveRecords(accessCode) {
  const snap = await getDocs(recordsCol(accessCode))
  return snap.docs.map(d => d.data())
}
