import {
  collection, doc, getDocs, getDoc, setDoc, deleteDoc,
  runTransaction, query, orderBy, Timestamp,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { uuid } from '../../lib/uuid'
import { safeGetItem } from '../../lib/storage'

// ═══════════════════════════════════════════════════════════════════════════
// todo-store — Firestore CRUD for todoProjects
// Schema reference: DATA.md §2-2 users/{accessCode}/todoProjects/{projectId}
// ═══════════════════════════════════════════════════════════════════════════

// Limits (DATA.md §2-2 / SPEC §6)
export const PROJECT_MAX = 100
export const LINE_MAX_PER_PROJECT = 1000
export const LINE_MAX_CHARS = 500
export const PROJECT_MAX_BYTES = 900 * 1024 // 900KB

function getClientId() {
  return safeGetItem('workHub_clientId') ?? 'unknown'
}

function projectsCol(accessCode) {
  return collection(db, `users/${accessCode}/todoProjects`)
}

function projectRef(accessCode, projectId) {
  return doc(db, `users/${accessCode}/todoProjects`, projectId)
}

// ── Load list (sidebar) ─────────────────────────────────────────────────
// Returns projects sorted by createdAt desc (DATA.md §5-2)
export async function loadProjects(accessCode) {
  const q = query(projectsCol(accessCode), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data())
}

// ── Load single project (full lines) ────────────────────────────────────
export async function loadProject(accessCode, projectId) {
  const snap = await getDoc(projectRef(accessCode, projectId))
  if (!snap.exists()) return null
  return snap.data()
}

// ── Create new project (no lines yet) ───────────────────────────────────
export async function createProject(accessCode, name) {
  const id = uuid()
  const now = Timestamp.now()
  const data = {
    id,
    name: name.trim(),
    lines: [],
    version: 1,
    updatedByClientId: getClientId(),
    createdAt: now,
    updatedAt: now,
  }
  await setDoc(projectRef(accessCode, id), data) // full overwrite, no merge
  return data
}

// ── Update project name only (NOT lines) ────────────────────────────────
// Uses transaction for version check
export async function updateProjectName(accessCode, projectId, newName, baseVersion) {
  const ref = projectRef(accessCode, projectId)
  const clientId = getClientId()
  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) {
      const err = new Error('Project not found')
      err.code = 'NOT_FOUND'
      throw err
    }
    const current = snap.data()
    if (current.version !== baseVersion && current.updatedByClientId !== clientId) {
      const err = new Error('Version conflict')
      err.code = 'CONFLICT'
      throw err
    }
    const next = {
      ...current,
      name: newName.trim(),
      version: current.version + 1,
      updatedByClientId: clientId,
      updatedAt: Timestamp.now(),
    }
    tx.set(ref, next) // full overwrite
    return next
  })
}

// ── Save project lines (the hot path for editor) ────────────────────────
// AC-TODO-C01..C09: conflict detection via version+clientId
export async function saveProjectLines(accessCode, projectId, lines, baseVersion) {
  // Size check (AC-TODO-L28)
  const sizeBytes = estimateProjectBytes(lines)
  if (sizeBytes > PROJECT_MAX_BYTES) {
    const err = new Error('Project too large')
    err.code = 'TOO_LARGE'
    err.sizeBytes = sizeBytes
    throw err
  }

  const ref = projectRef(accessCode, projectId)
  const clientId = getClientId()
  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) {
      const err = new Error('Project not found')
      err.code = 'NOT_FOUND'
      throw err
    }
    const current = snap.data()
    if (current.version !== baseVersion && current.updatedByClientId !== clientId) {
      const err = new Error('Version conflict')
      err.code = 'CONFLICT'
      err.serverData = current
      throw err
    }
    const next = {
      ...current,
      lines,
      version: current.version + 1,
      updatedByClientId: clientId,
      updatedAt: Timestamp.now(),
    }
    tx.set(ref, next) // full overwrite, no merge
    return next
  })
}

// ── Delete project ──────────────────────────────────────────────────────
// AC-TODO-P11: refuse if server version differs and not from self
export async function deleteProject(accessCode, projectId, baseVersion) {
  const ref = projectRef(accessCode, projectId)
  const clientId = getClientId()
  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) return // already gone, treat as success
    const current = snap.data()
    if (current.version !== baseVersion && current.updatedByClientId !== clientId) {
      const err = new Error('Version conflict on delete')
      err.code = 'CONFLICT'
      throw err
    }
    tx.delete(ref)
  })
}

// ── Helpers ─────────────────────────────────────────────────────────────
// Rough byte estimate (UTF-8 worst case 3 bytes per char for CJK)
export function estimateProjectBytes(lines) {
  let bytes = 0
  for (const line of lines) {
    // text + id + flags + indent + JSON overhead ≈ 100 bytes + text*3
    bytes += 100
    if (line.text) bytes += line.text.length * 3
  }
  return bytes
}

// Plain deleteDoc without version check (used for retry-after-conflict cleanup)
export async function deleteProjectForce(accessCode, projectId) {
  await deleteDoc(projectRef(accessCode, projectId))
}
