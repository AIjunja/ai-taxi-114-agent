// 상담원용 업무 웹 (Mock Console). Playwright Worker가 이 화면을 조작한다.
// 사람이 직접 열어 써 볼 수도 있다. 호출은 모두 가상이다.
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Badge, Button } from '../../components/ui'
import { randomId, requestDispatch, type DispatchOutcome } from '../../lib/dispatch-client'
import { PLACES } from '../dialog/places'

export function ConsolePage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const failOnce = useRef(params.get('fail') === 'once')
  const sessionId = useRef(randomId('console'))
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [approved, setApproved] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DispatchOutcome | null>(null)
  const [log, setLog] = useState<string[]>([])
  const keyRef = useRef(randomId('job'))

  const add = (s: string) => setLog((l) => [...l, `${new Date().toLocaleTimeString('ko-KR', { hour12: false })} ${s}`])
  const originPlace = PLACES.find((p) => p.name === origin)
  const destPlace = PLACES.find((p) => p.name === destination)
  const ready = Boolean(originPlace && destPlace && originPlace.id !== destPlace.id && approved)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!ready || pending || !originPlace || !destPlace) return
    setPending(true)
    setError(null)
    add('택시 호출 요청')
    if (failOnce.current) {
      // ?fail=once: Worker의 복구 동작을 보여주려고 일부러 넣은 일시 오류
      failOnce.current = false
      await new Promise((r) => setTimeout(r, 600))
      setPending(false)
      setError('배차 서버 응답이 늦어요. 잠시 뒤 다시 눌러 주세요. (시험용으로 넣은 오류)')
      add('오류: 일시적인 응답 지연 (주입된 오류)')
      return
    }
    try {
      const outcome = await requestDispatch({
        sessionId: sessionId.current,
        idempotencyKey: keyRef.current,
        originId: originPlace.id,
        destinationId: destPlace.id,
        approved,
      })
      setResult(outcome)
      add(`결과: ${outcome.result.status} (${outcome.source === 'server' ? '서버' : '브라우저 내 Mock'})`)
    } catch (err) {
      setError(`호출하지 못했어요. ${(err as Error).message}`)
      add(`오류: ${(err as Error).message}`)
    } finally {
      setPending(false)
    }
  }

  function reset() {
    setOrigin('')
    setDestination('')
    setApproved(false)
    setResult(null)
    setError(null)
    keyRef.current = randomId('job')
    add('새 호출 준비')
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[960px] items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <a href="/#automation" className="rounded-md p-1 hover:bg-bg" aria-label="소개 페이지로 돌아가기">
              <ArrowLeft size={18} />
            </a>
            <h1 className="text-base font-bold">114 상담원 업무 웹</h1>
            <Badge tag="Mock" />
          </div>
          <p className="text-xs text-muted">개인 PoC · 실제 택시를 부르지 않아요</p>
        </div>
      </header>

      <main className="mx-auto grid max-w-[960px] gap-4 px-4 py-6 md:grid-cols-[1fr_300px]">
        <form onSubmit={onSubmit} className="rounded-xl border border-line bg-surface p-5" aria-label="택시 대신 호출">
          <h2 className="font-bold">택시 대신 호출</h2>
          <p className="mt-1 text-sm text-muted">고객과 확인한 출발지·목적지를 넣고, 최종 승인을 받은 뒤 호출해요.</p>

          <label className="mt-5 block text-sm font-semibold" htmlFor="origin">
            출발지
          </label>
          <select id="origin" data-testid="console-origin" value={origin} onChange={(e) => setOrigin(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-line bg-surface px-3">
            <option value="">선택해 주세요</option>
            {PLACES.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name} ({p.area})
              </option>
            ))}
          </select>

          <label className="mt-4 block text-sm font-semibold" htmlFor="destination">
            목적지
          </label>
          <select id="destination" data-testid="console-destination" value={destination} onChange={(e) => setDestination(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-line bg-surface px-3">
            <option value="">선택해 주세요</option>
            {PLACES.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name} ({p.area})
              </option>
            ))}
          </select>

          <label className="mt-5 flex cursor-pointer items-start gap-2 rounded-lg border border-line p-3 text-sm">
            <input type="checkbox" data-testid="console-approved" checked={approved} onChange={(e) => setApproved(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]" />
            <span>
              <b>고객 최종 승인 받음</b>
              <span className="block text-muted">고객이 "네, 불러주세요"라고 답했을 때만 체크해요.</span>
            </span>
          </label>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="submit" variant="primary" size="lg" disabled={!ready || pending || Boolean(result)} data-testid="console-submit">
              {pending ? '호출하는 중' : '택시 호출'}
            </Button>
            {result && (
              <Button type="button" onClick={reset}>
                새 호출 준비
              </Button>
            )}
          </div>
          {!approved && origin && destination && <p className="mt-2 text-sm text-warn">최종 승인을 체크해야 호출할 수 있어요.</p>}

          {error && (
            <p role="alert" data-testid="console-error" className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          {result && (
            <div data-testid="console-result" data-status={result.result.status} className="mt-4 rounded-lg bg-accent-soft p-4 text-sm">
              {result.result.status === 'assigned' ? (
                <>
                  <p className="font-bold text-accent-strong">배차됐어요 (가상)</p>
                  <p className="mt-1">
                    차 번호 <b data-testid="console-plate">{result.result.plate}</b> · {result.result.color} {result.result.model} · 약 {result.result.etaMinutes}분
                  </p>
                </>
              ) : (
                <p className="font-bold">근처에 빈 택시가 없어요 (가상). 새 호출 준비를 누르고 다시 시도해 주세요.</p>
              )}
              <p className="mt-1 text-xs text-muted">요청 ID {result.result.requestId} · {result.source === 'server' ? '배차 서버' : '브라우저 내 Mock'}</p>
            </div>
          )}
        </form>

        <aside className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-bold">처리 기록</h2>
          <ol className="mt-2 space-y-1 font-mono text-xs text-muted" data-testid="console-log">
            {log.length === 0 && <li>아직 기록이 없어요.</li>}
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ol>
        </aside>
      </main>
    </div>
  )
}
