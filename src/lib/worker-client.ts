// /api/worker 실시간 실행 스트림(NDJSON)을 읽는다.
import type { Job, WorkerEvent } from '../../server/worker-core'

export type WorkerResult = Extract<WorkerEvent, { type: 'result' }>

export class WorkerUnavailable extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

export async function runWorker(job: Job, onEvent: (e: WorkerEvent) => void, signal?: AbortSignal): Promise<WorkerResult> {
  const res = await fetch('/api/worker', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(job),
    signal,
  }).catch(() => {
    throw new WorkerUnavailable('network', '실시간 Worker 서버에 연결하지 못했어요.')
  })
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}))
    throw new WorkerUnavailable(body.error ?? `http_${res.status}`, body.message ?? `실시간 Worker가 응답하지 않았어요 (${res.status}).`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let result: WorkerResult | null = null
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line) continue
      const e = JSON.parse(line) as WorkerEvent
      onEvent(e)
      if (e.type === 'result') result = e
      if (e.type === 'error') throw new WorkerUnavailable(e.code, e.message)
    }
  }
  if (!result) throw new WorkerUnavailable('incomplete', '실시간 Worker 실행이 중간에 끊겼어요.')
  return result
}
