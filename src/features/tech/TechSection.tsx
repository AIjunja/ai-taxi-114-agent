import { ArrowRight, ExternalLink } from 'lucide-react'
import { Badge, Panel } from '../../components/ui'
import report from '../../data/test-report.json'

const FLOW_BEFORE = ['고객이 02-114로 전화', '상담원이 출발지·목적지를 듣고 받아 적기', '상담원이 카카오 T로 대신 호출', '배차 결과를 고객에게 안내']
const FLOW_AFTER = [
  ['AI 상담원이 전화 받기', '음성 인식 → 대화 관리'],
  ['출발지·목적지를 되읽어 확인', '고객이 맞다고 할 때만 확정'],
  ['최종 승인 받기', "'네' 전에는 호출 잠금"],
  ['Playwright가 업무 웹 조작', '사람이 하던 입력과 클릭을 대신'],
  ['배차 결과를 음성으로 안내', '한 줄씩 끊어서'],
  ['실패하면 상담원에게 넘기기', '사람이 이어서 처리'],
]

const STACK: { name: string; solves: string; status: '사용' | '후보' }[] = [
  { name: 'React 18 + TypeScript + Vite', solves: '시연·체험·업무 웹을 한 코드로 만들고 대화 상태 타입을 컴파일 단계에서 검사해요.', status: '사용' },
  { name: '규칙 기반 대화 엔진 (machine.ts)', solves: '확인·승인 단계를 건너뛸 수 없게 해요. 순수 함수라서 자동 시연과 체험이 같은 로직을 쓰고 테스트하기 쉬워요.', status: '사용' },
  { name: 'Web Speech API', solves: '서버 키 없이 브라우저에서 음성 인식·합성을 해요. 공개 데모에서 키가 새어 나갈 일이 없어요.', status: '사용' },
  { name: 'Playwright', solves: '상담원 업무 웹 입력·클릭을 자동화하고, 같은 도구로 E2E 테스트와 실행 녹화를 남겨요.', status: '사용' },
  { name: 'Vercel Functions', solves: 'Mock 배차 API를 서버에 두고 승인 검사, 중복 방지, 요청량 제한을 해요.', status: '사용' },
  { name: 'Radix UI · Tailwind CSS', solves: '슬라이더·스위치·탭을 키보드와 화면 낭독기로도 쓸 수 있게 해요.', status: '사용' },
  { name: 'Recharts · Motion', solves: '성공률별 비용 그래프와 말풍선 등장처럼 꼭 필요한 움직임만 넣어요.', status: '사용' },
  { name: 'Vitest', solves: '대화 흐름, 비용 계산, 배차 API 규칙을 단위 테스트로 고정해요.', status: '사용' },
  { name: '상용 STT·TTS (전화 음질용)', solves: '8kHz 전화 음성과 사투리·어르신 발화 인식률을 높여요.', status: '후보' },
  { name: 'LLM 기반 발화 이해', solves: '"병원 앞 편의점" 같은 자유 발화를 장소 후보로 바꿔요. 확정은 지금처럼 규칙 엔진이 해요.', status: '후보' },
  { name: '지오코딩·POI 검색 API', solves: '24곳 데모 목록 대신 전국 장소를 찾아요.', status: '후보' },
  { name: '전화망 연동 (SIP·IVR)', solves: '실제 02-114 통화를 AI 상담원에게 연결해요.', status: '후보' },
  { name: '배차 플랫폼 공식 API', solves: '화면 자동화 대신 제휴 API로 호출해요. 제휴가 없으면 화면 자동화가 대안이에요.', status: '후보' },
]

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-lg font-bold">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  )
}

export function TechSection() {
  return (
    <div className="space-y-14">
      <Block title="문제를 발견한 배경">
        <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
          <div className="space-y-3 text-[15px] leading-relaxed">
            <p>
              KT IS는 2025년 4월부터 02-114로 전화하면 상담원이 카카오 T 택시를 대신 불러주는 서비스를 운영하고 있어요. 앱을 쓰기 어려운 어르신을 위한 서비스예요.
            </p>
            <p>
              공개 기사 기준 누적 약 15만 건, 이용자 약 6만 명이에요. 운영 시간은 오전 8시부터 오후 7시까지예요. 호출 한 건은 듣고, 확인하고, 앱에 입력하는 같은 순서를 반복해요.
            </p>
            <p className="font-semibold">그래서 정해진 순서는 AI와 자동화가 맡고, 사람은 AI가 못 푼 통화에 집중하는 구조를 제안했어요.</p>
          </div>
          <Panel className="p-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge tag="공개 자료" />
              <span className="text-muted">전자신문 2026년 8월 7일</span>
            </div>
            <dl className="mt-3 space-y-1.5">
              {[
                ['출시', '2025년 4월'],
                ['누적 이용', '약 15만 건'],
                ['누적 이용자', '약 6만 명'],
                ['운영 시간', '매일 08:00~19:00'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-muted">{k}</dt>
                  <dd className="num font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <a href="https://www.etnews.com/20260807000116" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 font-semibold text-accent underline underline-offset-2">
              기사 원문 <ExternalLink size={13} />
            </a>
          </Panel>
        </div>
      </Block>

      <Block title="기존 상담 흐름과 제안한 자동화 구조">
        <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
          <Panel className="p-4">
            <p className="text-sm font-bold text-muted">지금: 상담원이 모두 처리</p>
            <ol className="mt-3 space-y-2">
              {FLOW_BEFORE.map((s, i) => (
                <li key={s} className="flex gap-2 text-sm">
                  <span className="num w-5 shrink-0 font-bold text-muted">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </Panel>
          <Panel className="p-4">
            <p className="text-sm font-bold text-accent">제안: AI가 정해진 순서를 맡고, 사람은 예외를 맡음</p>
            <ol className="mt-3 grid gap-2 sm:grid-cols-2">
              {FLOW_AFTER.map(([t, d], i) => (
                <li key={t} className="rounded-lg bg-bg p-3 text-sm">
                  <p className="font-semibold">
                    <span className="num mr-1.5 text-accent">{i + 1}</span>
                    {t}
                  </p>
                  <p className="mt-0.5 text-muted">{d}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
        <ArchitectureDiagram />
      </Block>

      <Block title="사용한 기술과 채택 이유">
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b border-line bg-bg text-xs text-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">기술</th>
                <th className="px-4 py-2.5 font-semibold">해결하는 문제</th>
                <th className="px-4 py-2.5 font-semibold">상태</th>
              </tr>
            </thead>
            <tbody>
              {STACK.map((s) => (
                <tr key={s.name} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-semibold">{s.name}</td>
                  <td className="px-4 py-3 text-muted">{s.solves}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${s.status === '사용' ? 'bg-accent-soft text-accent-strong' : 'bg-bg text-muted'}`}>
                      {s.status === '사용' ? '사용함' : '도입 후보'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">도입 후보는 이 PoC에서 구현하지 않았어요.</p>
      </Block>

      <div className="grid gap-8 md:grid-cols-2">
        <Block title="Voice AI 대화 관리 방식">
          <ul className="space-y-2 text-[15px] leading-relaxed">
            <li>대화는 12개 단계의 상태 기계로 관리해요. 단계마다 다음으로 넘어가는 조건이 하나씩 정해져 있어요.</li>
            <li>장소는 되읽고 "네"를 들어야 확정해요. "아니요"면 다시 묻고, 못 찾으면 큰 건물이나 역 이름을 물어요.</li>
            <li>언어 모델은 쓰지 않았어요. 택시 호출은 틀리면 안 되는 일이라, 자유 발화 이해는 나중에 붙여도 확정은 규칙이 맡게 했어요.</li>
          </ul>
        </Block>
        <Block title="고령층을 위한 UX 설계">
          <ul className="space-y-2 text-[15px] leading-relaxed">
            <li>한 번에 하나만 묻고, '배차'·'픽업' 같은 업무 용어를 쓰지 않아요.</li>
            <li>차 번호는 "일이, 가, 삼사오육"처럼 끊어 읽고, 원하면 한 번 더 불러줘요.</li>
            <li>통화 화면 글자는 18px 이상이에요. 마이크가 안 되면 글로 이어서 할 수 있어요.</li>
            <li>문구는 토스 UX 라이팅 원칙으로 점검했어요. 에러에는 원인과 다음 행동을 함께 써요.</li>
          </ul>
        </Block>
        <Block title="호출 승인과 중복 요청 방지">
          <ul className="space-y-2 text-[15px] leading-relaxed">
            <li>대화 엔진: 최종 승인 단계에서 "네"를 들어야만 호출 요청이 생겨요.</li>
            <li>화면: 같은 시도 번호의 요청은 한 번만 보내요. 버튼을 여러 번 눌러도 마찬가지예요.</li>
            <li>서버: approved가 true가 아니면 403으로 거절해요. 같은 요청 키는 새로 배차하지 않고 처음 결과를 돌려줘요.</li>
            <li>Worker: 승인이 없는 작업은 브라우저를 띄우기 전에 거절해요.</li>
          </ul>
        </Block>
        <Block title="Mock Dispatch 구조">
          <ul className="space-y-2 text-[15px] leading-relaxed">
            <li>POST /api/dispatch 하나예요. 장소는 이름이 아니라 미리 정한 ID만 받아요.</li>
            <li>IP별 10분 20회로 제한하고, 요청 키는 10분 뒤 지워요. 아무것도 영구 저장하지 않아요.</li>
            <li>서버가 꺼지거나 응답이 늦으면 브라우저 안의 같은 Mock으로 계속하고, 화면에 출처를 표시해요.</li>
            <li>환경변수 DISPATCH_DISABLED=1로 서버 배차를 바로 멈출 수 있어요.</li>
          </ul>
        </Block>
      </div>

      <Block title="테스트 결과">
        <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
          <Panel className="p-4">
            <p className="text-xs text-muted">마지막 확인</p>
            <p className="num mt-0.5 font-bold">{new Date(report.checkedAt).toLocaleString('ko-KR')}</p>
            <p className="mt-0.5 text-xs text-muted">{report.environment}</p>
            <dl className="mt-3 space-y-1.5 text-sm">
              {report.suites.map((s) => (
                <div key={s.name} className="flex justify-between gap-2">
                  <dt className="text-muted">{s.name}</dt>
                  <dd className="num font-semibold" data-testid={`suite-${s.id}`}>
                    {s.passed}/{s.total} 통과
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-line bg-bg text-xs text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">확인 항목</th>
                  <th className="px-4 py-2.5 font-semibold">방법</th>
                  <th className="px-4 py-2.5 font-semibold">결과</th>
                </tr>
              </thead>
              <tbody>
                {report.checks.map((c) => (
                  <tr key={c.item} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5">{c.item}</td>
                    <td className="px-4 py-2.5 text-muted">{c.how}</td>
                    <td className={`px-4 py-2.5 font-semibold ${c.result === '통과' ? 'text-accent-strong' : 'text-warn'}`}>{c.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Block>

      <Block title="상용화하려면 더 필요한 것">
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['실제 통화 데이터로 성공률 측정', '지금 ROI의 성공률 70%는 가정이에요. 녹취 기반 평가가 먼저예요.'],
            ['전화 음질용 음성 인식', '8kHz 전화 음성, 사투리, 주변 소음에서 다시 검증해야 해요.'],
            ['배차 플랫폼과의 제휴', '화면 자동화는 화면이 바뀌면 깨져요. 공식 API 제휴가 가장 안정적이에요.'],
            ['상담원 전환 설계', 'AI가 막히면 대화 기록을 그대로 넘겨 고객이 다시 말하지 않게 해야 해요.'],
            ['개인정보 처리 기준', '전화번호·위치·녹취 보관 기간과 동의 절차를 정해야 해요.'],
            ['운영 지표', '자동 처리율, 전환율, 통화 시간, 재통화율을 매일 봐야 해요.'],
          ].map(([t, d]) => (
            <li key={t} className="rounded-lg border border-line bg-surface p-4 text-sm">
              <p className="font-bold">{t}</p>
              <p className="mt-1 text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </Block>
    </div>
  )
}

function ArchitectureDiagram() {
  const nodes: { label: string; sub: string; tag: string; real: boolean }[] = [
    { label: '고객 음성', sub: '마이크 또는 글', tag: '브라우저', real: true },
    { label: '음성 인식', sub: 'Web Speech API', tag: '브라우저', real: true },
    { label: '대화 엔진', sub: '확인 · 승인', tag: '브라우저', real: true },
    { label: 'Playwright Worker', sub: '업무 웹 조작', tag: '로컬 실행', real: true },
    { label: 'Mock Dispatch', sub: '/api/dispatch', tag: 'Vercel', real: true },
    { label: '음성 안내', sub: '음성 합성', tag: '브라우저', real: true },
  ]
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface p-4" aria-label="시스템 구조">
      <ol className="flex min-w-[760px] items-stretch gap-2">
        {nodes.map((n, i) => (
          <li key={n.label} className="flex flex-1 items-center gap-2">
            <div className="flex-1 rounded-lg border border-line bg-bg p-3">
              <p className="text-[11px] font-semibold text-muted">{n.tag}</p>
              <p className="mt-0.5 text-sm font-bold">{n.label}</p>
              <p className="text-xs text-muted">{n.sub}</p>
            </div>
            {i < nodes.length - 1 && <ArrowRight size={16} className="shrink-0 text-muted" aria-hidden />}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted">
        공개 사이트에서는 Worker 단계를 녹화로 보여주고, 직접 체험은 대화 엔진에서 Mock Dispatch API로 바로 요청해요. 실제 택시 플랫폼과는 연결되어 있지 않아요.
      </p>
    </div>
  )
}
