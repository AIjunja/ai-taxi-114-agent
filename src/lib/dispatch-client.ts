import { createDispatchService } from '../../server/dispatch-core'
import type { DispatchResult } from '../features/dialog/machine'

export type DispatchSource = 'server' | 'local_fallback'

export interface DispatchOutcome {
  result: DispatchResult
  source: DispatchSource
  httpStatus: number | null
  latencyMs: number
  duplicate: boolean
  fallbackReason?: string
}

// 서버가 응답하지 않을 때만 쓰는 브라우저 내 Mock. 화면에 반드시 출처를 표시한다.
const localService = createDispatchService({ rateLimit: { max: 50, windowMs: 60_000 } })

export function randomId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return `${prefix}-${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

export class ApprovalError extends Error {}

export async function requestDispatch(params: {
  sessionId: string
  idempotencyKey: string
  originId: string
  destinationId: string
  approved: boolean
  timeoutMs?: number
}): Promise<DispatchOutcome> {
  const started = performance.now()
  const payload = {
    sessionId: params.sessionId,
    idempotencyKey: params.idempotencyKey,
    originId: params.originId,
    destinationId: params.destinationId,
    approved: params.approved,
  }
  let fallbackReason = ''
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), params.timeoutMs ?? 8000)
    const res = await fetch('/api/dispatch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    const body = await res.json().catch(() => ({}))
    if (res.status === 403) throw new ApprovalError(body.message ?? '승인이 필요해요.')
    if (res.ok && (body.status === 'assigned' || body.status === 'no_taxi')) {
      return {
        result: body as DispatchResult,
        source: 'server',
        httpStatus: res.status,
        latencyMs: Math.round(performance.now() - started),
        duplicate: Boolean(body.duplicate),
      }
    }
    fallbackReason = `서버 응답 ${res.status}${body.error ? ` (${body.error})` : ''}`
  } catch (e) {
    if (e instanceof ApprovalError) throw e
    fallbackReason = (e as Error).name === 'AbortError' ? '서버 응답 시간 초과' : '서버 연결 실패'
  }

  const local = localService.handle(payload, 'local')
  if (local.status !== 200) throw new Error(String(local.body.message))
  return {
    result: local.body as unknown as DispatchResult,
    source: 'local_fallback',
    httpStatus: null,
    latencyMs: Math.round(performance.now() - started),
    duplicate: Boolean(local.body.duplicate),
    fallbackReason,
  }
}
