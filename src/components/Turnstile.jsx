import { useEffect, useRef, useCallback } from 'react'

// Cloudflare Turnstile widget. Shared across every public form (contact, waitlist,
// coffee chat, resume reviews, opportunity board). It surfaces the verification
// token to the parent via onToken(token) and clears it (onToken('')) on expiry/error.
//
// The Cloudflare script is injected once on demand — we do NOT touch index.html so
// the widget only loads on pages that actually render a form.
//
// If VITE_TURNSTILE_SITE_KEY is unset (e.g. local dev without the var) the component
// renders nothing and never blocks submission, so the app still builds and runs.
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let scriptPromise = null

// Load the Turnstile script exactly once and resolve when window.turnstile is ready.
function loadTurnstile() {
  if (typeof window !== 'undefined' && window.turnstile) return Promise.resolve(window.turnstile)
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]`)
    const onReady = () => {
      if (window.turnstile) resolve(window.turnstile)
      else reject(new Error('Turnstile failed to initialize'))
    }
    if (existing) {
      if (window.turnstile) return resolve(window.turnstile)
      existing.addEventListener('load', onReady, { once: true })
      existing.addEventListener('error', () => reject(new Error('Turnstile script failed to load')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.addEventListener('load', onReady, { once: true })
    script.addEventListener('error', () => reject(new Error('Turnstile script failed to load')), { once: true })
    document.head.appendChild(script)
  })
  return scriptPromise
}

// `onError` (optional): called when the script can't load at all (ad blocker,
// network failure) so the parent can tell the visitor why the form is stuck.
// `resetRef` (optional): pass a ref object; we attach a reset() fn so the parent can
// clear the widget after a successful submit.
export default function Turnstile({ onToken, onError, resetRef, className }) {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)
  const onErrorRef = useRef(onError)

  // Parents pass `onError` as an inline arrow, so its identity changes on every
  // render. Keep it in a ref and out of the effect deps below — otherwise the
  // effect re-runs each render and its cleanup destroys the widget mid-typing.
  useEffect(() => { onErrorRef.current = onError })

  const handleToken = useCallback((token) => { onToken?.(token) }, [onToken])
  const handleClear = useCallback(() => { onToken?.('') }, [onToken])

  useEffect(() => {
    // No site key configured → no-op (local dev / build without the var).
    if (!SITE_KEY) return
    let cancelled = false

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return
        // Avoid double-render in React StrictMode / re-mounts.
        if (widgetIdRef.current != null) return
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: handleToken,
          'expired-callback': handleClear,
          'error-callback': handleClear,
          'timeout-callback': handleClear,
        })
      })
      .catch((err) => {
        // Network/adblock failure — log, and let the parent surface it to the user.
        console.error('Turnstile load error:', err)
        onErrorRef.current?.(err)
      })

    return () => {
      cancelled = true
      if (widgetIdRef.current != null && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current) } catch (_) { /* noop */ }
      }
      widgetIdRef.current = null
    }
  }, [handleToken, handleClear])

  // Expose a reset() so parents can re-challenge after a submit.
  useEffect(() => {
    if (!resetRef) return
    resetRef.current = () => {
      handleClear()
      if (widgetIdRef.current != null && window.turnstile) {
        try { window.turnstile.reset(widgetIdRef.current) } catch (_) { /* noop */ }
      }
    }
    return () => { if (resetRef) resetRef.current = null }
  }, [resetRef, handleClear])

  if (!SITE_KEY) return null
  return <div ref={containerRef} className={className} />
}

// Whether Turnstile is active. When false, forms must not block on a token.
export const TURNSTILE_ENABLED = !!SITE_KEY
