import { ArrowRight, ExternalLink } from 'lucide-react'
import report from '../../data/test-report.json'

const PIPELINE: { label: string; tech: string; where: string }[] = [
  { label: '듣기 (STT)', tech: 'Web Speech API · SpeechRecognition', where: '방문자 브라우저' },
  { label: '알아듣기', tech: '규칙 기반 대화 엔진', where: '방문자 브라우저' },
  { label: '말하기 (TTS)', tech: 'Web Speech API · speechSynthesis', where: '방문자 브라우저' },
  { label: '콘솔 조작', tech: 'Playwright + 서버 Chromium', where: 'Vercel Function' },
  { label: '배차', tech: 'Mock Dispatch API', where: 'Vercel Function' },
]

const STACK: { name: string; role: string; status: '사용' | '후보' }[] = [
  { name: 'STT · Web Speech API (SpeechRecognition)', role: '고객이 한 말을 문장으로 바꿔요. 말하는 동안 중간 인식 결과를 보여줘요. Chrome·Edge에서는 브라우저 회사의 음성 인식 서버를 거쳐요.', status: '사용' },
  { name: 'TTS · Web Speech API (speechSynthesis)', role: '답변을 기기의 한국어 음성으로 읽어요. 문장마다 쉬고, 천천히 말하기·소리 크기·다시 듣기를 지원해요.', status: '사용' },
  { name: 'AI 대화 엔진 (규칙 기반 상태 기계)', role: '장소 인식, 후보 제시, 되읽기, 수정, 취소, 상담원 연결을 처리해요. 호출은 최종 승인 단계에서만 나가게 막아요. 언어 모델은 쓰지 않았어요.', status: '사용' },
  { name: 'Playwright + @sparticuz/chromium', role: '서버에서 Chromium을 띄워 택시 호출 콘솔에 실제로 입력하고 클릭해요. 화면은 CDP 스크린캐스트로 실시간 전송해요.', status: '사용' },
  { name: 'Mock Dispatch API (Vercel Functions)', role: '호출 접수 → 배차 대기 → 기사 배정 → 취소를 흉내 내요. 승인 검사, 중복 요청 방지, 요청량 제한을 해요. 요청 ID에 서명을 넣어 상태를 저장 없이 계산해요.', status: '사용' },
  { name: '택시 호출 콘솔 (Mock 업무 웹)', role: '호출 담당자가 쓰는 화면을 가정해 만들었어요. 실제 카카오모빌리티 화면을 본 적은 없고, 복제하지 않았어요.', status: '사용' },
  { name: 'React · TypeScript · Vite · Tailwind · Radix · Recharts · Motion', role: '화면 구성, 접근성 있는 조작 부품, 비용 그래프, 말풍선 전환에 썼어요.', status: '사용' },
  { name: 'Vitest · Playwright Test', role: '대화 흐름과 배차 규칙은 단위 테스트로, 화면 흐름은 공개 URL에서 E2E로 확인해요.', status: '사용' },
  { name: 'LLM 발화 이해 (OpenAI·Gemini 등)', role: '"병원 앞 편의점" 같은 자유로운 말을 장소 후보로 바꿀 수 있어요. 공개 데모는 API 비용과 키 관리 때문에 넣지 않았어요.', status: '후보' },
  { name: '전화 음질용 상용 STT·TTS', role: '8kHz 전화 음성과 어르신 발화, 사투리 인식률을 높여요.', status: '후보' },
  { name: '전화망 연동 (SIP·IVR)', role: '실제 02-114 통화를 AI 상담원에게 연결해요.', status: '후보' },
  { name: '지오코딩·POI 검색', role: '데모 장소 29곳 대신 전국 주소와 건물을 찾아요.', status: '후보' },
  { name: '배차 플랫폼 공식 API', role: '화면 자동화 대신 제휴 API로 호출해요. 화면이 바뀌어도 깨지지 않아요.', status: '후보' },
]

export function TechSection() {
  return (
    <div className="space-y-12">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-3 text-[15px] leading-relaxed">
          <h3 className="font-display text-lg font-bold">왜 만들었나</h3>
          <p>KT IS는 2025년 4월부터 02-114로 전화하면 상담원이 카카오 T 택시를 대신 불러주는 서비스를 운영해요. 공개 기사 기준 누적 약 15만 건, 이용자 약 6만 명이에요.</p>
          <p>호출 한 건은 '듣고, 되묻고, 앱에 입력하고, 결과를 읽어 주는' 같은 순서예요. 이 PoC는 그 순서를 AI 상담원과 화면 자동화가 맡고, 사람은 AI가 못 푼 통화를 맡는 구조를 보여줘요.</p>
          <a href="https://www.etnews.com/20260807000116" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-accent underline underline-offset-2">
            전자신문 2026년 8월 7일 기사 <ExternalLink size={13} />
          </a>
        </div>
        <div>
          <h3 className="font-display text-lg font-bold">한 통화가 처리되는 길</h3>
          <ol className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
            {PIPELINE.map((p, i) => (
              <li key={p.label} className="flex flex-1 items-center gap-2">
                <div className="flex-1 rounded-lg border border-line bg-bg p-3">
                  <p className="text-[11px] font-bold text-muted">{p.where}</p>
                  <p className="mt-0.5 font-display text-sm font-bold">{p.label}</p>
                  <p className="mt-0.5 text-xs text-muted">{p.tech}</p>
                </div>
                {i < PIPELINE.length - 1 && <ArrowRight size={14} className="hidden shrink-0 text-muted sm:block" aria-hidden />}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted">공개 사이트에서 서버 Worker를 쓸 수 없을 때(동시 실행·요청량 제한, 오류)는 배차 API로 직접 호출하고, 화면에 그 사실을 표시해요.</p>
        </div>
      </div>

      <div>
        <h3 className="font-display text-lg font-bold">각 기술이 맡은 일</h3>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-line bg-bg text-xs text-muted">
              <tr>
                <th className="px-4 py-2.5 font-bold">기술</th>
                <th className="px-4 py-2.5 font-bold">맡은 일</th>
                <th className="px-4 py-2.5 font-bold">상태</th>
              </tr>
            </thead>
            <tbody>
              {STACK.map((s) => (
                <tr key={s.name} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-bold">{s.name}</td>
                  <td className="px-4 py-3 leading-relaxed text-muted">{s.role}</td>
                  <td className="px-4 py-3">
                    <span className={`whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-bold ${s.status === '사용' ? 'bg-accent-soft text-accent-strong' : 'bg-bg text-muted'}`}>
                      {s.status === '사용' ? '구현함' : '아직 안 함'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="font-display text-lg font-bold">어르신을 위한 설계</h3>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed">
            <li>처음에 "제 목소리가 잘 들리세요?"로 소리부터 확인해요. 안 들린다고 하면 크고 천천히 말해요.</li>
            <li>한 번에 하나만 묻고, 들은 장소는 반드시 되읽어요. 이름이 겹치면 번호로 고르게 해요.</li>
            <li>"뭐라고요?", "천천히 말해 주세요"를 어느 단계에서든 알아들어요. 화면에는 다시 듣기 버튼이 있어요.</li>
            <li>차 번호는 "일이, 가, 삼사오육"처럼 끊어 읽어요. 대화 글자는 19px이에요.</li>
            <li>세 번 못 알아들으면 상담원에게 넘겨요.</li>
          </ul>
        </div>
        <div>
          <h3 className="font-display text-lg font-bold">호출 안전장치</h3>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed">
            <li>대화 엔진: 최종 확인에서 "네"를 들어야만 호출 요청이 생겨요. 같은 시도는 한 번만 보내요.</li>
            <li>Worker: 승인이 없거나 이 사이트가 아닌 주소면 브라우저를 띄우기 전에 거절해요. 다른 주소 요청은 차단하고, 동시에 1개만, 50초 안에 끝내요.</li>
            <li>배차 API: 승인 없는 요청은 403, 같은 요청 키는 새로 배차하지 않아요. IP별 요청량을 제한해요.</li>
            <li>실제 카카오 T, 결제, 계정 연동은 없어요. 음성·대화는 저장하지 않아요.</li>
          </ul>
        </div>
      </div>

      <div>
        <h3 className="font-display text-lg font-bold">테스트 결과</h3>
        <p className="mt-1 text-sm text-muted">
          마지막 확인 {new Date(report.checkedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} · {report.environment}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-[240px_minmax(0,1fr)]">
          <dl className="space-y-2 rounded-xl border border-line p-4 text-sm">
            {report.suites.map((s) => (
              <div key={s.name} className="flex justify-between gap-2">
                <dt className="text-muted">{s.name}</dt>
                <dd className="num font-bold" data-testid={`suite-${s.id}`}>
                  {s.passed}/{s.total}
                </dd>
              </div>
            ))}
          </dl>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[560px] text-left text-sm">
              <tbody>
                {report.checks.map((c) => (
                  <tr key={c.item} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5">{c.item}</td>
                    <td className="px-4 py-2.5 text-muted">{c.how}</td>
                    <td className={`whitespace-nowrap px-4 py-2.5 font-bold ${c.result === '통과' ? 'text-accent-strong' : 'text-warn'}`}>{c.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-display text-lg font-bold">상용화하려면 더 필요한 것</h3>
        <ul className="mt-3 grid gap-x-8 gap-y-2 text-[15px] sm:grid-cols-2">
          <li>실제 통화 녹취로 자동 처리 성공률 측정 (지금 비용 계산의 70%는 가정)</li>
          <li>전화 음질·어르신 발화에서 음성 인식 재검증</li>
          <li>배차 플랫폼 공식 API 제휴 또는 화면 변경 감지</li>
          <li>AI가 막힐 때 대화 기록을 상담원에게 그대로 넘기기</li>
          <li>전화번호·위치·녹취 보관 기준과 동의 절차</li>
          <li>자동 처리율, 전환율, 통화 시간, 재통화율 지표</li>
        </ul>
      </div>
    </div>
  )
}
