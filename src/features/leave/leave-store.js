import {
  collection, getDocs, query, orderBy,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'

// ═══════════════════════════════════════════════════════════════════════════
// leave-store — Firestore read-side for leaveRecords
// Schema: DATA.md §2-2 users/{accessCode}/leaveRecords/{recordId}
// Write-side (add/edit/delete with transaction + balance check) lives in
// leave-actions.js.
// ═══════════════════════════════════════════════════════════════════════════

function recordsCol(accessCode) {
  return collection(db, `users/${accessCode}/leaveRecords`)
}

// ── Load all leave records, sorted date desc then createdAt desc ────────
// Single query, returns plain objects ready for leave-calc functions.
export async function loadLeaveRecords(accessCode) {
  const q = query(
    recordsCol(accessCode),
    orderBy('date', 'desc'),
    orderBy('createdAt', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data())
}
