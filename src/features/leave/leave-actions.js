import {
  collection, doc, query, where, getDocs,
  runTransaction, setDoc, serverTimestamp, increment, deleteField,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { safeGetItem } from '../../lib/storage'
import { calcBalance, projectedBalance } from './leave-calc'

// ═══════════════════════════════════════════════════════════════════════════
// leave-actions — Firestore mutations for leaveRecords.
//
// Strategy: Firebase JS SDK transactions only support tx.get(documentRef)
// — they cannot get a query inside the transaction. So we:
//   1. Read all same-leaveType records OUTSIDE the transaction (getDocs).
//   2. Recompute the projected balance with the proposed change.
//   3. Reject locally on SHORTAGE.
//   4. Use a small transaction (or plain write) for the actual mutation,
//      including a version check on the target doc to catch CONFLICT.
//
// Trade-off: the race window between the getDocs read and the write is
// ~tens of ms. For a single-user app this is acceptable. Multi-device
// concurrent saves of the same leaveType could in theory let two writes
// both pass the local balance check; the deterministic-ish risk is the
// same as the existing Todo single-write conflict story.
//
// Errors are normalized to:
//   err.code === 'SHORTAGE',   err.shortageHours (positive number)
//   err.code === 'CONFLICT'
// Schema: see DATA.md §2-2 / §8b-4b.
// ═══════════════════════════════════════════════════════════════════════════

function getClientId() {
  return safeGetItem('workHub_clientId') ?? 'unknown'
}

function recordsCol(accessCode) {
  return collection(db, `users/${accessCode}/leaveRecords`)
}

function recordRef(accessCode, recordId) {
  return doc(db, `users/${accessCode}/leaveRecords`, recordId)
}

function makeShortageError(shortageHours) {
  const err = new Error(`SHORTAGE:${shortageHours}`)
  err.code = 'SHORTAGE'
  err.shortageHours = shortageHours
  return err
}

function makeConflictError() {
  const err = new Error('CONFLICT')
  err.code = 'CONFLICT'
  return err
}

// ── Load all records of a single leaveType (helper) ─────────────────────
async function loadByLeaveType(accessCode, leaveType) {
  const q = query(recordsCol(accessCode), where('leaveType', '==', leaveType))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data())
}

// ── Add a new leave record (use or adjustment) ──────────────────────────
// `record` shape: { type, leaveType, days?, hours, date, note }
// Returns the saved record (with id, version=1, local timestamps).
export async function addLeaveRecord(accessCode, record) {
  const clientId = getClientId()

  // 1. Read existing same-leaveType records and check projected balance
  const existing = await loadByLeaveType(accessCode, record.leaveType)
  const proposed = { ...record, id: '__new__' }
  const newBalance = projectedBalance(existing, record.leaveType, proposed)
  if (newBalance < 0) throw makeShortageError(Math.abs(newBalance))

  // 2. Write new doc (no version conflict possible — fresh id)
  const newRef = doc(recordsCol(accessCode))
  const id = newRef.id
  const data = {
    id,
    type: record.type,
    leaveType: record.leaveType,
    ...(record.type === 'use' ? { days: Number(record.days ?? 0) } : {}),
    hours: Number(record.hours ?? 0),
    date: record.date,
    note: record.note ?? '',
    version: 1,
    updatedByClientId: clientId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  await setDoc(newRef, data)
  return { ...data, createdAt: new Date(), updatedAt: new Date() }
}

// ── Edit an existing record ─────────────────────────────────────────────
export async function editLeaveRecord(accessCode, recordId, baseVersion, newData) {
  const clientId = getClientId()

  // 1. Recompute balance for the NEW leaveType, excluding the target
  const newTypeRecords = await loadByLeaveType(accessCode, newData.leaveType)
  const others = newTypeRecords.filter(r => r.id !== recordId)
  const proposed = { ...newData, id: recordId }
  const newBalance = calcBalance([...others, proposed], newData.leaveType)
  if (newBalance < 0) throw makeShortageError(Math.abs(newBalance))

  // 2. If leaveType changed, also verify OLD type's balance stays valid
  //    (removing an adjustment could push it negative).
  return await runTransaction(db, async (tx) => {
    const ref = recordRef(accessCode, recordId)
    const targetSnap = await tx.get(ref)
    if (!targetSnap.exists()) throw makeConflictError()
    const current = targetSnap.data()

    if (current.version !== baseVersion && current.updatedByClientId !== clientId) {
      throw makeConflictError()
    }

    if (current.leaveType !== newData.leaveType) {
      const oldTypeRecords = await loadByLeaveType(accessCode, current.leaveType)
      const oldOthers = oldTypeRecords.filter(r => r.id !== recordId)
      const oldBalance = calcBalance(oldOthers, current.leaveType)
      if (oldBalance < 0) throw makeShortageError(Math.abs(oldBalance))
    }

    const update = {
      type: newData.type,
      leaveType: newData.leaveType,
      hours: Number(newData.hours ?? 0),
      date: newData.date,
      note: newData.note ?? '',
      version: increment(1),
      updatedByClientId: clientId,
      updatedAt: serverTimestamp(),
    }
    if (newData.type === 'use') {
      update.days = Number(newData.days ?? 0)
    } else if (current.type === 'use') {
      // Switched from use to adjustment — remove the days field entirely
      // (Rules' hasOnly for adjustment forbids 'days' even if value is null)
      update.days = deleteField()
    }
    tx.update(ref, update)

    const returned = { ...current, ...update, version: (current.version ?? 1) + 1 }
    // Strip the deleteField sentinel from local state when switching use→adjustment.
    if (newData.type === 'adjustment' && current.type === 'use') {
      delete returned.days
    }
    return returned
  })
}

// ── Delete a record (use or adjustment) ─────────────────────────────────
// Pre-check the projected balance OUTSIDE the transaction, then do a
// version-checked delete inside one. The window between check and delete
// is small; for single-user usage no race.
export async function deleteLeaveRecord(accessCode, recordId, baseVersion) {
  const clientId = getClientId()

  // 1. Fetch target (to know its leaveType for the balance check)
  const ref = recordRef(accessCode, recordId)
  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) return // already gone
    const target = snap.data()

    if (target.version !== baseVersion && target.updatedByClientId !== clientId) {
      throw makeConflictError()
    }

    // 2. Recompute balance without target (read outside is fine here —
    //    we're already serialized on the target's version check)
    const sameType = await loadByLeaveType(accessCode, target.leaveType)
    const others = sameType.filter(r => r.id !== recordId)
    const newBalance = calcBalance(others, target.leaveType)
    if (newBalance < 0) throw makeShortageError(Math.abs(newBalance))

    tx.delete(ref)
  })
}
