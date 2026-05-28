import { doc, runTransaction } from 'firebase/firestore'
import { db } from './firebase'

// Delete a tracker + unpin from meta atomically (transaction guarantees consistency)
// Uses transaction (not batch) because we need to READ meta before deciding to unpin.
export async function deleteTrackerWithPin(accessCode, trackerId) {
  const trackerRef = doc(db, `users/${accessCode}/trackers`, trackerId)
  const metaRef = doc(db, `users/${accessCode}/meta`, 'singleton')

  await runTransaction(db, async (tx) => {
    const metaSnap = await tx.get(metaRef)
    const currentPinned = metaSnap.exists() ? (metaSnap.data().pinnedTrackerId ?? null) : null
    tx.delete(trackerRef)
    if (currentPinned === trackerId) {
      tx.update(metaRef, { pinnedTrackerId: null })
    }
  })
}
