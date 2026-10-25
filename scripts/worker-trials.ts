// 실험 2: 공개 서버에서 Playwright Worker를 여러 번 실행해 성공률과 시간을 잰다.
import { writeFile } from 'node:fs/promises'
const base = process.env.BASE ?? 'https://ai-taxi-114-agent.vercel.app'
const ROUTES: [string, string][] = [
  ['seoul-station', 'asan'],
  ['gimpo-airport', 'gangnam-station'],
  ['yongsan-station', 'samsung-hospital'],
  ['express-terminal', 'st-mary'],
  ['city-hall', 'noryangjin'],
  ['hongik-station', 'severance'],
]
const trials = []
for (const [o, d] of ROUTES) {
  const t0 = Date.now()
  let firstFrame: number | null = null
  let frames = 0
  let steps = 0
  let result: Record<string, unknown> | null = null
  let error: string | null = null
  try {
    const res = await fetch(`${base}/api/worker`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'dispatch', originId: o, destinationId: d, approved: true }) })
    if (!res.ok || !res.body) {
      error = `HTTP ${res.status} ${(await res.text()).slice(0, 120)}`
    } else {
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let nl
        while ((nl = buf.indexOf('\n')) >= 0) {
          const e = JSON.parse(buf.slice(0, nl))
          buf = buf.slice(nl + 1)
          if (e.type === 'frame') {
            frames++
            firstFrame ??= Date.now() - t0
          } else if (e.type === 'step') steps++
          else if (e.type === 'result') result = e
          else if (e.type === 'error') error = `${e.code}: ${e.message}`
        }
      }
    }
  } catch (e) {
    error = (e as Error).message
  }
  const row = {
    route: `${o} → ${d}`,
    ok: result?.status === 'assigned' || result?.status === 'no_taxi',
    status: (result?.status as string) ?? 'error',
    totalMs: Date.now() - t0,
    workerMs: (result?.t as number) ?? null,
    firstFrameMs: firstFrame,
    frames,
    steps,
    attempts: (result?.attempts as number) ?? 0,
    error,
  }
  trials.push(row)
  console.log(JSON.stringify(row))
}
const ok = trials.filter((t) => t.ok)
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null)
const out = {
  ranAt: new Date().toISOString(),
  base,
  method: '공개 URL의 /api/worker를 6번 차례로 호출 (서버 Chromium이 콘솔을 열어 입력·호출). 걸린 시간은 이 PC에서 잰 값',
  runs: trials.length,
  succeeded: ok.length,
  avgTotalMs: avg(ok.map((t) => t.totalMs)),
  avgFirstFrameMs: avg(ok.map((t) => t.firstFrameMs ?? 0)),
  trials,
}
await writeFile('src/data/experiment-worker.json', JSON.stringify(out, null, 2) + '\n')
console.log(`성공 ${out.succeeded}/${out.runs} · 평균 ${out.avgTotalMs}ms · 첫 화면 ${out.avgFirstFrameMs}ms`)
