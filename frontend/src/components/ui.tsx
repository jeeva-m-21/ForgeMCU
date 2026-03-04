import React from 'react'
import clsx from 'clsx'
import { Loader2, CheckCircle2, AlertCircle, XCircle } from 'lucide-react'

/* ─── Card ─── */
export function Card({
  children,
  className = '',
  hover = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      {...props}
      className={clsx(
        'rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-5 transition-all duration-200',
        hover && 'hover:border-[#333] hover:bg-[#111] cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  )
}

/* ─── Button ─── */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}) {
  const variants = {
    primary: 'bg-white text-black hover:bg-[#ccc] border-transparent font-medium',
    secondary: 'bg-[#111] text-white hover:bg-[#1a1a1a] border-[#222]',
    ghost: 'bg-transparent text-[#888] hover:text-white hover:bg-[#111] border-transparent',
    danger: 'bg-transparent text-[#888] hover:text-white hover:bg-[#1a1a1a] border-[#222]',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-[12px] rounded-lg gap-1.5',
    md: 'px-4 py-2 text-[13px] rounded-lg gap-2',
    lg: 'px-5 py-2.5 text-[14px] rounded-xl gap-2',
  }

  return (
    <button
      disabled={loading || props.disabled}
      className={clsx(
        'inline-flex items-center justify-center border transition-all duration-150',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  )
}

/* ─── Badge ─── */
export function Badge({
  children,
  variant = 'default',
  dot = false,
  className = '',
}: {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  dot?: boolean
  className?: string
}) {
  const variants = {
    default: 'bg-[#111] text-[#888] border-[#222]',
    success: 'bg-[#111] text-white border-[#333]',
    warning: 'bg-[#111] text-[#888] border-[#333]',
    error: 'bg-[#111] text-[#666] border-[#222]',
    info: 'bg-[#111] text-[#888] border-[#222]',
  }
  const dotColors = {
    default: 'bg-[#555]',
    success: 'bg-white',
    warning: 'bg-[#888]',
    error: 'bg-[#555]',
    info: 'bg-[#666]',
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border',
        variants[variant],
        className
      )}
    >
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  )
}

/* ─── StatusBadge ─── */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: 'success' | 'warning' | 'error' | 'info'; icon: React.ReactNode; label: string }> = {
    completed: { variant: 'success', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Completed' },
    running:   { variant: 'warning', icon: <Loader2 className="w-3 h-3 animate-spin" />, label: 'Running' },
    queued:    { variant: 'info',    icon: <Loader2 className="w-3 h-3 animate-spin" />, label: 'Queued' },
    pending:   { variant: 'info',    icon: <Loader2 className="w-3 h-3 animate-spin" />, label: 'Pending' },
    failed:    { variant: 'error',   icon: <XCircle className="w-3 h-3" />, label: 'Failed' },
    success:   { variant: 'success', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Success' },
    idle:      { variant: 'info',    icon: <AlertCircle className="w-3 h-3" />, label: 'Idle' },
  }
  const config = map[status?.toLowerCase()] || map.idle!
  return (
    <Badge variant={config.variant}>
      {config.icon}
      {config.label}
    </Badge>
  )
}

/* ─── ProgressBar ─── */
export function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="w-full h-[3px] bg-[#1a1a1a] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full bg-white transition-all duration-700 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/* ─── Skeleton ─── */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />
}

/* ─── EmptyState ─── */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-xl bg-[#111] border border-[#1a1a1a] flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-[#444]" />
      </div>
      <h3 className="text-[14px] font-medium text-white mb-1">{title}</h3>
      <p className="text-[13px] text-[#666] max-w-sm mb-5">{description}</p>
      {action}
    </div>
  )
}

/* ─── SectionHeader ─── */
export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-[18px] font-semibold text-white tracking-tight">{title}</h2>
        {description && <p className="text-[13px] text-[#666] mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  )
}
