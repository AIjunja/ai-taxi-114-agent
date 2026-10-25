// Mock Dispatch. 실제 택시나 카카오 T를 호출하지 않는다.
// 요청 ID 안에 생성 시각과 시드를 서명해 넣어서, 서버리스 인스턴스가 바뀌어도
// 같은 요청의 진행 상태(배차 대기 → 기사 배정)를 다시 계산할 수 있다.
// 아무것도 영구 저장하지 않는다.
import { PLACE_IDS } from '../src/features/dialog/places.js'

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
  /** 0~1. 빈 택시 없음 비율 */
  noTaxiRate?: number
  disabled?: boolean
  random?: () => number
  /** 요청 ID 서명. 서버는 HMAC, 브라우저 대체 Mock은 단순 해시를 쓴다. */
  sign?: (data: string) => string
}

type Reply = { status: number; body: Record<string, unknown> }

interface Ticket {
  v: 1
  t: number
  s: number
  o: string
  d: string
}

const ID_RE = /^[a-z0-9-]{8,64}$/i
const COLORS = ['흰색', '검은색', '은색', '회색', '파란색']
const MODELS = ['쏘나타', 'K5', '아이오닉 5', '그랜저', 'EV6', 'K8']
const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤']
const GIVEN = ['수', '훈', '민', '호', '영', '준', '석', '철']
const HANGUL = '가나다라마바사아자하'

function fnv(data: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < data.length; i++) {
    h ^= data.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

function b64url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function unb64url(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export const SEARCH_BASE_MS = 3000

export function createDispatchService(opts: ServiceOptions = {}) {
  const now = opts.now ?? Date.now
  const random = opts.random ?? Math.random
  const sign = opts.sign ?? fnv
  const limit = opts.rateLimit ?? { max: 20, windowMs: 10 * 60_000 }
  const noTaxiRate = opts.noTaxiRate ?? 0.05
  const idempotency = new Map<string, { sessionId: string; body: Record<string, unknown>; at: number }>()
  const hits = new Map<string, number[]>()
  let dispatches = 0

  function rateLimited(ip: string): boolean {
    const t = now()
    const recent = (hits.get(ip) ?? []).filter((x) => t - x < limit.windowMs)
    const over = recent.length >= limit.max
    if (!over) recent.push(t)
    hits.set(ip, recent)
    return over
  }

  function sweep() {
    const t = now()
    for (const [k, v] of idempotency) if (t - v.at > 10 * 60_000) idempotency.delete(k)
  }

  function decode(requestId: unknown): Ticket | null {
    if (typeof requestId !== 'string' || requestId.length > 400) return null
    const [data, sig] = requestId.split('.')
    if (!data || !sig || sign(data) !== sig) return null
    try {
      const t = JSON.parse(unb64url(data)) as Ticket
      return t.v === 1 && PLACE_IDS.has(t.o) && PLACE_IDS.has(t.d) ? t : null
    } catch {
      return null
    }
  }

  /** POST /api/dispatch — 승인된 호출을 접수한다. */
  function create(input: unknown, ip: string): Reply {
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
      if (prior.sessionId !== req.sessionId) return { status: 409, body: { error: 'key_conflict', message: '다른 요청에서 이미 쓴 키예요.' } }
      return { status: 200, body: { ...prior.body, duplicate: true } }
    }
    if (rateLimited(ip)) {
      return { status: 429, body: { error: 'rate_limited', message: '요청이 많아요. 잠시 뒤 다시 시도해 주세요.', fallback: 'local_mock' } }
    }

    dispatches++
    const ticket: Ticket = { v: 1, t: now(), s: Math.floor(random() * 1e9), o: req.originId, d: req.destinationId }
    const data = b64url(JSON.stringify(ticket))
    const body = { requestId: `${data}.${sign(data)}`, status: 'searching', mock: true, acceptedAt: ticket.t }
    idempotency.set(req.idempotencyKey, { sessionId: req.sessionId, body, at: now() })
    return { status: 200, body }
  }

  /** GET /api/dispatch?requestId= — 현재 진행 상태를 계산한다. */
  function status(requestId: unknown): Reply {
    const t = decode(requestId)
    if (!t) return { status: 404, body: { error: 'not_found', message: '호출 기록을 찾지 못했어요.' } }
    const elapsed = now() - t.t
    const searchMs = SEARCH_BASE_MS + (t.s % 2500)
    const base = { requestId, mock: true, originId: t.o, destinationId: t.d, acceptedAt: t.t }
    if (elapsed < searchMs) {
      return { status: 200, body: { ...base, status: 'searching', nearbyTaxis: 3 + (t.s % 9), progress: Math.min(0.95, elapsed / searchMs) } }
    }
    if ((t.s % 1000) / 1000 < noTaxiRate) return { status: 200, body: { ...base, status: 'no_taxi' } }
    const s = t.s
    const eta0 = 2 + (s % 7)
    return {
      status: 200,
      body: {
        ...base,
        status: 'assigned',
        assignedAt: t.t + searchMs,
        etaMinutes: Math.max(1, eta0 - Math.floor((elapsed - searchMs) / 60_000)),
        plate: `${10 + (s % 89)}${HANGUL[(s >> 3) % HANGUL.length]} ${1000 + ((s >> 5) % 8999)}`,
        color: COLORS[(s >> 7) % COLORS.length],
        model: MODELS[(s >> 9) % MODELS.length],
        driverName: `${SURNAMES[(s >> 11) % SURNAMES.length]}*${GIVEN[(s >> 13) % GIVEN.length]}`,
        driverRating: (4.6 + ((s >> 15) % 4) / 10).toFixed(1),
      },
    }
  }

  /** POST /api/dispatch?action=cancel — 호출을 취소한다. */
  function cancel(input: unknown): Reply {
    const requestId = (input as { requestId?: unknown } | null)?.requestId
    const t = decode(requestId)
    if (!t) return { status: 404, body: { error: 'not_found', message: '호출 기록을 찾지 못했어요.' } }
    return { status: 200, body: { requestId, status: 'cancelled', mock: true, cancelledAt: now() } }
  }

  return { create, status, cancel, stats: () => ({ dispatches }) }
}
