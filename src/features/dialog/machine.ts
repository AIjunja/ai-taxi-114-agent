// 114 택시 대신 불러주기 대화 흐름.
// 순수 함수라서 자동 시연, 직접 체험, 테스트가 같은 로직을 쓴다.
import { isCancel, isRestart, parseYesNo } from './intents'
import { matchPlace, type Place } from './places'
import { speakPlate, withRo } from './speech-format'

export type Stage =
  | 'idle'
  | 'askIntent'
  | 'askOrigin'
  | 'confirmOrigin'
  | 'askDestination'
  | 'confirmDestination'
  | 'finalApproval'
  | 'dispatching'
  | 'dispatched'
  | 'noTaxi'
  | 'cancelled'
  | 'closed'

export type DispatchResult =
  | { status: 'assigned'; requestId: string; etaMinutes: number; plate: string; color: string; model: string }
  | { status: 'no_taxi'; requestId: string }

export interface DialogState {
  stage: Stage
  origin?: Place
  destination?: Place
  candidate?: Place
  approved: boolean
  attempts: number
  result?: DispatchResult
}

export type DialogEvent =
  | { type: 'start' }
  | { type: 'utterance'; text: string }
  | { type: 'dispatchResult'; result: DispatchResult }
  | { type: 'dispatchFailed'; reason: string }

export type Effect = { type: 'requestDispatch'; origin: Place; destination: Place; attempt: number }

export interface Output {
  state: DialogState
  say: string[]
  effects: Effect[]
}

export function createInitialState(): DialogState {
  return { stage: 'idle', approved: false, attempts: 0 }
}

const ASK_ORIGIN = '택시를 타실 곳을 알려주세요. 주소를 모르시면 가까운 건물이나 역 이름도 괜찮아요.'
const ASK_DESTINATION = '어디로 가세요?'
const YES_NO_HELP = "맞으면 '네', 아니면 '아니요'라고 말씀해 주세요."
const WAITING = '지금 근처 택시를 찾고 있어요. 잠시만 기다려 주세요.'
const GOODBYE = '조심히 다녀오세요.'

const label = (p: Place) => p.name

function out(state: DialogState, say: string[], effects: Effect[] = []): Output {
  return { state, say, effects }
}

function dispatch(state: DialogState): Output {
  const next: DialogState = { ...state, stage: 'dispatching', attempts: state.attempts + 1 }
  return out(next, [WAITING], [
    { type: 'requestDispatch', origin: state.origin!, destination: state.destination!, attempt: next.attempts },
  ])
}

export function reduce(state: DialogState, event: DialogEvent): Output {
  if (event.type === 'start') {
    return out({ ...createInitialState(), stage: 'askIntent' }, ['네, 114예요. 택시 불러드릴까요?'])
  }

  if (event.type === 'dispatchResult') {
    if (state.stage !== 'dispatching') return out(state, [])
    const result = event.result
    if (result.status === 'assigned') {
      return out({ ...state, stage: 'dispatched', result }, [
        '택시가 잡혔어요.',
        `약 ${result.etaMinutes}분 뒤에 도착해요.`,
        `차 번호는 ${speakPlate(result.plate)}이에요.`,
        `${result.color} ${result.model} 차량이에요.`,
        '차 번호를 한 번 더 불러드릴까요?',
      ])
    }
    return out({ ...state, stage: 'noTaxi', result }, ['지금 근처에 빈 택시가 없어요.', '몇 분 뒤에 다시 불러드릴까요?'])
  }

  if (event.type === 'dispatchFailed') {
    if (state.stage !== 'dispatching') return out(state, [])
    return out({ ...state, stage: 'noTaxi' }, ['택시 호출 서버에 연결하지 못했어요.', '다시 불러드릴까요?'])
  }

  const text = event.text.trim()
  if (!text) return out(state, ['잘 못 들었어요. 한 번 더 말씀해 주세요.'])

  const beforeDispatch = ['askIntent', 'askOrigin', 'confirmOrigin', 'askDestination', 'confirmDestination', 'finalApproval']
  if (beforeDispatch.includes(state.stage) && isCancel(text)) {
    return out({ ...state, stage: 'cancelled', approved: false }, ['택시 부르기를 취소했어요. 필요하시면 114로 다시 전화 주세요.'])
  }

  switch (state.stage) {
    case 'idle':
      return out(state, [])

    case 'askIntent': {
      const yn = parseYesNo(text)
      if (yn === 'no') return out({ ...state, stage: 'closed' }, ['네, 다른 안내가 필요하시면 다시 전화 주세요.'])
      // 첫 대답에 장소를 함께 말한 경우 바로 확인으로 넘어간다.
      const place = matchPlace(text)
      if (place) return out({ ...state, stage: 'confirmOrigin', candidate: place }, [`${label(place)}에서 타시는 거 맞으세요?`])
      return out({ ...state, stage: 'askOrigin' }, [ASK_ORIGIN])
    }

    case 'askOrigin': {
      const place = matchPlace(text)
      if (!place) return out(state, ['말씀하신 곳을 지도에서 찾지 못했어요. 근처에 큰 건물이나 역 이름을 알려주세요.'])
      return out({ ...state, stage: 'confirmOrigin', candidate: place }, [`${label(place)}에서 타시는 거 맞으세요?`])
    }

    case 'confirmOrigin': {
      const yn = parseYesNo(text)
      if (yn === 'yes') {
        return out({ ...state, stage: 'askDestination', origin: state.candidate, candidate: undefined }, [ASK_DESTINATION])
      }
      if (yn === 'no') {
        const other = matchPlace(text)
        if (other && other.id !== state.candidate?.id) {
          return out({ ...state, candidate: other }, [`${label(other)}에서 타시는 거 맞으세요?`])
        }
        return out({ ...state, stage: 'askOrigin', candidate: undefined }, ['그럼 타실 곳을 다시 알려주세요.'])
      }
      return out(state, [YES_NO_HELP])
    }

    case 'askDestination': {
      const place = matchPlace(text)
      if (!place) return out(state, ['말씀하신 곳을 지도에서 찾지 못했어요. 가시는 곳 근처의 큰 건물이나 역 이름을 알려주세요.'])
      if (place.id === state.origin?.id) return out(state, ['타시는 곳과 가시는 곳이 같아요. 가시는 곳을 다시 알려주세요.'])
      return out({ ...state, stage: 'confirmDestination', candidate: place }, [`${withRo(label(place))} 가시는 거 맞으세요?`])
    }

    case 'confirmDestination': {
      const yn = parseYesNo(text)
      if (yn === 'yes') {
        const next = { ...state, stage: 'finalApproval' as const, destination: state.candidate, candidate: undefined }
        return out(next, [
          `${label(state.origin!)}에서 ${label(state.candidate!)}까지 택시를 부를까요?`,
          "부르시려면 '네'라고 말씀해 주세요.",
        ])
      }
      if (yn === 'no') {
        const other = matchPlace(text)
        if (other && other.id !== state.candidate?.id && other.id !== state.origin?.id) {
          return out({ ...state, candidate: other }, [`${withRo(label(other))} 가시는 거 맞으세요?`])
        }
        return out({ ...state, stage: 'askDestination', candidate: undefined }, ['그럼 가시는 곳을 다시 알려주세요.'])
      }
      return out(state, [YES_NO_HELP])
    }

    case 'finalApproval': {
      const yn = parseYesNo(text)
      if (yn === 'yes') return dispatch({ ...state, approved: true })
      if (yn === 'no') {
        return out({ ...state, stage: 'cancelled', approved: false }, [
          "택시를 부르지 않았어요. 처음부터 다시 하시려면 '다시'라고 말씀해 주세요.",
        ])
      }
      return out(state, ["택시를 부르시려면 '네', 그만두시려면 '아니요'라고 말씀해 주세요."])
    }

    case 'dispatching':
      // 이미 요청을 보냈다. 같은 말을 반복해도 새 요청을 만들지 않는다.
      return out(state, ['택시를 찾고 있어요. 조금만 더 기다려 주세요.'])

    case 'dispatched': {
      const yn = parseYesNo(text)
      if (yn === 'yes' && state.result?.status === 'assigned') {
        return out({ ...state, stage: 'closed' }, [`차 번호는 ${speakPlate(state.result.plate)}이에요.`, GOODBYE])
      }
      return out({ ...state, stage: 'closed' }, [GOODBYE])
    }

    case 'noTaxi': {
      const yn = parseYesNo(text)
      if (yn === 'yes') return dispatch(state)
      return out({ ...state, stage: 'closed' }, ['택시를 부르지 않았어요. 필요하시면 114로 다시 전화 주세요.'])
    }

    case 'cancelled':
    case 'closed':
      if (isRestart(text)) return reduce(state, { type: 'start' })
      return out(state, ["새로 부르시려면 '다시'라고 말씀해 주세요."])
  }
}

/** 화면에 보여줄 단계 이름 */
export const STAGE_LABEL: Record<Stage, string> = {
  idle: '대기',
  askIntent: '용건 확인',
  askOrigin: '출발지 묻는 중',
  confirmOrigin: '출발지 확인 대기',
  askDestination: '목적지 묻는 중',
  confirmDestination: '목적지 확인 대기',
  finalApproval: '최종 승인 대기',
  dispatching: '호출 중',
  dispatched: '배차 완료',
  noTaxi: '배차 안 됨',
  cancelled: '취소됨',
  closed: '통화 종료',
}
