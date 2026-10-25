// 통화 화면형 자동 시연. 대본(Step[])을 순서대로 실행하며 음성을 재생하고,
// 승인 단계에서는 실제 Playwright Worker(공개 서버 Chromium)로 호출 콘솔을 조작한다.
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Bot, Headset, Pause, Phone, Play, RotateCcw, Sparkles, User, Volume2, VolumeX } from 'lucide-react'
import { DemoAudio } from '../assist/demoAudio'
import { useWorkerJob } from '../assist/useWorkerJob'
import { OperatorPanel, type OrderView } from '../call/OperatorPanel'
import { findPlace } from '../dialog/places'
import manifest from '../../../public/audio/demo2/manifest.json'
import { assistScript, clipId, fullScript, resultPieces, type OrderState, type Speaker, type Step } from './script'

const SECONDS = (manifest as { clips: Record<string, number> }).clips

type LineBody = { kind: 'say'; speaker: Speaker; text: string } | { kind: 'note'; text: string }
type Line = LineBody & { id: number }

const WHO: Record<Speaker, string> = { agent: 'AI 상담원', counselor: '상담원', customer: '고객' }
const INITIAL_ORDER: OrderState = { originId: null, destinationId: null, approval: 'locked' }

export type Scenario = 'full' | 'assist'

export function DemoCall({ scenario }: { scenario: Scenario }) {
  const steps = useMemo<Step[]>(() => (scenario === 'full' ? fullScript() : assistScript()), [scenario])
  const [lines, setLines] = useState<Line[]>([])
  const [speaking, setSpeaking] = useState<Speaker | null>(null)
  const [state, setState] = useState<'ready' | 'running' | 'paused' | 'done'>('ready')
  const [muted, setMuted] = useState(false)
  const [order, setOrder] = useState<OrderState>(INITIAL_ORDER)
  const player = useRef<DemoAudio | null>(null)
  const job = useWorkerJob()
  const scroller = useRef<HTMLDivElement>(null)
  const lineId = useRef(0)

  useEffect(() => () => player.current?.stop(), [])
  useEffect(() => {
    player.current?.stop()
    setLines([])
    setOrder(INITIAL_ORDER)
    setState('ready')
    setSpeaking(null)
    job.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario])
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [lines.length])

  async function run() {
    player.current?.stop()
    const p = new DemoAudio('/audio/demo2', (id) => SECONDS[id])
    p.muted = muted
    player.current = p
    setLines([])
    setOrder(INITIAL_ORDER)
    job.reset()
    setState('running')
    const push = (l: LineBody) => setLines((ls) => [...ls, { ...l, id: ++lineId.current }])
    const say = async (speaker: Speaker, text: string, show = true) => {
      if (show) push({ kind: 'say', speaker, text })
      setSpeaking(speaker)
      const ok = await p.play(clipId(speaker, text))
      setSpeaking(null)
      return ok
    }
    let dispatched: Promise<Awaited<ReturnType<typeof job.dispatch>>> | null = null
    if (!(await p.wait(500))) return
    for (const s of steps) {
      if (s.type === 'say') {
        if (!(await say(s.speaker, s.text))) return
        if (!(await p.wait(s.speaker === 'customer' ? 350 : 250))) return
      } else if (s.type === 'note') {
        push({ kind: 'note', text: s.text })
        if (!(await p.wait(700))) return
      } else if (s.type === 'order') {
        setOrder((o) => ({ ...o, ...s.patch }))
      } else if (s.type === 'wait') {
        if (!(await p.wait(s.ms))) return
      } else if (s.type === 'dispatch') {
        dispatched = job.dispatch(s.originId, s.destinationId, true)
      } else if (s.type === 'result') {
        const r = await dispatched
        if (!(await p.gate())) return
        if (!r) {
          push({ kind: 'note', text: '호출하지 못했어요. 상담원이 이어서 처리해요.' })
          continue
        }
        const pieces = resultPieces(r)
        // 화면에는 문장으로, 소리는 한 자씩 끊어서
        push({ kind: 'say', speaker: s.speaker, text: r.status === 'assigned' ? `택시가 잡혔어요. 약 ${r.etaMinutes}분 뒤에 도착해요. 차 번호는 ${r.plate}이에요. ${r.color} ${r.model} 차량이에요.` : '지금 근처에 빈 택시가 없어요. 몇 분 뒤에 다시 불러드릴까요?' })
        for (const piece of pieces) {
          if (!(await say(s.speaker, piece.text, false))) return
          if (!(await p.wait(piece.gapMs))) return
        }
      }
    }
    setState('done')
  }

  function togglePause() {
    const p = player.current
    if (!p) return
    if (state === 'running') {
      p.pause()
      setState('paused')
    } else if (state === 'paused') {
      p.resume()
      setState('running')
    }
  }

  const view: OrderView = {
    origin: order.originId ? findPlace(order.originId) : null,
    destination: order.destinationId ? findPlace(order.destinationId) : null,
    originNote: order.originNote ?? (scenario === 'full' && !order.originId && lines.length ? '듣는 중' : undefined),
    destinationNote: order.destinationNote,
    approval: order.approval,
  }
  const status = state === 'ready' ? '대기' : state === 'done' ? '통화 종료' : state === 'paused' ? '일시정지' : job.busy ? '호출 처리 중' : speaking ? `${WHO[speaking]} 말하는 중` : '진행 중'

  return (
    <div className="grid gap-3 lg:h-[calc(100dvh-170px)] lg:min-h-[600px] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]" data-testid="demo-call" data-scenario={scenario} data-state={state}>
      <section className="flex h-[620px] min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface lg:h-auto" aria-label="통화 화면">
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white">{scenario === 'full' ? <Bot size={18} /> : <Headset size={18} />}</span>
            <div className="min-w-0">
              <p className="font-display text-[15px] font-bold">{scenario === 'full' ? 'AI 상담원 혼자 처리' : '상담원 + AI 보조'}</p>
              <p className="truncate text-xs text-muted">02-114 택시 대신 불러드리기 · 목소리는 AI 합성음</p>
            </div>
          </div>
          <span role="status" data-testid="demo-status" className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${speaking ? 'bg-accent text-white' : job.busy ? 'bg-[#f5c400] text-ink' : 'bg-bg text-muted'}`}>
            {status}
          </span>
        </header>

        <div ref={scroller} className="relative min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" data-testid="transcript">
          {lines.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <button type="button" onClick={() => void run()} data-testid="demo-start" aria-label="자동 시연 시작" className="flex h-24 w-24 items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_24px_-8px_rgba(13,107,79,0.6)] transition-transform hover:scale-[1.03] active:scale-95">
                <Phone size={34} />
              </button>
              <div>
                <p className="font-display text-lg font-bold">자동 시연 보기</p>
                <p className="mt-1 text-sm text-muted">누르면 통화가 처음부터 끝까지 진행돼요 · 소리가 나요 · 약 1분</p>
              </div>
            </div>
          )}
          {lines.map((l) =>
            l.kind === 'note' ? (
              <motion.p key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto flex w-fit max-w-full items-center gap-1.5 rounded-full bg-info-soft px-3 py-1.5 text-[13px] font-bold text-info">
                <Sparkles size={13} /> {l.text}
              </motion.p>
            ) : (
              <motion.div key={l.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className={l.speaker === 'customer' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={`flex max-w-[86%] items-end gap-2 ${l.speaker === 'customer' ? 'flex-row-reverse' : ''}`}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${l.speaker === 'customer' ? 'bg-bg text-muted' : 'bg-accent-soft text-accent'}`}>
                    {l.speaker === 'customer' ? <User size={14} /> : l.speaker === 'agent' ? <Bot size={14} /> : <Headset size={14} />}
                  </span>
                  <div>
                    <p className={`text-[11px] font-bold text-muted ${l.speaker === 'customer' ? 'text-right' : ''}`}>{WHO[l.speaker]}</p>
                    <p data-speaker={l.speaker} className={`rounded-2xl px-4 py-2.5 text-[18px] leading-snug ${l.speaker === 'customer' ? 'rounded-br-md bg-ink text-white' : 'rounded-bl-md bg-bg'}`}>
                      {l.text}
                    </p>
                  </div>
                </div>
              </motion.div>
            ),
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
          {state === 'ready' ? (
            <button type="button" onClick={() => void run()} className="flex h-11 items-center gap-1.5 rounded-full bg-accent px-5 font-bold text-white" data-testid="demo-play">
              <Play size={16} /> 자동 시연 시작
            </button>
          ) : state === 'done' ? (
            <button type="button" onClick={() => void run()} className="flex h-11 items-center gap-1.5 rounded-full bg-accent px-5 font-bold text-white" data-testid="demo-play">
              <RotateCcw size={16} /> 다시 보기
            </button>
          ) : (
            <>
              <button type="button" onClick={togglePause} className="flex h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-bold text-white" data-testid="demo-pause">
                {state === 'paused' ? <Play size={15} /> : <Pause size={15} />} {state === 'paused' ? '이어서 보기' : '일시정지'}
              </button>
              <button type="button" onClick={() => void run()} className="flex h-11 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm font-bold">
                <RotateCcw size={15} /> 처음부터
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setMuted((m) => !m)
              if (player.current) player.current.muted = !muted
            }}
            aria-label={muted ? '소리 켜기' : '소리 끄기'}
            data-testid="demo-mute"
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-full border border-line"
          >
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
        </footer>
      </section>

      <div className="min-h-[520px] lg:min-h-0">
        <OperatorPanel
          order={view}
          w={job.worker}
          idleTitle={scenario === 'full' ? '고객이 "네, 불러주세요"라고 하면 시작해요' : '상담원이 확인하고 고객 승인을 받으면 시작해요'}
          idleText="공개 서버의 Chromium에서 Playwright가 호출 콘솔을 열고, 출발지·목적지를 검색해 실제 지도에서 확인한 뒤 호출 버튼을 눌러요. 그 화면이 여기에 실시간으로 나와요."
        />
      </div>
    </div>
  )
}
