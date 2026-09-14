/**
 * Backend selection. `VITE_DATA_BACKEND=firestore` switches the whole app over;
 * anything else (including an absent value) uses the local IndexedDB adapter.
 */

import type { Repo } from './types'
import { LocalRepo } from './local'

/**
 * The in-flight promise is cached, not the instance. Caching the instance would
 * let a second caller receive a repository whose `init()` had not finished yet —
 * which React's StrictMode reliably triggers by mounting effects twice.
 */
let pending: Promise<Repo> | null = null

export function backendKind(): 'local' | 'firestore' {
  return import.meta.env.VITE_DATA_BACKEND === 'firestore' ? 'firestore' : 'local'
}

export function getRepo(): Promise<Repo> {
  if (pending) return pending
  pending = (async () => {
    const repo: Repo =
      backendKind() === 'firestore' ? new (await import('./firestore')).FirestoreRepo() : new LocalRepo()
    await repo.init()
    return repo
  })().catch((e) => {
    // A failed open must not poison every later attempt.
    pending = null
    throw e
  })
  return pending
}

export type { Repo } from './types'
