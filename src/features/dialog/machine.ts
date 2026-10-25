// 114 택시 대신 불러주기 대화 흐름.
// 순수 함수라서 음성 통화, 글 입력, 자동 시연, 테스트가 같은 로직을 쓴다.
// 호출 요청(requestDispatch)은 finalApproval에서 '네'를 들었을 때만 나온다.
import { changeTarget, isAgent, isCancel, isCantHear, isRepeat, isRestart, isSlower, parseYesNo, soundsLikeNewDestination } from './intents'
import { pickCandidate, resolvePlaces, type Place } from './places'
import { speakPlate, withRo } from './speech-format'

export type Stage =
  | 'idle'
  | 'soundCheck'
  | 'askOrigin'
  | 'chooseOrigin'
  | 'confirmOrigin'
  | 'askDestination'
  | 'chooseDestination'
  | 'confirmDestination'
  | 'finalApproval'
  | 'askChange'
  | 'dispatching'
  | 'dispatched'
  | 'closing'
  | 'noTaxi'
  | 'cancelling'
  | 'cancelled'
  | 'handoff'
  | 'closed'

export type DispatchResult =
  | { status: 'assigned'; requestId: string; etaMinutes: number; plate: string; color: string; model: string; driverName?: string }
  | { status: 'no_taxi'; requestId: string }

export interface DialogState {
  stage: Stage
  origin?: Place
  destination?: Place
  candidate?: Place
  candidates?: Place[]
  approved: boolean
  attempts: number
  misses: number
  hearingChecks: number
  result?: DispatchResult
  lastSay: string[]
}

export type DialogEvent =
  | { type: 'start' }
  | { type: 'utterance'; text: string }
  | { type: 'silence' }
  | { type: 'dispatchResult'; result: DispatchResult }
  | { type: 'dispatchFailed'; reason: string }
  | { type: 'cancelResult'; ok: boolean }

export type Effect =
  | { type: 'requestDispatch'; origin: Place; destination: Place; attempt: number }
  | { type: 'requestCancel'; requestId: string }
  | { type: 'voice'; slower?: boolean; louder?: boolean }
  | { type: 'endCall' }

export interface Output {
  state: DialogState
  say: string[]
  effects: Effect[]
}

export function createInitialState(): DialogState {
  return { stage: 'idle', approved: false, attempts: 0, misses: 0, hearingChecks: 0, lastSay: [] }
}

const ASK_ORIGIN = '택시를 타실 곳을 알려주세요. 주소를 모르시면 가까운 역이나 병원, 큰 건물 이름도 괜찮아요.'
const ASK_DESTINATION = '어디로 가세요?'
const YES_NO_HELP = "맞으면 '네', 아니면 '아니요'라고 말씀해 주세요."
const WAITING = '지금 근처 택시를 찾고 있어요. 잠시만 기다려 주세요.'
const BEFORE_DISPATCH: Stage[] = [
  'soundCheck',
  'askOrigin',
  'chooseOrigin',
  'confirmOrigin',
  'askDestination',
  'chooseDestination',
  'confirmDestination',
  'finalApproval',
  'askChange',
]

function out(state: DialogState, say: string[], effects: Effect[] = []): Output {
  return { state: say.length ? { ...state, lastSay: say } : state, say, effects }
}

function candidatesPrompt(kind: 'origin' | 'destination', list: Place[]): string[] {
  const where = kind === 'origin' ? '타실 곳' : '가실 곳'
  const count = ['', '한', '두', '세', '네'][list.length] ?? String(list.length)
  return [
    `말씀하신 곳이 ${count} 군데 있어요.`,
    ...list.map((p, i) => `${i + 1}번, ${p.name}.`),
    `${where}이 몇 번인지 말씀해 주세요.`,
  ]
}

function askOriginAgain(state: DialogState): Output {
  return out({ ...state, stage: 'askOrigin', candidate: undefined, candidates: undefined }, ['그럼 타실 곳을 다시 알려주세요.'])
}

function askDestinationAgain(state: DialogState, line = '그럼 가실 곳을 다시 알려주세요.'): Output {
  return out({ ...state, stage: 'askDestination', candidate: undefined, candidates: undefined }, [line])
}

function finalApproval(state: DialogState, lead = '정리해 드릴게요.'): Output {
  return out({ ...state, stage: 'finalApproval', candidate: undefined, candidates: undefined }, [
    lead,
    `타시는 곳은 ${state.origin!.name}.`,
    `가시는 곳은 ${state.destination!.name}.`,
    "이대로 택시를 부를까요? 부르시려면 '네, 불러주세요'라고 말씀해 주세요.",
  ])
}

function miss(state: DialogState, kind: 'origin' | 'destination'): Output {
  const misses = state.misses + 1
  if (misses >= 3) {
    return out({ ...state, stage: 'handoff', misses }, ['제가 잘 알아듣지 못했어요.', '상담원에게 연결해 드릴게요. 잠시만 기다려 주세요.'], [{ type: 'endCall' }])
  }
  const near = kind === 'origin' ? '타실 곳' : '가실 곳'
  const line =
    misses === 1
      ? `말씀하신 곳을 지도에서 찾지 못했어요. ${near} 근처의 역이나 병원, 큰 건물 이름을 알려주세요.`
      : "한 번만 더 부탁드려요. 예를 들면 '서울역', '세브란스병원'처럼 말씀해 주세요."
  return out({ ...state, misses }, [line])
}

/** 장소 발화를 처리한다: 한 곳이면 확인, 여러 곳이면 후보 제시, 없으면 다시 묻기 */
function resolveInto(state: DialogState, text: string, kind: 'origin' | 'destination'): Output {
  const found = resolvePlaces(text)
  if (found.length === 0) return miss(state, kind)
  if (kind === 'destination' && found.length === 1 && found[0].id === state.origin?.id) {
    return out({ ...state, stage: 'askDestination' }, ['타시는 곳과 가시는 곳이 같아요. 가실 곳을 다시 알려주세요.'])
  }
  const reset = { ...state, misses: 0 }
  if (found.length > 1) {
    const list = kind === 'destination' ? found.filter((p) => p.id !== state.origin?.id) : found
    if (list.length > 1) {
      return out({ ...reset, stage: kind === 'origin' ? 'chooseOrigin' : 'chooseDestination', candidates: list }, candidatesPrompt(kind, list))
    }
    return confirmPlace(reset, list[0], kind)
  }
  return confirmPlace(reset, found[0], kind)
}

function confirmPlace(state: DialogState, place: Place, kind: 'origin' | 'destination'): Output {
  if (kind === 'origin') {
    return out({ ...state, stage: 'confirmOrigin', candidate: place, candidates: undefined }, [`${place.name}에서 타시는 거 맞으세요?`])
  }
  return out({ ...state, stage: 'confirmDestination', candidate: place, candidates: undefined }, [`${withRo(place.name)} 가시는 거 맞으세요?`])
}

function dispatch(state: DialogState): Output {
  const next: DialogState = { ...state, stage: 'dispatching', approved: true, attempts: state.attempts + 1 }
  return out(next, [WAITING], [{ type: 'requestDispatch', origin: state.origin!, destination: state.destination!, attempt: next.attempts }])
}

export function reduce(state: DialogState, event: DialogEvent): Output {
  switch (event.type) {
    case 'start':
      return out({ ...createInitialState(), stage: 'soundCheck' }, [
        '안녕하세요, 114 택시 대신 불러드리기예요.',
        "제 목소리가 잘 들리시면 '네'라고 말씀해 주세요.",
      ])

    case 'silence':
      if (['idle', 'closed', 'cancelled', 'handoff', 'dispatching', 'cancelling'].includes(state.stage)) return out(state, [])
      return out(state, ['말씀이 잘 들리지 않았어요. 한 번 더 말씀해 주세요.'])

    case 'dispatchResult': {
      if (state.stage !== 'dispatching') return out(state, [])
      const r = event.result
      if (r.status === 'assigned') {
        return out({ ...state, stage: 'dispatched', result: r }, [
          '택시가 잡혔어요.',
          `약 ${r.etaMinutes}분 뒤에 도착해요.`,
          `차 번호는 ${speakPlate(r.plate)}이에요.`,
          `${r.color} ${r.model} 차량이에요.`,
          '차 번호를 한 번 더 불러드릴까요?',
        ])
      }
      return out({ ...state, stage: 'noTaxi', result: r }, ['지금 근처에 빈 택시가 없어요.', '몇 분 뒤에 다시 불러드릴까요?'])
    }

    case 'dispatchFailed':
      if (state.stage !== 'dispatching') return out(state, [])
      return out({ ...state, stage: 'noTaxi' }, ['택시 호출 화면에 연결하지 못했어요.', '다시 불러드릴까요?'])

    case 'cancelResult':
      if (state.stage !== 'cancelling') return out(state, [])
      if (!event.ok) return out({ ...state, stage: 'closing' }, ['호출을 취소하지 못했어요. 상담원이 이어서 도와드릴게요.'])
      return out({ ...state, stage: 'cancelled', approved: false }, ['택시 호출을 취소했어요.', '다시 필요하시면 114로 전화 주세요.'], [{ type: 'endCall' }])

    case 'utterance':
      return onUtterance(state, event.text.trim())
  }
}

function onUtterance(state: DialogState, text: string): Output {
  if (!text) return out(state, ['잘 못 들었어요. 한 번 더 말씀해 주세요.'])

  // 어느 단계에서든: 다시 말해 달라, 천천히, 안 들린다, 상담원
  if (state.stage !== 'idle') {
    if (isSlower(text)) return out(state, ['네, 천천히 말씀드릴게요.', ...state.lastSay], [{ type: 'voice', slower: true }])
    if (isCantHear(text) && state.stage !== 'soundCheck') {
      return out(state, ['소리를 크게 할게요.', ...state.lastSay], [{ type: 'voice', louder: true, slower: true }])
    }
    if (isRepeat(text) && state.lastSay.length) return { state, say: state.lastSay, effects: [] }
    if (isAgent(text) && BEFORE_DISPATCH.includes(state.stage)) {
      return out({ ...state, stage: 'handoff' }, ['상담원에게 연결해 드릴게요. 잠시만 기다려 주세요.'], [{ type: 'endCall' }])
    }
  }

  if (BEFORE_DISPATCH.includes(state.stage) && isCancel(text)) {
    return out({ ...state, stage: 'cancelled', approved: false }, ['택시 부르기를 그만둘게요. 필요하시면 114로 다시 전화 주세요.'], [{ type: 'endCall' }])
  }

  // 확인·승인 단계에서 "출발지 바꿀래요", "목적지 바꿔 주세요"
  if (['confirmOrigin', 'confirmDestination', 'finalApproval', 'askChange', 'askDestination', 'chooseDestination'].includes(state.stage)) {
    const target = changeTarget(text)
    if (target === 'origin' && resolvePlaces(text).length === 0) return askOriginAgain(state)
    if (target === 'destination' && resolvePlaces(text).length === 0 && state.stage !== 'askDestination') return askDestinationAgain(state, '가실 곳을 바꿀게요. 어디로 가세요?')
  }

  switch (state.stage) {
    case 'idle':
      return out(state, [])

    case 'soundCheck': {
      if (isCantHear(text) || parseYesNo(text) === 'no') {
        const checks = state.hearingChecks + 1
        if (checks >= 2) {
          return out({ ...state, stage: 'askOrigin', hearingChecks: checks }, ['화면에 글자로도 같이 보여드릴게요.', ASK_ORIGIN], [{ type: 'voice', louder: true, slower: true }])
        }
        return out({ ...state, hearingChecks: checks }, ['소리를 크게 하고 천천히 말씀드릴게요.', '이제 잘 들리세요?'], [{ type: 'voice', louder: true, slower: true }])
      }
      if (resolvePlaces(text).length) return resolveInto({ ...state, stage: 'askOrigin' }, text, 'origin')
      return out({ ...state, stage: 'askOrigin' }, [ASK_ORIGIN])
    }

    case 'askOrigin':
      return resolveInto(state, text, 'origin')

    case 'chooseOrigin':
    case 'chooseDestination': {
      const kind = state.stage === 'chooseOrigin' ? 'origin' : 'destination'
      const picked = pickCandidate(text, state.candidates ?? [])
      if (picked) return confirmPlace(state, picked, kind)
      if (parseYesNo(text) === 'no') return kind === 'origin' ? askOriginAgain(state) : askDestinationAgain(state)
      const other = resolvePlaces(text)
      if (other.length) return resolveInto(state, text, kind)
      return out(state, ['몇 번인지 다시 말씀해 주세요.', ...(state.candidates ?? []).map((p, i) => `${i + 1}번, ${p.name}.`)])
    }

    case 'confirmOrigin': {
      const yn = parseYesNo(text)
      const mentioned = resolvePlaces(text)
      if (yn === 'yes' && !(mentioned.length && mentioned[0].id !== state.candidate?.id)) {
        const next = { ...state, origin: state.candidate, candidate: undefined, misses: 0 }
        if (next.destination) return finalApproval(next, '타실 곳을 바꿨어요.')
        return out({ ...next, stage: 'askDestination' }, [ASK_DESTINATION])
      }
      if (mentioned.length && mentioned[0].id !== state.candidate?.id) return resolveInto(state, text, 'origin')
      if (yn === 'no') return askOriginAgain(state)
      return out(state, [YES_NO_HELP])
    }

    case 'askDestination':
      return resolveInto(state, text, 'destination')

    case 'confirmDestination': {
      const yn = parseYesNo(text)
      const mentioned = resolvePlaces(text)
      if (yn === 'yes' && !(mentioned.length && mentioned[0].id !== state.candidate?.id)) {
        return finalApproval({ ...state, destination: state.candidate, misses: 0 })
      }
      if (mentioned.length && mentioned[0].id !== state.candidate?.id) return resolveInto(state, text, 'destination')
      if (yn === 'no') return askDestinationAgain(state)
      return out(state, [YES_NO_HELP])
    }

    case 'finalApproval': {
      const mentioned = resolvePlaces(text)
      if (mentioned.length && soundsLikeNewDestination(text)) return resolveInto(state, text, 'destination')
      const yn = parseYesNo(text)
      if (yn === 'yes') return dispatch(state)
      if (yn === 'no') {
        if (mentioned.length) return resolveInto(state, text, 'destination')
        return out({ ...state, stage: 'askChange' }, ["어떤 걸 바꿀까요? '타는 곳'이나 '가는 곳'이라고 말씀해 주세요.", "그만두시려면 '취소'라고 해 주세요."])
      }
      if (mentioned.length) return resolveInto(state, text, 'destination')
      return out(state, ["택시를 부르시려면 '네', 바꾸시려면 '아니요'라고 말씀해 주세요."])
    }

    case 'askChange': {
      const t = changeTarget(text)
      if (t === 'origin' || /타는|출발/.test(text)) return askOriginAgain(state)
      if (t === 'destination' || /가는|목적|도착/.test(text)) return askDestinationAgain(state)
      if (resolvePlaces(text).length) return resolveInto(state, text, 'destination')
      if (/불러/.test(text)) return dispatch(state)
      return out(state, ["'타는 곳', '가는 곳', '취소' 중에서 말씀해 주세요."])
    }

    case 'dispatching':
      // 이미 요청을 보냈다. 같은 말을 반복해도 새 요청을 만들지 않는다.
      return out(state, ['택시를 찾고 있어요. 조금만 더 기다려 주세요.'])

    case 'dispatched':
    case 'closing': {
      if (isCancel(text) && state.result?.status === 'assigned') {
        return out({ ...state, stage: 'cancelling' }, ['택시 호출을 취소할게요. 잠시만 기다려 주세요.'], [{ type: 'requestCancel', requestId: state.result.requestId }])
      }
      if (state.stage === 'closing') {
        return out({ ...state, stage: 'closed' }, ['이용해 주셔서 고마워요. 조심히 다녀오세요.'], [{ type: 'endCall' }])
      }
      const yn = parseYesNo(text)
      const plate = state.result?.status === 'assigned' ? state.result.plate : ''
      const lines = yn === 'yes' || isRepeat(text) ? [`차 번호는 ${speakPlate(plate)}이에요.`] : []
      return out({ ...state, stage: 'closing' }, [...lines, "취소가 필요하시면 '취소해 주세요'라고 말씀해 주세요. 아니면 '끝'이라고 해 주세요."])
    }

    case 'noTaxi': {
      if (parseYesNo(text) === 'yes') return dispatch(state)
      return out({ ...state, stage: 'closed' }, ['택시를 부르지 않았어요. 필요하시면 114로 다시 전화 주세요.'], [{ type: 'endCall' }])
    }

    case 'cancelling':
      return out(state, ['취소하고 있어요. 조금만 기다려 주세요.'])

    case 'handoff':
    case 'cancelled':
    case 'closed':
      if (isRestart(text)) return reduce(state, { type: 'start' })
      return out(state, ["새로 부르시려면 '다시'라고 말씀해 주세요."])
  }
}

/** 화면에 보여줄 단계 이름 */
export const STAGE_LABEL: Record<Stage, string> = {
  idle: '대기',
  soundCheck: '소리 확인',
  askOrigin: '출발지 묻는 중',
  chooseOrigin: '출발지 후보 고르는 중',
  confirmOrigin: '출발지 되읽기',
  askDestination: '목적지 묻는 중',
  chooseDestination: '목적지 후보 고르는 중',
  confirmDestination: '목적지 되읽기',
  finalApproval: '최종 승인 대기',
  askChange: '바꿀 내용 묻는 중',
  dispatching: '호출 중',
  dispatched: '배차 완료',
  closing: '마무리',
  noTaxi: '배차 안 됨',
  cancelling: '취소 중',
  cancelled: '취소됨',
  handoff: '상담원 연결',
  closed: '통화 종료',
}
