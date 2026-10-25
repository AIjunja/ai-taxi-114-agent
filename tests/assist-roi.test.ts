import { describe, expect, it } from 'vitest'
import { calculateAssist, DEFAULT_ASSIST, savingCurve } from '../src/features/roi/assist-roi'

describe('상담원 보조 효과 계산', () => {
  it('기본값을 손으로 계산한 값과 같다', () => {
    const r = calculateAssist(DEFAULT_ASSIST)
    // 기존 180 + 0.03×150 = 184.5초, 보조 140 + 0.015×150 = 142.25초
    expect(r.beforeSecPerCall).toBeCloseTo(184.5, 6)
    expect(r.afterSecPerCall).toBeCloseTo(142.25, 6)
    // 10,000건 × 42.25초 ÷ 3600 = 117.36시간
    expect(r.savedHours).toBeCloseTo(117.3611, 3)
    expect(r.timeValue).toBe(Math.round(117.36111 * 20_000))
    // 10,000 × 40원 + 50만 = 90만
    expect(r.aiCost).toBe(900_000)
    expect(r.net).toBe(r.timeValue - 900_000)
    expect(r.errorsAvoided).toBe(150)
  })
  it('손익분기 절감 초는 운영비를 시간 가치로 나눈 값에서 오류 감소분을 뺀다', () => {
    const r = calculateAssist(DEFAULT_ASSIST)
    // 90만 ÷ (10,000 × 20,000/3600) = 16.2초, 오류 감소 2.25초 → 13.95초
    expect(r.breakEvenSavedSec).toBeCloseTo(13.95, 6)
  })
  it('절감 시간이 작으면 순효과가 음수이고 회수기간은 없다', () => {
    const r = calculateAssist({ ...DEFAULT_ASSIST, savedSecPerCall: 5, assistErrorRate: 0.03 })
    expect(r.net).toBeLessThan(0)
    expect(r.paybackMonths).toBeNull()
  })
  it('호출 0건이면 나누지 않는다', () => {
    expect(calculateAssist({ ...DEFAULT_ASSIST, monthlyCalls: 0 }).breakEvenSavedSec).toBeNull()
  })
  it('절감 초 곡선은 0~90초', () => {
    const c = savingCurve(DEFAULT_ASSIST)
    expect(c.map((p) => p.sec)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
    expect(c[4].timeValue).toBe(calculateAssist(DEFAULT_ASSIST).timeValue)
  })
})
