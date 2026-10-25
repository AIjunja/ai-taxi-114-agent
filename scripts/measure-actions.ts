// 실험 3: 같은 통화를 '수동 입력'과 '상담원 보조'로 처리할 때 상담원 조작 수(클릭 + 키 입력)를 센다.
// 수동: 호출 콘솔에서 정답이 첫 후보로 뜨는 가장 짧은 검색어만 입력한다 (상담원에게 유리하게 셈).
// 보조: AI 제안을 보고 확인·후보 선택·직접 고르기만 한다. 고객 말 입력은 고객 쪽을 흉내 낸 것이라 세지 않는다.
//   npm run dev 를 띄운 뒤 BASE=http://localhost:5173 npx tsx scripts/measure-actions.ts
import { chromium, type Page } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { CASES } from '../src/features/assist/cases'
import { HOLDOUT } from '../src/features/assist/holdout'
import { findPlace } from '../src/features/dialog/places'

const base = process.env.BASE ?? 'http://localhost:5173'

// 한글 키 입력 수 = 자모 수 (두벌식 기준, 겹받침·이중모음은 2타)
function keystrokes(s: string): number {
  const DOUBLE_V = new Set([9, 10, 11, 14, 15, 16, 19])
  const DOUBLE_T = new Set([3, 5, 6, 9, 10, 11, 12, 13, 14, 15, 18])
  let n = 0
  for (const ch of s) {
    const c = ch.charCodeAt(0) - 0xac00
    if (c < 0 || c > 11171) {
      n++
      continue
    }
    const v = Math.floor((c % 588) / 28)
    const t = c % 28
    n += 1 + (DOUBLE_V.has(v) ? 2 : 1) + (t ? (DOUBLE_T.has(t) ? 2 : 1) : 0)
  }
  return n
}

// 실험할 통화와 고객이 실제로 원한 곳 (애매한 곳은 상담원이 고객에게 물어 확인했다고 가정)
const PLAN = [
  { id: 'c13', label: '나눠 말하기', origin: 'seoul-station', destination: 'asan' },
  { id: 'c17', label: '이름이 겹치는 병원', origin: 'seoul-station', destination: 'severance' },
  { id: 'c22', label: '중간에 목적지 변경', origin: 'seoul-station', destination: 'gimpo-airport' },
  { id: 'h06', label: 'AI가 출발지를 틀림', origin: 'samsung-hospital', destination: 'seoul-station' },
]

async function manual(page: Page, originId: string, destId: string) {
  await page.goto(`${base}/console`)
  let clicks = 0
  let keys = 0
  for (const [kind, id] of [['origin', originId], ['destination', destId]] as const) {
    const name = findPlace(id)!.name
    const input = page.getByTestId(`console-${kind}-input`)
    await input.click()
    clicks++
    let prefix = name
    for (let k = 1; k <= name.length; k++) {
      await input.fill(name.slice(0, k))
      const first = await page.getByTestId(`console-${kind}-suggestions`).locator('[data-testid^="suggest-"]').first().getAttribute('data-testid')
      if (first === `suggest-${kind}-${id}`) {
        prefix = name.slice(0, k)
        break
      }
    }
    keys += keystrokes(prefix)
    await page.getByTestId(`suggest-${kind}-${id}`).click()
    clicks++
    await page.getByTestId(`console-${kind}-confirm`).click()
    clicks++
  }
  await page.getByTestId('console-approved').check()
  clicks++
  clicks++ // 호출 버튼 (배차는 실험 2에서 확인해서 여기서는 누르지 않는다)
  return { clicks, keys }
}

async function assisted(page: Page, utterances: string[], originId: string, destId: string, run: boolean) {
  await page.goto(base)
  for (const u of utterances) {
    await page.getByTestId('utterance-input').fill(u)
    await page.getByTestId('utterance-input').press('Enter')
  }
  await page.getByTestId('utterances').locator('li').nth(utterances.length - 1).waitFor()
  await page.waitForTimeout(400) // AI 정리가 화면에 반영될 때까지
  let clicks = 0
  const fixes: string[] = []
  for (const [kind, id] of [['origin', originId], ['destination', destId]] as const) {
    const slot = page.getByTestId(`slot-${kind}`)
    const status = await slot.getAttribute('data-status')
    const value = (await page.getByTestId(`slot-${kind}-value`).textContent())?.trim()
    const want = findPlace(id)!.name
    if (value !== want) {
      if (status === 'ambiguous' && (await page.getByTestId(`pick-${kind}-${id}`).count())) {
        await page.getByTestId(`pick-${kind}-${id}`).click()
        fixes.push(`${kind === 'origin' ? '출발지' : '목적지'} 후보 선택`)
      } else {
        await page.getByTestId(`select-${kind}`).selectOption(id)
        fixes.push(`${kind === 'origin' ? '출발지' : '목적지'} 직접 수정 (AI: ${value})`)
      }
      clicks++
    }
    await page.getByTestId(`confirm-${kind}`).click()
    clicks++
  }
  await page.getByTestId('assist-approved').check()
  clicks++
  if (run) {
    await page.getByTestId('assist-run').click()
    await page.getByTestId('assist-result').waitFor({ timeout: 60_000 })
  }
  clicks++
  const uiCount = Number((await page.getByTestId('action-count').textContent())?.replace(/[^0-9]/g, ''))
  return { clicks, keys: 0, fixes, uiCount, result: run ? await page.getByTestId('assist-result').getAttribute('data-status') : null }
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const rows = []
for (const p of PLAN) {
  const utterances = [...CASES, ...HOLDOUT].find((c) => c.id === p.id)!.utterances
  const m = await manual(page, p.origin, p.destination)
  const a = await assisted(page, utterances, p.origin, p.destination, process.env.RUN === '1')
  const row = {
    sample: p.label,
    manual: m.clicks + m.keys,
    assisted: a.clicks + a.keys,
    manualDetail: `클릭 ${m.clicks} + 키 입력 ${m.keys}`,
    assistedDetail: `클릭 ${a.clicks}`,
    uiCounter: a.uiCount,
    note: a.fixes.length ? a.fixes.join(', ') : 'AI 제안 그대로 확인',
    worker: a.result,
  }
  rows.push(row)
  console.log(JSON.stringify(row))
}
await browser.close()
await writeFile(
  'src/data/experiment-actions.json',
  JSON.stringify(
    {
      ranAt: new Date().toISOString(),
      method: '같은 통화 4건을 Playwright로 두 방식 모두 재현해 상담원 조작을 셌어요. 수동은 정답이 첫 후보로 뜨는 가장 짧은 검색어만 입력했고(키 입력은 한글 자모 수), 보조는 확인·후보 선택·직접 고르기 클릭만 셌어요. 고객 말 입력은 세지 않았어요.',
      rows,
    },
    null,
    2,
  ) + '\n',
)
