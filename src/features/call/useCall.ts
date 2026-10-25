// 통화 컨트롤러: 대화 엔진 + 음성(STT·TTS) + 업무 자동화(Worker)를 하나의 흐름으로 묶는다.
//   AI가 말한다(TTS) → 끝나면 듣는다(STT) → 인식한 문장을 대화 엔진에 넣는다 → 다시 말한다
// 호출은 대화 엔진이 requestDispatch 효과를 낼 때만 시작한다(최종 승인 뒤).
import { useCallback, useEffect, useRef, useState } from 'react'
import { createInitialState, reduce, type DialogEvent, type DialogState, type DispatchResult, type Effect } from '../dialog/machine'
import { cancelCall, createCall, randomId, waitForAssignment } from '../../lib/dispatch-client'
import { LISTEN_ERROR_TEXT, listenOnce, speak, startMicMeter, stopSpeaking, sttSupported, ttsSupported, VOICE_NORMAL, VOICE_SLOW, type ListenError, type VoiceSettings } from '../../lib/speech'
import { runWorker, WorkerUnavailable } from '../../lib/worker-client'
import type { WorkerEvent } from '../../../server/worker-core'
import { DEMO_SCRIPT, loadRecording, type Recording } from './demo'

export type Phase = 'off' | 'speaking' | 'listening' | 'thinking' | 'waiting' | 'paused'

export interface Turn {
  id: number
  speaker: 'agent' | 'caller' | 'system'
  text: string
  note?: string
}

export interface WorkerStep {
  t: number
  action: string
  detail?: string
}

export interface WorkerView {
  mode: 'idle' | 'live' | 'recording' | 'api_fallback'
  action: 'dispatch' | 'cancel'
  status: 'idle' | 'running' | 'done' | 'failed'
  frame?: string
  frames: number
  steps: WorkerStep[]
  result?: DispatchResult | { status: 'cancelled' }
  reason?: string
  recording?: Recording
  startedAt?: number
}

const IDLE_WORKER: WorkerView = { mode: 'idle', action: 'dispatch', status: 'idle', frames: 0, steps: [] }
const TERMINAL = ['closed', 'cancelled', 'handoff']

export function useCall(mode: 'live' | 'demo') {
  const [state, setState] = useState<DialogState>(createInitialState)
  const [turns, setTurns] = useState<Turn[]>([])
  const [phase, setPhase] = useState<Phase>('off')
  const [interim, setInterim] = useState('')
  const [level, setLevel] = useState(0)
  const [settings, setSettings] = useState<VoiceSettings>(VOICE_NORMAL)
  const [voiceOn, setVoiceOn] = useState(mode === 'live')
  const [textOnly, setTextOnly] = useState(!sttSupported())
  const [notice, setNotice] = useState<string | null>(null)
  const [worker, setWorker] = useState<WorkerView>(IDLE_WORKER)
  const [demoPaused, setDemoPaused] = useState(false)

  const stateRef = useRef(state)
  const settingsRef = useRef(settings)
  const voiceRef = useRef(voiceOn)
  const textOnlyRef = useRef(textOnly)
  const token = useRef(0)
  const active = useRef(false)
  const ending = useRef(false)
  const silences = useRef(0)
  const cancelListen = useRef<() => void>(() => {})
  const stopMeter = useRef<() => void>(() => {})
  const inflight = useRef(new Set<string>())
  const sessionId = useRef('')
  const demoIndex = useRef(0)
  const demoPausedRef = useRef(false)
  const turnId = useRef(0)
  const workerRef = useRef(worker)
  workerRef.current = worker
  stateRef.current = state
  settingsRef.current = settings
  voiceRef.current = voiceOn
  textOnlyRef.current = textOnly
  demoPausedRef.current = demoPaused

  const addTurn = useCallback((t: Omit<Turn, 'id'>) => setTurns((ts) => [...ts, { ...t, id: ++turnId.current }]), [])

  const stopAll = useCallback(() => {
    token.current++
    stopSpeaking()
    cancelListen.current()
    setInterim('')
  }, [])

  // ---------- 듣기 ----------
  const listen = useCallback(() => {
    if (!active.current || mode === 'demo') return
    if (textOnlyRef.current) {
      setPhase('paused')
      return
    }
    const my = ++token.current
    setPhase('listening')
    setInterim('')
    const { promise, cancel } = listenOnce((t) => token.current === my && setInterim(t))
    cancelListen.current = cancel
    promise
      .then((text) => {
        if (token.current !== my) return
        silences.current = 0
        setInterim('')
        onCaller(text, 'stt')
      })
      .catch((err: ListenError) => {
        if (token.current !== my) return
        setInterim('')
        if (err === 'aborted') return
        if (err === 'no-speech') {
          silences.current++
          if (silences.current <= 2) {
            apply({ type: 'silence' })
          } else {
            setPhase('paused')
            setNotice('말씀이 들리지 않아서 듣기를 멈췄어요. 마이크 버튼을 누르고 말씀하시거나, 아래에 글로 입력해 주세요.')
          }
          return
        }
        setNotice(LISTEN_ERROR_TEXT[err] ?? LISTEN_ERROR_TEXT.other)
        if (err === 'not-allowed' || err === 'unsupported' || err === 'network') setTextOnly(true)
        setPhase('paused')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // ---------- 말하기 → 다음 행동 ----------
  const speakThen = useCallback(
    async (lines: string[], after: () => void) => {
      const my = ++token.current
      if (lines.length) setPhase('speaking')
      for (const line of lines) {
        if (token.current !== my) return
        if (voiceRef.current && ttsSupported()) {
          await speak(line, settingsRef.current, 'agent')
          await new Promise((r) => setTimeout(r, settingsRef.current.rate < 0.85 ? 380 : 220))
        } else {
          await new Promise((r) => setTimeout(r, 350 + line.length * 18))
        }
      }
      if (token.current !== my) return
      after()
    },
    [],
  )

  const nextAfterSpeech = useCallback(() => {
    if (!active.current) return
    const st = stateRef.current
    if (ending.current || TERMINAL.includes(st.stage)) {
      active.current = false
      ending.current = false
      setPhase('off')
      stopMeter.current()
      setLevel(0)
      return
    }
    if (st.stage === 'dispatching' || st.stage === 'cancelling') {
      setPhase('waiting')
      return
    }
    if (mode === 'demo') {
      void demoCallerTurn()
      return
    }
    listen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, listen])

  // ---------- 대화 엔진 ----------
  const apply = useCallback(
    (event: DialogEvent) => {
      const prev = stateRef.current
      const o = reduce(prev, event)
      stateRef.current = o.state
      setState(o.state)
      if (o.state.stage === 'soundCheck' && prev.stage !== 'soundCheck' && prev.stage !== 'idle') {
        sessionId.current = randomId('sess')
        inflight.current.clear()
      }
      o.say.forEach((text) => addTurn({ speaker: 'agent', text }))
      o.effects.forEach(runEffect)
      void speakThen(o.say, nextAfterSpeech)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addTurn, speakThen, nextAfterSpeech],
  )

  const onCaller = useCallback(
    (text: string, via: 'stt' | 'input' | 'demo') => {
      const v = text.trim()
      if (!v) return
      addTurn({ speaker: 'caller', text: v, note: via === 'stt' ? '음성 인식' : via === 'demo' ? '합성 고객 음성' : '글로 입력' })
      setPhase('thinking')
      apply({ type: 'utterance', text: v })
    },
    [addTurn, apply],
  )

  // ---------- 효과 ----------
  function runEffect(effect: Effect) {
    if (effect.type === 'voice') {
      setSettings((s) => ({ rate: effect.slower ? VOICE_SLOW.rate : s.rate, volume: effect.louder ? 1 : s.volume }))
      settingsRef.current = { rate: effect.slower ? VOICE_SLOW.rate : settingsRef.current.rate, volume: effect.louder ? 1 : settingsRef.current.volume }
      return
    }
    if (effect.type === 'endCall') {
      ending.current = true
      return
    }
    if (effect.type === 'requestDispatch') {
      const key = `${sessionId.current}-a${effect.attempt}`
      if (inflight.current.has(key)) return
      inflight.current.add(key)
      void dispatchJob(effect.origin.id, effect.destination.id, key)
      return
    }
    if (effect.type === 'requestCancel') {
      void cancelJob(effect.requestId)
    }
  }

  const onWorkerEvent = (e: WorkerEvent) => {
    if (e.type === 'frame') setWorker((w) => ({ ...w, frame: e.data, frames: w.frames + 1 }))
    else if (e.type === 'step') setWorker((w) => ({ ...w, steps: [...w.steps, { t: e.t, action: e.action, detail: e.detail }] }))
  }

  async function dispatchJob(originId: string, destinationId: string, key: string) {
    if (mode === 'demo') {
      const rec = await loadRecording()
      setWorker({ ...IDLE_WORKER, mode: 'recording', action: 'dispatch', status: 'running', recording: rec, startedAt: Date.now() })
      // 녹화 길이만큼 기다린다 (화면은 OperatorPanel이 영상과 단계로 보여준다)
      await new Promise((r) => setTimeout(r, Math.min(rec.durationMs, 14_000)))
      const result: DispatchResult = rec.result
      setWorker((w) => ({ ...w, status: 'done', result }))
      apply({ type: 'dispatchResult', result })
      return
    }

    setWorker({ ...IDLE_WORKER, mode: 'live', action: 'dispatch', status: 'running', startedAt: Date.now() })
    try {
      const r = await runWorker({ action: 'dispatch', originId, destinationId, approved: stateRef.current.approved }, onWorkerEvent)
      if (r.status === 'assigned' && r.plate) {
        const result: DispatchResult = { status: 'assigned', requestId: r.requestId ?? '', plate: r.plate, etaMinutes: r.etaMinutes ?? 5, color: r.color ?? '', model: r.model ?? '', driverName: r.driverName }
        setWorker((w) => ({ ...w, status: 'done', result }))
        apply({ type: 'dispatchResult', result })
      } else if (r.status === 'no_taxi') {
        const result: DispatchResult = { status: 'no_taxi', requestId: r.requestId ?? '' }
        setWorker((w) => ({ ...w, status: 'done', result }))
        apply({ type: 'dispatchResult', result })
      } else {
        setWorker((w) => ({ ...w, status: 'failed', reason: '업무 화면 조작에 실패했어요' }))
        apply({ type: 'dispatchFailed', reason: 'worker_failed' })
      }
    } catch (e) {
      // 실시간 Worker를 못 쓰면 API로 직접 호출한다. Playwright 조작이 없다는 것을 화면에 밝힌다.
      const reason = e instanceof WorkerUnavailable ? e.message : '실시간 Worker에 연결하지 못했어요.'
      setWorker((w) => ({ ...w, mode: 'api_fallback', status: 'running', reason }))
      try {
        const created = await createCall({ sessionId: sessionId.current, idempotencyKey: key, originId, destinationId, approved: stateRef.current.approved })
        setWorker((w) => ({ ...w, steps: [...w.steps, { t: Date.now() - (w.startedAt ?? Date.now()), action: 'API로 호출 접수', detail: created.source === 'server' ? '배차 서버' : '브라우저 내 Mock' }] }))
        const s = await waitForAssignment(created.data.requestId)
        const result: DispatchResult =
          s.status === 'assigned'
            ? { status: 'assigned', requestId: s.requestId, plate: s.plate!, etaMinutes: s.etaMinutes!, color: s.color!, model: s.model!, driverName: s.driverName }
            : { status: 'no_taxi', requestId: s.requestId }
        setWorker((w) => ({ ...w, status: 'done', result }))
        apply({ type: 'dispatchResult', result })
      } catch (err) {
        setWorker((w) => ({ ...w, status: 'failed', reason: (err as Error).message }))
        apply({ type: 'dispatchFailed', reason: (err as Error).message })
      }
    }
  }

  async function cancelJob(requestId: string) {
    if (mode === 'demo' || !requestId) {
      apply({ type: 'cancelResult', ok: true })
      return
    }
    setWorker((w) => ({ ...w, mode: w.mode === 'api_fallback' ? 'api_fallback' : 'live', action: 'cancel', status: 'running', steps: [], frames: 0, startedAt: Date.now() }))
    try {
      if (workerRef.current.mode === 'api_fallback' || requestId.startsWith('L~')) throw new WorkerUnavailable('fallback', 'API로 취소')
      const r = await runWorker({ action: 'cancel', requestId, approved: true }, onWorkerEvent)
      setWorker((w) => ({ ...w, status: 'done', result: { status: 'cancelled' } }))
      apply({ type: 'cancelResult', ok: r.status === 'cancelled' })
    } catch {
      try {
        await cancelCall(requestId)
        setWorker((w) => ({ ...w, mode: 'api_fallback', status: 'done', result: { status: 'cancelled' } }))
        apply({ type: 'cancelResult', ok: true })
      } catch {
        apply({ type: 'cancelResult', ok: false })
      }
    }
  }

  // ---------- 자동 시연: 합성 고객 발화 ----------
  async function demoCallerTurn() {
    const line = DEMO_SCRIPT[demoIndex.current]
    if (!line || !active.current) return
    await new Promise((r) => setTimeout(r, 650))
    while (demoPausedRef.current && active.current) await new Promise((r) => setTimeout(r, 200))
    if (!active.current) return
    demoIndex.current++
    setPhase('listening')
    if (voiceRef.current && ttsSupported()) await speak(line, settingsRef.current, 'caller')
    else await new Promise((r) => setTimeout(r, 500 + line.length * 40))
    if (!active.current) return
    onCaller(line, 'demo')
  }

  // ---------- 통화 시작·종료 ----------
  const start = useCallback(async () => {
    stopAll()
    stopMeter.current()
    active.current = true
    ending.current = false
    silences.current = 0
    demoIndex.current = 0
    setDemoPaused(false)
    sessionId.current = randomId('sess')
    inflight.current.clear()
    setTurns([])
    setNotice(null)
    setWorker(IDLE_WORKER)
    setSettings(VOICE_NORMAL)
    settingsRef.current = VOICE_NORMAL
    stateRef.current = createInitialState()
    if (mode === 'live' && !textOnlyRef.current) {
      try {
        stopMeter.current = await startMicMeter(setLevel)
      } catch {
        setTextOnly(true)
        textOnlyRef.current = true
        setNotice(LISTEN_ERROR_TEXT['not-allowed'])
      }
    }
    // 첫 클릭으로 음성 합성을 깨운다 (브라우저 자동재생 정책)
    if (voiceRef.current && ttsSupported()) window.speechSynthesis.resume()
    apply({ type: 'start' })
  }, [apply, mode, stopAll])

  const end = useCallback(() => {
    active.current = false
    stopAll()
    stopMeter.current()
    setLevel(0)
    setPhase('off')
    addTurn({ speaker: 'system', text: '통화를 끊었어요' })
  }, [addTurn, stopAll])

  useEffect(() => () => {
    active.current = false
    stopAll()
    stopMeter.current()
  }, [stopAll])

  const sendText = useCallback(
    (text: string) => {
      if (!active.current) return
      stopAll()
      onCaller(text, 'input')
    },
    [onCaller, stopAll],
  )

  /** 마이크 버튼: 말하는 중이면 끊고 듣기, 듣는 중이면 멈춤, 멈춰 있으면 듣기 */
  const micTap = useCallback(() => {
    if (!active.current) return
    if (phase === 'listening') {
      stopAll()
      setPhase('paused')
      return
    }
    if (textOnlyRef.current && sttSupported()) {
      setTextOnly(false)
      textOnlyRef.current = false
    }
    stopAll()
    setNotice(null)
    silences.current = 0
    listen()
  }, [listen, phase, stopAll])

  /** 다시 듣기: 직전 안내를 천천히 다시 읽는다 */
  const replay = useCallback(() => {
    const lines = stateRef.current.lastSay
    if (!lines.length) return
    stopAll()
    const prevRate = settingsRef.current.rate
    settingsRef.current = { ...settingsRef.current, rate: Math.min(prevRate, VOICE_SLOW.rate) }
    void speakThen(lines, () => {
      settingsRef.current = { ...settingsRef.current, rate: prevRate }
      nextAfterSpeech()
    })
  }, [nextAfterSpeech, speakThen, stopAll])

  /** 소리 확인: 짧은 문장을 읽어 준다 */
  const soundTest = useCallback(async () => {
    stopSpeaking()
    await speak('소리 확인이에요. 이 목소리가 잘 들리세요?', settingsRef.current)
  }, [])

  const setSlow = useCallback((slow: boolean) => {
    const next = { ...settingsRef.current, rate: slow ? VOICE_SLOW.rate : VOICE_NORMAL.rate }
    settingsRef.current = next
    setSettings(next)
  }, [])

  const setVolume = useCallback((volume: number) => {
    const next = { ...settingsRef.current, volume }
    settingsRef.current = next
    setSettings(next)
  }, [])

  return {
    state,
    turns,
    phase,
    interim,
    level,
    settings,
    voiceOn,
    textOnly,
    notice,
    worker,
    demoPaused,
    active: phase !== 'off',
    start,
    end,
    sendText,
    micTap,
    replay,
    soundTest,
    setSlow,
    setVolume,
    setVoiceOn: (v: boolean) => {
      setVoiceOn(v)
      voiceRef.current = v
      if (!v) stopSpeaking()
    },
    setDemoPaused,
    dismissNotice: () => setNotice(null),
    /** 음성 입력 켜기·끄기. 끄면 글로만 대화한다. */
    setVoiceInput: (on: boolean) => {
      const textOnlyNext = !on || !sttSupported()
      setTextOnly(textOnlyNext)
      textOnlyRef.current = textOnlyNext
      if (textOnlyNext) {
        if (phase === 'listening') {
          stopAll()
          setPhase('paused')
        }
      } else if (active.current && (phase === 'paused' || phase === 'off')) {
        listen()
      }
    },
  }
}
