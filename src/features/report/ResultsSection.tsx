// 실험 결과. 성공과 실패를 모두 그대로 보여준다. 숫자는 src/data/*.json (스크립트가 만든 값)에서 읽는다.
import type { ReactNode } from 'react'
import v1 from '../../data/experiment-extraction-v1.json'
import v2 from '../../data/experiment-extraction.json'
import holdout from '../../data/experiment-extraction-holdout.json'
import worker from '../../data/experiment-worker.json'
import actions from '../../data/experiment-actions.json'
import voice from '../../data/experiment-voice.json'
import report from '../../data/test-report.json'

const pct = (a: number, b: number) => `${Math.round((a / b) * 100)}%`
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-')

function Card({ id, title, verdict, tone, children }: { id: string; title: string; verdict: string; tone: 'ok' | 'mixed' | 'fail'; children: ReactNode }) {
  const cls = tone === 'ok' ? 'bg-accent-soft text-accent-strong' : tone === 'mixed' ? 'bg-warn-soft text-warn' : 'bg-danger-soft text-danger'
  return (
    <article className="rounded-xl border border-line bg-surface p-5" data-testid={`exp-${id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-display text-[17px] font-bold">{title}</h3>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{verdict}</span>
      </div>
      <div className="mt-3 space-y-3 text-[14px] leading-relaxed">{children}</div>
    </article>
  )
}

type Row = {
  id: string
  category: string
  utterances: string[]
  expected: { origin: string; destination: string }
  got: { origin: string; destination: string }
  verdict: { origin: string; destination: string }
  pass: boolean
}

function FailTable({ rows }: { rows: Row[] }) {
  const fails = rows.filter((r) => !r.pass)
  if (!fails.length) return null
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[620px] text-left text-[13px]">
        <thead className="bg-bg text-xs text-muted">
          <tr>
            <th className="px-3 py-2">고객이 한 말</th>
            <th className="px-3 py-2">정답</th>
            <th className="px-3 py-2">AI 정리</th>
            <th className="px-3 py-2">오류 종류</th>
          </tr>
        </thead>
        <tbody>
          {fails.map((r) => (
            <tr key={r.id} className="border-t border-line align-top">
              <td className="px-3 py-2">{r.utterances.join(' / ')}</td>
              <td className="px-3 py-2">
                {r.expected.origin} → {r.expected.destination}
              </td>
              <td className="px-3 py-2">
                {r.got.origin} → {r.got.destination}
              </td>
              <td className="px-3 py-2 font-bold text-danger">{[r.verdict.origin, r.verdict.destination].includes('wrong_confident') ? '틀린 곳을 자신 있게 채움' : '놓침'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-bg p-2.5 text-center">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="num font-display text-xl font-bold">{value}</p>
      {sub && <p className="text-[11px] text-danger">{sub}</p>}
    </div>
  )
}

export function ResultsSection() {
  const a = actions as { ranAt: string | null; method: string; rows: { sample: string; manual: number; assisted: number; note: string }[] }
  const vo = voice as { ranAt: string | null; rows: { browser: string; mic: string; stt: string; tts: string }[] }
  const later = worker.trials.slice(1)
  const laterFirstFrame = later.reduce((s, t) => s + (t.firstFrameMs ?? 0), 0) / Math.max(1, later.length)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card id="extract" title="실험 1 · 고객 말에서 출발지·목적지 정리" verdict={`처음 보는 발화 ${pct(holdout.casesPassed, holdout.cases)}`} tone="mixed">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="1차 (34건)" value={`${v1.casesPassed}/${v1.cases}`} sub={`자신 있게 틀림 ${v1.wrongConfident}칸`} />
          <Stat label="규칙 수정 후 (같은 34건)" value={`${v2.casesPassed}/${v2.cases}`} sub={`자신 있게 틀림 ${v2.wrongConfident}칸`} />
          <Stat label="새 발화 (16건)" value={`${holdout.casesPassed}/${holdout.cases}`} sub={`자신 있게 틀림 ${holdout.wrongConfident}칸`} />
        </div>
        <p className="text-muted">
          발화는 실제 녹취가 아니라 직접 만든 예시예요. 1차 실패를 보고 규칙을 고친 뒤, 고친 규칙으로 처음 보는 발화 16건을 한 번만 돌렸어요. 같은 데이터로 고친 점수({pct(v2.casesPassed, v2.cases)})보다 새 데이터 점수({pct(holdout.casesPassed, holdout.cases)})가 낮아요.
        </p>
        <p>
          <b>판단:</b> 틀린 장소를 자신 있게 채우는 오류가 남아 있어서 완전 자동 호출은 위험해요. 그래서 AI는 제안만 하고 상담원이 확인하는 방식을 기본으로 정했어요.
        </p>
        <details>
          <summary className="cursor-pointer text-sm font-bold text-accent">새 발화에서 틀린 사례 보기</summary>
          <div className="mt-2">
            <FailTable rows={holdout.rows as Row[]} />
          </div>
        </details>
        <details>
          <summary className="cursor-pointer text-sm font-bold text-accent">1차에서 틀린 사례 보기</summary>
          <div className="mt-2">
            <FailTable rows={v1.rows as Row[]} />
          </div>
        </details>
        <p className="text-xs text-muted">실행: {when(holdout.ranAt)} · scripts/run-experiments.ts</p>
      </Card>

      <Card id="worker" title="실험 2 · Playwright가 공개 서버에서 콘솔 입력·호출" verdict={`${worker.succeeded}/${worker.runs} 성공`} tone="ok">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="평균 소요" value={`${((worker.avgTotalMs ?? 0) / 1000).toFixed(1)}초`} />
          <Stat label="첫 화면 (첫 실행)" value={`${((worker.trials[0].firstFrameMs ?? 0) / 1000).toFixed(1)}초`} />
          <Stat label="첫 화면 (이후)" value={`${(laterFirstFrame / 1000).toFixed(1)}초`} />
        </div>
        <p className="text-muted">
          서버 Chromium이 콘솔을 열고 검색·선택·위치 확인·승인 체크·호출 버튼까지 실제로 조작했어요. 소요 시간의 상당 부분은 사람이 따라볼 수 있게 일부러 넣은 동작 간격(0.32초씩)과 Mock 배차 대기(3~5.5초)예요.
        </p>
        <p>
          <b>실패:</b> {worker.concurrency.finding}
        </p>
        <p>
          <b>판단:</b> 공개 데모는 IP별 요청 제한으로 버티지만, 실제로 쓰려면 Worker 앞에 전체 대기열을 둬야 해요.
        </p>
        <p className="text-xs text-muted">실행: {when(worker.ranAt)} · scripts/worker-trials.ts</p>
      </Card>

      <Card id="actions" title="실험 3 · 같은 통화를 처리할 때 상담원 조작 수" verdict={a.rows.length ? '조작 수 감소' : '측정 전'} tone={a.rows.length ? 'ok' : 'mixed'}>
        {a.rows.length ? (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-bg text-xs text-muted">
                <tr>
                  <th className="px-3 py-2">예시 통화</th>
                  <th className="px-3 py-2">수동 입력</th>
                  <th className="px-3 py-2">상담원 보조</th>
                  <th className="px-3 py-2">비고</th>
                </tr>
              </thead>
              <tbody>
                {a.rows.map((r) => (
                  <tr key={r.sample} className="border-t border-line">
                    <td className="px-3 py-2">{r.sample}</td>
                    <td className="num px-3 py-2">{r.manual}회</td>
                    <td className="num px-3 py-2 font-bold">{r.assisted}회</td>
                    <td className="px-3 py-2 text-muted">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">아직 측정하지 않았어요.</p>
        )}
        <p className="text-muted">{a.method}</p>
        <p>
          <b>한계:</b> 조작 수는 시간이 아니에요. 사람이 실제로 몇 초를 아끼는지는 상담원 파일럿으로만 알 수 있어요. 비용 계산의 '줄어드는 시간 40초'를 가정으로 표시한 이유예요.
        </p>
        {a.ranAt && <p className="text-xs text-muted">실행: {when(a.ranAt)} · scripts/measure-actions.ts</p>}
      </Card>

      <Card id="voice" title="실험 4 · 음성 인식(STT)과 음성 합성(TTS)" verdict="STT 검증 실패" tone="fail">
        {vo.rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[520px] text-left text-[13px]">
              <thead className="bg-bg text-xs text-muted">
                <tr>
                  <th className="px-3 py-2">브라우저</th>
                  <th className="px-3 py-2">마이크</th>
                  <th className="px-3 py-2">음성 인식</th>
                  <th className="px-3 py-2">한국어 목소리</th>
                </tr>
              </thead>
              <tbody>
                {vo.rows.map((r) => (
                  <tr key={r.browser} className="border-t border-line align-top">
                    <td className="px-3 py-2 font-bold">{r.browser}</td>
                    <td className="px-3 py-2">{r.mic}</td>
                    <td className="px-3 py-2">{r.stt}</td>
                    <td className="px-3 py-2">{r.tts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-muted">브라우저 음성 인식은 브라우저 회사 서버에 맡기는 구조라, 이 PoC가 직접 고칠 수 없는 실패가 많아요. 사람이 직접 말해서 성공한 기록도 아직 없어요.</p>
        <p>
          <b>판단:</b> STT를 핵심 기능에서 빼고 '받아쓰기 보조'로 낮췄어요. 받아쓰기가 실패해도 상담원이 고객 말을 입력하거나 예시 통화로 흐름은 이어져요. 목소리는 기기 합성음이라 사람 상담원 수준이라고 주장하지 않아요. 보조 방식에서는 상담원이 직접 말해요.
        </p>
        <p className="text-xs text-muted">
          실행: {when(vo.ranAt)} · 원인 확인은{' '}
          <a href="/diagnostics" className="font-bold text-accent underline">
            음성 진단
          </a>
          에서 직접 해 볼 수 있어요
        </p>
      </Card>

      <Card id="tests" title="실험 5 · 자동 테스트" verdict={report.suites.map((s) => `${s.passed}/${s.total}`).join(' · ')} tone={report.checks.some((c) => c.result !== '통과') ? 'mixed' : 'ok'}>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[520px] text-left text-[13px]">
            <tbody>
              {report.checks.map((c) => (
                <tr key={c.item} className="border-t border-line first:border-0">
                  <td className="px-3 py-2">{c.item}</td>
                  <td className="px-3 py-2 text-muted">{c.how}</td>
                  <td className={`whitespace-nowrap px-3 py-2 font-bold ${c.result === '통과' ? 'text-accent-strong' : 'text-danger'}`}>{c.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">
          {report.suites.map((s) => `${s.name} ${s.passed}/${s.total}`).join(' · ')} · 마지막 실행 {when(report.checkedAt)}
        </p>
      </Card>
    </div>
  )
}
