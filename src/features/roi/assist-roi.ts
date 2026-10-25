// 상담원 보조 방식의 효과 계산. 인력을 줄이는 계산이 아니라 '처리 시간과 재작업이 얼마나 줄고,
// 그 시간이 AI 운영비보다 가치가 있는가'를 본다. 기본값은 모두 가정이며 파일럿으로 측정해야 한다.
export interface AssistInput {
  monthlyCalls: number // 월 호출 건수
  baseHandleSec: number // 기존 건당 처리시간(초)
  savedSecPerCall: number // 보조로 줄어드는 시간(초): 받아 적기·검색 입력·결과 읽기
  baseErrorRate: number // 기존 입력 오류율 (0~1): 출발지·목적지 잘못 입력
  assistErrorRate: number // 보조 적용 후 입력 오류율
  reworkSec: number // 오류 1건 재작업 시간(초): 재통화·취소·재호출
  hourlyLaborCost: number // 시간당 총인건비(원) — 시간 가치를 원으로 바꿀 때만 쓴다
  aiCostPerCall: number // 건당 AI 운영비(원): 받아쓰기·장소 정리·Worker 실행
  monthlyFixedCost: number // 월 고정 운영비(원)
  initialCost: number // 초기 구축비(원)
}

export const DEFAULT_ASSIST: AssistInput = {
  monthlyCalls: 10_000,
  baseHandleSec: 180,
  savedSecPerCall: 40,
  baseErrorRate: 0.03,
  assistErrorRate: 0.015,
  reworkSec: 150,
  hourlyLaborCost: 20_000,
  aiCostPerCall: 40,
  monthlyFixedCost: 500_000,
  initialCost: 20_000_000,
}

export const MONTHLY_WORK_HOURS = 209

export interface AssistResult {
  beforeSecPerCall: number // 재작업 포함 건당 실질 처리시간
  afterSecPerCall: number
  savedHours: number // 월 절감 시간
  reworkHoursBefore: number
  reworkHoursAfter: number
  timeValue: number // 절감 시간의 원 환산
  aiCost: number // 월 AI 운영비
  net: number // 시간 가치 - 운영비
  paybackMonths: number | null
  breakEvenSavedSec: number | null // 운영비를 넘기려면 건당 몇 초를 줄여야 하나
  freedFte: number
  errorsAvoided: number // 월 오류 감소 건수
}

export function calculateAssist(i: AssistInput): AssistResult {
  const before = i.baseHandleSec + i.baseErrorRate * i.reworkSec
  const after = Math.max(0, i.baseHandleSec - i.savedSecPerCall) + i.assistErrorRate * i.reworkSec
  const savedHours = (i.monthlyCalls * (before - after)) / 3600
  const perSecValue = i.hourlyLaborCost / 3600
  const timeValue = Math.round(savedHours * i.hourlyLaborCost)
  const aiCost = Math.round(i.monthlyCalls * i.aiCostPerCall + i.monthlyFixedCost)
  const net = timeValue - aiCost
  // 오류 감소분을 뺀 뒤, 처리시간에서 몇 초를 줄여야 운영비와 같아지는가
  const errorSecSaved = (i.baseErrorRate - i.assistErrorRate) * i.reworkSec
  const breakEvenSavedSec = i.monthlyCalls > 0 && perSecValue > 0 ? Math.max(0, aiCost / (i.monthlyCalls * perSecValue) - errorSecSaved) : null
  return {
    beforeSecPerCall: before,
    afterSecPerCall: after,
    savedHours,
    reworkHoursBefore: (i.monthlyCalls * i.baseErrorRate * i.reworkSec) / 3600,
    reworkHoursAfter: (i.monthlyCalls * i.assistErrorRate * i.reworkSec) / 3600,
    timeValue,
    aiCost,
    net,
    paybackMonths: net > 0 ? i.initialCost / net : null,
    breakEvenSavedSec,
    freedFte: savedHours / MONTHLY_WORK_HOURS,
    errorsAvoided: Math.round(i.monthlyCalls * (i.baseErrorRate - i.assistErrorRate)),
  }
}

/** 건당 절감 시간(0~90초)에 따른 월 순효과 */
export function savingCurve(i: AssistInput) {
  return Array.from({ length: 10 }, (_, k) => {
    const sec = k * 10
    const r = calculateAssist({ ...i, savedSecPerCall: sec })
    return { sec, timeValue: r.timeValue, aiCost: r.aiCost }
  })
}
