import { beforeEach, describe, expect, it } from 'vitest'
import { createDispatchService } from '../server/dispatch-core'

const valid = {
  sessionId: 'sess-aaaaaaaa',
  idempotencyKey: 'key-00000001',
  originId: 'seoul-station',
  destinationId: 'severance',
  approved: true,
}

describe('dispatch service', () => {
  let svc: ReturnType<typeof createDispatchService>
  let now = 1_000_000
  beforeEach(() => {
    now = 1_000_000
    svc = createDispatchService({ now: () => now, rateLimit: { max: 3, windowMs: 60_000 }, noTaxiRate: 0 })
  })

  it('승인되지 않은 요청은 403으로 거부한다', () => {
    const r = svc.handle({ ...valid, approved: false }, '1.1.1.1')
    expect(r.status).toBe(403)
    expect(r.body).toMatchObject({ error: 'approval_required' })
  })

  it('승인된 요청은 가상 차량을 배정한다', () => {
    const r = svc.handle(valid, '1.1.1.1')
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ status: 'assigned', mock: true })
  })

  it('같은 idempotencyKey는 같은 결과를 돌려주고 새로 배차하지 않는다', () => {
    const a = svc.handle(valid, '1.1.1.1')
    const b = svc.handle(valid, '1.1.1.1')
    expect(b.status).toBe(200)
    expect(b.body).toEqual({ ...(a.body as object), duplicate: true })
    expect(svc.stats().dispatches).toBe(1)
  })

  it('다른 세션이 같은 키를 써도 남의 결과를 보여주지 않는다', () => {
    svc.handle(valid, '1.1.1.1')
    const r = svc.handle({ ...valid, sessionId: 'sess-bbbbbbbb' }, '2.2.2.2')
    expect(r.status).toBe(409)
  })

  it('목록에 없는 장소는 400', () => {
    const r = svc.handle({ ...valid, originId: 'https://evil.example' }, '1.1.1.1')
    expect(r.status).toBe(400)
  })

  it('IP별 요청량을 제한한다', () => {
    for (let i = 0; i < 3; i++) svc.handle({ ...valid, idempotencyKey: `key-0000000${i}` }, '9.9.9.9')
    const r = svc.handle({ ...valid, idempotencyKey: 'key-00000009' }, '9.9.9.9')
    expect(r.status).toBe(429)
    now += 61_000
    expect(svc.handle({ ...valid, idempotencyKey: 'key-00000010' }, '9.9.9.9').status).toBe(200)
  })

  it('비활성화 스위치가 켜지면 503과 대체 안내를 돌려준다', () => {
    const off = createDispatchService({ now: () => now, disabled: true })
    const r = off.handle(valid, '1.1.1.1')
    expect(r.status).toBe(503)
    expect(r.body).toMatchObject({ error: 'disabled', fallback: 'local_mock' })
  })

  it('결과에 주소나 개인정보를 담지 않는다', () => {
    const r = svc.handle(valid, '1.1.1.1')
    expect(JSON.stringify(r.body)).not.toMatch(/1\.1\.1\.1|sess-/)
  })
})
