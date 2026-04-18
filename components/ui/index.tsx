'use client'

import React from 'react'
import { createPortal } from 'react-dom'
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

interface SelectProps {
  label?: string
  error?: string
  hint?: string
  options: { value: string; label: string }[]
  className?: string
  id?: string
  name?: string
  value?: string
  defaultValue?: string
  disabled?: boolean
  required?: boolean
  placeholder?: string
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void
  onValueChange?: (value: string) => void
}

export function Select({
  label,
  error,
  hint,
  options,
  className,
  id,
  name,
  value,
  defaultValue,
  disabled,
  required,
  placeholder,
  onChange,
  onValueChange,
}: SelectProps) {
  const generatedId = React.useId().replace(/:/g, '')
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-') || `select-${generatedId}`
  const labelId = `${selectId}-label`
  const listboxId = `${selectId}-listbox`
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const containerRef = React.useRef<HTMLDivElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const [open, setOpen] = React.useState(false)
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? options[0]?.value ?? '')
  const [menuMetrics, setMenuMetrics] = React.useState<{
    left: number
    width: number
    top?: number
    bottom?: number
    maxHeight: number
    openUpward: boolean
  } | null>(null)
  const selectedValue = value ?? internalValue
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === selectedValue)
  )
  const selectedOption = options[selectedIndex]

  React.useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      const insideTrigger = containerRef.current?.contains(target)
      const insideMenu = menuRef.current?.contains(target)

      if (!insideTrigger && !insideMenu) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  React.useEffect(() => {
    if (!open) return

    const viewportPadding = 16
    const menuGap = 10
    const desiredHeight = Math.min(320, options.length * 60 + 24)

    const updateMenuMetrics = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return

      const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2)
      const left = Math.min(
        Math.max(viewportPadding, rect.left),
        window.innerWidth - width - viewportPadding
      )
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding - menuGap
      const spaceAbove = rect.top - viewportPadding - menuGap
      const openUpward = spaceBelow < desiredHeight && spaceAbove > spaceBelow
      const availableSpace = openUpward ? spaceAbove : spaceBelow
      const maxHeight = Math.max(132, Math.min(320, availableSpace))

      setMenuMetrics({
        left,
        width,
        top: openUpward ? undefined : rect.bottom + menuGap,
        bottom: openUpward ? window.innerHeight - rect.top + menuGap : undefined,
        maxHeight,
        openUpward,
      })
    }

    updateMenuMetrics()

    window.addEventListener('resize', updateMenuMetrics)
    window.addEventListener('scroll', updateMenuMetrics, true)

    return () => {
      window.removeEventListener('resize', updateMenuMetrics)
      window.removeEventListener('scroll', updateMenuMetrics, true)
    }
  }, [open, options.length])

  React.useEffect(() => {
    if (!open || !menuMetrics) return

    const nextOption = optionRefs.current[selectedIndex]
    nextOption?.focus()
  }, [menuMetrics, open, selectedIndex])

  const emitValue = (nextValue: string) => {
    if (value === undefined) {
      setInternalValue(nextValue)
    }

    onValueChange?.(nextValue)

    if (onChange) {
      const syntheticTarget = { value: nextValue, name } as EventTarget & HTMLSelectElement
      onChange({
        target: syntheticTarget,
        currentTarget: syntheticTarget,
      } as React.ChangeEvent<HTMLSelectElement>)
    }
  }

  const focusOption = (index: number) => {
    optionRefs.current[index]?.focus()
  }

  const handleSelect = (nextValue: string) => {
    emitValue(nextValue)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
    }

    if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusOption((index + 1) % options.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusOption((index - 1 + options.length) % options.length)
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      focusOption(0)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      focusOption(options.length - 1)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
      return
    }

    if (event.key === 'Tab') {
      setOpen(false)
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleSelect(options[index].value)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div id={labelId} className="text-[11px] font-semibold uppercase tracking-widest text-[#3D3D3A]">
          {label}
        </div>
      )}
      <div ref={containerRef} className="relative">
        {name && <input type="hidden" name={name} value={selectedValue} />}
        <button
          ref={triggerRef}
          id={selectId}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={label ? `${labelId} ${selectId}` : selectId}
          aria-controls={listboxId}
          aria-invalid={Boolean(error)}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={handleTriggerKeyDown}
          className={clsx(
            'flex w-full items-center justify-between rounded-[22px] border px-4 py-3.5 pr-4 text-left text-[15px] outline-none transition-all',
            'bg-white/92 text-[#1A1A1A] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_24px_rgba(15,23,42,0.04)]',
            error
              ? 'border-[#DC4A3D] focus-visible:border-[#DC4A3D] focus-visible:ring-4 focus-visible:ring-[#FEE2E2]'
              : 'border-[#E8E8E3] hover:border-[#D6D6CF] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_12px_28px_rgba(15,23,42,0.06)] focus-visible:border-[#2D6A4F] focus-visible:ring-4 focus-visible:ring-[#D8F3DC]',
            open && !error && 'border-[#2D6A4F] ring-4 ring-[#D8F3DC] shadow-[0_16px_40px_rgba(22,101,52,0.1)]',
            disabled && 'cursor-not-allowed opacity-60',
            className
          )}
        >
          <span className={clsx('pr-4', !selectedOption && 'text-[#A1A1AA]')}>
            {selectedOption?.label || placeholder || 'Select an option'}
          </span>
          <span
            className={clsx(
              'pointer-events-none flex h-8 w-8 items-center justify-center rounded-full bg-[#F8FAFC] text-[#6B7280] transition-all duration-200',
              open && 'rotate-180 bg-[#ECFDF5] text-[#166534]'
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>

      </div>
      {error && <p className="text-xs text-[#DC4A3D]">{error}</p>}
      {hint && !error && <p className="text-xs text-[#8A8A85]">{hint}</p>}
      {open &&
        menuMetrics &&
        createPortal(
          <div
            ref={menuRef}
            className="z-[100] overflow-hidden rounded-[26px] border border-white/80 bg-white/95 p-2 shadow-[0_24px_70px_rgba(15,23,42,0.18)] backdrop-blur-xl animate-scale-in"
            style={{
              position: 'fixed',
              left: menuMetrics.left,
              width: menuMetrics.width,
              top: menuMetrics.top,
              bottom: menuMetrics.bottom,
              maxHeight: menuMetrics.maxHeight,
              transformOrigin: menuMetrics.openUpward ? 'bottom center' : 'top center',
            }}
          >
            <div
              id={listboxId}
              role="listbox"
              aria-labelledby={label ? labelId : undefined}
              aria-required={required}
              className="max-h-full space-y-1 overflow-y-auto overscroll-contain pr-1"
            >
              {options.map((option, index) => {
                const isSelected = option.value === selectedValue

                return (
                  <button
                    key={option.value}
                    ref={(node) => {
                      optionRefs.current[index] = node
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => handleSelect(option.value)}
                    onKeyDown={(event) => handleOptionKeyDown(event, index)}
                    className={clsx(
                      'flex w-full items-center justify-between rounded-[18px] px-4 py-3 text-left text-[15px] transition-all duration-150',
                      isSelected
                        ? 'bg-[#F0FDF4] text-[#111827] shadow-[inset_0_0_0_1px_rgba(22,101,52,0.18)]'
                        : 'text-[#1F2937] hover:bg-[#F8FAFC] focus:bg-[#F8FAFC] focus:outline-none'
                    )}
                  >
                    <span>{option.label}</span>
                    <span
                      className={clsx(
                        'ml-4 flex h-6 w-6 items-center justify-center rounded-full transition-all',
                        isSelected ? 'bg-[#166534] text-white' : 'bg-transparent text-transparent'
                      )}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M5 13l4 4L19 7"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>,
          document.body
        )}
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
  actionDisabled = false,
  className,
}: {
  title: string
  action?: string
  onAction?: () => void
  actionDisabled?: boolean
  className?: string
}) {
  return (
    <div className={clsx('mb-3 flex items-center justify-between px-4 lg:px-0', className)}>
      <h2 className="font-display text-[18px] font-semibold">{title}</h2>
      {action && (
        <button
          onClick={onAction}
          disabled={actionDisabled}
          className="text-xs font-medium text-[#8A8A85] transition-colors hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-[#8A8A85]"
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
