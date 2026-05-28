import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

// ★ Increment when schema changes require data migration
const CURRENT_SCHEMA_VERSION = 1

// Called on every login. Creates meta if new user, runs migrations if needed.
// Returns { isNew: bool, pinnedTrackerId: string|null }
export async function ensureSchema(accessCode) {
  const metaRef = doc(db, `users/${accessCode}/meta`, 'singleton')
  const metaSnap = await getDoc(metaRef)

  if (!metaSnap.exists()) {
    // New user - create meta only, do NOT touch other subcollections (AC-DATA-03)
    await setDoc(metaRef, {
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      pinnedTrackerId: null,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    })
    return { isNew: true, pinnedTrackerId: null }
  }

  const data = metaSnap.data()
  const version = data.schemaVersion ?? 1

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error('このアプリより新しいデータがあります。最新版にアップデートしてください')
  }

  // Update last login time
  await setDoc(metaRef, { lastLoginAt: serverTimestamp() }, { merge: true })

  if (version < CURRENT_SCHEMA_VERSION) {
    await runMigrations(version, CURRENT_SCHEMA_VERSION, accessCode)
    await setDoc(metaRef, { schemaVersion: CURRENT_SCHEMA_VERSION }, { merge: true })
  }

  return { isNew: false, pinnedTrackerId: data.pinnedTrackerId ?? null }
}

// Runs migrations in sequence from `from` to `to`
// v1: no migrations needed yet
async function runMigrations(from, to, accessCode) {
  // Example: if (from < 2) await migrate_1_to_2(accessCode)
}
