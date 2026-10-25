// 실제 Playwright 실행을 녹화해 자동 시연용 증빙을 남긴다.
// 실행: npm run dev 를 띄운 뒤 npm run record:worker
import { chromium } from 'playwright-core'
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runJob, WorkerRefusal, type WorkerEvent } from '../server/worker-core'

const baseUrl = process.env.WORKER_BASE_URL ?? 'http://localhost:5173'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const evidence = path.join(root, 'public', 'evidence')
const tmp = path.join(evidence, '.tmp-video')
const allowedHosts = ['localhost', '127.0.0.1']
const launch = () => chromium.launch({ headless: true })

await rm(tmp, { recursive: true, force: true })
await mkdir(tmp, { recursive: true })

// 1) 승인 없는 작업은 브라우저를 띄우기 전에 거절해야 한다.
try {
  await runJob({ action: 'dispatch', originId: 'seoul-station', destinationId: 'severance', approved: false }, { baseUrl, allowedHosts, launch, onEvent: () => {} })
  throw new Error('승인 없는 작업이 실행됐어요')
} catch (e) {
  if (!(e instanceof WorkerRefusal)) throw e
  console.log('미승인 작업 거절 확인:', e.code)
}

// 2) 실제 실행 + 녹화. 첫 호출에 일시 오류를 넣어 복구 과정을 남긴다.
const steps: { t: number; action: string; detail?: string }[] = []
let lastFrame = ''
const onEvent = (e: WorkerEvent) => {
  if (e.type === 'step') steps.push({ t: e.t, action: e.action, detail: e.detail })
  if (e.type === 'frame') lastFrame = e.data
}
const result = await runJob(
  { action: 'dispatch', originId: 'seoul-station', destinationId: 'severance', approved: true },
  { baseUrl, allowedHosts, launch, onEvent, recordVideoDir: tmp, injectFailure: true, screencast: true, pace: 320 },
)
if (result.status !== 'assigned') {
  console.log(steps)
  throw new Error(`녹화 실행 결과가 배차 완료가 아니에요: ${result.status}`)
}
const [video] = (await readdir(tmp)).filter((f) => f.endsWith('.webm'))
await rename(path.join(tmp, video), path.join(evidence, 'worker-run.webm'))
await rm(tmp, { recursive: true, force: true })
await writeFile(path.join(evidence, 'worker-run.jpg'), Buffer.from(lastFrame, 'base64'))
const pw = (await import('playwright-core/package.json', { with: { type: 'json' } })).default.version
const record = {
  recordedAt: new Date().toISOString(),
  environment: `로컬 개발 서버 (${process.platform}, Playwright ${pw})`,
  video: '/evidence/worker-run.webm',
  poster: '/evidence/worker-run.jpg',
  steps,
  durationMs: result.t,
  result: { status: 'assigned', requestId: 'recorded', plate: result.plate, etaMinutes: result.etaMinutes, color: result.color, model: result.model, driverName: result.driverName },
}
await writeFile(path.join(evidence, 'worker-run.json'), JSON.stringify(record, null, 2) + '\n')
console.log(JSON.stringify(record.result), `${result.t}ms`, `${steps.length} steps`)
