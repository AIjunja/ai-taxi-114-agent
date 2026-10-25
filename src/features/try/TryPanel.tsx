import { useEffect, useRef, useState, type FormEvent } from 'react'
import * as Switch from '@radix-ui/react-switch'
import { Mic, MicOff, PhoneCall, PhoneOff, Send } from 'lucide-react'
import { CallCard, type CallStatus, type Turn } from '../../components/CallCard'
import { Badge, Button, Panel } from '../../components/ui'
import { randomId, requestDispatch } from '../../lib/dispatch-client'
import { sessionStore } from '../../lib/session-store'
import { LISTEN_ERROR_TEXT, listenOnce, speak, stopSpeaking, sttSupported, ttsSupported, type ListenError } from '../../lib/speech'
import { createInitialState, reduce, STAGE_LABEL, type DialogEvent, type DialogState, type Effect } from '../dialog/machine'
import { PLACES } from '../dialog/places'

const QUICK_PLACES = ['서울역', '세브란스병원', '김포공항', '서울아산병원']

function callStatus(state: DialogState, listening: boolean, speaking: boolean, error: boolean): CallStatus {
  if (error) return '오류'
  if (listening) return '듣는 중'
  if (state.stage === 'idle') return '대기'
  if (state.stage === 'dispatching') return '호출 중'
  if (['dispatched', 'closed', 'cancelled'].includes(state.stage)) return '완료'
  if (speaking) return '말하는 중'
  return '확인 대기'
}

export function TryPanel() {
  const [state, setState] = useState<DialogState>(createInitialState)
  const [turns, setTurns] = useState<Turn[]>([])
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [voiceOn, setVoiceOn] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [micBlocked, setMicBlocked] = useState(!sttSupported())
  const stateRef = useRef(state)
  const inflight = useRef<Set<string>>(new Set())
  const cancelListen = useRef<() => void>(() => {})
  const sessionId = useRef<string>('')
  stateRef.current = state

  useEffect(() => () => {
    stopSpeaking()
    cancelListen.current()
  }, [])

  async function say(lines: string[]) {
    setTurns((t) => [...t, ...lines.map((text) => ({ speaker: 'agent' as const, text }))])
    lines.forEach((l) => sessionStore.log('agent', l))
    if (voiceOn) {
      setSpeaking(true)
      for (const l of lines) await speak(l)
      setSpeaking(false)
    }
  }

  function apply(event: DialogEvent) {
    const prev = stateRef.current
    const o = reduce(prev, event)
    if (o.state.stage === 'askIntent' && (prev.stage === 'closed' || prev.stage === 'cancelled')) {
      // '다시'로 새 통화를 시작하면 새 세션 키를 쓴다.
      sessionId.current = randomId('sess')
      inflight.current.clear()
      sessionStore.reset(sessionId.current)
    }
    stateRef.current = o.state
    setState(o.state)
    sessionStore.set({ state: o.state })
    if (o.state.stage !== prev.stage) sessionStore.log('state', `${STAGE_LABEL[prev.stage]} → ${STAGE_LABEL[o.state.stage]}`)
    if (o.state.approved && !prev.approved) sessionStore.log('approval', '고객이 최종 승인했어요')
    void say(o.say)
    o.effects.forEach(runEffect)
  }

  async function runEffect(effect: Effect) {
    const key = `${sessionId.current}-a${effect.attempt}`
    // 같은 시도 번호로는 한 번만 요청한다 (화면 중복 클릭·재렌더 방지).
    if (inflight.current.has(key)) {
      sessionStore.log('guard', `중복 요청을 막았어요 (${effect.attempt}번째 시도)`)
      return
    }
    inflight.current.add(key)
    sessionStore.set({ pending: true })
    sessionStore.log('api', `POST /api/dispatch 요청 · ${effect.origin.name} → ${effect.destination.name} · 승인 true`)
    try {
      const outcome = await requestDispatch({
        sessionId: sessionId.current,
        idempotencyKey: key,
        originId: effect.origin.id,
        destinationId: effect.destination.id,
        approved: stateRef.current.approved,
      })
      sessionStore.set({ lastDispatch: outcome, pending: false })
      if (outcome.source === 'local_fallback') {
        sessionStore.log('error', `${outcome.fallbackReason} → 브라우저 내 Mock으로 계속했어요`)
        setNotice('배차 서버에 연결하지 못해서 브라우저 안의 Mock으로 계속했어요. 결과는 똑같이 가상이에요.')
      }
      sessionStore.log('api', `응답 ${outcome.httpStatus ?? '로컬'} · ${outcome.result.status} · ${outcome.latencyMs}ms`)
      setTurns((t) => [...t, { speaker: 'system', text: `Mock 배차 ${outcome.result.status === 'assigned' ? '배정됨' : '빈 차 없음'} · ${outcome.source === 'server' ? '서버' : '브라우저 내 Mock'} · ${outcome.latencyMs}ms` }])
      apply({ type: 'dispatchResult', result: outcome.result })
    } catch (e) {
      sessionStore.set({ pending: false })
      sessionStore.log('error', (e as Error).message)
      apply({ type: 'dispatchFailed', reason: (e as Error).message })
    }
  }

  function start() {
    stopSpeaking()
    sessionId.current = randomId('sess')
    inflight.current.clear()
    sessionStore.reset(sessionId.current)
    sessionStore.log('state', '체험 통화를 시작했어요')
    setTurns([])
    setNotice(null)
    stateRef.current = createInitialState()
    apply({ type: 'start' })
  }

  function end() {
    stopSpeaking()
    cancelListen.current()
    setListening(false)
    setState(createInitialState())
    stateRef.current = createInitialState()
    setTurns((t) => [...t, { speaker: 'system', text: '통화를 끊었어요' }])
    sessionStore.log('state', '통화를 끊었어요')
  }

  function send(value: string, via: 'stt' | 'input') {
    const v = value.trim()
    if (!v || stateRef.current.stage === 'idle') return
    setTurns((t) => [...t, { speaker: 'caller', text: v, note: via === 'stt' ? '음성 인식 결과' : '글로 입력' }])
    sessionStore.log(via, v)
    apply({ type: 'utterance', text: v })
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    send(text, 'input')
    setText('')
  }

  async function onMic() {
    if (listening) {
      cancelListen.current()
      setListening(false)
      return
    }
    stopSpeaking()
    setNotice(null)
    const { promise, cancel } = listenOnce()
    cancelListen.current = cancel
    setListening(true)
    try {
      const heard = await promise
      send(heard, 'stt')
    } catch (err) {
      const code = (typeof err === 'string' ? err : 'other') as ListenError
      if (code !== 'aborted') setNotice(LISTEN_ERROR_TEXT[code])
      if (code === 'not-allowed' || code === 'unsupported') setMicBlocked(true)
      sessionStore.log('error', `음성 인식 실패: ${code}`)
    } finally {
      setListening(false)
    }
  }

  const live = state.stage !== 'idle'
  const ended = ['closed', 'cancelled'].includes(state.stage)
  const atApproval = state.stage === 'finalApproval'
  const atConfirm = ['askIntent', 'confirmOrigin', 'confirmDestination', 'dispatched', 'noTaxi'].includes(state.stage)

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]" data-testid="try-panel">
      <CallCard
        title="직접 체험 · 내 통화"
        status={callStatus(state, listening, speaking, false)}
        turns={turns}
        badge={<Badge tag="실시간" />}
        minHeight={320}
        footer={
          !live ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" size="lg" onClick={start} data-testid="try-start">
                <PhoneCall size={18} /> {ended || turns.length ? '다시 전화 걸기' : '체험 전화 걸기'}
              </Button>
              <p className="text-sm text-muted">마이크가 없어도 글로 체험할 수 있어요.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {atApproval && (
                <div className="rounded-lg border border-warn/40 bg-warn-soft p-3" data-testid="approval-box">
                  <p className="text-sm font-bold text-warn">최종 승인이 필요해요</p>
                  <p className="mt-0.5 text-sm">
                    {state.origin?.name} → {state.destination?.name}. 승인하면 가상 배차를 요청해요.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button variant="primary" onClick={() => send('네', 'input')} data-testid="approve">
                      택시 부르기
                    </Button>
                    <Button onClick={() => send('아니요', 'input')} data-testid="reject">
                      부르지 않기
                    </Button>
                  </div>
                </div>
              )}
              {!atApproval && !ended && (
                <div className="flex flex-wrap gap-1.5" aria-label="빠른 답변">
                  {(atConfirm ? ['네', '아니요'] : QUICK_PLACES).map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q, 'input')}
                      className="rounded-full border border-line bg-surface px-3 py-1 text-sm hover:bg-bg"
                      disabled={state.stage === 'dispatching'}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
              <form onSubmit={onSubmit} className="flex gap-2">
                <Button
                  type="button"
                  variant={listening ? 'primary' : 'secondary'}
                  onClick={onMic}
                  disabled={micBlocked || ended}
                  aria-label={listening ? '듣기 멈추기' : '말하기'}
                  data-testid="mic"
                  className="shrink-0 px-3"
                >
                  {micBlocked ? <MicOff size={18} /> : <Mic size={18} />}
                  <span className="hidden sm:inline">{listening ? '듣는 중' : '말하기'}</span>
                </Button>
                <label className="sr-only" htmlFor="try-input">
                  고객으로 말할 내용
                </label>
                <input
                  id="try-input"
                  data-testid="try-input"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={ended ? "'다시'라고 입력하면 새로 시작해요" : '예: 서울역이요'}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-base outline-none focus:border-accent"
                  autoComplete="off"
                  maxLength={80}
                />
                <Button type="submit" variant="primary" className="shrink-0 px-3" aria-label="보내기" data-testid="try-send">
                  <Send size={16} />
                </Button>
                <Button type="button" variant="danger" className="shrink-0 px-3" onClick={end} aria-label="통화 끊기">
                  <PhoneOff size={16} />
                </Button>
              </form>
              {notice && (
                <p role="alert" className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn" data-testid="try-notice">
                  {notice}
                </p>
              )}
            </div>
          )
        }
      />

      <div className="flex flex-col gap-3">
        <Panel className="p-4">
          <p className="text-sm font-bold">지금 상태</p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">단계</dt>
              <dd data-testid="try-stage" className="font-semibold">{STAGE_LABEL[state.stage]}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">출발지</dt>
              <dd>{state.origin?.name ?? '-'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">목적지</dt>
              <dd>{state.destination?.name ?? '-'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">최종 승인</dt>
              <dd data-testid="try-approved" className={state.approved ? 'font-semibold text-accent' : ''}>
                {state.approved ? '승인함' : '아직 안 함'}
              </dd>
            </div>
          </dl>
          {ttsSupported() && (
            <label className="mt-3 flex cursor-pointer items-center gap-2 border-t border-line pt-3 text-sm font-medium">
              <Switch.Root
                checked={voiceOn}
                onCheckedChange={(v) => {
                  setVoiceOn(v)
                  if (!v) stopSpeaking()
                }}
                className="relative h-6 w-10 shrink-0 rounded-full bg-line transition-colors data-[state=checked]:bg-accent"
                aria-label="AI 답변을 소리로 듣기"
              >
                <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
              </Switch.Root>
              AI 답변을 소리로 듣기
            </label>
          )}
        </Panel>

        <Panel className="p-4 text-sm">
          <p className="font-bold">체험 전에 알아두세요</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-muted">
            <li>모든 배차는 가상이에요. 실제 택시를 부르지 않아요.</li>
            <li>현재 위치(GPS)는 쓰지 않아요. 타는 곳을 직접 말해 주세요.</li>
            <li>음성 인식은 브라우저 기능을 써요. Chrome·Edge는 인식을 위해 음성을 브라우저 회사 서버로 보낼 수 있어요.</li>
            <li>이 사이트는 음성과 대화를 저장하지 않아요. 서버에는 가상 장소 ID만 보내요.</li>
          </ul>
          <details className="mt-3">
            <summary className="cursor-pointer font-semibold text-accent">알아듣는 장소 {PLACES.length}곳 보기</summary>
            <p className="mt-2 leading-relaxed text-muted">{PLACES.map((p) => p.name).join(', ')}</p>
          </details>
        </Panel>
      </div>
    </div>
  )
}
