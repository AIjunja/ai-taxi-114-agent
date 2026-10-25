import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Badge, Button, buttonClass, Section } from './components/ui'
import { ConsolePage } from './features/console/ConsolePage'
import { DEMO_PLAY_EVENT, DemoPlayer } from './features/demo/DemoPlayer'
import { TryPanel } from './features/try/TryPanel'
import { AutomationSection } from './features/automation/AutomationSection'
import { RoiSection } from './features/roi/RoiSection'
import { TechSection } from './features/tech/TechSection'

const NAV = [
  ['#demo', '자동 시연'],
  ['#try', '직접 체험'],
  ['#automation', '업무 자동화'],
  ['#roi', '비용 분석'],
  ['#tech', '기술 구조'],
] as const

const SCOPE: { label: string; tag: 'Mock' | '실시간' | '녹화' | '합성'; text: string }[] = [
  { label: '대화 엔진·확인·승인', tag: '실시간', text: '브라우저에서 실제로 동작해요' },
  { label: '음성 인식·합성', tag: '실시간', text: '브라우저 내장 기능을 써요' },
  { label: '배차', tag: 'Mock', text: '가상 서버예요. 실제 택시를 부르지 않아요' },
  { label: '업무 웹 자동화', tag: '녹화', text: 'Playwright 실제 실행을 녹화했어요' },
]

function Header() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur-sm">
      <div className="bg-ink px-4 py-1.5 text-center text-xs text-white" data-testid="poc-banner">
        개인 PoC예요. KT IS·카카오모빌리티의 공식 서비스가 아니고, 모든 배차는 가상이에요.
      </div>
      <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2 font-bold">
          <span className="num flex h-7 w-9 items-center justify-center rounded-md bg-accent text-xs text-white">114</span>
          AI 택시 상담
        </a>
        <nav className="hidden items-center gap-1 md:flex" aria-label="주요 메뉴">
          {NAV.map(([href, label]) => (
            <a key={href} href={href} className="rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:bg-black/5 hover:text-ink">
              {label}
            </a>
          ))}
        </nav>
        <button className="rounded-md p-2 md:hidden" onClick={() => setOpen((v) => !v)} aria-label={open ? '메뉴 닫기' : '메뉴 열기'} aria-expanded={open}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-line bg-bg px-4 py-2 md:hidden" aria-label="모바일 메뉴">
          {NAV.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="block rounded-md px-2 py-2.5 text-[15px] font-medium">
              {label}
            </a>
          ))}
        </nav>
      )}
    </header>
  )
}

function Hero() {
  const playDemo = () => {
    document.getElementById('demo')?.scrollIntoView()
    window.dispatchEvent(new Event(DEMO_PLAY_EVENT))
  }
  return (
    <section id="top" className="mx-auto max-w-[1120px] px-4 pt-10 sm:px-6 md:pt-14">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
        <div>
          <p className="text-sm font-semibold text-accent">114 택시 대신 불러주기 · AI 상담원 PoC</p>
          <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-tight sm:text-4xl">
            어르신이 전화로 말하면,
            <br />
            AI가 확인하고 택시를 불러요
          </h1>
          <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted sm:text-base">
            앱으로 택시를 부르기 어려운 분들이 02-114에 전화하면 지금은 상담원이 대신 불러줘요. 이 PoC는 그 반복 업무를 AI 음성 상담과 업무 웹 자동화로 처리하고, AI가 못 푼 통화만 상담원에게 넘기는 구조를 보여줘요.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="primary" size="lg" onClick={playDemo} data-testid="cta-demo">
              자동 시연 보기
            </Button>
            <a href="#try" className={buttonClass('secondary', 'lg')}>
              직접 체험하기
            </a>
            <a href="#tech" className={buttonClass('ghost', 'lg')}>
              기술 구조 보기
            </a>
            <a href="#roi" className={buttonClass('ghost', 'lg')}>
              비용 절감 분석 보기
            </a>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line text-sm" aria-label="구현 범위">
          {SCOPE.map((s) => (
            <div key={s.label} className="bg-surface p-3">
              <dt className="flex items-center justify-between gap-1 font-semibold">
                {s.label} <Badge tag={s.tag} />
              </dt>
              <dd className="mt-1 text-xs text-muted">{s.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

function Landing() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <section id="demo" className="mx-auto max-w-[1120px] px-4 pb-6 pt-8 sm:px-6" aria-label="자동 시연">
          <DemoPlayer />
        </section>

        <Section
          id="try"
          eyebrow="직접 체험"
          title="고객이 되어 전화를 걸어 보세요"
          lead="마이크로 말하거나 글로 입력해요. 타는 곳과 가는 곳을 확인하고, 최종 승인을 해야 가상 배차를 요청해요."
        >
          <TryPanel />
        </Section>

        <div className="border-y border-line bg-surface/60">
          <Section
            id="automation"
            eyebrow="업무 자동화"
            title="AI가 상담원용 업무 웹을 조작하는 순서"
            lead="AI가 확정한 내용을 Playwright Worker가 받아 상담원 업무 웹에 입력하고 호출 버튼을 눌러요. 녹화와 실시간 화면을 나눠서 보여줘요."
          >
            <AutomationSection />
          </Section>
        </div>

        <Section
          id="roi"
          eyebrow="비용 분석"
          title="도입하면 얼마나 줄어드는지 직접 바꿔 보세요"
          lead="값을 바꾸면 바로 다시 계산해요. 기본값은 공개 기사 수치와 가정으로 만든 예시예요."
        >
          <RoiSection />
        </Section>

        <div className="border-t border-line bg-surface/60">
          <Section id="tech" eyebrow="기술 및 프로젝트" title="왜 이렇게 만들었는지">
            <TechSection />
          </Section>
        </div>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-2 px-4 py-8 text-sm text-muted sm:px-6">
          <p className="font-semibold text-ink">개인 포트폴리오용 PoC · 신준형</p>
          <p>KT IS, 카카오모빌리티와 관계없는 개인 프로젝트예요. 실제 택시 호출, 결제, 카카오 T 계정 연동은 하지 않아요.</p>
          <p>음성과 대화 내용은 저장하지 않아요. 서버 로그에는 결과 종류만 남기고 장소·IP는 남기지 않아요.</p>
          <a href="https://github.com/AIjunja/ai-taxi-114-agent" className="font-semibold text-accent underline underline-offset-2">
            GitHub 저장소
          </a>
        </div>
      </footer>
    </>
  )
}

export function App() {
  if (window.location.pathname.startsWith('/console')) return <ConsolePage />
  return <Landing />
}
