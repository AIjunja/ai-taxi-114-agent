import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, Lock, MonitorPlay, Radio } from 'lucide-react'
import { MiniMap } from '../../components/MiniMap'
import type { DialogState } from '../dialog/machine'
import type { WorkerView } from './useCall'

const MODE_BADGE: Record<WorkerView['mode'], { text: string; cls: string }> = {
  idle: { text: '승인 대기', cls: 'bg-bg text-muted' },
  live: { text: '실시간 · 서버 Chromium', cls: 'bg-accent text-white' },
  recording: { text: '녹화 · 실제 실행 기록', cls: 'bg-info text-white' },
  api_fallback: { text: 'Worker 없이 API 호출', cls: 'bg-warn-soft text-warn' },
}

function Row({ k, v, state }: { k: string; v: string; state: 'empty' | 'pending' | 'done' | 'locked' | 'open' }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0" data-state={state}>
      <span className="text-[13px] text-muted">{k}</span>
      <span className={`flex items-center gap-1.5 text-right text-[14px] font-bold ${state === 'empty' ? 'text-muted/60' : state === 'pending' ? 'text-warn' : state === 'locked' ? 'text-muted' : ''}`}>
        {state === 'done' && <Check size={14} className="text-accent" />}
        {state === 'pending' && <Loader2 size={14} className="animate-spin" />}
        {state === 'locked' && <Lock size={13} />}
        {v}
      </span>
    </div>
  )
}

function WorkOrder({ st }: { st: DialogState }) {
  const pendingOrigin = !st.origin && (st.stage === 'confirmOrigin' || st.stage === 'chooseOrigin')
  const pendingDest = !st.destination && (st.stage === 'confirmDestination' || st.stage === 'chooseDestination')
  const changingDest = Boolean(st.destination) && (st.stage === 'confirmDestination' || st.stage === 'chooseDestination')
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="rounded-xl border border-line bg-surface px-4 py-1" data-testid="work-order">
        <Row k="접수 채널" v="114 전화 · 번호 비공개" state="done" />
        <Row
          k="출발지"
          v={st.origin ? st.origin.name : pendingOrigin ? (st.candidate ? `${st.candidate.name} 확인 중` : `후보 ${st.candidates?.length}곳`) : '듣는 중'}
          state={st.origin ? 'done' : pendingOrigin ? 'pending' : 'empty'}
        />
        <Row
          k="목적지"
          v={changingDest && st.candidate ? `${st.candidate.name}(으)로 변경 확인 중` : st.destination ? st.destination.name : pendingDest ? (st.candidate ? `${st.candidate.name} 확인 중` : `후보 ${st.candidates?.length}곳`) : '-'}
          state={changingDest ? 'pending' : st.destination ? 'done' : pendingDest ? 'pending' : 'empty'}
        />
        <Row k="최종 승인" v={st.approved ? '승인 받음' : st.stage === 'finalApproval' ? '고객 답변 기다리는 중' : '호출 잠김'} state={st.approved ? 'done' : st.stage === 'finalApproval' ? 'pending' : 'locked'} />
      </div>
      <MiniMap origin={st.origin} destination={st.destination} pending={st.candidate ?? null} height={186} />
    </div>
  )
}

function BrowserFrame({ src, children, url }: { src?: string; children?: React.ReactNode; url: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-ink/15 bg-[#1d2430]">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="flex gap-1">
          <i className="h-2 w-2 rounded-full bg-white/25" />
          <i className="h-2 w-2 rounded-full bg-white/25" />
          <i className="h-2 w-2 rounded-full bg-white/25" />
        </span>
        <span className="truncate rounded bg-white/10 px-2 py-0.5 font-mono text-[11px] text-white/70">{url}</span>
      </div>
      <div className="relative aspect-[11/7] bg-white">
        {src ? <img src={src} alt="Playwright가 조작 중인 호출 콘솔 화면" className="absolute inset-0 h-full w-full object-cover object-top" data-testid="worker-frame" /> : children}
      </div>
    </div>
  )
}

function Steps({ steps, live }: { steps: WorkerView['steps']; live: boolean }) {
  const ref = useRef<HTMLOListElement>(null)
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight })
  }, [steps.length])
  return (
    <ol ref={ref} className="max-h-[168px] space-y-1 overflow-y-auto rounded-lg bg-bg p-3 font-mono text-[12px]" data-testid="worker-steps">
      {steps.length === 0 && <li className="text-muted">{live ? 'Worker를 준비하는 중이에요' : '아직 실행 기록이 없어요'}</li>}
      {steps.map((s, i) => (
        <li key={i} className="flex gap-2">
          <span className="w-12 shrink-0 text-right text-muted">{(s.t / 1000).toFixed(1)}s</span>
          <span className={s.action.startsWith('오류') || s.action === '실패' || s.action === '차단' ? 'text-danger' : s.action.startsWith('복구') ? 'text-warn' : 'text-ink'}>
            {s.action}
            {s.detail && <span className="text-muted"> · {s.detail}</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

function RecordingView({ w }: { w: WorkerView }) {
  const rec = w.recording!
  const video = useRef<HTMLVideoElement>(null)
  const [now, setNow] = useState(0)
  useEffect(() => {
    const v = video.current
    if (!v) return
    v.currentTime = 0
    void v.play().catch(() => {})
    const t = setInterval(() => setNow(v.currentTime * 1000), 200)
    return () => clearInterval(t)
  }, [rec])
  return (
    <>
      <BrowserFrame url="/console?by=worker (녹화)">
        <video ref={video} src={rec.video} poster={rec.poster} muted playsInline className="absolute inset-0 h-full w-full object-cover object-top" data-testid="worker-video" />
      </BrowserFrame>
      <Steps steps={rec.steps.filter((s) => s.t <= now + 200)} live={false} />
      <p className="text-xs text-muted">
        {new Date(rec.recordedAt).toLocaleString('ko-KR')} · {rec.environment}에서 Playwright로 실제 실행해 녹화했어요. 자동 시연은 이 녹화를 다시 보여줘요.
      </p>
    </>
  )
}

export function OperatorPanel({ st, w }: { st: DialogState; w: WorkerView }) {
  const badge = MODE_BADGE[w.mode]
  const r = w.result
  const elapsed = w.steps.at(-1)?.t ?? 0

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-[#f7f8f9]" aria-label="업무 자동화 화면" data-testid="operator-panel" data-mode={w.mode} data-status={w.status}>
      <header className="flex items-center justify-between gap-2 border-b border-line bg-surface px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1d2430] text-[#f5c400]">
            {w.mode === 'live' ? <Radio size={17} /> : <MonitorPlay size={17} />}
          </span>
          <div className="min-w-0">
            <p className="font-display text-[15px] font-bold leading-tight">택시 호출 콘솔 · 업무 자동화</p>
            <p className="truncate text-xs text-muted">
              {w.mode === 'idle' ? 'AI가 확정한 내용이 작업 지시서에 쌓여요' : w.action === 'cancel' ? 'Playwright Worker가 호출을 취소하고 있어요' : 'Playwright Worker가 콘솔을 직접 조작해요'}
            </p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${badge.cls}`} data-testid="worker-badge">
          {badge.text}
        </span>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <WorkOrder st={st} />

        {w.mode === 'idle' && (
          <div className="rounded-xl border border-dashed border-line bg-surface p-4 text-sm leading-relaxed text-muted">
            <p className="font-bold text-ink">고객이 최종 승인하면 시작해요</p>
            <p className="mt-1">서버의 Chromium이 이 사이트의 택시 호출 콘솔을 열고, Playwright가 출발지·목적지를 검색해 고르고, 위치를 확인하고, 호출 버튼을 눌러요. 그 화면이 여기에 실시간으로 나와요.</p>
            <a href="/console" target="_blank" rel="noreferrer" className="mt-2 inline-block font-bold text-accent underline underline-offset-2">
              호출 콘솔 직접 열어 보기
            </a>
          </div>
        )}

        {w.mode === 'live' && (
          <>
            <BrowserFrame src={w.frame ? `data:image/jpeg;base64,${w.frame}` : undefined} url={w.action === 'cancel' ? '/console?request=…&by=worker' : '/console?by=worker'}>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted">
                <Loader2 size={22} className="animate-spin" />
                서버에서 브라우저를 띄우는 중이에요
              </div>
            </BrowserFrame>
            <div className="flex items-center justify-between text-xs text-muted">
              <span>
                화면 {w.frames}장 수신 · {(elapsed / 1000).toFixed(1)}초
              </span>
              {w.status === 'running' && <span className="font-bold text-accent">조작 중</span>}
            </div>
            <Steps steps={w.steps} live />
          </>
        )}

        {w.mode === 'recording' && w.recording && <RecordingView w={w} />}

        {w.mode === 'api_fallback' && (
          <div className="space-y-2 rounded-xl border border-warn/40 bg-warn-soft p-4 text-sm" data-testid="fallback-notice">
            <p className="font-bold text-warn">실시간 Worker를 쓰지 못해서 배차 API로 직접 호출했어요</p>
            <p className="text-ink">{w.reason}</p>
            <p className="text-muted">이번 호출은 Playwright 브라우저 조작 없이 진행했어요. 실제 조작 화면은 자동 시연에서 녹화로 볼 수 있어요.</p>
            <Steps steps={w.steps} live={false} />
          </div>
        )}

        {r && (
          <div className="rounded-xl border border-line bg-surface p-4" data-testid="dispatch-summary" data-status={r.status}>
            {r.status === 'assigned' ? (
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-accent">기사 배정 완료 · Mock</p>
                  <p className="mt-1 font-display text-2xl font-bold tracking-wide">{r.plate}</p>
                  <p className="text-sm text-muted">
                    {r.color} {r.model}
                    {r.driverName ? ` · 기사 ${r.driverName}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted">도착 예정</p>
                  <p className="font-display text-2xl font-bold">{r.etaMinutes}분</p>
                </div>
              </div>
            ) : r.status === 'cancelled' ? (
              <p className="font-bold">호출을 취소했어요 · Mock</p>
            ) : (
              <p className="font-bold text-danger">주변에 빈 택시가 없어요 · Mock</p>
            )}
          </div>
        )}

        {w.status === 'failed' && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">{w.reason ?? '처리하지 못했어요'}</p>}
      </div>
    </section>
  )
}
