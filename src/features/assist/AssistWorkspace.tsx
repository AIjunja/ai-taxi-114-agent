// 상담원 보조 화면 (기본 시나리오).
// 고객이 한 말 → AI가 출발지·목적지를 정리(제안) → 상담원이 확인·수정 → 고객 최종 확인 → Playwright가 콘솔에 입력·호출
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AlertTriangle, Check, Mic, Pause, Play, RotateCcw, Send, Sparkles, UserCheck, Volume2, VolumeX } from 'lucide-react'
import { OperatorPanel, type OrderView } from '../call/OperatorPanel'
import { PLACES, findPlace, type Place } from '../dialog/places'
import { speakPlate, withRo } from '../dialog/speech-format'
import type { DispatchResult } from '../dialog/machine'
import { LISTEN_ERROR_TEXT, listenOnce, sttSupported, type ListenError } from '../../lib/speech'
import { extract, type Slot } from './extract'
import { SAMPLE_CALLS } from './samples'
import { useWorkerJob } from './useWorkerJob'
import { clipText, DemoAudio } from './demoAudio'

interface Choice {
  place: Place | null
  confirmed: boolean
  /** 상담원이 AI 제안을 바꿨는지 */
  edited: boolean
}

const EMPTY: Choice = { place: null, confirmed: false, edited: false }

function statusText(slot: Slot) {
  if (slot.status === 'found') return { text: 'AI 제안', cls: 'bg-info-soft text-info' }
  if (slot.status === 'ambiguous') return { text: `후보 ${slot.places.length}곳`, cls: 'bg-warn-soft text-warn' }
  return { text: '모름 · 직접 입력', cls: 'bg-danger-soft text-danger' }
}

function SlotCard({
  kind,
  slot,
  choice,
  onPick,
  onConfirm,
  disabled,
}: {
  kind: 'origin' | 'destination'
  slot: Slot
  choice: Choice
  onPick: (p: Place | null, edited: boolean) => void
  onConfirm: () => void
  disabled: boolean
}) {
  const label = kind === 'origin' ? '출발지' : '목적지'
  const s = statusText(slot)
  return (
    <div className={`rounded-xl border p-3 ${choice.confirmed ? 'border-accent/50 bg-accent-soft/40' : 'border-line bg-surface'}`} data-testid={`slot-${kind}`} data-status={choice.confirmed ? 'confirmed' : slot.status}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-bold">
          <span className={`h-2 w-2 rounded-full ${kind === 'origin' ? 'bg-accent' : 'bg-danger'}`} /> {label}
        </p>
        {choice.confirmed ? (
          <span className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">
            <UserCheck size={11} /> 상담원 확인{choice.edited ? ' · 수정함' : ''}
          </span>
        ) : (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s.cls}`}>{s.text}</span>
        )}
      </div>

      <p className="mt-2 font-display text-lg font-bold" data-testid={`slot-${kind}-value`}>
        {choice.place ? choice.place.name : <span className="text-muted">아직 없어요</span>}
      </p>
      {slot.utterance !== undefined && !choice.edited && (
        <p className="text-xs text-muted">
          근거: {slot.utterance + 1}번째 말 · {slot.reason}
        </p>
      )}

      {!choice.confirmed && slot.status === 'ambiguous' && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {slot.places.map((p) => (
            <button key={p.id} type="button" disabled={disabled} onClick={() => onPick(p, false)} data-testid={`pick-${kind}-${p.id}`} className={`rounded-full border px-3 py-1 text-sm ${choice.place?.id === p.id ? 'border-ink bg-ink text-white' : 'border-line hover:bg-bg'}`}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      {!choice.confirmed && (
        <div className="mt-2 flex gap-2">
          <select
            aria-label={`${label} 직접 고르기`}
            data-testid={`select-${kind}`}
            disabled={disabled}
            value={choice.place?.id ?? ''}
            onChange={(e) => onPick(findPlace(e.target.value) ?? null, true)}
            className="h-9 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-sm"
          >
            <option value="">{slot.status === 'missing' ? '직접 고르기' : '다른 곳으로 바꾸기'}</option>
            {PLACES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.area})
              </option>
            ))}
          </select>
          <button type="button" onClick={onConfirm} disabled={!choice.place || disabled} data-testid={`confirm-${kind}`} className="h-9 shrink-0 rounded-md bg-ink px-3 text-sm font-bold text-white disabled:opacity-35">
            확인
          </button>
        </div>
      )}
    </div>
  )
}

export function AssistWorkspace({ autoDemo = false }: { autoDemo?: boolean }) {
  const [utterances, setUtterances] = useState<string[]>([])
  const [sampleId, setSampleId] = useState<string | null>(null)
  const [pendingLines, setPendingLines] = useState<string[]>([])
  const [text, setText] = useState('')
  const [origin, setOrigin] = useState<Choice>(EMPTY)
  const [destination, setDestination] = useState<Choice>(EMPTY)
  const [approved, setApproved] = useState(false)
  const [result, setResult] = useState<DispatchResult | null>(null)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [sttError, setSttError] = useState<string | null>(null)
  const [actions, setActions] = useState(0)
  const cancelListen = useRef<() => void>(() => {})
  const job = useWorkerJob()

  const ex = useMemo(() => extract(utterances), [utterances])

  // ---------- 자동 시연 ----------
  const [demo, setDemo] = useState<'ready' | 'running' | 'paused' | 'done'>('ready')
  const [caption, setCaption] = useState<{ who: '상담원' | '고객'; text: string } | null>(null)
  const [muted, setMuted] = useState(false)
  const player = useRef<DemoAudio | null>(null)
  useEffect(() => () => player.current?.stop(), [])

  async function runDemo() {
    player.current?.stop()
    const p = new DemoAudio()
    p.muted = muted
    player.current = p
    reset()
    setSampleId(null)
    setDemo('running')
    const say = async (id: string, utter = false) => {
      const who = id.startsWith('u') ? '고객' : '상담원'
      setCaption({ who, text: clipText(id) })
      if (utter) setUtterances((u) => [...u, clipText(id).replace(/\.$/, '')])
      const ok = await p.play(id)
      return ok && (await p.wait(250))
    }
    const step = (ms: number) => p.wait(ms)
    if (!(await step(600))) return
    if (!(await say('c1'))) return
    if (!(await say('u1', true))) return
    if (!(await say('u2', true))) return
    setCaption({ who: '상담원', text: 'AI가 출발지는 서울역, 목적지는 후보 2곳으로 정리했어요.' })
    if (!(await step(1800))) return
    if (!(await say('c2'))) return
    if (!(await say('u3', true))) return
    const sev = findPlace('severance')!
    setDestination({ place: sev, confirmed: false, edited: false })
    setCaption({ who: '상담원', text: '후보에서 신촌세브란스병원을 고르고 두 곳을 확인해요.' })
    if (!(await step(900))) return
    setOrigin((c) => ({ ...c, place: c.place ?? findPlace('seoul-station')!, confirmed: true }))
    if (!(await step(700))) return
    setDestination((c) => ({ ...c, confirmed: true }))
    if (!(await step(800))) return
    if (!(await say('c3'))) return
    if (!(await say('u4', true))) return
    setApproved(true)
    if (!(await step(500))) return
    setCaption({ who: '상담원', text: '승인을 받았어요. Playwright가 호출 콘솔에 입력해요.' })
    const dispatched = job.dispatch('seoul-station', 'severance', true)
    if (!(await say('c4'))) return
    const r = await dispatched
    setResult(r)
    if (!(await p.gate())) return
    if (r?.status === 'assigned') {
      if (!(await say('r_ok'))) return
      if (!(await say(`eta${Math.min(9, Math.max(1, r.etaMinutes))}`))) return
      setCaption({ who: '상담원', text: `차 번호는 ${r.plate}이에요.` })
      await p.play('r_plate')
      const m = r.plate.replace(/\s/g, '').match(/^(\d+)([가-힣])(\d+)$/)
      if (m) {
        for (const d of m[1]) if (!(await p.play(`d${d}`))) return
        await p.wait(180)
        await p.play(`h_${m[2]}`)
        await p.wait(180)
        for (const d of m[3]) if (!(await p.play(`d${d}`))) return
      }
      await p.play('r_end')
      if (!(await say(`car_${r.color}_${r.model}`))) return
    } else {
      if (!(await say('r_none'))) return
    }
    if (!(await say('u5'))) return
    setCaption(null)
    setDemo('done')
  }

  function toggleDemoPause() {
    const p = player.current
    if (!p) return
    if (demo === 'running') {
      p.pause()
      setDemo('paused')
    } else if (demo === 'paused') {
      p.resume()
      setDemo('running')
    }
  }

  // AI 제안이 바뀌면, 상담원이 아직 확인하지 않은 칸만 따라 바꾼다
  useEffect(() => {
    setOrigin((c) => (c.confirmed || c.edited ? c : { ...c, place: ex.origin.status === 'found' ? ex.origin.places[0] : null }))
    setDestination((c) => (c.confirmed || c.edited ? c : { ...c, place: ex.destination.status === 'found' ? ex.destination.places[0] : null }))
  }, [ex])

  const act = () => setActions((n) => n + 1)

  function reset() {
    cancelListen.current()
    setUtterances([])
    setPendingLines([])
    setOrigin(EMPTY)
    setDestination(EMPTY)
    setApproved(false)
    setResult(null)
    setActions(0)
    setSttError(null)
    job.reset()
  }

  function loadSample(id: string) {
    reset()
    setSampleId(id)
    setPendingLines(SAMPLE_CALLS.find((s) => s.id === id)!.utterances)
  }

  function nextLine() {
    if (!pendingLines.length) return
    setUtterances((u) => [...u, pendingLines[0]])
    setPendingLines((p) => p.slice(1))
  }

  function allLines() {
    setUtterances((u) => [...u, ...pendingLines])
    setPendingLines([])
  }

  function addTyped(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setUtterances((u) => [...u, text.trim()])
    setText('')
  }

  async function listen() {
    if (listening) {
      cancelListen.current()
      setListening(false)
      return
    }
    setSttError(null)
    setListening(true)
    const { promise, cancel } = listenOnce(setInterim, 10_000)
    cancelListen.current = cancel
    try {
      const heard = await promise
      setUtterances((u) => [...u, heard])
    } catch (err) {
      if (err !== 'aborted') setSttError(LISTEN_ERROR_TEXT[(err as ListenError) ?? 'other'] ?? LISTEN_ERROR_TEXT.other)
    } finally {
      setListening(false)
      setInterim('')
    }
  }

  async function run() {
    if (!origin.confirmed || !destination.confirmed || !approved || !origin.place || !destination.place) return
    const r = await job.dispatch(origin.place.id, destination.place.id, approved)
    setResult(r)
  }

  const same = origin.place && destination.place && origin.place.id === destination.place.id
  const ready = origin.confirmed && destination.confirmed && approved && !same && !job.busy && !result

  const order: OrderView = {
    origin: origin.confirmed ? origin.place : null,
    destination: destination.confirmed ? destination.place : null,
    originNote: !origin.confirmed && origin.place ? `${origin.place.name} 확인 대기` : undefined,
    destinationNote: !destination.confirmed && destination.place ? `${destination.place.name} 확인 대기` : undefined,
    approval: approved ? 'done' : origin.confirmed && destination.confirmed ? 'pending' : 'locked',
    pin: !origin.confirmed ? origin.place : !destination.confirmed ? destination.place : null,
  }

  return (
    <div className="space-y-3">
    {autoDemo && (
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3" data-testid="demo-bar" data-state={demo}>
        <button
          type="button"
          onClick={() => (demo === 'running' || demo === 'paused' ? toggleDemoPause() : void runDemo())}
          data-testid="demo-play"
          className="flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 font-display text-sm font-bold text-white"
        >
          {demo === 'running' ? <Pause size={16} /> : <Play size={16} />}
          {demo === 'ready' ? '자동 시연 시작' : demo === 'running' ? '일시정지' : demo === 'paused' ? '이어서 보기' : '다시 보기'}
        </button>
        {(demo === 'running' || demo === 'paused') && (
          <button type="button" onClick={() => void runDemo()} className="flex h-10 items-center gap-1 rounded-full border border-line px-3 text-sm font-bold">
            <RotateCcw size={14} /> 처음부터
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setMuted((m) => !m)
            if (player.current) player.current.muted = !muted
          }}
          aria-label={muted ? '소리 켜기' : '소리 끄기'}
          data-testid="demo-mute"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line"
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <p className="min-w-0 flex-1 text-[15px]" data-testid="demo-caption" aria-live="polite">
          {caption ? (
            <>
              <span className={`mr-2 rounded-md px-1.5 py-0.5 text-xs font-bold ${caption.who === '고객' ? 'bg-ink text-white' : 'bg-accent-soft text-accent-strong'}`}>{caption.who}</span>
              {caption.text}
            </>
          ) : demo === 'done' ? (
            <span className="text-muted">시연이 끝났어요. 실제 Playwright 실행 결과예요.</span>
          ) : (
            <span className="text-muted">소리가 나요 · 약 1분 · 목소리는 AI 합성음, 배차는 Mock</span>
          )}
        </p>
      </div>
    )}
    <div className={`grid gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] ${autoDemo ? 'lg:h-[calc(100dvh-180px)] lg:min-h-[620px]' : 'lg:h-[calc(100dvh-112px)] lg:min-h-[640px]'}`}>
      <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface" aria-label="상담원 보조 화면" data-testid="assist-panel" onPointerUpCapture={(e) => {
          // 상담원이 직접 한 조작만 센다 (예시 통화 재생·받아쓰기처럼 고객 쪽을 흉내 내는 버튼은 제외)
          const el = (e.target as HTMLElement).closest('button,select,input[type=checkbox]')
          if (el && !el.closest('[data-sim]')) act()
        }}>
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <p className="font-display text-[15px] font-bold">상담원 보조 화면</p>
            <p className="text-xs text-muted">AI가 정리해서 제안하고, 상담원이 확인해요</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="num rounded-full bg-bg px-2.5 py-1 text-xs font-bold" data-testid="action-count">
              조작 {actions}회
            </span>
            <button type="button" onClick={reset} data-sim className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-muted hover:bg-bg">
              <RotateCcw size={13} /> 새 통화
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {/* 1. 고객이 한 말 */}
          <div>
            <p className="text-xs font-bold text-muted">1. 고객이 한 말</p>
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="예시 통화" data-sim>
              {SAMPLE_CALLS.map((s) => (
                <button key={s.id} type="button" onClick={() => loadSample(s.id)} data-testid={`sample-${s.id}`} title={s.hint} className={`rounded-full border px-3 py-1 text-[13px] ${sampleId === s.id ? 'border-ink bg-ink text-white' : 'border-line hover:bg-bg'}`}>
                  {s.title}
                </button>
              ))}
            </div>
            {sampleId && <p className="mt-1.5 text-xs text-muted">{SAMPLE_CALLS.find((s) => s.id === sampleId)?.hint} · 직접 만든 예시 통화예요</p>}

            <ol className="mt-3 space-y-1.5" data-testid="utterances">
              {utterances.map((u, i) => (
                <li key={i} className="flex gap-2">
                  <span className="num mt-1 w-5 shrink-0 text-right text-xs font-bold text-muted">{i + 1}</span>
                  <p className="rounded-xl rounded-tl-sm bg-bg px-3 py-2 text-[16px]">{u}</p>
                </li>
              ))}
              {listening && (
                <li className="flex gap-2">
                  <span className="w-5" />
                  <p className="rounded-xl border border-dashed border-info/50 bg-info-soft px-3 py-2 text-[16px] text-info">{interim || '듣는 중이에요'}</p>
                </li>
              )}
              {utterances.length === 0 && !listening && <li className="text-sm text-muted">위에서 예시 통화를 고르거나, 아래에 고객이 한 말을 넣어 주세요.</li>}
            </ol>

            <div className="mt-3 flex flex-wrap gap-2" data-sim>
              {pendingLines.length > 0 && (
                <>
                  <button type="button" onClick={nextLine} data-testid="next-line" className="flex h-9 items-center gap-1.5 rounded-md bg-ink px-3 text-sm font-bold text-white">
                    <Play size={14} /> 다음 말 ({pendingLines.length})
                  </button>
                  <button type="button" onClick={allLines} className="h-9 rounded-md border border-line px-3 text-sm font-bold">
                    모두 보기
                  </button>
                </>
              )}
            </div>
            <form onSubmit={addTyped} className="mt-2 flex gap-2" data-sim>
              <input value={text} onChange={(e) => setText(e.target.value)} data-testid="utterance-input" placeholder="고객이 한 말을 직접 입력 (예: 서울역에서 아산병원 가요)" className="h-10 min-w-0 flex-1 rounded-md border border-line px-3 text-[15px] outline-none focus:border-ink" maxLength={100} />
              <button type="submit" aria-label="추가" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-ink text-white">
                <Send size={15} />
              </button>
              {sttSupported() && (
                <button type="button" onClick={listen} data-testid="assist-mic" aria-label="마이크로 받아쓰기" className={`flex h-10 shrink-0 items-center gap-1 rounded-md border px-3 text-sm font-bold ${listening ? 'border-info bg-info text-white' : 'border-line'}`}>
                  <Mic size={15} /> 받아쓰기
                </button>
              )}
            </form>
            {sttError && (
              <p className="mt-2 rounded-md bg-warn-soft px-3 py-2 text-xs text-warn" data-testid="assist-stt-error">
                {sttError}{' '}
                <a href="/diagnostics" className="font-bold underline">
                  음성 진단으로 원인 확인하기
                </a>
              </p>
            )}
          </div>

          {/* 2. AI 정리 */}
          <div>
            <p className="flex items-center gap-1 text-xs font-bold text-muted">
              <Sparkles size={12} /> 2. AI 정리 (제안) · 상담원이 확인해야 콘솔에 들어가요
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <SlotCard kind="origin" slot={ex.origin} choice={origin} disabled={Boolean(result) || job.busy} onPick={(p, edited) => setOrigin({ place: p, confirmed: false, edited })} onConfirm={() => setOrigin((c) => ({ ...c, confirmed: true }))} />
              <SlotCard kind="destination" slot={ex.destination} choice={destination} disabled={Boolean(result) || job.busy} onPick={(p, edited) => setDestination({ place: p, confirmed: false, edited })} onConfirm={() => setDestination((c) => ({ ...c, confirmed: true }))} />
            </div>
            {[...ex.notes, ...(same ? ['출발지와 목적지가 같아요. 고객에게 다시 물어봐 주세요.'] : [])].map((n) => (
              <p key={n} className="mt-2 flex items-start gap-1.5 text-xs text-warn">
                <AlertTriangle size={13} className="mt-px shrink-0" /> {n}
              </p>
            ))}
          </div>

          {/* 3. 고객 최종 확인 */}
          <div className="rounded-xl border border-line p-3">
            <p className="text-xs font-bold text-muted">3. 고객에게 최종 확인</p>
            <p className="mt-1.5 text-[15px]">
              {origin.place && destination.place ? (
                <>
                  읽어 줄 말: <b>"{origin.place.name}에서 {withRo(destination.place.name)} 택시 불러드릴까요?"</b>
                </>
              ) : (
                <span className="text-muted">출발지와 목적지를 확인하면 읽어 줄 말이 나와요.</span>
              )}
            </p>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={approved} disabled={!origin.confirmed || !destination.confirmed || Boolean(result)} onChange={(e) => setApproved(e.target.checked)} data-testid="assist-approved" className="h-4 w-4" />
              고객이 "네"라고 답했어요
            </label>
            <button type="button" onClick={run} disabled={!ready} data-testid="assist-run" className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent font-display font-bold text-white disabled:bg-line disabled:text-muted">
              <Check size={17} /> {job.busy ? 'Playwright가 입력하는 중' : '콘솔에 입력하고 호출하기'}
            </button>
          </div>

          {/* 4. 결과와 안내할 말 */}
          {result && (
            <div className="rounded-xl border border-accent/40 bg-accent-soft/40 p-3" data-testid="assist-result" data-status={result.status}>
              <p className="text-xs font-bold text-muted">4. 고객에게 안내할 말</p>
              {result.status === 'assigned' ? (
                <ul className="mt-1.5 space-y-1 text-[15px]">
                  <li>"택시가 잡혔어요. 약 {result.etaMinutes}분 뒤에 도착해요."</li>
                  <li>
                    "차 번호는 {speakPlate(result.plate)}이에요. {result.color} {result.model}이에요."
                  </li>
                </ul>
              ) : (
                <p className="mt-1.5 text-[15px]">"지금 근처에 빈 택시가 없어요. 몇 분 뒤에 다시 불러드릴까요?"</p>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="min-h-[520px] lg:min-h-0">
        <OperatorPanel
          order={order}
          w={job.worker}
          idleTitle="상담원이 확인하고 고객 승인을 받으면 시작해요"
          idleText="Playwright가 서버의 Chromium으로 호출 콘솔을 열고, 확인된 출발지·목적지를 검색해 고르고, 위치 확인과 승인 체크를 한 뒤 호출 버튼을 눌러요. 상담원은 결과만 읽어 주면 돼요."
        />
      </div>
    </div>
    </div>
  )
}
