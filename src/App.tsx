import { useState, type ReactNode } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { ConsolePage } from './features/console/ConsolePage'
import { VoiceDiagnostics } from './features/diagnostics/VoiceDiagnostics'
import { CallPanel } from './features/call/CallPanel'
import { OperatorPanel, orderFromDialog } from './features/call/OperatorPanel'
import { useCall } from './features/call/useCall'
import { AssistWorkspace } from './features/assist/AssistWorkspace'
import { AssistRoiSection } from './features/roi/AssistRoiSection'
import { RoiSection } from './features/roi/RoiSection'
import { TechSection } from './features/tech/TechSection'
import { CompareSection } from './features/report/CompareSection'
import { ResultsSection } from './features/report/ResultsSection'
import { DecisionSection } from './features/report/DecisionSection'

type Mode = 'assist' | 'auto' | 'demo'

/** 완전 자동 시나리오: AI 음성 상담원이 혼자 처리한다 (비교용) */
function AutoWorkspace({ demo }: { demo: boolean }) {
  const call = useCall(demo ? 'demo' : 'live')
  return (
    <div className="grid gap-3 lg:h-[calc(100dvh-112px)] lg:min-h-[620px] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="h-[640px] min-h-0 lg:h-auto">
        <CallPanel call={call} mode={demo ? 'demo' : 'live'} />
      </div>
      <div className="min-h-[520px] lg:min-h-0">
        <OperatorPanel order={orderFromDialog(call.state)} w={call.worker} />
      </div>
    </div>
  )
}

function Section({ id, title, lead, children, tinted }: { id: string; title: string; lead?: string; children: ReactNode; tinted?: boolean }) {
  return (
    <section id={id} className={`scroll-mt-24 ${tinted ? 'border-y border-line bg-surface' : ''}`}>
      <div className="mx-auto max-w-[1400px] px-4 py-12">
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        {lead && <p className="mt-2 max-w-[720px] text-[15px] text-muted">{lead}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </section>
  )
}

const MODES: [Mode, string][] = [
  ['assist', '상담원 보조 · 기본'],
  ['auto', '완전 자동 · 비교용'],
  ['demo', '완전 자동 시연'],
]

function Home() {
  const [mode, setMode] = useState<Mode>('assist')
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-4">
          <a href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-7 w-10 items-center justify-center rounded-md bg-accent font-display text-[13px] font-bold text-white">114</span>
            <span className="hidden font-display text-[15px] font-bold xl:inline">상담원 반복 업무 줄이기 PoC</span>
          </a>
          <div className="flex overflow-x-auto rounded-full bg-bg p-1 text-[13px] font-bold" role="tablist" aria-label="시나리오">
            {MODES.map(([m, label]) => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} data-testid={`mode-${m}`} className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 transition-colors ${mode === m ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>
                {label}
              </button>
            ))}
          </div>
          <nav className="hidden items-center gap-0.5 text-[13px] font-semibold text-muted lg:flex" aria-label="더 보기">
            {[
              ['#compare', '적용 전후'],
              ['#results', '실험 결과'],
              ['#roi', '비용'],
              ['#decisions', '판단 기록'],
              ['/diagnostics', '음성 진단'],
              ['/console', '호출 콘솔'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-md px-2 py-1.5 hover:bg-bg hover:text-ink">
                {label}
              </a>
            ))}
          </nav>
        </div>
        <p className="border-t border-line bg-ink px-4 py-1 text-center text-[11px] text-white/85" data-testid="poc-banner">
          개인 PoC예요. KT IS의 공식 사업이 아니고 카카오모빌리티와도 관계없어요. 실제 택시 호출·결제는 하지 않아요.
        </p>
      </header>

      <main className="mx-auto max-w-[1400px] px-3 py-3 sm:px-4">
        {mode === 'assist' ? <AssistWorkspace /> : <AutoWorkspace key={mode} demo={mode === 'demo'} />}
      </main>

      <Section id="compare" title="적용 전후" lead="상담원이 하던 일 중 무엇을 AI와 Playwright가 맡고, 무엇을 사람에게 남겼는지예요." tinted>
        <CompareSection />
      </Section>

      <Section id="results" title="실험 결과" lead="성공한 것과 실패한 것을 모두 적었어요. 숫자는 스크립트로 실행한 결과이고, 직접 만든 예시 데이터라는 한계가 있어요.">
        <ResultsSection />
      </Section>

      <Section id="roi" title="비용과 효과" lead="상담원을 줄이는 계산이 아니라, 건당 처리시간·재작업이 줄어든 만큼이 AI 운영비보다 가치가 있는지를 봐요." tinted>
        <Tabs.Root defaultValue="assist">
          <Tabs.List className="mb-4 inline-flex rounded-lg border border-line bg-bg p-1 text-sm font-bold" aria-label="계산 방식">
            <Tabs.Trigger value="assist" className="rounded-md px-3 py-1.5 text-muted data-[state=active]:bg-surface data-[state=active]:text-ink">
              상담원 보조 (기본)
            </Tabs.Trigger>
            <Tabs.Trigger value="replace" className="rounded-md px-3 py-1.5 text-muted data-[state=active]:bg-surface data-[state=active]:text-ink">
              완전 자동 대체 (참고)
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="assist">
            <AssistRoiSection />
          </Tabs.Content>
          <Tabs.Content value="replace">
            <p className="mb-4 text-sm text-warn">처음 만든 계산이에요. 상담원 인건비를 대체한다는 전제라 지금 PoC의 기본 판단과 맞지 않아서 참고로만 남겼어요.</p>
            <RoiSection />
          </Tabs.Content>
        </Tabs.Root>
      </Section>

      <Section id="decisions" title="판단 기록" lead="왜 이 문제를 골랐고, 왜 이 기술을 썼고, 무엇이 실패해서 어떻게 바꿨는지예요.">
        <DecisionSection />
      </Section>

      <Section id="tech" title="기술 구조" tinted>
        <TechSection />
      </Section>

      <footer>
        <div className="mx-auto flex max-w-[1400px] flex-col gap-1.5 px-4 py-8 text-sm text-muted">
          <p className="font-bold text-ink">개인 포트폴리오용 PoC · 신준형</p>
          <p>KT IS의 공식 사업이 아니에요. 실제 택시 호출, 결제, 카카오 T 계정 연동은 하지 않아요. 음성과 대화는 저장하지 않아요.</p>
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
  if (window.location.pathname.startsWith('/diagnostics')) return <VoiceDiagnostics />
  return <Home />
}
