import { useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Button, formatWon, Panel } from '../../components/ui'
import { calculateAssist, DEFAULT_ASSIST, MONTHLY_WORK_HOURS, savingCurve, type AssistInput } from './assist-roi'
import { Kpi, NumberField, type Field } from './RoiSection'

const FIELDS: Field<keyof AssistInput>[] = [
  { key: 'monthlyCalls', label: '월 호출 건수', unit: '건', min: 0, max: 100_000, step: 500, hint: '공개 기사(16개월 누적 약 15만 건)로 추정한 월 약 9,400건을 반올림' },
  { key: 'baseHandleSec', label: '기존 건당 처리시간', unit: '초', min: 30, max: 600, step: 10, hint: '가정 · 통화 시작부터 배차 안내까지' },
  { key: 'savedSecPerCall', label: '보조로 줄어드는 시간', unit: '초', min: 0, max: 120, step: 5, hint: '가정 · 받아 적기·검색 입력·결과 읽기. 파일럿에서 가장 먼저 측정할 값' },
  { key: 'baseErrorRate', label: '기존 입력 오류율', unit: '%', min: 0, max: 20, step: 0.5, scale: 100, hint: '가정 · 출발지·목적지를 잘못 넣은 비율' },
  { key: 'assistErrorRate', label: '보조 후 입력 오류율', unit: '%', min: 0, max: 20, step: 0.5, scale: 100, hint: '가정 · 상담원 확인이 남아 있어 0은 아님' },
  { key: 'reworkSec', label: '오류 1건 재작업 시간', unit: '초', min: 0, max: 600, step: 10, hint: '가정 · 재통화·취소·재호출' },
  { key: 'hourlyLaborCost', label: '시간당 총인건비', unit: '원', min: 10_000, max: 50_000, step: 500, hint: '가정 · 줄어든 시간을 원으로 바꿀 때만 써요' },
  { key: 'aiCostPerCall', label: '건당 AI 운영비', unit: '원', min: 0, max: 300, step: 5, hint: '가정 · 받아쓰기·장소 정리·Worker 실행' },
  { key: 'monthlyFixedCost', label: '월 고정 운영비', unit: '원', min: 0, max: 5_000_000, step: 100_000, hint: '가정 · 서버·모니터링' },
  { key: 'initialCost', label: '초기 구축비', unit: '원', min: 0, max: 100_000_000, step: 1_000_000, hint: '가정' },
]

export function AssistRoiSection() {
  const [input, setInput] = useState<AssistInput>(DEFAULT_ASSIST)
  const r = useMemo(() => calculateAssist(input), [input])
  const curve = useMemo(() => savingCurve(input), [input])
  const good = r.net > 0
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Panel className="p-5">
        <div className="flex items-center justify-between">
          <p className="font-bold">입력값 (모두 가정)</p>
          <Button size="sm" onClick={() => setInput(DEFAULT_ASSIST)}>
            기본값으로
          </Button>
        </div>
        <div className="mt-4 space-y-5">
          {FIELDS.map((f) => (
            <NumberField key={f.key} f={f} value={input[f.key]} onChange={(v) => setInput((p) => ({ ...p, [f.key]: v }))} />
          ))}
        </div>
      </Panel>
      <div className="flex min-w-0 flex-col gap-4">
        <Panel className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold">결과</p>
            <Badge tag="가정">가정 기반 계산 · 측정값 아님</Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Kpi label="건당 처리시간 (재작업 포함)" value={`${r.beforeSecPerCall.toFixed(0)}초 → ${r.afterSecPerCall.toFixed(0)}초`} testId="aroi-handle" />
            <Kpi label="월 절감 시간" value={`${Math.round(r.savedHours).toLocaleString('ko-KR')}시간`} sub={`상담원 약 ${r.freedFte.toFixed(1)}명분 · 월 ${MONTHLY_WORK_HOURS}시간 기준`} testId="aroi-hours" />
            <Kpi label="월 재작업 시간" value={`${Math.round(r.reworkHoursBefore)} → ${Math.round(r.reworkHoursAfter)}시간`} sub={`오류 월 ${r.errorsAvoided.toLocaleString('ko-KR')}건 감소`} testId="aroi-rework" />
            <Kpi label="월 AI 운영비" value={formatWon(r.aiCost)} testId="aroi-cost" />
            <Kpi label="절감 시간의 가치" value={formatWon(r.timeValue)} sub="인건비 단가로 환산" testId="aroi-value" />
            <Kpi label="월 순효과" value={formatWon(r.net)} sub="시간 가치 - AI 운영비" testId="aroi-net" tone={good ? 'good' : 'bad'} />
            <Kpi label="투자 회수기간" value={r.paybackMonths === null ? '회수 안 됨' : `${r.paybackMonths.toFixed(1)}개월`} testId="aroi-payback" />
            <Kpi label="손익분기 절감 시간" value={r.breakEvenSavedSec === null ? '-' : `건당 ${r.breakEvenSavedSec.toFixed(1)}초`} sub="이보다 많이 줄여야 운영비 이상" testId="aroi-breakeven" />
          </div>
        </Panel>
        <Panel className="p-5">
          <p className="font-bold">건당 줄어드는 시간에 따른 월 가치와 운영비</p>
          <p className="mt-1 text-sm text-muted">줄어드는 시간이 손익분기보다 적으면 AI를 붙일수록 손해예요. 파일럿에서 이 값부터 측정해야 해요.</p>
          <div className="mt-4 h-[240px] w-full">
            <ResponsiveContainer>
              <LineChart data={curve} margin={{ top: 22, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid stroke="#e3e3de" vertical={false} />
                <XAxis dataKey="sec" tickFormatter={(v) => `${v}초`} tick={{ fontSize: 12, fill: '#5d636b' }} stroke="#e3e3de" />
                <YAxis tickFormatter={(v) => `${Math.round(v / 10_000).toLocaleString()}만`} tick={{ fontSize: 12, fill: '#5d636b' }} stroke="#e3e3de" width={56} />
                <Tooltip formatter={(v) => formatWon(Number(v))} labelFormatter={(l) => `건당 ${l}초 절감`} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Line name="절감 시간의 가치" dataKey="timeValue" stroke="#0d6b4f" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Line name="AI 운영비" dataKey="aiCost" stroke="#5d636b" strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} />
                <ReferenceLine x={Math.round(input.savedSecPerCall / 10) * 10} stroke="#0d6b4f" strokeOpacity={0.35} label={{ value: '현재', fontSize: 11, fill: '#0a5940', position: 'top' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel className="p-5 text-sm">
          <p className="font-bold">이 계산이 말하지 않는 것</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-muted">
            <li>
              <b className="text-ink">인력을 줄이는 계산이 아니에요.</b> 줄어든 시간은 대기 고객 응대나 병원·약국 안내처럼 다른 상담에 쓰는 처리 여유로 봐요.
            </li>
            <li>모든 값은 가정이에요. 이 PoC에서 실제로 잰 것은 장소 정리 정확도와 Playwright 입력 시간뿐이에요 (아래 실험 결과).</li>
            <li>상담원이 확인하는 시간이 새로 생겨요. 줄어드는 시간 40초는 그 시간을 뺀 순감소로 가정했어요.</li>
          </ul>
        </Panel>
      </div>
    </div>
  )
}
