// 비용 분석 계산. 모든 기본값은 공개 기사 수치와 일반 가정으로 만든 예시이며
// KT IS 내부 원가가 아니다.
export interface RoiInput {
  monthlyCalls: number // 월 호출 건수
  handleMinutes: number // 상담원 평균 처리시간(분)
  hourlyLaborCost: number // 시간당 총인건비(원)
  successRate: number // AI 자동 처리 성공률 0~1
  aiCostPerCall: number // AI 건당 처리비용(원): 음성 인식·합성·언어 모델
  handoffCostPerCall: number // 상담원 전환 비용(원): 실패 건을 넘길 때 추가로 드는 비용
  monthlyOpsCost: number // 전화망·브라우저 자동화 운영비(원/월)
  initialCost: number // 초기 구축비(원)
}

export const DEFAULT_ROI_INPUT: RoiInput = {
  monthlyCalls: 10_000,
  handleMinutes: 3,
  hourlyLaborCost: 20_000,
  successRate: 0.7,
  aiCostPerCall: 150,
  handoffCostPerCall: 300,
  monthlyOpsCost: 1_500_000,
  initialCost: 30_000_000,
}

/** 월 소정근로시간 209시간 기준 */
export const MONTHLY_WORK_HOURS = 209

export interface RoiResult {
  laborCostPerCall: number
  baselineMonthly: number
  aiMonthly: number
  monthlySaving: number
  annualSaving: number
  savingRate: number
  paybackMonths: number | null
  breakEvenRate: number | null
  freedHours: number
  freedFte: number
}

function monthlyCostAt(input: RoiInput, rate: number): number {
  const labor = (input.handleMinutes / 60) * input.hourlyLaborCost
  const failed = input.monthlyCalls * (1 - rate)
  return Math.round(input.monthlyCalls * input.aiCostPerCall + failed * (labor + input.handoffCostPerCall) + input.monthlyOpsCost)
}

export function calculateRoi(input: RoiInput): RoiResult {
  const laborCostPerCall = (input.handleMinutes / 60) * input.hourlyLaborCost
  const baselineMonthly = Math.round(input.monthlyCalls * laborCostPerCall)
  const aiMonthly = monthlyCostAt(input, input.successRate)
  const monthlySaving = baselineMonthly - aiMonthly
  const savingRate = baselineMonthly > 0 ? monthlySaving / baselineMonthly : 0
  const paybackMonths = monthlySaving > 0 ? input.initialCost / monthlySaving : null

  // baseline = N·c_ai + N(1-s)(L + h) + O 를 s에 대해 푼다.
  let breakEvenRate: number | null = null
  const denominator = input.monthlyCalls * (laborCostPerCall + input.handoffCostPerCall)
  if (input.monthlyCalls > 0 && denominator > 0) {
    const s = 1 - (baselineMonthly - input.monthlyCalls * input.aiCostPerCall - input.monthlyOpsCost) / denominator
    breakEvenRate = s >= 0 && s <= 1 ? s : s < 0 ? 0 : null
  }

  const freedHours = (input.monthlyCalls * input.successRate * input.handleMinutes) / 60
  return {
    laborCostPerCall,
    baselineMonthly,
    aiMonthly,
    monthlySaving,
    annualSaving: monthlySaving * 12,
    savingRate,
    paybackMonths,
    breakEvenRate,
    freedHours,
    freedFte: freedHours / MONTHLY_WORK_HOURS,
  }
}

export function costCurve(input: RoiInput) {
  const baseline = calculateRoi(input).baselineMonthly
  return Array.from({ length: 11 }, (_, i) => ({ rate: i * 10, baseline, ai: monthlyCostAt(input, i / 10) }))
}
