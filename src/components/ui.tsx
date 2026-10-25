import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type Tag = '실시간' | '녹화' | '합성' | '가정' | 'Mock' | '공개 자료'

const TAG_STYLE: Record<Tag, string> = {
  실시간: 'bg-accent-soft text-accent-strong border-accent/30',
  녹화: 'bg-info-soft text-info border-info/30',
  합성: 'bg-warn-soft text-warn border-warn/30',
  가정: 'bg-warn-soft text-warn border-warn/30',
  Mock: 'bg-white text-muted border-line',
  '공개 자료': 'bg-white text-ink border-line',
}

export function Badge({ tag, children }: { tag: Tag; children?: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-semibold ${TAG_STYLE[tag]}`}>
      {children ?? tag}
    </span>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-strong border-accent',
  secondary: 'bg-surface text-ink hover:bg-bg border-line',
  ghost: 'bg-transparent text-ink hover:bg-black/5 border-transparent',
  danger: 'bg-surface text-danger hover:bg-danger-soft border-danger/40',
}

const SIZE = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-[15px]', lg: 'h-12 px-5 text-base' }
const BASE = 'inline-flex items-center justify-center gap-2 rounded-lg border font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45'

export function buttonClass(variant: Variant = 'secondary', size: keyof typeof SIZE = 'md') {
  return `${BASE} ${SIZE[size]} ${VARIANT[variant]}`
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return <button {...props} className={`${buttonClass(variant, size)} ${className}`} />
}

export function Section({ id, eyebrow, title, lead, children }: { id: string; eyebrow: string; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 md:py-24" aria-labelledby={`${id}-title`}>
      <p className="text-sm font-semibold text-accent">{eyebrow}</p>
      <h2 id={`${id}-title`} className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        {title}
      </h2>
      {lead && <div className="mt-3 max-w-[680px] text-[15px] leading-relaxed text-muted sm:text-base">{lead}</div>}
      <div className="mt-8">{children}</div>
    </section>
  )
}

export function Panel({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-xl border border-line bg-surface ${className}`}>{children}</div>
}

export function formatWon(n: number): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(abs % 100_000_000 === 0 ? 0 : 2)}억 원`
  if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000).toLocaleString('ko-KR')}만 원`
  return `${sign}${Math.round(abs).toLocaleString('ko-KR')}원`
}
