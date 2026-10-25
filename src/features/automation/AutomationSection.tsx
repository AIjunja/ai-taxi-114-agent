import { useEffect, useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { ExternalLink } from 'lucide-react'
import { Badge, Panel } from '../../components/ui'
import { useTrySession, type LogEntry } from '../../lib/session-store'
import { STAGE_LABEL } from '../dialog/machine'

interface RunLog {
  recordedAt: string
  environment: string
  baseUrl: string
  job: { origin: string; destination: string; approved: boolean }
  steps: { t: number; action: string; detail?: string }[]
  result: { status: string; plate?: string; attempts: number }
  durationMs: number
  video: string
  poster?: string
}

const KIND_LABEL: Record<LogEntry['kind'], string> = {
  stt: '음성',
  input: '입력',
  agent: 'AI',
  state: '상태',
  approval: '승인',
  api: 'API',
  error: '오류',
  guard: '방지',
}

function RecordedRun() {
  const [run, setRun] = useState<RunLog | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    fetch('/evidence/playwright-run.json')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setRun)
      .catch(() => setMissing(true))
  }, [])

  if (missing) return <p className="text-sm text-muted">녹화 기록을 불러오지 못했어요. 페이지를 새로고침해 주세요.</p>
  if (!run) return <p className="text-sm text-muted">녹화 기록을 불러오는 중이에요.</p>

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div>
        <video src={run.video} poster={run.poster} controls muted playsInline preload="metadata" className="w-full rounded-lg border border-line bg-black" data-testid="evidence-video" />
        <p className="mt-2 text-xs text-muted">
          {new Date(run.recordedAt).toLocaleString('ko-KR')}에 {run.environment}에서 실제로 실행한 화면이에요. 공개 사이트에서 실시간으로 다시 실행하지는 않아요.
        </p>
      </div>
      <div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>
            <span className="text-muted">작업</span> {run.job.origin} → {run.job.destination}
          </span>
          <span>
            <span className="text-muted">결과</span> <b>{run.result.status === 'assigned' ? `배차됨 ${run.result.plate}` : run.result.status}</b>
          </span>
          <span>
            <span className="text-muted">시도</span> <span className="num">{run.result.attempts}</span>번
          </span>
          <span>
            <span className="text-muted">소요</span> <span className="num">{(run.durationMs / 1000).toFixed(1)}</span>초 (측정값)
          </span>
        </div>
        <ol className="mt-3 max-h-[300px] space-y-1 overflow-y-auto rounded-lg bg-bg p-3 font-mono text-xs" data-testid="evidence-log">
          {run.steps.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="num w-14 shrink-0 text-right text-muted">{(s.t / 1000).toFixed(2)}s</span>
              <span className={s.action.startsWith('오류') ? 'text-danger' : s.action.startsWith('복구') ? 'text-warn' : ''}>
                {s.action}
                {s.detail && <span className="text-muted"> · {s.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-muted">기록 파일은 Worker가 실행 중에 직접 남긴 값이에요. 2번째 시도는 일부러 넣은 오류에서 복구한 과정이에요.</p>
      </div>
    </div>
  )
}

function LiveSession() {
  const s = useTrySession()
  if (!s.sessionId) {
    return (
      <div className="rounded-lg bg-bg p-6 text-center">
        <p className="font-semibold">아직 체험 통화가 없어요</p>
        <p className="mt-1 text-sm text-muted">직접 체험에서 전화를 걸면 이 브라우저 안의 진행 상황이 여기에 그대로 나와요.</p>
        <a href="#try" className="mt-3 inline-block text-sm font-semibold text-accent underline underline-offset-2">
          직접 체험하러 가기
        </a>
      </div>
    )
  }
  const st = s.state
  const d = s.lastDispatch
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <dl className="space-y-2 rounded-lg bg-bg p-4 text-sm" data-testid="live-summary">
        {[
          ['단계', st ? STAGE_LABEL[st.stage] : '-'],
          ['확정 출발지', st?.origin?.name ?? '-'],
          ['확정 목적지', st?.destination?.name ?? '-'],
          ['최종 승인', st?.approved ? '승인함' : '아직 안 함'],
          ['배차 요청', s.pending ? '응답 기다리는 중' : d ? `${d.result.status} · ${d.source === 'server' ? '서버' : '브라우저 내 Mock'} · ${d.latencyMs}ms` : '-'],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <ol className="max-h-[300px] space-y-1 overflow-y-auto rounded-lg border border-line p-3 font-mono text-xs" data-testid="live-log">
        {s.log.map((l, i) => (
          <li key={i} className="flex gap-2">
            <span className="num shrink-0 text-muted">{new Date(l.at).toLocaleTimeString('ko-KR', { hour12: false })}</span>
            <span className={`w-8 shrink-0 font-bold ${l.kind === 'error' ? 'text-danger' : l.kind === 'guard' || l.kind === 'approval' ? 'text-warn' : 'text-accent'}`}>{KIND_LABEL[l.kind]}</span>
            <span className="min-w-0">{l.text}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function AutomationSection() {
  return (
    <div className="space-y-6">
      <Tabs.Root defaultValue="recorded">
        <Tabs.List className="inline-flex rounded-lg border border-line bg-surface p-1" aria-label="업무 자동화 보기 방식">
          <Tabs.Trigger value="recorded" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-muted data-[state=active]:bg-bg data-[state=active]:text-ink">
            Playwright 실행 <Badge tag="녹화" />
          </Tabs.Trigger>
          <Tabs.Trigger value="live" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-muted data-[state=active]:bg-bg data-[state=active]:text-ink">
            내 체험 세션 <Badge tag="실시간" />
          </Tabs.Trigger>
        </Tabs.List>
        <Panel className="mt-3 p-4 sm:p-5">
          <Tabs.Content value="recorded">
            <RecordedRun />
          </Tabs.Content>
          <Tabs.Content value="live">
            <LiveSession />
          </Tabs.Content>
        </Panel>
      </Tabs.Root>

      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <Panel className="p-5">
          <p className="font-bold">Playwright Worker가 하는 일</p>
          <ol className="mt-3 space-y-2 text-sm">
            {[
              ['작업 받기', 'AI가 확정한 출발지·목적지와 승인 여부를 받아요. 승인이 false면 브라우저를 띄우지 않고 거절해요.'],
              ['업무 웹 열기', '허용 목록의 주소만 열어요. 다른 사이트로 가는 요청은 차단해요.'],
              ['입력과 클릭', '출발지·목적지를 고르고, 승인 체크 후 호출 버튼을 눌러요.'],
              ['결과 읽기', '화면에 나온 배차 결과를 읽어 AI 상담원에게 돌려줘요.'],
              ['오류 복구', '오류 문구가 보이면 기록하고 최대 2번까지 다시 시도해요. 전체 제한 시간은 30초예요.'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent-strong">{i + 1}</span>
                <span>
                  <b>{t}</b>
                  <span className="block text-muted">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel className="p-5 text-sm">
          <p className="font-bold">공개 사이트에서 실시간 실행을 하지 않는 이유</p>
          <p className="mt-2 text-muted">
            브라우저 자동화는 요청마다 브라우저를 띄워서 비용과 악용 위험이 커요. 그래서 공개 사이트는 실제 실행 녹화와 기록 파일을 보여주고, 실행은 로컬·격리 환경에서만 해요.
          </p>
          <p className="mt-2 text-muted">상용화할 때는 Worker를 별도 서버에 두고, 세션 분리·동시 실행 1개·30초 제한·허용 주소 목록을 그대로 적용해요.</p>
          <a href="/console" className="mt-3 inline-flex items-center gap-1 font-semibold text-accent underline underline-offset-2">
            Worker가 조작하는 업무 웹 직접 열기 <ExternalLink size={14} />
          </a>
        </Panel>
      </div>
    </div>
  )
}
