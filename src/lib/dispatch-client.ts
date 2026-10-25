// 브라우저에서 Mock 배차 API를 부르는 함수들.
// 서버가 응답하지 않으면 브라우저 안의 같은 Mock으로 계속하고, 출처를 함께 돌려준다.
import { createDispatchService } from '../../server/dispatch-core'

export type DispatchSource = 'server' | 'local_fallback'

export interface DispatchStatus {
  requestId: string
  status: 'searching' | 'assigned' | 'no_taxi' | 'cancelled'
  originId?: string
  destinationId?: string
  nearbyTaxis?: number
  progress?: number
  etaMinutes?: number
  plate?: string
  color?: string
  model?: string
  driverName?: string
  driverRating?: string
  acceptedAt?: number
  assignedAt?: number
  duplicate?: boolean
}

export interface Sourced<T> {
  data: T
  source: DispatchSource
  latencyMs: number
  fallbackReason?: string
}

const local = createDispatchService({ rateLimit: { max: 50, windowMs: 60_000 } })

export function randomId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return `${prefix}-${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

export class ApprovalError extends Error {}

async function call(method: 'GET' | 'POST', query: string, body?: unknown, timeoutMs = 8000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`/api/dispatch${query}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    })
    const json = await res.json().catch(() => ({}))
    return { res, json }
  } finally {
    clearTimeout(timer)
  }
}

function isLocalId(requestId: string) {
  return requestId.startsWith('L~')
}

async function withFallback<T>(remote: () => Promise<T | { fallback: string }>, fallback: () => T): Promise<Sourced<T>> {
  const started = performance.now()
  let fallbackReason = ''
  try {
    const r = await remote()
    if (!(r && typeof r === 'object' && 'fallback' in r)) return { data: r as T, source: 'server', latencyMs: Math.round(performance.now() - started) }
    fallbackReason = (r as { fallback: string }).fallback
  } catch (e) {
    if (e instanceof ApprovalError) throw e
    fallbackReason = (e as Error).name === 'AbortError' ? '서버 응답 시간 초과' : '서버 연결 실패'
  }
  return { data: fallback(), source: 'local_fallback', latencyMs: Math.round(performance.now() - started), fallbackReason }
}

export function createCall(p: { sessionId: string; idempotencyKey: string; originId: string; destinationId: string; approved: boolean }) {
  return withFallback<DispatchStatus>(
    async () => {
      const { res, json } = await call('POST', '', p)
      if (res.status === 403) throw new ApprovalError(json.message ?? '승인이 필요해요.')
      if (res.ok && json.requestId) return json as DispatchStatus
      return { fallback: `서버 응답 ${res.status}${json.error ? ` (${json.error})` : ''}` }
    },
    () => {
      const r = local.create(p, 'local')
      if (r.status !== 200) throw new Error(String(r.body.message))
      return { ...(r.body as unknown as DispatchStatus), requestId: `L~${r.body.requestId}` }
    },
  )
}

export function getStatus(requestId: string) {
  if (isLocalId(requestId)) {
    const r = local.status(requestId.slice(2))
    return Promise.resolve<Sourced<DispatchStatus>>({ data: { ...(r.body as unknown as DispatchStatus), requestId }, source: 'local_fallback', latencyMs: 0 })
  }
  return withFallback<DispatchStatus>(
    async () => {
      const { res, json } = await call('GET', `?requestId=${encodeURIComponent(requestId)}`)
      if (res.ok) return json as DispatchStatus
      throw new Error(json.message ?? `상태 조회 실패 ${res.status}`)
    },
    () => {
      throw new Error('상태 조회 실패')
    },
  )
}

export async function cancelCall(requestId: string): Promise<Sourced<DispatchStatus>> {
  if (isLocalId(requestId)) {
    const r = local.cancel({ requestId: requestId.slice(2) })
    return { data: { ...(r.body as unknown as DispatchStatus), requestId }, source: 'local_fallback', latencyMs: 0 }
  }
  const started = performance.now()
  const { res, json } = await call('POST', '?action=cancel', { requestId })
  if (!res.ok) throw new Error(json.message ?? `취소 실패 ${res.status}`)
  return { data: json as DispatchStatus, source: 'server', latencyMs: Math.round(performance.now() - started) }
}

/** assigned / no_taxi 가 나올 때까지 상태를 조회한다. */
export async function waitForAssignment(requestId: string, onTick?: (s: DispatchStatus) => void, timeoutMs = 25_000): Promise<DispatchStatus> {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    const { data } = await getStatus(requestId)
    onTick?.(data)
    if (data.status !== 'searching') return data
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('배차 결과를 기다리다 시간이 지났어요')
}
