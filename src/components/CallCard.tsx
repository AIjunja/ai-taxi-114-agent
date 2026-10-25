import { useEffect, useRef, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Headset, Phone, User } from 'lucide-react'

export interface Turn {
  speaker: 'agent' | 'caller' | 'system'
  text: string
  note?: string
}

export type CallStatus = '대기' | '듣는 중' | '말하는 중' | '확인 대기' | '호출 중' | '완료' | '오류'

const STATUS_STYLE: Record<CallStatus, string> = {
  대기: 'bg-bg text-muted',
  '듣는 중': 'bg-info-soft text-info',
  '말하는 중': 'bg-accent-soft text-accent-strong',
  '확인 대기': 'bg-warn-soft text-warn',
  '호출 중': 'bg-warn-soft text-warn',
  완료: 'bg-accent-soft text-accent-strong',
  오류: 'bg-danger-soft text-danger',
}

export function CallCard({
  title,
  status,
  turns,
  footer,
  badge,
  minHeight = 360,
}: {
  title: string
  status: CallStatus
  turns: Turn[]
  footer?: ReactNode
  badge?: ReactNode
  minHeight?: number
}) {
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [turns.length])

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white">
            <Phone size={16} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{title}</p>
            <p className="text-xs text-muted">02-114 · AI 상담원</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {badge}
          <span role="status" aria-live="polite" data-testid="call-status" className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[status]}`}>
            {status}
          </span>
        </div>
      </div>
      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" style={{ minHeight, maxHeight: minHeight + 80 }} aria-live="polite">
        {turns.length === 0 && <p className="pt-10 text-center text-sm text-muted">통화를 시작하면 대화가 여기에 나와요.</p>}
        {turns.map((t, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={t.speaker === 'caller' ? 'flex justify-end' : t.speaker === 'system' ? 'flex justify-center' : 'flex justify-start'}
          >
            {t.speaker === 'system' ? (
              <p className="rounded-md bg-bg px-2.5 py-1 text-center text-xs text-muted">{t.text}</p>
            ) : (
              <div className={`flex max-w-[88%] items-end gap-2 ${t.speaker === 'caller' ? 'flex-row-reverse' : ''}`}>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${t.speaker === 'agent' ? 'bg-accent-soft text-accent' : 'bg-bg text-muted'}`}
                  aria-label={t.speaker === 'agent' ? 'AI 상담원' : '고객'}
                >
                  {t.speaker === 'agent' ? <Headset size={14} /> : <User size={14} />}
                </span>
                <div>
                  <p
                    className={`rounded-2xl px-3.5 py-2.5 text-[18px] leading-snug ${
                      t.speaker === 'agent' ? 'rounded-bl-md bg-bg text-ink' : 'rounded-br-md bg-accent text-white'
                    }`}
                  >
                    {t.text}
                  </p>
                  {t.note && <p className={`mt-1 text-xs text-muted ${t.speaker === 'caller' ? 'text-right' : ''}`}>{t.note}</p>}
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
      {footer && <div className="border-t border-line px-4 py-3">{footer}</div>}
    </div>
  )
}
