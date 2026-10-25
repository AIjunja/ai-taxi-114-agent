import { describe, expect, it } from 'vitest'
import { calculateRoi, costCurve, DEFAULT_ROI_INPUT } from '../src/features/roi/roi'

describe('calculateRoi', () => {
  it('기본값 계산이 손으로 계산한 값과 같다', () => {
    const r = calculateRoi(DEFAULT_ROI_INPUT)
    // 10,000건 × 3분 ÷ 60 × 20,000원 = 10,000,000원
    expect(r.baselineMonthly).toBe(10_000_000)
    // AI 1,500,000 + 실패 3,000건 × (1,000 + 300) 3,900,000 + 운영 1,500,000
    expect(r.aiMonthly).toBe(6_900_000)
    expect(r.monthlySaving).toBe(3_100_000)
    expect(r.annualSaving).toBe(37_200_000)
    expect(r.savingRate).toBeCloseTo(0.31, 5)
    expect(r.paybackMonths).toBeCloseTo(30_000_000 / 3_100_000, 5)
    expect(r.breakEvenRate).toBeCloseTo(1 - 7_000_000 / 13_000_000, 5)
    // 7,000건 × 3분 = 350시간
    expect(r.freedHours).toBeCloseTo(350, 5)
  })

  it('입력값을 바꾸면 결과가 다시 계산된다', () => {
    const a = calculateRoi(DEFAULT_ROI_INPUT)
    const b = calculateRoi({ ...DEFAULT_ROI_INPUT, successRate: 0.9 })
    expect(b.aiMonthly).toBeLessThan(a.aiMonthly)
    expect(b.monthlySaving).toBe(10_000_000 - (1_500_000 + 1_000 * 1_300 + 1_500_000))
  })

  it('절감이 없으면 회수기간은 null', () => {
    const r = calculateRoi({ ...DEFAULT_ROI_INPUT, successRate: 0.2 })
    expect(r.monthlySaving).toBeLessThan(0)
    expect(r.paybackMonths).toBeNull()
  })

  it('어떤 성공률로도 손익분기가 안 되면 breakEvenRate는 null', () => {
    const r = calculateRoi({ ...DEFAULT_ROI_INPUT, aiCostPerCall: 2_000 })
    expect(r.breakEvenRate).toBeNull()
  })

  it('호출 0건이면 0으로 나누지 않는다', () => {
    const r = calculateRoi({ ...DEFAULT_ROI_INPUT, monthlyCalls: 0 })
    expect(r.savingRate).toBe(0)
    expect(r.breakEvenRate).toBeNull()
  })
})

describe('costCurve', () => {
  it('성공률 0~100%를 10% 간격으로 만든다', () => {
    const c = costCurve(DEFAULT_ROI_INPUT)
    expect(c).toHaveLength(11)
    expect(c[0].rate).toBe(0)
    expect(c[10].rate).toBe(100)
    expect(c[7].ai).toBe(6_900_000)
    expect(c.every((p) => p.baseline === 10_000_000)).toBe(true)
  })
})
