// 실험 1: 고객 발화 → 출발지·목적지 정리 정확도. 결과를 src/data/experiment-extraction.json에 쓴다.
import { writeFile } from 'node:fs/promises'
import { CASES } from '../src/features/assist/cases'
import { HOLDOUT } from '../src/features/assist/holdout'
import { extract } from '../src/features/assist/extract'
import { judge, slotLabel } from '../src/features/assist/score'
import { findPlace } from '../src/features/dialog/places'

const label = (e: string) => (e === 'missing' ? '모름' : e === 'ambiguous' ? '후보 제시' : findPlace(e)?.name ?? e)
const SET = process.env.SET === 'holdout' ? HOLDOUT : CASES
const rows = SET.map((c) => {
  const r = extract(c.utterances)
  const o = judge(r.origin, c.expected.origin)
  const d = judge(r.destination, c.expected.destination)
  return {
    id: c.id,
    category: c.category,
    utterances: c.utterances,
    expected: { origin: label(c.expected.origin), destination: label(c.expected.destination) },
    got: { origin: slotLabel(r.origin), destination: slotLabel(r.destination) },
    verdict: { origin: o, destination: d },
    pass: o === 'correct' && d === 'correct',
  }
})
const slots = rows.flatMap((r) => [r.verdict.origin, r.verdict.destination])
const count = (v: string) => slots.filter((s) => s === v).length
const byCategory = [...new Set(rows.map((r) => r.category))].map((cat) => {
  const rs = rows.filter((r) => r.category === cat)
  return { category: cat, cases: rs.length, pass: rs.filter((r) => r.pass).length }
})
const out = {
  ranAt: new Date().toISOString(),
  method: process.env.SET === 'holdout' ? '규칙 수정 뒤 새로 쓴 발화 16건(실제 녹취 아님)을 한 번만 채점' : '직접 만든 고객 발화 34건(실제 녹취 아님)을 규칙 기반 추출기에 넣고 출발지·목적지 68칸을 채점',
  cases: rows.length,
  casesPassed: rows.filter((r) => r.pass).length,
  slots: slots.length,
  correct: count('correct'),
  wrongConfident: count('wrong_confident'),
  missed: count('missed'),
  byCategory,
  rows,
}
await writeFile(process.env.SET === 'holdout' ? 'src/data/experiment-extraction-holdout.json' : 'src/data/experiment-extraction.json', JSON.stringify(out, null, 2) + '\n')
console.log(`통화 ${out.casesPassed}/${out.cases} 완전 정답 · 칸 ${out.correct}/${out.slots} 정답 · 자신 있게 틀림 ${out.wrongConfident} · 놓침 ${out.missed}`)
for (const r of rows.filter((x) => !x.pass)) console.log(' ✗', r.id, r.category, JSON.stringify(r.utterances), '기대', JSON.stringify(r.expected), '결과', JSON.stringify(r.got))
