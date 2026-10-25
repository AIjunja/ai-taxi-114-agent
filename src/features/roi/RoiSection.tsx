import { useMemo, useState } from 'react'
import * as Slider from '@radix-ui/react-slider'
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Button, formatWon, Panel } from '../../components/ui'
import { calculateRoi, costCurve, DEFAULT_ROI_INPUT, MONTHLY_WORK_HOURS, type RoiInput } from './roi'

export interface Field<K extends string = keyof RoiInput> {
  key: K
  label: string
  unit: string
  min: number
  max: number
  step: number
  scale?: number // 화면 값 = 실제 값 × scale
  hint: string
}

const FIELDS: Field[] = [
  { key: 'monthlyCalls', label: '월 호출 건수', unit: '건', min: 0, max: 100_000, step: 500, hint: '기사 공개 수치(16개월 누적 약 15만 건)로 추정한 월 약 9,400건을 반올림' },
  { key: 'handleMinutes', label: '상담원 평균 처리시간', unit: '분', min: 0.5, max: 10, step: 0.5, hint: '가정' },
  { key: 'hourlyLaborCost', label: '시간당 총인건비', unit: '원', min: 10_000, max: 50_000, step: 500, hint: '가정 · 급여와 4대보험 등을 합친 값' },
  { key: 'successRate', label: 'AI 자동 처리 성공률', unit: '%', min: 0, max: 100, step: 1, scale: 100, hint: '가정 · 나머지는 상담원에게 넘겨요' },
  { key: 'aiCostPerCall', label: 'AI 건당 처리비용', unit: '원', min: 0, max: 1_000, step: 10, hint: '가정 · 음성 인식, 합성, 언어 모델' },
  { key: 'handoffCostPerCall', label: '상담원 전환 비용', unit: '원/건', min: 0, max: 1_500, step: 50, hint: '가정 · 실패 건을 넘길 때 더 드는 시간' },
  { key: 'monthlyOpsCost', label: '전화망·자동화 운영비', unit: '원/월', min: 0, max: 10_000_000, step: 100_000, hint: '가정' },
  { key: 'initialCost', label: '초기 구축비', unit: '원', min: 0, max: 200_000_000, step: 1_000_000, hint: '가정' },
]

export function NumberField({ f, value, onChange }: { f: Field<string>; value: number; onChange: (v: number) => void }) {
  const shown = +(value * (f.scale ?? 1)).toFixed(2)
  const set = (v: number) => onChange(Math.max(f.min, Math.min(f.max, v)) / (f.scale ?? 1))
  const id = `roi-${f.key}`
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold">
          {f.label}
        </label>
        <div className="flex items-center gap-1">
          <input
            id={id}
            data-testid={id}
            type="number"
            inputMode="decimal"
            min={f.min}
            max={f.max}
            step={f.step}
            value={shown}
            onChange={(e) => e.target.value !== '' && set(Number(e.target.value))}
            className="num h-8 w-28 rounded-md border border-line bg-surface px-2 text-right text-sm"
          />
          <span className="w-9 text-xs text-muted">{f.unit}</span>
        </div>
      </div>
      <Slider.Root
        className="relative mt-2 flex h-5 touch-none select-none items-center"
        min={f.min}
        max={f.max}
        step={f.step}
        value={[shown]}
        onValueChange={([v]) => set(v)}
        aria-label={f.label}
      >
        <Slider.Track className="relative h-1.5 grow rounded-full bg-line">
          <Slider.Range className="absolute h-full rounded-full bg-accent" />
        </Slider.Track>
        <Slider.Thumb className="block h-4 w-4 rounded-full border-2 border-accent bg-white" aria-label={f.label} />
      </Slider.Root>
      <p className="mt-1 text-xs text-muted">{f.hint}</p>
    </div>
  )
}

export function Kpi({ label, value, sub, testId, tone }: { label: string; value: string; sub?: string; testId: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-lg bg-bg p-3">
      <p className="text-xs text-muted">{label}</p>
      <p data-testid={testId} className={`num mt-1 text-lg font-bold sm:text-xl ${tone === 'good' ? 'text-accent-strong' : tone === 'bad' ? 'text-danger' : ''}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  )
}

export function RoiSection() {
  const [input, setInput] = useState<RoiInput>(DEFAULT_ROI_INPUT)
  const r = useMemo(() => calculateRoi(input), [input])
  const curve = useMemo(() => costCurve(input), [input])
  const positive = r.monthlySaving > 0

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Panel className="p-5">
        <div className="flex items-center justify-between">
          <p className="font-bold">입력값</p>
          <Button size="sm" onClick={() => setInput(DEFAULT_ROI_INPUT)}>
            기본값으로 되돌리기
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
            <Badge tag="가정">가정 기반 계산</Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Kpi label="기존 월 운영비" value={formatWon(r.baselineMonthly)} sub={`건당 ${formatWon(r.laborCostPerCall)}`} testId="roi-baseline" />
            <Kpi label="AI 도입 후 월 운영비" value={formatWon(r.aiMonthly)} testId="roi-ai" />
            <Kpi label="월간 절감 잠재액" value={formatWon(r.monthlySaving)} sub={`연간 ${formatWon(r.annualSaving)}`} testId="roi-saving" tone={positive ? 'good' : 'bad'} />
            <Kpi label="비용 절감률" value={`${(r.savingRate * 100).toFixed(1)}%`} testId="roi-rate" tone={positive ? 'good' : 'bad'} />
            <Kpi label="투자 회수기간" value={r.paybackMonths === null ? '회수 안 됨' : `${r.paybackMonths.toFixed(1)}개월`} testId="roi-payback" />
            <Kpi
              label="손익분기 자동화율"
              value={r.breakEvenRate === null ? '도달 불가' : `${(r.breakEvenRate * 100).toFixed(1)}%`}
              sub="이 성공률보다 높아야 이득"
              testId="roi-breakeven"
            />
            <Kpi label="확보되는 처리 시간" value={`월 ${Math.round(r.freedHours).toLocaleString('ko-KR')}시간`} sub={`상담원 약 ${r.freedFte.toFixed(1)}명분 · 월 ${MONTHLY_WORK_HOURS}시간 기준`} testId="roi-hours" />
          </div>
        </Panel>

        <Panel className="p-5">
          <p className="font-bold">성공률에 따른 월 운영비</p>
          <p className="mt-1 text-sm text-muted">AI가 처리하지 못한 건은 상담원이 다시 받아요. 성공률이 손익분기보다 낮으면 오히려 비용이 늘어요.</p>
          <div className="mt-4 h-[260px] w-full" data-testid="roi-chart">
            <ResponsiveContainer>
              <LineChart data={curve} margin={{ top: 22, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid stroke="#e3e3de" vertical={false} />
                <XAxis dataKey="rate" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12, fill: '#5d636b' }} stroke="#e3e3de" />
                <YAxis tickFormatter={(v) => `${Math.round(v / 10_000).toLocaleString()}만`} tick={{ fontSize: 12, fill: '#5d636b' }} stroke="#e3e3de" width={56} />
                <Tooltip formatter={(v) => formatWon(Number(v))} labelFormatter={(l) => `성공률 ${l}%`} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Line name="기존 (상담원만)" dataKey="baseline" stroke="#5d636b" strokeDasharray="5 4" dot={false} strokeWidth={2} isAnimationActive={false} />
                <Line name="AI 도입 후" dataKey="ai" stroke="#0d6b4f" dot={false} strokeWidth={2.5} isAnimationActive={false} />
                <ReferenceLine x={Math.round(input.successRate * 10) * 10} stroke="#0d6b4f" strokeOpacity={0.35} label={{ value: '현재', fontSize: 11, fill: '#0a5940', position: 'top' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="p-5 text-sm">
          <p className="font-bold">이 숫자를 읽는 방법</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-muted">
            <li>
              <b className="text-ink">절감 잠재액은 인력을 줄여야 현금이 돼요.</b> 상담원을 그대로 두면 비용은 줄지 않고, 대신 위의 처리 시간이 생겨요. 이 시간을 병원·약국 안내 같은 다른 상담에 쓰는 것이 더 현실적인 효과예요.
            </li>
            <li>모든 기본값은 공개 기사 수치와 일반적인 가정으로 만든 예시예요. KT IS 내부 원가나 실제 계약 금액이 아니에요.</li>
            <li>이 프로젝트에서 실제로 측정한 값은 테스트 통과 여부와 Playwright 실행 시간뿐이에요. AI 성공률은 실제 통화로 측정하지 않았어요.</li>
          </ul>
        </Panel>
      </div>
    </div>
  )
}
