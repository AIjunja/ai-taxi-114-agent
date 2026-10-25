// Mock Dispatch. 실제 택시나 카카오 T를 호출하지 않는다.
// 서버리스 인스턴스 메모리에만 잠깐 보관하고 아무것도 영구 저장하지 않는다.
import { PLACE_IDS } from '../src/features/dialog/places'

export interface DispatchRequest {
  sessionId: string
  idempotencyKey: string
  originId: string
  destinationId: string
  approved: boolean
}

export interface ServiceOptions {
  now?: () => number
  rateLimit?: { max: number; windowMs: number }
  /** 0~1. 빈 택시 없음 응답 비율 */
  noTaxiRate?: number
  disabled?: boolean
  random?: () => number
}

type Reply = { status: number; body: Record<string, unknown> }

const ID_RE = /^[a-z0-9-]{8,64}$/i
const COLORS = ['흰색', '검은색', '은색', '회색']
const MODELS = ['쏘나타', 'K5', '아이오닉 5', '그랜저', 'EV6']
const HANGUL = '가나다라마바사아자하'

export function createDispatchService(opts: ServiceOptions = {}) {
  const now = opts.now ?? Date.now
  const random = opts.random ?? Math.random
  const limit = opts.rateLimit ?? { max: 20, windowMs: 10 * 60_000 }
  const noTaxiRate = opts.noTaxiRate ?? 0.1
  const idempotency = new Map<string, { sessionId: string; body: Record<string, unknown>; at: number }>()
  const hits = new Map<string, number[]>()
  let dispatches = 0

  function rateLimited(ip: string): boolean {
    const t = now()
    const recent = (hits.get(ip) ?? []).filter((x) => t - x < limit.windowMs)
    if (recent.length >= limit.max) {
      hits.set(ip, recent)
      return true
    }
    recent.push(t)
    hits.set(ip, recent)
    return false
  }

  function sweep() {
    const t = now()
    for (const [k, v] of idempotency) if (t - v.at > 10 * 60_000) idempotency.delete(k)
  }

  function handle(input: unknown, ip: string): Reply {
    if (opts.disabled) {
      return { status: 503, body: { error: 'disabled', message: '지금은 서버 배차 체험을 잠시 멈췄어요.', fallback: 'local_mock' } }
    }
    const req = input as Partial<DispatchRequest> | null
    if (
      !req ||
      typeof req.sessionId !== 'string' ||
      typeof req.idempotencyKey !== 'string' ||
      !ID_RE.test(req.sessionId) ||
      !ID_RE.test(req.idempotencyKey) ||
      typeof req.originId !== 'string' ||
      typeof req.destinationId !== 'string' ||
      !PLACE_IDS.has(req.originId) ||
      !PLACE_IDS.has(req.destinationId) ||
      req.originId === req.destinationId
    ) {
      return { status: 400, body: { error: 'invalid_request', message: '요청 형식이 맞지 않아요.' } }
    }
    if (req.approved !== true) {
      return { status: 403, body: { error: 'approval_required', message: '고객의 최종 승인 없이 호출할 수 없어요.' } }
    }

    sweep()
    const prior = idempotency.get(req.idempotencyKey)
    if (prior) {
      if (prior.sessionId !== req.sessionId) {
        return { status: 409, body: { error: 'key_conflict', message: '다른 요청에서 이미 쓴 키예요.' } }
      }
      return { status: 200, body: { ...prior.body, duplicate: true } }
    }

    if (rateLimited(ip)) {
      return { status: 429, body: { error: 'rate_limited', message: '요청이 많아요. 잠시 뒤 다시 시도해 주세요.', fallback: 'local_mock' } }
    }

    dispatches++
    const requestId = `mock-${now().toString(36)}-${Math.floor(random() * 1e6).toString(36)}`
    const body: Record<string, unknown> =
      random() < noTaxiRate
        ? { status: 'no_taxi', requestId, mock: true }
        : {
            status: 'assigned',
            requestId,
            mock: true,
            etaMinutes: 2 + Math.floor(random() * 7),
            plate: `${10 + Math.floor(random() * 89)}${HANGUL[Math.floor(random() * HANGUL.length)]} ${1000 + Math.floor(random() * 8999)}`,
            color: COLORS[Math.floor(random() * COLORS.length)],
            model: MODELS[Math.floor(random() * MODELS.length)],
          }
    idempotency.set(req.idempotencyKey, { sessionId: req.sessionId, body, at: now() })
    return { status: 200, body }
  }

  return { handle, stats: () => ({ dispatches }) }
}
