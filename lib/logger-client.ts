// Client-side logger utility (for use in React components)

const isDev = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args)
    }
  },
  error: (...args: unknown[]) => {
    // Always log errors
    console.error(...args)
  },
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...args)
    }
  },
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info(...args)
    }
  },
}
