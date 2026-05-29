import {
  collection, doc, query, where, runTransaction, serverTimestamp, increment,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { uuid } from '../../lib/uuid'
import { safeGetItem } from '../../lib/storage'
import { calcBalance, projectedBalance } from './leave-calc'

// ═══════════════════════════════════════════════════════════════════════════
// leave-actions — Firestore mutations for leaveRecords.
// Each mutation runs inside runTransaction, reads all records for the same
// leaveType, recomputes the resulting balance, and rejects with
// SHORTAGE (negative balance) or CONFLICT (version mismatch from another
// client). Errors are normalized to:
//   err.code === 'SHORTAGE',   err.shortageHours (positive number)
//   err.code === 'CONFLICT'
// so the UI can render the right dialog.
//
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

// ── Add a new leave record (use or adjustment) ──────────────────────────
// `record` shape: { type, leaveType, days?, hours, date, note }
// Returns the saved record (with id, version=1, timestamps).
export async function addLeaveRecord(accessCode, record) {
  const clientId = getClientId()
  return await runTransaction(db, async (tx) => {
    // 1. Read all records of the same leaveType
    const q = query(recordsCol(accessCode), where('leaveType', '==', record.leaveType))
    const snap = await tx.get(q)
    const existing = snap.docs.map(d => d.data())

    // 2. Recompute balance with the new record included
    const proposed = { ...record, id: '__new__' }
    const newBalance = projectedBalance(existing, record.leaveType, proposed)
    if (newBalance < 0) throw makeShortageError(Math.abs(newBalance))

    // 3. Save
    const newRef = doc(recordsCol(accessCode))
    const id = newRef.id
    const data = {
      id,
      type: record.type,
      leaveType: record.leaveType,
      ...(record.type === 'use' ? { days: Number(record.days ?? 0) } : {}),
      hours: Number(record.hours ?? 0),
      date: record.date,
      note: record.note ?? null,
      version: 1,
      updatedByClientId: clientId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    tx.set(newRef, data)
    // Return a best-effort local copy (server timestamps are not resolved yet)
    return { ...data, createdAt: new Date(), updatedAt: new Date() }
  })
}

// ── Edit an existing record ─────────────────────────────────────────────
// `newData` shape: { type, leaveType, days?, hours, date, note }
// `baseVersion` is the version we expect on the server.
export async function editLeaveRecord(accessCode, recordId, baseVersion, newData) {
  const clientId = getClientId()
  return await runTransaction(db, async (tx) => {
    // 1. Read target record for version check
    const ref = recordRef(accessCode, recordId)
    const targetSnap = await tx.get(ref)
    if (!targetSnap.exists()) throw makeConflictError()
    const current = targetSnap.data()

    if (current.version !== baseVersion && current.updatedByClientId !== clientId) {
      throw makeConflictError()
    }

    // 2. Read all records of the (possibly new) leaveType for balance
    const q = query(recordsCol(accessCode), where('leaveType', '==', newData.leaveType))
    const snap = await tx.get(q)
    const others = snap.docs.map(d => d.data()).filter(r => r.id !== recordId)

    // 3. Recompute balance with edited record substituted
    const proposed = { ...newData, id: recordId }
    const newBalance = calcBalance([...others, proposed], newData.leaveType)
    if (newBalance < 0) throw makeShortageError(Math.abs(newBalance))

    // 4. If leaveType changed, we also need the OTHER type's balance to
    //    stay non-negative (the edited record left it). Removing the
    //    old record from its old type can never push that side negative
    //    (adjustments removed → could go negative; use removed → only adds).
    if (current.leaveType !== newData.leaveType) {
      const qOld = query(recordsCol(accessCode), where('leaveType', '==', current.leaveType))
      const oldSnap = await tx.get(qOld)
      const oldOthers = oldSnap.docs.map(d => d.data()).filter(r => r.id !== recordId)
      const oldBalance = calcBalance(oldOthers, current.leaveType)
      if (oldBalance < 0) throw makeShortageError(Math.abs(oldBalance))
    }

    // 5. Apply update — full overwrite of the editable fields
    const update = {
      type: newData.type,
      leaveType: newData.leaveType,
      hours: Number(newData.hours ?? 0),
      date: newData.date,
      note: newData.note ?? null,
      version: increment(1),
      updatedByClientId: clientId,
      updatedAt: serverTimestamp(),
    }
    if (newData.type === 'use') {
      update.days = Number(newData.days ?? 0)
    }
    tx.update(ref, update)

    return { ...current, ...update, version: (current.version ?? 1) + 1 }
  })
}

// ── Delete a record (use or adjustment) ─────────────────────────────────
// Checks that removing this record won't push the balance negative
// (matters for adjustment deletes; use deletes only restore balance).
export async function deleteLeaveRecord(accessCode, recordId, baseVersion) {
  const clientId = getClientId()
  return await runTransaction(db, async (tx) => {
    const ref = recordRef(accessCode, recordId)
    const snap = await tx.get(ref)
    if (!snap.exists()) return // already gone — treat as success
    const target = snap.data()

    if (target.version !== baseVersion && target.updatedByClientId !== clientId) {
      throw makeConflictError()
    }

    // Recompute balance without the target record
    const q = query(recordsCol(accessCode), where('leaveType', '==', target.leaveType))
    const allSnap = await tx.get(q)
    const others = allSnap.docs.map(d => d.data()).filter(r => r.id !== recordId)
    const newBalance = calcBalance(others, target.leaveType)
    if (newBalance < 0) throw makeShortageError(Math.abs(newBalance))

    tx.delete(ref)
  })
}
