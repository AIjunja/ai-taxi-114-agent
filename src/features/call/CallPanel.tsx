import { useEffect, useRef, useState, type FormEvent } from 'react'
import * as Slider from '@radix-ui/react-slider'
import * as Switch from '@radix-ui/react-switch'
import { motion } from 'motion/react'
import { Headset, Mic, MicOff, Pause, Phone, PhoneOff, Play, RotateCcw, Send, Snail, Volume2 } from 'lucide-react'
import { STAGE_LABEL } from '../dialog/machine'
import { hasKoreanVoice, sttSupported, ttsSupported } from '../../lib/speech'
import type { Phase, useCall } from './useCall'

type Call = ReturnType<typeof useCall>

const PHASE_LABEL: Record<Phase, string> = {
  off: '대기',
  speaking: 'AI가 말하는 중',
  listening: '듣는 중',
  thinking: '알아듣는 중',
  waiting: '호출 처리 중',
  paused: '말씀을 기다려요',
}

const PHASE_STYLE: Record<Phase, string> = {
  off: 'bg-bg text-muted',
  speaking: 'bg-accent text-white',
  listening: 'bg-info text-white',
  thinking: 'bg-ink text-white',
  waiting: 'bg-[#f5c400] text-ink',
  paused: 'bg-warn-soft text-warn',
}

function quickReplies(stage: string, candidates: number): string[] {
  if (stage === 'soundCheck') return ['네, 잘 들려요', '잘 안 들려요']
  if (stage === 'askOrigin') return ['서울역이요', '김포공항', '세브란스병원']
  if (stage === 'askDestination') return ['세브란스병원', '서울아산병원', '강남역']
  if (stage.startsWith('choose')) return [...Array.from({ length: candidates }, (_, i) => `${i + 1}번이요`), '다시 말해 주세요']
  if (stage === 'finalApproval') return ['네, 불러주세요', '목적지 바꿀래요', '아니요']
  if (stage === 'askChange') return ['타는 곳', '가는 곳', '취소']
  if (stage === 'dispatched' || stage === 'closing') return ['네', '취소해 주세요', '끝']
  if (stage === 'noTaxi') return ['네', '아니요']
  if (stage.startsWith('confirm')) return ['네, 맞아요', '아니요']
  return []
}

function Meter({ level, on }: { level: number; on: boolean }) {
  return (
    <div className="flex h-6 items-end gap-[3px]" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => {
        const h = on ? Math.max(0.12, Math.min(1, level * 1.6 - Math.abs(i - 5.5) * 0.06 + ((i * 7) % 3) * 0.05)) : 0.12
        return <span key={i} className={`w-[3px] rounded-full transition-[height] duration-75 ${on ? 'bg-info' : 'bg-line'}`} style={{ height: `${h * 100}%` }} />
      })}
    </div>
  )
}

export function CallPanel({ call, mode }: { call: Call; mode: 'live' | 'demo' }) {
  const [text, setText] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const [elapsed, setElapsed] = useState(0)
  const st = call.state

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [call.turns.length, call.interim])

  useEffect(() => {
    if (!call.active) return
    const started = Date.now()
    setElapsed(0)
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(t)
  }, [call.active])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    call.sendText(text)
    setText('')
  }

  const ended = !call.active && call.turns.length > 0
  const slow = call.settings.rate < 0.85
  const chips = quickReplies(st.stage, st.candidates?.length ?? 0)

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface" aria-label="고객 통화" data-testid="call-panel" data-phase={call.phase} data-stage={st.stage}>
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white">
            <Headset size={18} />
          </span>
          <div className="min-w-0">
            <p className="font-display text-[15px] font-bold leading-tight">114 AI 상담원</p>
            <p className="truncate text-xs text-muted">
              {call.active ? `통화 중 ${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')} · ${STAGE_LABEL[st.stage]}` : mode === 'demo' ? '자동 시연 · 합성 고객 음성' : '02-114 택시 대신 불러드리기'}
            </p>
          </div>
        </div>
        <span role="status" aria-live="polite" data-testid="call-phase" className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${PHASE_STYLE[call.phase]}`}>
          {PHASE_LABEL[call.phase]}
        </span>
      </header>

      <div ref={scroller} className="relative min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" data-testid="transcript">
        {call.turns.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-6 text-center">
            <button
              type="button"
              onClick={() => void call.start()}
              data-testid={mode === 'demo' ? 'demo-start' : 'call-start'}
              className="group flex h-24 w-24 items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_24px_-8px_rgba(13,107,79,0.6)] transition-transform hover:scale-[1.03] active:scale-95"
              aria-label={mode === 'demo' ? '자동 시연 시작' : '통화 시작'}
            >
              {mode === 'demo' ? <Play size={34} /> : <Phone size={34} />}
            </button>
            <div>
              <p className="font-display text-lg font-bold">{mode === 'demo' ? '자동 시연 보기' : '114에 전화 걸기'}</p>
              <p className="mt-1 max-w-[320px] text-sm leading-relaxed text-muted">
                {mode === 'demo'
                  ? '준비된 고객 음성으로 처음부터 끝까지 진행해요. 소리는 아래에서 켜세요.'
                  : sttSupported()
                    ? '누르면 마이크 권한을 물어봐요. 허용하면 말로 상담하고, 허용하지 않아도 글로 할 수 있어요.'
                    : '이 브라우저는 음성 인식이 안 돼서 글로 상담해요. AI 답변은 소리로 들려 드려요.'}
              </p>
            </div>
            {mode === 'live' && ttsSupported() && (
              <button type="button" onClick={() => void call.soundTest()} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:bg-bg" data-testid="sound-test">
                <Volume2 size={15} /> 먼저 소리 확인하기
              </button>
            )}
            {ttsSupported() && !hasKoreanVoice() && <p className="text-xs text-warn">이 기기에 한국어 음성이 없어서 기본 음성으로 읽을 수 있어요.</p>}
          </div>
        )}

        {call.turns.map((t) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: 'easeOut' }} className={t.speaker === 'caller' ? 'flex justify-end' : t.speaker === 'system' ? 'flex justify-center' : 'flex justify-start'}>
            {t.speaker === 'system' ? (
              <p className="rounded-md bg-bg px-2.5 py-1 text-xs text-muted">{t.text}</p>
            ) : (
              <div className={`max-w-[88%] ${t.speaker === 'caller' ? 'text-right' : ''}`}>
                <p
                  data-speaker={t.speaker}
                  className={`inline-block rounded-2xl px-4 py-2.5 text-left text-[19px] leading-snug ${t.speaker === 'agent' ? 'rounded-bl-md bg-bg text-ink' : 'rounded-br-md bg-ink text-white'}`}
                >
                  {t.text}
                </p>
                {t.note && <p className="mt-1 text-[11px] text-muted">{t.note}</p>}
              </div>
            )}
          </motion.div>
        ))}

        {call.phase === 'listening' && mode === 'live' && (
          <div className="flex justify-end" data-testid="interim">
            <p className="inline-flex items-center gap-2 rounded-2xl rounded-br-md border border-dashed border-info/50 bg-info-soft px-4 py-2.5 text-[19px] text-info">
              <Meter level={call.level} on />
              {call.interim || '말씀하세요'}
            </p>
          </div>
        )}
      </div>

      {call.notice && (
        <div role="alert" className="mx-4 mb-2 flex items-start justify-between gap-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn" data-testid="call-notice">
          <span>{call.notice}</span>
          <button type="button" className="shrink-0 text-xs font-bold underline" onClick={call.dismissNotice}>
            닫기
          </button>
        </div>
      )}

      <footer className="space-y-2.5 border-t border-line px-4 py-3">
        {call.active && mode === 'live' && chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="빠른 답변">
            {chips.map((c) => (
              <button key={c} type="button" onClick={() => call.sendText(c)} className="rounded-full border border-line bg-surface px-3 py-1 text-sm hover:bg-bg" disabled={call.phase === 'waiting'}>
                {c}
              </button>
            ))}
          </div>
        )}

        {mode === 'live' && call.active && (
          <form onSubmit={onSubmit} className="flex gap-2">
            <label htmlFor="caller-input" className="sr-only">
              고객으로 말할 내용
            </label>
            <input
              id="caller-input"
              data-testid="caller-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={call.textOnly ? '여기에 말할 내용을 써 주세요 (예: 서울역이요)' : '말 대신 글로 써도 돼요'}
              className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-[16px] outline-none focus:border-ink"
              autoComplete="off"
              maxLength={80}
            />
            <button type="submit" aria-label="보내기" data-testid="caller-send" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink text-white">
              <Send size={17} />
            </button>
          </form>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {mode === 'live' ? (
            call.active ? (
              <>
                <button
                  type="button"
                  onClick={call.micTap}
                  disabled={!sttSupported() || call.phase === 'waiting'}
                  data-testid="mic"
                  aria-label={call.phase === 'listening' ? '듣기 멈추기' : '말하기'}
                  className={`flex h-11 items-center gap-2 rounded-full px-4 font-bold transition-colors disabled:opacity-40 ${call.phase === 'listening' ? 'bg-info text-white' : 'bg-bg text-ink hover:bg-line'}`}
                >
                  {sttSupported() && !call.textOnly ? <Mic size={18} /> : <MicOff size={18} />}
                  {call.phase === 'listening' ? <Meter level={call.level} on /> : call.phase === 'speaking' ? '끊고 말하기' : '말하기'}
                </button>
                <button type="button" onClick={call.replay} className="flex h-11 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm font-bold hover:bg-bg" data-testid="replay">
                  <RotateCcw size={15} /> 다시 듣기
                </button>
                <button type="button" onClick={call.end} className="ml-auto flex h-11 items-center gap-1.5 rounded-full bg-danger px-4 text-sm font-bold text-white" data-testid="call-end">
                  <PhoneOff size={16} /> 끊기
                </button>
              </>
            ) : (
              ended && (
                <button type="button" onClick={() => void call.start()} className="flex h-11 items-center gap-2 rounded-full bg-accent px-5 font-bold text-white" data-testid="call-restart">
                  <Phone size={17} /> 다시 전화 걸기
                </button>
              )
            )
          ) : call.active ? (
            <>
              <button type="button" onClick={() => call.setDemoPaused(!call.demoPaused)} className="flex h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-bold text-white" data-testid="demo-pause">
                {call.demoPaused ? <Play size={15} /> : <Pause size={15} />} {call.demoPaused ? '이어서 보기' : '일시정지'}
              </button>
              <button type="button" onClick={() => void call.start()} className="flex h-11 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm font-bold" data-testid="demo-restart">
                <RotateCcw size={15} /> 처음부터
              </button>
              <button type="button" onClick={call.end} className="ml-auto flex h-11 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm font-bold">
                멈추기
              </button>
            </>
          ) : (
            ended && (
              <button type="button" onClick={() => void call.start()} className="flex h-11 items-center gap-2 rounded-full bg-accent px-5 font-bold text-white" data-testid="demo-again">
                <RotateCcw size={16} /> 다시 보기
              </button>
            )
          )}
        </div>

        {ttsSupported() && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-2.5 text-[13px]">
            {mode === 'live' && sttSupported() && (
              <label className="flex cursor-pointer items-center gap-2 font-semibold">
                <Switch.Root
                  checked={!call.textOnly}
                  onCheckedChange={call.setVoiceInput}
                  className="relative h-6 w-10 shrink-0 rounded-full bg-line transition-colors data-[state=checked]:bg-accent"
                  aria-label="음성으로 말하기"
                  data-testid="voice-input"
                >
                  <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
                </Switch.Root>
                <Mic size={14} /> 음성으로 말하기
              </label>
            )}
            {mode === 'demo' && (
              <label className="flex cursor-pointer items-center gap-2 font-semibold">
                <Switch.Root
                  checked={call.voiceOn}
                  onCheckedChange={call.setVoiceOn}
                  className="relative h-6 w-10 shrink-0 rounded-full bg-line transition-colors data-[state=checked]:bg-accent"
                  aria-label="소리 켜기"
                  data-testid="demo-sound"
                >
                  <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
                </Switch.Root>
                소리 켜기
              </label>
            )}
            <label className="flex cursor-pointer items-center gap-2 font-semibold">
              <Switch.Root
                checked={slow}
                onCheckedChange={call.setSlow}
                className="relative h-6 w-10 shrink-0 rounded-full bg-line transition-colors data-[state=checked]:bg-accent"
                aria-label="천천히 말하기"
                data-testid="slow"
              >
                <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
              </Switch.Root>
              <Snail size={14} /> 천천히 말하기
            </label>
            <div className="flex min-w-[150px] flex-1 items-center gap-2">
              <Volume2 size={15} className="shrink-0 text-muted" />
              <Slider.Root className="relative flex h-5 flex-1 touch-none select-none items-center" min={0.2} max={1} step={0.1} value={[call.settings.volume]} onValueChange={([v]) => call.setVolume(v)} aria-label="소리 크기">
                <Slider.Track className="relative h-1.5 grow rounded-full bg-line">
                  <Slider.Range className="absolute h-full rounded-full bg-ink" />
                </Slider.Track>
                <Slider.Thumb className="block h-4 w-4 rounded-full border-2 border-ink bg-white" aria-label="소리 크기" />
              </Slider.Root>
            </div>
          </div>
        )}
      </footer>
    </section>
  )
}
