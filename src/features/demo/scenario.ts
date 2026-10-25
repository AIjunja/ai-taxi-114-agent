// 자동 시연 시나리오. 고객 발화는 미리 정한 합성 자료이고,
// AI 상담원 문장은 실제 대화 로직(machine.ts)을 돌려서 만든다.
import type { Turn } from '../../components/CallCard'
import { createInitialState, reduce, type DialogEvent, type DialogState, type DispatchResult } from '../dialog/machine'

export interface DemoStep {
  id: number
  title: string
  detail: string
  turns: Turn[]
  state: DialogState
  /** 연출용 재생 시간(ms). 측정값이 아니다. */
  durationMs: number
  panel: 'none' | 'recognition' | 'approval' | 'automation' | 'dispatch' | 'summary'
}

export const DEMO_DISPATCH: DispatchResult = {
  status: 'assigned',
  requestId: 'demo-fixed-0001',
  etaMinutes: 4,
  plate: '12가 3456',
  color: '흰색',
  model: '쏘나타',
}

export const AUTOMATION_STEPS = [
  '상담원 업무 웹 열기',
  '출발지 입력: 서울역',
  '목적지 입력: 세브란스병원',
  '고객 최종 승인 확인',
  '택시 호출 버튼 누르기',
  'Mock 배차 결과 읽기',
]

function build(): DemoStep[] {
  let state = createInitialState()
  const steps: DemoStep[] = []
  let current: Turn[] = []

  const agent = (event: DialogEvent) => {
    const o = reduce(state, event)
    state = o.state
    o.say.forEach((text) => current.push({ speaker: 'agent', text }))
  }
  const caller = (text: string, note = '합성 음성 · 미리 준비한 발화') => {
    current.push({ speaker: 'caller', text, note })
    return text
  }
  const push = (title: string, detail: string, panel: DemoStep['panel'], extra = 0) => {
    const chars = current.reduce((n, t) => n + t.text.length, 0)
    steps.push({ id: steps.length + 1, title, detail, turns: current, state, panel, durationMs: 2200 + chars * 55 + extra })
    current = []
  }

  agent({ type: 'start' })
  push('AI 상담원 첫인사', '전화를 받으면 바로 용건을 물어요.', 'none')

  const originSaid = caller('네, 서울역 앞에서 탈게요.')
  push('출발지 음성 입력', '고객이 타는 곳을 말해요. GPS 위치는 쓰지 않아요.', 'recognition')

  agent({ type: 'utterance', text: originSaid })
  const yes1 = caller('네, 맞아요.')
  push('출발지 인식과 확인', '알아들은 장소를 되읽고 고객이 맞다고 할 때만 확정해요.', 'recognition')

  agent({ type: 'utterance', text: yes1 })
  const destSaid = caller('세브란스병원이요.')
  push('목적지 입력', '가는 곳을 한 번에 하나씩 물어요.', 'recognition')

  agent({ type: 'utterance', text: destSaid })
  const yes2 = caller('네.')
  push('목적지 재확인', '목적지도 되읽어 확인해요.', 'recognition')

  agent({ type: 'utterance', text: yes2 })
  const approve = caller('네, 불러주세요.')
  push('호출 전 최종 승인', "고객이 '네'라고 해야만 호출해요. 승인 전에는 호출 버튼이 잠겨 있어요.", 'approval')

  agent({ type: 'utterance', text: approve })
  push('업무 웹 자동 입력', 'AI가 상담원용 업무 웹에 출발지·목적지를 넣고 호출 버튼을 눌러요.', 'automation', 4200)

  current.push({ speaker: 'system', text: `Mock 배차 결과: 배정됨 · ${DEMO_DISPATCH.status === 'assigned' ? DEMO_DISPATCH.plate : ''}` })
  push('Mock 배차 성공', '가상 배차 서버가 차량을 배정해요. 실제 택시는 부르지 않아요.', 'dispatch')

  agent({ type: 'dispatchResult', result: DEMO_DISPATCH })
  const no = caller('아니요, 됐어요.')
  push('차량 정보 음성 안내', '도착 시간, 차 번호, 차종을 한 줄씩 끊어서 알려줘요.', 'dispatch')

  agent({ type: 'utterance', text: no })
  push('처리 결과', '통화가 끝나면 처리 결과를 정리해요.', 'summary')

  return steps
}

export const DEMO_STEPS = build()
export const DEMO_TOTAL_MS = DEMO_STEPS.reduce((n, s) => n + s.durationMs, 0)
