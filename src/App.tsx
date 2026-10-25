import { useState } from 'react'
import { ConsolePage } from './features/console/ConsolePage'
import { CallPanel } from './features/call/CallPanel'
import { OperatorPanel } from './features/call/OperatorPanel'
import { useCall } from './features/call/useCall'
import { RoiSection } from './features/roi/RoiSection'
import { TechSection } from './features/tech/TechSection'

function Workspace({ mode }: { mode: 'live' | 'demo' }) {
  const call = useCall(mode)
  return (
    <div className="grid gap-3 lg:h-[calc(100dvh-112px)] lg:min-h-[620px] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="h-[640px] min-h-0 lg:h-auto">
        <CallPanel call={call} mode={mode} />
      </div>
      <div className="min-h-[520px] lg:min-h-0">
        <OperatorPanel st={call.state} w={call.worker} />
      </div>
    </div>
  )
}

function Home() {
  const [mode, setMode] = useState<'live' | 'demo'>('live')
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-4">
          <a href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-7 w-10 items-center justify-center rounded-md bg-accent font-display text-[13px] font-bold text-white">114</span>
            <span className="hidden font-display text-[15px] font-bold sm:inline">AI 택시 상담</span>
          </a>
          <div className="flex rounded-full bg-bg p-1 text-sm font-bold" role="tablist" aria-label="체험 방식">
            {(
              [
                ['live', '직접 통화'],
                ['demo', '자동 시연'],
              ] as const
            ).map(([m, label]) => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} data-testid={`mode-${m}`} className={`rounded-full px-3.5 py-1.5 transition-colors ${mode === m ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>
                {label}
              </button>
            ))}
          </div>
          <nav className="hidden items-center gap-1 text-sm font-semibold text-muted md:flex" aria-label="더 보기">
            <a href="/console" className="rounded-md px-2.5 py-1.5 hover:bg-bg hover:text-ink">
              호출 콘솔
            </a>
            <a href="#roi" className="rounded-md px-2.5 py-1.5 hover:bg-bg hover:text-ink">
              비용 계산
            </a>
            <a href="#tech" className="rounded-md px-2.5 py-1.5 hover:bg-bg hover:text-ink">
              기술 구조
            </a>
          </nav>
        </div>
        <p className="border-t border-line bg-ink px-4 py-1 text-center text-[11px] text-white/85" data-testid="poc-banner">
          개인 PoC예요. KT IS·카카오모빌리티 공식 서비스가 아니고, 실제 택시 호출·결제는 하지 않아요. 음성과 대화는 저장하지 않아요.
        </p>
      </header>

      <main className="mx-auto max-w-[1400px] px-3 py-3 sm:px-4">
        <Workspace key={mode} mode={mode} />
      </main>

      <section id="roi" className="mx-auto max-w-[1400px] scroll-mt-24 px-4 py-14">
        <h2 className="font-display text-2xl font-bold">비용 계산</h2>
        <p className="mt-2 max-w-[640px] text-[15px] text-muted">상담원이 모두 처리할 때와 AI가 먼저 처리할 때의 월 비용을 비교해요. 기본값은 공개 기사 수치와 가정으로 만든 예시예요.</p>
        <div className="mt-6">
          <RoiSection />
        </div>
      </section>

      <section id="tech" className="scroll-mt-24 border-t border-line bg-surface">
        <div className="mx-auto max-w-[1400px] px-4 py-14">
          <h2 className="font-display text-2xl font-bold">기술 구조</h2>
          <div className="mt-6">
            <TechSection />
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-1.5 px-4 py-8 text-sm text-muted">
          <p className="font-bold text-ink">개인 포트폴리오용 PoC · 신준형</p>
          <p>KT IS, 카카오모빌리티와 관계없는 개인 프로젝트예요. 실제 택시 호출, 결제, 카카오 T 계정 연동은 하지 않아요.</p>
          <a href="https://github.com/AIjunja/ai-taxi-114-agent" className="font-bold text-accent underline underline-offset-2">
            GitHub 저장소
          </a>
        </div>
      </footer>
    </>
  )
}

export function App() {
  if (window.location.pathname.startsWith('/console')) return <ConsolePage />
  return <Home />
}
