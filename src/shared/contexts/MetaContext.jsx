import { createContext, useContext, useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'

const MetaContext = createContext(null)

export function MetaProvider({ accessCode, initialPinnedId, children }) {
  const [pinnedTrackerId, setPinnedTrackerId] = useState(initialPinnedId ?? null)

  async function pinTracker(trackerId) {
    const metaRef = doc(db, `users/${accessCode}/meta`, 'singleton')
    await setDoc(metaRef, { pinnedTrackerId: trackerId }, { merge: true })
    setPinnedTrackerId(trackerId)
  }

  async function unpinTracker() {
    const metaRef = doc(db, `users/${accessCode}/meta`, 'singleton')
    await setDoc(metaRef, { pinnedTrackerId: null }, { merge: true })
    setPinnedTrackerId(null)
  }

  return (
    <MetaContext.Provider value={{ pinnedTrackerId, pinTracker, unpinTracker, setPinnedTrackerId }}>
      {children}
    </MetaContext.Provider>
  )
}

export function useMeta() {
  const ctx = useContext(MetaContext)
  if (!ctx) throw new Error('useMeta must be used within MetaProvider')
  return ctx
}
