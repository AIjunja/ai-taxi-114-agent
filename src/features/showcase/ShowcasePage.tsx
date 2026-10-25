// 공개 첫 페이지: 시연 영상 + 왜 만들었나 + 무엇이 바뀌나 + ROI로 정한 다음 단계 + 확인한 것/못 한 것
import { Check, X } from 'lucide-react'
import demo from '../../../public/media/demo.json'
import holdout from '../../data/experiment-extraction-holdout.json'
import worker from '../../data/experiment-worker.json'
import actions from '../../data/experiment-actions.json'
import { calculateAssist, DEFAULT_ASSIST } from '../roi/assist-roi'

const roi = calculateAssist(DEFAULT_ASSIST)
const manualRange = `${Math.min(...actions.rows.map((r) => r.manual))}~${Math.max(...actions.rows.map((r) => r.manual))}`
const assistRange = `${Math.min(...actions.rows.map((r) => r.assisted))}~${Math.max(...actions.rows.map((r) => r.assisted))}`
const won = (n: number) => `${Math.round(n / 10_000).toLocaleString('ko-KR')}만 원`

function H2({ children }: { children: string }) {
  return <h2 className="font-display text-xl font-bold sm:text-2xl">{children}</h2>
}

export function ShowcasePage() {
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-10 items-center justify-center rounded-md bg-accent font-display text-[13px] font-bold text-white">114</span>
            <span className="font-display text-[15px] font-bold">택시 대신 불러주기 · 상담원 보조 PoC</span>
          </div>
          <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-bold text-warn" data-testid="poc-banner">
            개인 PoC · KT IS 공식 사업 아님 · 실제 택시 호출 없음
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1040px] space-y-14 px-4 py-10">
        <section>
          <h1 className="font-display text-[28px] font-bold leading-tight sm:text-[36px]">
            택시 대신 불러주기,
            <br />
            상담원 조작 {actions.rows[0].manual}번을 {actions.rows[0].assisted}번으로
          </h1>
          <ul className="mt-4 space-y-1 text-[16px] text-muted">
            <li>고객 말은 AI가 정리해요.</li>
            <li>호출 화면 입력은 Playwright가 해요.</li>
            <li>확인과 승인은 상담원이 해요.</li>
          </ul>
          <figure className="mt-6">
            <video src="/media/demo.mp4" poster="/media/demo-poster.jpg" controls playsInline preload="metadata" className="w-full rounded-xl border border-line bg-ink" data-testid="demo-video" />
            <figcaption className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              <span>{demo.seconds}초</span>
              <span>실제 화면 녹화</span>
              <span>목소리는 AI 합성음</span>
              <span>지도는 OpenStreetMap</span>
              <span>배차는 Mock</span>
            </figcaption>
          </figure>
        </section>

        <section>
          <H2>왜 만들었나</H2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ['매번 같은 순서', '듣기 → 되묻기 → 앱 입력 → 안내', '하루 약 300건 (공개 수치로 추정)'],
              ['틀리면 어르신이 기다려요', '잘못 입력하면 재통화·재호출', '상담원 확인은 빼면 안 돼요'],
              ['완전 자동은 아직 일러요', `새 발화 ${holdout.cases}건 중 ${holdout.cases - holdout.casesPassed}건`, 'AI가 틀린 곳을 자신 있게 골랐어요'],
            ].map(([t, a, b]) => (
              <div key={t} className="rounded-xl border border-line bg-surface p-4">
                <p className="font-display font-bold">{t}</p>
                <p className="mt-2 text-[15px]">{a}</p>
                <p className="mt-0.5 text-sm text-muted">{b}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <H2>무엇이 바뀌나</H2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[560px] text-left text-[15px]">
              <thead className="border-b border-line bg-bg text-xs text-muted">
                <tr>
                  <th className="px-4 py-2.5">일</th>
                  <th className="px-4 py-2.5">지금</th>
                  <th className="px-4 py-2.5">PoC</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['고객 말 정리', '상담원이 메모', 'AI가 제안 → 상담원이 확인'],
                  ['호출 화면 입력', `상담원 조작 ${manualRange}번`, `Playwright가 입력 · 상담원 ${assistRange}번`],
                  ['호출 승인', '상담원', '상담원 (그대로)'],
                  ['결과 안내', '화면 보고 말하기', '안내 문구 읽기'],
                ].map(([k, a, b]) => (
                  <tr key={k} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-bold">{k}</td>
                    <td className="px-4 py-3 text-muted">{a}</td>
                    <td className="px-4 py-3">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <H2>ROI로 정한 다음 단계</H2>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="roi-tiles">
            {[
              ['손익분기', `건당 ${roi.breakEvenSavedSec?.toFixed(0)}초 절감`],
              ['월 여유 시간', `${Math.round(roi.savedHours)}시간`],
              ['월 AI 운영비', won(roi.aiCost)],
              ['투자 회수', `${roi.paybackMonths?.toFixed(0)}개월`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line bg-surface p-3">
                <p className="text-xs text-muted">{k}</p>
                <p className="mt-1 font-display text-lg font-bold">{v}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            가정: 월 {DEFAULT_ASSIST.monthlyCalls.toLocaleString('ko-KR')}건, 건당 {DEFAULT_ASSIST.savedSecPerCall}초 절감, 입력 오류 {DEFAULT_ASSIST.baseErrorRate * 100}% → {DEFAULT_ASSIST.assistErrorRate * 100}%, 건당 AI 비용 {DEFAULT_ASSIST.aiCostPerCall}원
          </p>
          <ol className="mt-5 space-y-3">
            {[
              ['2주 파일럿', '상담원 3~5명, 쉬운 통화부터', '잴 것: 건당 처리시간 · 입력 오류율 · AI 제안 확인 시간'],
              ['확대 기준', `건당 ${roi.breakEvenSavedSec?.toFixed(0)}초 넘게 줄면 확대`, '못 넘으면 AI 비용을 먼저 줄여요'],
              ['자동화 범위', 'AI가 틀린 통화 유형부터 찾기', '자신 있게 틀리는 유형은 상담원 확인 유지'],
              ['효과 쓰는 곳', `월 ${Math.round(roi.savedHours)}시간 여유`, '인력 감축 아님 · 병원·약국 안내 같은 다른 상담에'],
            ].map(([t, a, b], i) => (
              <li key={t} className="flex gap-3 rounded-xl border border-line bg-surface p-4">
                <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">{i + 1}</span>
                <div>
                  <p className="font-display font-bold">{t}</p>
                  <p className="mt-0.5 text-[15px]">{a}</p>
                  <p className="text-sm text-muted">{b}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-5" data-testid="verified">
            <H2>확인한 것</H2>
            <ul className="mt-3 space-y-2 text-[15px]">
              {[
                `Playwright 공개 서버 입력·호출 ${worker.succeeded}/${worker.runs}번 성공`,
                `장소 정리 새 발화 ${holdout.casesPassed}/${holdout.cases}건 정답`,
                `상담원 조작 ${manualRange}번 → ${assistRange}번`,
              ].map((x) => (
                <li key={x} className="flex gap-2">
                  <Check size={18} className="mt-0.5 shrink-0 text-accent" /> {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-line bg-surface p-5" data-testid="not-verified">
            <H2>못 한 것</H2>
            <ul className="mt-3 space-y-2 text-[15px]">
              {['실제 목소리 음성 인식 (브라우저 인식 서버 문제)', '사람 상담원의 실제 시간 절감', '실제 통화 녹취로 정확도 측정'].map((x) => (
                <li key={x} className="flex gap-2">
                  <X size={18} className="mt-0.5 shrink-0 text-danger" /> {x}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1040px] flex-wrap gap-x-4 gap-y-1 px-4 py-6 text-sm text-muted">
          <span>개인 포트폴리오 · 신준형</span>
          <a href="https://github.com/AIjunja/ai-taxi-114-agent" className="font-bold text-accent underline underline-offset-2">
            GitHub
          </a>
          <a href="https://github.com/AIjunja/ai-taxi-114-agent/blob/main/docs/decision-log.md" className="font-bold text-accent underline underline-offset-2">
            판단 기록
          </a>
        </div>
      </footer>
    </div>
  )
}
