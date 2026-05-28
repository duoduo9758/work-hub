import { collection, getDocs, doc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { uuid } from '../../lib/uuid'

// ═══════════════════════════════════════════════════════════════════════════
// Firestore CRUD for trackers
// Path: users/{accessCode}/trackers/{trackerId}
// ═══════════════════════════════════════════════════════════════════════════

// Load all trackers for a user (unsorted — caller sorts by endDate)
export async function loadTrackers(accessCode) {
  const colRef = collection(db, `users/${accessCode}/trackers`)
  const snap = await getDocs(colRef)
  return snap.docs.map(d => d.data())
}

// Create or update a tracker (full overwrite, no merge — DATA.md rule)
export async function saveTracker(accessCode, trackerData) {
  const isNew = !trackerData.id
  const id = isNew ? uuid() : trackerData.id
  const now = Timestamp.now()

  const data = {
    id,
    title: trackerData.title.trim(),
    startDate: trackerData.startDate,
    endDate: trackerData.endDate,
    createdAt: isNew ? now : (trackerData.createdAt ?? now),
    updatedAt: now,
  }

  const ref = doc(db, `users/${accessCode}/trackers`, id)
  await setDoc(ref, data) // ★ full overwrite (no merge) per DATA.md principle
  return data
}
