const SUPPRESS_PATTERNS = [/ResizeObserver loop completed/]

function shouldSuppress(args: unknown[]): boolean {
  for (const arg of args) {
    const message = arg instanceof Error ? arg.message : typeof arg === 'string' ? arg : ''
    if (SUPPRESS_PATTERNS.some((re) => re.test(message))) return true
  }
  return false
}

const originalError = console.error.bind(console)
console.error = (...args: unknown[]) => {
  if (shouldSuppress(args)) return
  originalError(...args)
}

window.addEventListener(
  'error',
  (event) => {
    if (event.message && SUPPRESS_PATTERNS.some((re) => re.test(event.message))) {
      event.stopImmediatePropagation()
      event.preventDefault()
    }
  },
  true,
)
