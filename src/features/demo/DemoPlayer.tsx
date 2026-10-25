import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Switch from '@radix-ui/react-switch'
import { Check, ChevronLeft, ChevronRight, Lock, LockOpen, Pause, Play, RotateCcw } from 'lucide-react'
import { CallCard, type CallStatus, type Turn } from '../../components/CallCard'
import { Badge, Button, Panel } from '../../components/ui'
import { speak, stopSpeaking, ttsSupported } from '../../lib/speech'
import { AUTOMATION_STEPS, DEMO_DISPATCH, DEMO_STEPS, DEMO_TOTAL_MS, type DemoStep } from './scenario'

export const DEMO_PLAY_EVENT = 'demo:play'

function statusFor(step: DemoStep, playing: boolean, speakingCaller: boolean): CallStatus {
  if (step.panel === 'summary') return '완료'
  if (step.state.stage === 'dispatching') return '호출 중'
  if (step.state.stage === 'dispatched') return '완료'
  if (!playing) return '대기'
  if (speakingCaller) return '듣는 중'
  if (step.state.stage.startsWith('confirm') || step.state.stage === 'finalApproval') return '확인 대기'
  return '말하는 중'
}

export function DemoPlayer() {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)
  const [revealed, setRevealed] = useState(0)
  const [soundOn, setSoundOn] = useState(false)
  const [stepElapsed, setStepElapsed] = useState(0)
  const runToken = useRef(0)
  const step = DEMO_STEPS[index]

  const play = useCallback(() => {
    setStarted(true)
    setIndex((i) => (i === DEMO_STEPS.length - 1 && !playing ? 0 : i))
    setRevealed(0)
    setPlaying(true)
  }, [playing])

  const pause = () => {
    runToken.current++
    stopSpeaking()
    setPlaying(false)
  }

  const goTo = (i: number) => {
    runToken.current++
    stopSpeaking()
    setStarted(true)
    setIndex(Math.max(0, Math.min(DEMO_STEPS.length - 1, i)))
    setRevealed(playing ? 0 : Number.MAX_SAFE_INTEGER)
  }

  const restart = () => {
    runToken.current++
    stopSpeaking()
    setStarted(true)
    setIndex(0)
    setRevealed(0)
    setPlaying(true)
  }

  useEffect(() => {
    const onPlay = () => restart()
    window.addEventListener(DEMO_PLAY_EVENT, onPlay)
    return () => window.removeEventListener(DEMO_PLAY_EVENT, onPlay)
  })

  // 재생 루프: 현재 단계의 문장을 하나씩 보여주고(소리가 켜져 있으면 읽고) 다음 단계로 넘어간다.
  useEffect(() => {
    if (!playing) return
    const token = ++runToken.current
    const alive = () => token === runToken.current
    const lines = step.turns
    const perLine = step.durationMs / Math.max(lines.length, 1)
    const startedAt = performance.now()
    const tick = setInterval(() => alive() && setStepElapsed(performance.now() - startedAt), 100)
    ;(async () => {
      for (let i = 0; i < lines.length; i++) {
        if (!alive()) return
        setRevealed(i + 1)
        const t = lines[i]
        if (soundOn && t.speaker !== 'system') await speak(t.text, t.speaker === 'caller' ? 'caller' : 'agent')
        else await new Promise((r) => setTimeout(r, perLine))
      }
      const rest = step.durationMs - (performance.now() - startedAt)
      await new Promise((r) => setTimeout(r, soundOn ? 600 : Math.max(rest, 400)))
      if (!alive()) return
      if (index < DEMO_STEPS.length - 1) {
        setRevealed(0)
        setIndex(index + 1)
      } else {
        setPlaying(false)
      }
    })()
    return () => {
      clearInterval(tick)
    }
  }, [playing, index, soundOn, step])

  useEffect(() => () => stopSpeaking(), [])

  const turns: Turn[] = useMemo(() => {
    if (!started) {
      return [{ speaker: 'system' as const, text: '미리보기 · 재생하면 처음부터 한 단계씩 진행해요' }, ...DEMO_STEPS.slice(0, 3).flatMap((s) => s.turns)]
    }
    const prev = DEMO_STEPS.slice(0, index).flatMap((s) => s.turns)
    const cur = playing ? step.turns.slice(0, revealed) : step.turns
    return [...prev, ...cur]
  }, [started, index, playing, revealed, step])

  const speakingCaller = playing && turns.at(-1)?.speaker === 'caller'
  const automationProgress = step.panel === 'automation' ? (playing ? Math.min(1, stepElapsed / (step.durationMs * 0.85)) : 1) : 0

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]" data-testid="demo-player">
      <div>
        <CallCard
          title="자동 시연 · 서울역에서 세브란스병원"
          status={started ? statusFor(step, playing, speakingCaller) : '대기'}
          turns={turns}
          badge={<Badge tag="합성" />}
          minHeight={340}
          footer={
            <div className="flex flex-wrap items-center gap-2">
              {playing ? (
                <Button variant="primary" onClick={pause} aria-label="일시정지">
                  <Pause size={16} /> 일시정지
                </Button>
              ) : (
                <Button variant="primary" onClick={play} data-testid="demo-play">
                  <Play size={16} /> {started ? (index === DEMO_STEPS.length - 1 ? '다시 보기' : '이어서 보기') : '자동 시연 보기'}
                </Button>
              )}
              <Button onClick={restart} aria-label="처음부터 다시 보기" data-testid="demo-restart">
                <RotateCcw size={16} /> 처음부터
              </Button>
              <div className="flex">
                <Button size="md" className="rounded-r-none px-3" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="이전 단계">
                  <ChevronLeft size={16} />
                </Button>
                <Button size="md" className="-ml-px rounded-l-none px-3" onClick={() => goTo(index + 1)} disabled={index === DEMO_STEPS.length - 1} aria-label="다음 단계">
                  <ChevronRight size={16} />
                </Button>
              </div>
              {ttsSupported() && (
                <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <Switch.Root
                    checked={soundOn}
                    onCheckedChange={(v) => {
                      setSoundOn(v)
                      if (!v) stopSpeaking()
                    }}
                    className="relative h-6 w-10 rounded-full bg-line transition-colors data-[state=checked]:bg-accent"
                    aria-label="소리 켜기"
                  >
                    <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
                  </Switch.Root>
                  소리 켜기
                </label>
              )}
            </div>
          }
        />
        <p className="mt-2 text-xs text-muted">
          고객 발화와 음성은 미리 준비한 합성 자료예요. 소리는 브라우저 정책 때문에 직접 켜야 나와요.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Panel className="p-3">
          <div className="flex items-center justify-between px-1 pb-2">
            <p className="text-sm font-bold">
              단계 <span className="num" data-testid="demo-step">{index + 1}</span>/{DEMO_STEPS.length}
            </p>
            <p className="text-xs text-muted">단계를 눌러 이동할 수 있어요</p>
          </div>
          <ol className="grid grid-cols-5 gap-1 lg:grid-cols-1">
            {DEMO_STEPS.map((s, i) => (
              <li key={s.id}>
                <button
                  onClick={() => goTo(i)}
                  aria-current={i === index ? 'step' : undefined}
                  aria-label={`${s.id}단계 ${s.title}`}
                  className={`flex w-full items-center justify-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors lg:justify-start ${
                    i === index ? 'bg-accent-soft font-bold text-accent-strong' : i < index ? 'text-ink hover:bg-bg' : 'text-muted hover:bg-bg'
                  }`}
                >
                  <span className={`num flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${i < index ? 'bg-accent text-white' : 'border border-current'}`}>
                    {i < index ? <Check size={11} /> : s.id}
                  </span>
                  <span className="hidden lg:inline">{s.title}</span>
                </button>
              </li>
            ))}
          </ol>
          <p className="mt-2 px-1 text-sm font-semibold lg:hidden">{step.title}</p>
        </Panel>

        <Panel className="p-4" >
          <p className="text-xs font-semibold text-muted">지금 단계</p>
          <p className="mt-1 font-bold">{step.title}</p>
          <p className="mt-1 text-sm text-muted">{step.detail}</p>
          <div className="mt-3">
            <StepPanel step={step} progress={automationProgress} />
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="text-muted">{k}</span>
      <span className={strong ? 'font-bold' : ''}>{v}</span>
    </div>
  )
}

function StepPanel({ step, progress }: { step: DemoStep; progress: number }) {
  const s = step.state
  switch (step.panel) {
    case 'recognition':
      return (
        <div className="rounded-lg bg-bg p-3">
          <Row k="출발지" v={s.origin ? `${s.origin.name} · 확정` : s.candidate && s.stage === 'confirmOrigin' ? `${s.candidate.name} · 확인 중` : '듣는 중'} strong={Boolean(s.origin)} />
          <Row
            k="목적지"
            v={s.destination ? `${s.destination.name} · 확정` : s.candidate && s.stage === 'confirmDestination' ? `${s.candidate.name} · 확인 중` : '-'}
            strong={Boolean(s.destination)}
          />
        </div>
      )
    case 'approval':
      return (
        <div className="rounded-lg border border-warn/40 bg-warn-soft p-3 text-sm">
          <p className="flex items-center gap-1.5 font-bold text-warn">
            <Lock size={14} /> 승인 전에는 호출이 잠겨 있어요
          </p>
          <p className="mt-1 text-ink">서울역 → 세브란스병원</p>
          <p className="mt-1 text-xs text-muted">고객이 "네"라고 하면 잠금이 풀리고 업무 웹 자동 입력이 시작돼요.</p>
        </div>
      )
    case 'automation':
      return (
        <div className="rounded-lg border border-line p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-bold">
              <LockOpen size={14} className="text-accent" /> 업무 웹 자동 입력
            </p>
            <Badge tag="합성">합성 재현</Badge>
          </div>
          <ol className="space-y-1">
            {AUTOMATION_STEPS.map((label, i) => {
              const done = progress >= (i + 1) / AUTOMATION_STEPS.length
              return (
                <li key={label} className={`flex items-center gap-2 text-sm ${done ? 'text-ink' : 'text-muted'}`}>
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full ${done ? 'bg-accent text-white' : 'border border-line'}`}>
                    {done && <Check size={10} />}
                  </span>
                  {label}
                </li>
              )
            })}
          </ol>
          <p className="mt-2 text-xs text-muted">
            이 화면은 연출이에요. Playwright가 실제로 조작한 녹화는{' '}
            <a href="#automation" className="font-semibold text-accent underline underline-offset-2">
              업무 자동화
            </a>
            에서 볼 수 있어요.
          </p>
        </div>
      )
    case 'dispatch':
      return DEMO_DISPATCH.status === 'assigned' ? (
        <div className="rounded-lg bg-bg p-3">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-bold">가상 배차 결과</p>
            <Badge tag="Mock" />
          </div>
          <Row k="차 번호" v={DEMO_DISPATCH.plate} strong />
          <Row k="차종" v={`${DEMO_DISPATCH.color} ${DEMO_DISPATCH.model}`} />
          <Row k="도착 예정" v={`약 ${DEMO_DISPATCH.etaMinutes}분`} />
        </div>
      ) : null
    case 'summary':
      return (
        <div className="rounded-lg bg-bg p-3">
          <Row k="결과" v="배차 완료 (가상)" strong />
          <Row k="확인 절차" v="출발지·목적지·최종 승인 3번" />
          <Row k="대화" v={`${DEMO_STEPS.flatMap((x) => x.turns).filter((t) => t.speaker !== 'system').length}마디`} />
          <Row k="시연 재생 시간" v={`약 ${Math.round(DEMO_TOTAL_MS / 1000)}초`} />
          <p className="mt-2 text-xs text-muted">재생 시간은 연출용으로 정한 값이에요. 실제 처리 시간 측정값이 아니에요.</p>
        </div>
      )
    default:
      return <p className="text-sm text-muted">AI 상담원은 해요체로, 한 번에 하나씩 물어요.</p>
  }
}
