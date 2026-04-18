'use client'

import React from 'react'
import { clsx } from 'clsx'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  fullWidth,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-2xl font-semibold transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50'

  const variants = {
    primary: 'bg-[#1A1A1A] text-white hover:-translate-y-0.5 hover:bg-[#2D2D2D] hover:shadow-lg',
    secondary: 'border border-[#E8E8E3] bg-white text-[#1A1A1A] hover:border-[#1A1A1A] hover:shadow-sm',
    ghost: 'bg-transparent text-[#8A8A85] hover:bg-[#F1F1EC] hover:text-[#1A1A1A]',
    danger: 'bg-[#FEE2E2] text-[#DC4A3D] hover:bg-[#DC4A3D] hover:text-white',
  }

  const sizes = {
    sm: 'px-4 py-2.5 text-xs tracking-wide',
    md: 'px-5 py-3.5 text-sm tracking-wide',
    lg: 'px-6 py-4 text-sm tracking-wide',
  }

  return (
    <button
      className={clsx(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <LoadingDots />
        </span>
      ) : (
        children
      )}
    </button>
  )
}

export function LoadingDots() {
  return (
    <span className="flex items-center gap-1">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="typing-dot h-1.5 w-1.5 rounded-full bg-current opacity-100"
          style={{ animationDelay: `${index * 0.2}s` }}
        />
      ))}
    </span>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-[11px] font-semibold uppercase tracking-widest text-[#3D3D3A]"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={clsx(
          'w-full rounded-xl border px-4 py-3 text-[15px] outline-none transition-colors',
          'bg-white/80 text-[#1A1A1A] placeholder:text-[#C0C0BA]',
          'font-body',
          error ? 'border-[#DC4A3D] focus:border-[#DC4A3D]' : 'border-[#E8E8E3] focus:border-[#2D6A4F]',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-[#DC4A3D]">{error}</p>}
      {hint && !error && <p className="text-xs text-[#8A8A85]">{hint}</p>}
    </div>
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
}

export function Select({ label, options, className, id, ...props }: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="text-[11px] font-semibold uppercase tracking-widest text-[#3D3D3A]"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={clsx(
          'w-full rounded-xl border px-4 py-3 text-[15px] outline-none transition-colors',
          'border-[#E8E8E3] bg-white/80 text-[#1A1A1A] focus:border-[#2D6A4F]',
          className
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  glass?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({ children, className, onClick, glass, padding = 'md' }: CardProps) {
  const paddings = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' }
  const hasCustomBackground = typeof className === 'string' && /\bbg-[^\s]+/.test(className)

  return (
    <div
      onClick={onClick}
      className={clsx(
        'rounded-2xl border border-[#E8E8E3] transition-all duration-200',
        glass
          ? 'border-white/90 bg-white/[0.72] shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl'
          : !hasCustomBackground && 'bg-white',
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]',
        paddings[padding],
        className
      )}
    >
      {children}
    </div>
  )
}

type ChipVariant = 'green' | 'amber' | 'blue' | 'coral' | 'purple' | 'gray'

const chipStyles: Record<ChipVariant, string> = {
  green: 'bg-[#D8F3DC] text-[#2D6A4F]',
  amber: 'bg-[#FEF3C7] text-[#B45309]',
  blue: 'bg-[#DBEAFE] text-[#1D4ED8]',
  coral: 'bg-[#FEE2E2] text-[#DC4A3D]',
  purple: 'bg-[#EDE9FE] text-[#6D28D9]',
  gray: 'bg-[#F1F1EC] text-[#5F5E5A]',
}

export function Chip({
  children,
  variant = 'gray',
  className,
}: {
  children: React.ReactNode
  variant?: ChipVariant
  className?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold',
        chipStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

export function SectionHeader({
  title,
  action,
  onAction,
  className,
}: {
  title: string
  action?: string
  onAction?: () => void
  className?: string
}) {
  return (
    <div className={clsx('mb-3 flex items-center justify-between px-4 lg:px-0', className)}>
      <h2 className="font-display text-[18px] font-semibold">{title}</h2>
      {action && (
        <button
          onClick={onAction}
          className="text-xs font-medium text-[#8A8A85] transition-colors hover:text-[#1A1A1A]"
        >
          {action}
        </button>
      )}
    </div>
  )
}

export function StatCard({
  value,
  label,
  unit,
  trend,
  trendUp,
}: {
  value: string | number
  label: string
  unit?: string
  trend?: string
  trendUp?: boolean
  color?: string
}) {
  return (
    <Card padding="sm">
      <div className="font-display text-[22px] font-semibold leading-none">
        {value}
        {unit && <span className="ml-1 text-[13px] font-normal text-[#8A8A85]">{unit}</span>}
      </div>
      <div className="mt-1.5 text-[11px] text-[#8A8A85]">{label}</div>
      {trend && (
        <div
          className={clsx(
            'mt-2 text-[11px] font-semibold',
            trendUp ? 'text-[#2D6A4F]' : 'text-[#DC4A3D]'
          )}
        >
          {trendUp ? 'Up' : 'Down'} {trend}
        </div>
      )}
    </Card>
  )
}

export function ProgressBar({
  value,
  max,
  color = '#2D6A4F',
  height = 8,
  className,
}: {
  value: number
  max: number
  color?: string
  height?: number
  className?: string
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))

  return (
    <div className={clsx('overflow-hidden rounded-full', className)} style={{ height, background: '#E8E8E3' }}>
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-xl bg-[#D8F3DC] font-semibold text-[#2D6A4F]"
      style={{ width: size, height: size, fontSize: size * 0.3 }}
    >
      {initials}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-xl bg-[#F1F1EC]', className)} />
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: string
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 text-4xl">{icon}</div>
      <div className="font-display mb-2 text-[18px] font-semibold">{title}</div>
      {subtitle && <p className="mb-5 text-sm leading-relaxed text-[#8A8A85]">{subtitle}</p>}
      {action}
    </div>
  )
}
