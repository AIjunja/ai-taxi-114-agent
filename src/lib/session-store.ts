// 이 브라우저 탭의 체험 세션. 메모리에만 있고 새로고침하면 사라진다.
// 다른 방문자와 공유하지 않는다.
import { useSyncExternalStore } from 'react'
import type { DialogState } from '../features/dialog/machine'
import type { DispatchOutcome } from './dispatch-client'

export interface LogEntry {
  at: number
  kind: 'stt' | 'input' | 'agent' | 'state' | 'approval' | 'api' | 'error' | 'guard'
  text: string
}

export interface TrySession {
  sessionId: string | null
  state: DialogState | null
  log: LogEntry[]
  lastDispatch: DispatchOutcome | null
  pending: boolean
}

let snapshot: TrySession = { sessionId: null, state: null, log: [], lastDispatch: null, pending: false }
const listeners = new Set<() => void>()

export const sessionStore = {
  get: () => snapshot,
  set(patch: Partial<TrySession>) {
    snapshot = { ...snapshot, ...patch }
    listeners.forEach((l) => l())
  },
  log(kind: LogEntry['kind'], text: string) {
    snapshot = { ...snapshot, log: [...snapshot.log, { at: Date.now(), kind, text }].slice(-200) }
    listeners.forEach((l) => l())
  },
  reset(sessionId: string) {
    snapshot = { sessionId, state: null, log: [], lastDispatch: null, pending: false }
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

export function useTrySession(): TrySession {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get)
}
