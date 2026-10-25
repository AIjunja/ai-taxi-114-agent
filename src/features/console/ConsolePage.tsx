// 택시 호출 콘솔 (Mock). 택시 호출 담당자가 쓰는 업무용 웹을 가정해 만든 화면이다.
// Playwright Worker가 이 화면을 실제 브라우저로 조작한다. 사람이 직접 써 볼 수도 있다.
// 실제 카카오 T나 택시를 호출하지 않는다.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Car, Check, ClipboardList, History, LayoutGrid, MapPin, Phone, Search, Settings, X } from 'lucide-react'
import { MiniMap, distanceKm, driverPosition } from '../../components/MiniMap'
import { cancelCall, createCall, getStatus, randomId, type DispatchStatus } from '../../lib/dispatch-client'
import { findPlace, normalize, PLACES, resolvePlaces, type Place } from '../dialog/places'

type Phase = 'input' | 'requesting' | 'searching' | 'assigned' | 'no_taxi' | 'cancelling' | 'cancelled'

interface LogLine {
  at: string
  text: string
  tone?: 'error' | 'ok'
}

function searchPlaces(q: string): Place[] {
  const t = normalize(q)
  if (!t) return []
  const exact = resolvePlaces(q)
  const rest = PLACES.filter((p) => !exact.includes(p) && (normalize(p.name).includes(t) || normalize(p.area).includes(t)))
  return [...exact, ...rest].slice(0, 6)
}

function PlaceField({
  kind,
  value,
  confirmed,
  disabled,
  onPick,
  onConfirm,
  onClear,
}: {
  kind: 'origin' | 'destination'
  value: Place | null
  confirmed: boolean
  disabled: boolean
  onPick: (p: Place) => void
  onConfirm: () => void
  onClear: () => void
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const list = useMemo(() => searchPlaces(q), [q])
  const label = kind === 'origin' ? '출발지' : '목적지'
  const dot = kind === 'origin' ? 'bg-accent' : 'bg-danger'

  return (
    <div className="rounded-lg border border-line bg-surface p-3" data-testid={`console-${kind}-card`}>
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[13px] font-bold">
          <span className={`h-2 w-2 rounded-full ${dot}`} /> {label}
        </p>
        {confirmed && (
          <span className="flex items-center gap-1 text-xs font-bold text-accent" data-testid={`console-${kind}-confirmed`}>
            <Check size={12} /> 위치 확인됨
          </span>
        )}
      </div>
      {value ? (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-bg px-2.5 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold" data-testid={`console-${kind}-value`}>
              {value.name}
            </p>
            <p className="text-xs text-muted">
              {value.area} · {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            {!confirmed && (
              <button type="button" disabled={disabled} onClick={onConfirm} data-testid={`console-${kind}-confirm`} className="rounded-md bg-ink px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-40">
                위치 확인
              </button>
            )}
            <button type="button" disabled={disabled} onClick={onClear} aria-label={`${label} 지우기`} className="rounded-md p-1.5 text-muted hover:bg-line disabled:opacity-40">
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="relative mt-2">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            data-testid={`console-${kind}-input`}
            value={q}
            disabled={disabled}
            onChange={(e) => {
              setQ(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            placeholder={`${label} 검색 (예: 서울역)`}
            className="h-9 w-full rounded-md border border-line bg-surface pl-8 pr-2 text-sm outline-none focus:border-ink"
            autoComplete="off"
          />
          {open && q && (
            <ul className="absolute left-0 right-0 top-10 z-20 overflow-hidden rounded-md border border-line bg-surface shadow-lg" role="listbox" data-testid={`console-${kind}-suggestions`}>
              {list.length === 0 && <li className="px-3 py-2 text-sm text-muted">검색 결과가 없어요. 역이나 병원 이름으로 찾아보세요.</li>}
              {list.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    role="option"
                    data-testid={`suggest-${kind}-${p.id}`}
                    onClick={() => {
                      onPick(p)
                      setQ('')
                      setOpen(false)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg"
                  >
                    <MapPin size={13} className="shrink-0 text-muted" />
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-xs text-muted">{p.area}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

const STEPS: { key: string; label: string }[] = [
  { key: 'place', label: '위치 확인' },
  { key: 'approve', label: '고객 승인' },
  { key: 'request', label: '호출 접수' },
  { key: 'search', label: '배차 대기' },
  { key: 'assign', label: '기사 배정' },
]

export function ConsolePage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const byWorker = params.get('by') === 'worker'
  const failOnce = useRef(params.get('fail') === 'once')
  const sessionId = useRef(randomId('console'))
  const callKey = useRef(randomId('job'))
  const [origin, setOrigin] = useState<Place | null>(null)
  const [destination, setDestination] = useState<Place | null>(null)
  const [originOk, setOriginOk] = useState(false)
  const [destOk, setDestOk] = useState(false)
  const [approved, setApproved] = useState(false)
  const [phase, setPhase] = useState<Phase>('input')
  const [status, setStatus] = useState<DispatchStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [log, setLog] = useState<LogLine[]>([])
  const [tick, setTick] = useState(0)
  const [callNo] = useState(() => `114-${String(Date.now()).slice(-6)}`)

  const add = (text: string, tone?: LogLine['tone']) =>
    setLog((l) => [...l, { at: new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Seoul', hour12: false }), text, tone }].slice(-40))

  // ?request= 로 열면 기존 호출을 불러온다 (취소 작업용)
  useEffect(() => {
    const id = params.get('request')
    if (!id) return
    void getStatus(id).then(({ data }) => {
      setStatus(data)
      setOrigin(findPlace(data.originId ?? '') ?? null)
      setDestination(findPlace(data.destinationId ?? '') ?? null)
      setOriginOk(true)
      setDestOk(true)
      setApproved(true)
      setPhase(data.status === 'searching' ? 'searching' : data.status === 'assigned' ? 'assigned' : data.status === 'no_taxi' ? 'no_taxi' : 'input')
      add(`호출 불러옴 · ${data.status}`)
    })
  }, [params])

  // 배차 대기 중이면 1초마다 상태를 조회한다
  useEffect(() => {
    if (phase !== 'searching' || !status) return
    const t = setInterval(async () => {
      try {
        const { data } = await getStatus(status.requestId)
        setStatus(data)
        if (data.status === 'assigned') {
          setPhase('assigned')
          add(`기사 배정 · ${data.driverName} · ${data.plate}`, 'ok')
        } else if (data.status === 'no_taxi') {
          setPhase('no_taxi')
          add('배차 실패 · 주변 빈 차 없음', 'error')
        }
      } catch (e) {
        add(`상태 조회 오류 · ${(e as Error).message}`, 'error')
      }
    }, 1000)
    return () => clearInterval(t)
  }, [phase, status])

  useEffect(() => {
    if (phase !== 'assigned') return
    const t = setInterval(() => setTick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  const ready = Boolean(origin && destination && originOk && destOk && approved && origin.id !== destination.id)
  const locked = phase !== 'input'

  async function submit() {
    if (!ready || !origin || !destination || locked) return
    setError(null)
    setPhase('requesting')
    add('택시 호출 요청')
    if (failOnce.current) {
      // ?fail=once: Worker의 복구 동작을 보여주려고 일부러 넣은 일시 오류
      failOnce.current = false
      await new Promise((r) => setTimeout(r, 700))
      setPhase('input')
      setError('배차 서버 응답이 늦어요. 잠시 뒤 다시 눌러 주세요. (시험용으로 넣은 오류)')
      add('오류 · 응답 지연 (주입된 오류)', 'error')
      return
    }
    try {
      const { data, source } = await createCall({ sessionId: sessionId.current, idempotencyKey: callKey.current, originId: origin.id, destinationId: destination.id, approved })
      setStatus(data)
      ;(window as unknown as { __lastRequestId?: string }).__lastRequestId = data.requestId
      setPhase('searching')
      add(`호출 접수 · ${source === 'server' ? '배차 서버' : '브라우저 내 Mock'}`)
    } catch (e) {
      setPhase('input')
      setError(`호출하지 못했어요. ${(e as Error).message}`)
      add(`오류 · ${(e as Error).message}`, 'error')
    }
  }

  async function doCancel() {
    if (!status) return
    setConfirmCancel(false)
    setPhase('cancelling')
    try {
      await cancelCall(status.requestId)
      setPhase('cancelled')
      add('호출 취소 완료', 'ok')
    } catch (e) {
      setPhase('assigned')
      setError(`취소하지 못했어요. ${(e as Error).message}`)
    }
  }

  function reset() {
    setOrigin(null)
    setDestination(null)
    setOriginOk(false)
    setDestOk(false)
    setApproved(false)
    setStatus(null)
    setError(null)
    setPhase('input')
    callKey.current = randomId('job')
    add('새 호출 준비')
  }

  const doneIndex =
    phase === 'assigned' || phase === 'cancelling' || phase === 'cancelled'
      ? 5
      : phase === 'searching' || phase === 'no_taxi'
        ? 3
        : phase === 'requesting'
          ? 2
          : approved && originOk && destOk
            ? 2
            : originOk && destOk
              ? 1
              : 0

  const eta = status?.etaMinutes ?? 0
  const elapsedSinceAssign = status?.assignedAt ? (Date.now() - status.assignedAt) / 1000 : 0
  void tick
  const driver = origin && status?.status === 'assigned' && phase !== 'cancelled' ? driverPosition(origin, status.requestId, elapsedSinceAssign / Math.max(60, eta * 60)) : null
  const km = origin && destination ? distanceKm(origin, destination) : null

  return (
    <div className="flex min-h-screen bg-[#f3f4f6] text-[14px]" data-testid="console" data-phase={phase}>
      <aside className="hidden w-[176px] shrink-0 flex-col bg-[#1d2430] text-white/80 md:flex">
        <div className="flex h-12 items-center gap-2 border-b border-white/10 px-4">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-[#f5c400] text-[11px] font-black text-ink">T</span>
          <span className="font-display text-sm font-bold text-white">호출 콘솔</span>
        </div>
        <nav className="flex-1 space-y-0.5 p-2 text-[13px]">
          {[
            [ClipboardList, '호출 접수', true],
            [LayoutGrid, '배차 현황', false],
            [History, '호출 이력', false],
            [Settings, '설정', false],
          ].map(([Icon, label, active]) => {
            const I = Icon as typeof ClipboardList
            return (
              <span key={label as string} className={`flex items-center gap-2 rounded-md px-2.5 py-2 ${active ? 'bg-white/10 font-bold text-white' : 'text-white/50'}`}>
                <I size={15} /> {label as string}
              </span>
            )
          })}
        </nav>
        <div className="border-t border-white/10 p-3 text-xs">
          <p className="font-bold text-white">상담원 114-07</p>
          <p className="text-white/50">Mock 환경</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center justify-between gap-2 border-b border-line bg-surface px-4">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate font-bold">
              호출 접수 <span className="font-normal text-muted">› 새 호출 {callNo}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs">
            {byWorker && (
              <span className="rounded-md bg-[#1d2430] px-2 py-1 font-bold text-white" data-testid="worker-banner">
                Playwright Worker 자동 조작 중
              </span>
            )}
            <span className="rounded-md border border-warn/40 bg-warn-soft px-2 py-1 font-bold text-warn">Mock · 실제 호출 없음</span>
          </div>
        </header>

        <main className="grid flex-1 gap-3 p-3 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-muted" />
                <span className="text-[13px] font-bold">114 전화 고객</span>
              </div>
              <span className="text-xs text-muted">번호 비공개 · 통화 연결됨</span>
            </div>

            <PlaceField
              kind="origin"
              value={origin}
              confirmed={originOk}
              disabled={locked}
              onPick={(p) => {
                setOrigin(p)
                setOriginOk(false)
                add(`출발지 선택 · ${p.name}`)
              }}
              onConfirm={() => {
                setOriginOk(true)
                add('출발지 위치 확인')
              }}
              onClear={() => {
                setOrigin(null)
                setOriginOk(false)
              }}
            />
            <PlaceField
              kind="destination"
              value={destination}
              confirmed={destOk}
              disabled={locked}
              onPick={(p) => {
                setDestination(p)
                setDestOk(false)
                add(`목적지 선택 · ${p.name}`)
              }}
              onConfirm={() => {
                setDestOk(true)
                add('목적지 위치 확인')
              }}
              onClear={() => {
                setDestination(null)
                setDestOk(false)
              }}
            />

            <div className="rounded-lg border border-line bg-surface p-3">
              <label className="flex cursor-pointer items-start gap-2 text-[13px]">
                <input
                  type="checkbox"
                  data-testid="console-approved"
                  checked={approved}
                  disabled={locked}
                  onChange={(e) => {
                    setApproved(e.target.checked)
                    if (e.target.checked) add('고객 최종 승인 확인')
                  }}
                  className="mt-0.5 h-4 w-4 accent-[#1d2430]"
                />
                <span>
                  <b>고객 최종 승인 받음</b>
                  <span className="block text-xs text-muted">고객이 "네, 불러주세요"라고 답했을 때만 체크해요.</span>
                </span>
              </label>
              {km !== null && <p className="mt-2 text-xs text-muted">직선거리 약 {km.toFixed(1)}km</p>}
              <button
                type="button"
                onClick={submit}
                disabled={!ready || locked}
                data-testid="console-submit"
                className="mt-3 h-11 w-full rounded-md bg-[#f5c400] font-display text-[15px] font-bold text-ink transition-colors hover:bg-[#e8b900] disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
              >
                {phase === 'requesting' ? '호출하는 중' : '택시 호출'}
              </button>
              {!ready && phase === 'input' && (
                <p className="mt-2 text-xs text-muted">
                  {!origin || !destination ? '출발지와 목적지를 검색해 고르세요.' : !originOk || !destOk ? '두 곳 모두 위치 확인을 눌러 주세요.' : '최종 승인을 체크해야 호출할 수 있어요.'}
                </p>
              )}
              {error && (
                <p role="alert" data-testid="console-error" className="mt-2 rounded-md bg-danger-soft px-2.5 py-2 text-xs font-semibold text-danger">
                  {error}
                </p>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <MiniMap origin={originOk ? origin : null} destination={destOk ? destination : null} pending={!originOk ? origin : !destOk ? destination : null} driver={driver} height={210} />

            <ol className="grid grid-cols-5 gap-1 rounded-lg border border-line bg-surface p-2" data-testid="console-steps">
              {STEPS.map((s, i) => (
                <li key={s.key} className={`rounded-md px-1 py-1.5 text-center text-[11px] font-bold ${i < doneIndex ? 'bg-[#1d2430] text-white' : i === doneIndex ? 'bg-bg text-ink ring-1 ring-ink/20' : 'text-muted'}`}>
                  {s.label}
                </li>
              ))}
            </ol>

            <div className="min-h-[150px] rounded-lg border border-line bg-surface p-3" data-testid="console-status" data-status={phase}>
              {phase === 'input' || phase === 'requesting' ? (
                <p className="text-sm text-muted">호출을 접수하면 배차 상태가 여기에 나와요.</p>
              ) : phase === 'searching' ? (
                <div>
                  <p className="flex items-center gap-2 font-bold">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#f5c400]" /> 배차 대기 중
                  </p>
                  <p className="mt-1 text-[13px] text-muted">{status?.nearbyTaxis ? `주변 택시 ${status.nearbyTaxis}대에 호출을 보냈어요.` : '주변 택시에 호출을 보내는 중이에요.'}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
                    <div className="h-full bg-[#1d2430] transition-all duration-700" style={{ width: `${Math.round((status?.progress ?? 0.1) * 100)}%` }} />
                  </div>
                </div>
              ) : phase === 'no_taxi' ? (
                <div>
                  <p className="font-bold text-danger">배차 실패 · 주변에 빈 차가 없어요</p>
                  <button type="button" onClick={reset} className="mt-2 rounded-md border border-line px-3 py-1.5 text-xs font-bold">
                    새 호출 준비
                  </button>
                </div>
              ) : phase === 'cancelled' ? (
                <div data-testid="console-cancelled">
                  <p className="font-bold">호출을 취소했어요</p>
                  <p className="mt-1 text-xs text-muted">기사에게 취소 알림을 보냈어요 (가상).</p>
                  <button type="button" onClick={reset} className="mt-2 rounded-md border border-line px-3 py-1.5 text-xs font-bold">
                    새 호출 준비
                  </button>
                </div>
              ) : (
                <div data-testid="console-result" data-status={status?.status}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-bold text-accent">
                        <Car size={13} /> 기사 배정 완료 (가상)
                      </p>
                      <p className="mt-1 font-display text-2xl font-bold tracking-wide" data-testid="console-plate">
                        {status?.plate}
                      </p>
                      <p className="text-[13px] text-muted">
                        <span data-testid="console-car">{status?.color} {status?.model}</span> · 기사 <span data-testid="console-driver">{status?.driverName}</span> ★{status?.driverRating}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted">도착 예정</p>
                      <p className="font-display text-2xl font-bold" data-testid="console-eta">
                        {eta}분
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    {confirmCancel ? (
                      <>
                        <span className="text-xs font-semibold">정말 취소할까요?</span>
                        <button type="button" onClick={doCancel} data-testid="console-cancel-confirm" className="rounded-md bg-danger px-3 py-1.5 text-xs font-bold text-white">
                          취소하기
                        </button>
                        <button type="button" onClick={() => setConfirmCancel(false)} className="rounded-md border border-line px-3 py-1.5 text-xs font-bold">
                          돌아가기
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmCancel(true)}
                        disabled={phase === 'cancelling'}
                        data-testid="console-cancel"
                        className="rounded-md border border-danger/40 px-3 py-1.5 text-xs font-bold text-danger disabled:opacity-40"
                      >
                        {phase === 'cancelling' ? '취소하는 중' : '호출 취소'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <ol className="num max-h-[108px] overflow-y-auto rounded-lg border border-line bg-surface px-3 py-2 text-[11px] text-muted" data-testid="console-log">
              {log.length === 0 && <li>처리 기록이 여기에 남아요.</li>}
              {log.map((l, i) => (
                <li key={i} className={l.tone === 'error' ? 'text-danger' : l.tone === 'ok' ? 'text-accent' : ''}>
                  {l.at} {l.text}
                </li>
              ))}
            </ol>
          </div>
        </main>
      </div>
    </div>
  )
}
