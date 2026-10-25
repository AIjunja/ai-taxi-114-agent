// 상담원 보조 화면에서 쓰는 Worker 실행. 실시간 Worker를 못 쓰면 API로 호출하고 그 사실을 남긴다.
import { useRef, useState } from 'react'
import { createCall, randomId, waitForAssignment } from '../../lib/dispatch-client'
import { runWorker, WorkerUnavailable } from '../../lib/worker-client'
import type { DispatchResult } from '../dialog/machine'
import type { WorkerView } from '../call/useCall'

const IDLE: WorkerView = { mode: 'idle', action: 'dispatch', status: 'idle', frames: 0, steps: [] }

export function useWorkerJob() {
  const [worker, setWorker] = useState<WorkerView>(IDLE)
  const running = useRef(false)
  const session = useRef(randomId('assist'))

  async function dispatch(originId: string, destinationId: string, approved: boolean): Promise<DispatchResult | null> {
    if (running.current || !approved) return null
    running.current = true
    const startedAt = Date.now()
    setWorker({ ...IDLE, mode: 'live', status: 'running', startedAt })
    try {
      const r = await runWorker({ action: 'dispatch', originId, destinationId, approved }, (e) => {
        if (e.type === 'frame') setWorker((w) => ({ ...w, frame: e.data, frames: w.frames + 1 }))
        else if (e.type === 'step') setWorker((w) => ({ ...w, steps: [...w.steps, { t: e.t, action: e.action, detail: e.detail }] }))
      })
      const result: DispatchResult | null =
        r.status === 'assigned' && r.plate
          ? { status: 'assigned', requestId: r.requestId ?? '', plate: r.plate, etaMinutes: r.etaMinutes ?? 0, color: r.color ?? '', model: r.model ?? '', driverName: r.driverName }
          : r.status === 'no_taxi'
            ? { status: 'no_taxi', requestId: r.requestId ?? '' }
            : null
      setWorker((w) => ({ ...w, status: result ? 'done' : 'failed', result: result ?? undefined, reason: result ? undefined : '콘솔 조작에 실패했어요' }))
      return result
    } catch (e) {
      const reason = e instanceof WorkerUnavailable ? e.message : '실시간 Worker에 연결하지 못했어요.'
      setWorker((w) => ({ ...w, mode: 'api_fallback', reason }))
      try {
        const created = await createCall({ sessionId: session.current, idempotencyKey: randomId('job'), originId, destinationId, approved })
        const s = await waitForAssignment(created.data.requestId)
        const result: DispatchResult =
          s.status === 'assigned'
            ? { status: 'assigned', requestId: s.requestId, plate: s.plate!, etaMinutes: s.etaMinutes!, color: s.color!, model: s.model!, driverName: s.driverName }
            : { status: 'no_taxi', requestId: s.requestId }
        setWorker((w) => ({ ...w, status: 'done', result }))
        return result
      } catch (err) {
        setWorker((w) => ({ ...w, status: 'failed', reason: (err as Error).message }))
        return null
      }
    } finally {
      running.current = false
    }
  }

  return { worker, dispatch, reset: () => setWorker(IDLE), busy: worker.status === 'running' }
}
