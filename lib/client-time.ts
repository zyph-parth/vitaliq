export function getClientTimeZone(): string {
  if (typeof window === 'undefined') return 'UTC'

  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export function withTimeZone(path: string): string {
  if (typeof window === 'undefined') return path

  const url = new URL(path, window.location.origin)
  url.searchParams.set('tz', getClientTimeZone())
  const query = url.searchParams.toString()

  return query ? `${url.pathname}?${query}` : url.pathname
}

export function getLocalDateKey(): string {
  return new Date().toLocaleDateString('en-CA')
}
