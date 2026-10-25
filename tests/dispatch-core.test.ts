import { beforeEach, describe, expect, it } from 'vitest'
import { createDispatchService, SEARCH_BASE_MS } from '../server/dispatch-core'

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
    svc = createDispatchService({ now: () => now, rateLimit: { max: 3, windowMs: 60_000 }, noTaxiRate: 0, random: () => 0.123456 })
  })

  it('승인되지 않은 요청은 403으로 거부한다', () => {
    const r = svc.create({ ...valid, approved: false }, '1.1.1.1')
    expect(r.status).toBe(403)
    expect(r.body).toMatchObject({ error: 'approval_required' })
  })

  it('접수하면 배차 대기 상태로 시작하고, 시간이 지나면 기사가 배정된다', () => {
    const r = svc.create(valid, '1.1.1.1')
    expect(r.body).toMatchObject({ status: 'searching', mock: true })
    const id = r.body.requestId
    expect(svc.status(id).body).toMatchObject({ status: 'searching' })
    now += SEARCH_BASE_MS + 2500
    const done = svc.status(id).body
    expect(done).toMatchObject({ status: 'assigned', originId: 'seoul-station', destinationId: 'severance' })
    expect(done.plate).toMatch(/^\d{2}[가-힣] \d{4}$/)
    expect(done.driverName).toMatch(/^[가-힣]\*[가-힣]$/)
  })

  it('다른 인스턴스(새 서비스)에서도 같은 요청 상태를 계산한다', () => {
    const id = svc.create(valid, '1.1.1.1').body.requestId
    now += 10_000
    const other = createDispatchService({ now: () => now, noTaxiRate: 0 })
    expect(other.status(id).body).toEqual(svc.status(id).body)
  })

  it('위조한 요청 ID는 404', () => {
    const id = String(svc.create(valid, '1.1.1.1').body.requestId)
    expect(svc.status(id.slice(0, -2) + 'zz').status).toBe(404)
    expect(svc.status('nope').status).toBe(404)
  })

  it('취소하면 취소 상태를 돌려준다', () => {
    const id = svc.create(valid, '1.1.1.1').body.requestId
    expect(svc.cancel({ requestId: id }).body).toMatchObject({ status: 'cancelled' })
    expect(svc.cancel({ requestId: 'x.y' }).status).toBe(404)
  })

  it('같은 idempotencyKey는 같은 결과를 돌려주고 새로 접수하지 않는다', () => {
    const a = svc.create(valid, '1.1.1.1')
    const b = svc.create(valid, '1.1.1.1')
    expect(b.body).toEqual({ ...a.body, duplicate: true })
    expect(svc.stats().dispatches).toBe(1)
  })

  it('다른 세션이 같은 키를 쓰면 남의 결과를 보여주지 않는다', () => {
    svc.create(valid, '1.1.1.1')
    expect(svc.create({ ...valid, sessionId: 'sess-bbbbbbbb' }, '2.2.2.2').status).toBe(409)
  })

  it('목록에 없는 장소는 400', () => {
    expect(svc.create({ ...valid, originId: 'https://evil.example' }, '1.1.1.1').status).toBe(400)
  })

  it('IP별 요청량을 제한한다', () => {
    for (let i = 0; i < 3; i++) svc.create({ ...valid, idempotencyKey: `key-0000000${i}` }, '9.9.9.9')
    expect(svc.create({ ...valid, idempotencyKey: 'key-00000009' }, '9.9.9.9').status).toBe(429)
    now += 61_000
    expect(svc.create({ ...valid, idempotencyKey: 'key-00000010' }, '9.9.9.9').status).toBe(200)
  })

  it('비활성화 스위치가 켜지면 503과 대체 안내를 돌려준다', () => {
    const off = createDispatchService({ now: () => now, disabled: true })
    expect(off.create(valid, '1.1.1.1')).toMatchObject({ status: 503, body: { fallback: 'local_mock' } })
  })

  it('응답에 IP나 세션 정보를 담지 않는다', () => {
    const r = svc.create(valid, '1.1.1.1')
    expect(JSON.stringify(r.body)).not.toMatch(/1\.1\.1\.1|sess-/)
  })
})
