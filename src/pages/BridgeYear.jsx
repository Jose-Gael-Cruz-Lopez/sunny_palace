import { useState, useCallback, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ArticleLayout from '../components/ArticleLayout'
import { useT } from '../hooks/useT'
import Turnstile, { TURNSTILE_ENABLED } from '../components/Turnstile'

function ExtIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  )
}

export default function BridgeYear() {
  const t = useT('bridgeYear')

  const [searchParams, setSearchParams] = useSearchParams()
  const validRoleKeys = (t.roleFilters || []).map(f => f.key)
  const urlRole = searchParams.get('role') || ''
  const roleFilter = urlRole && validRoleKeys.includes(urlRole) ? urlRole : 'all'
  const filtersRef = useRef(null)
  const progressRef = useRef(null)

  const [formSubmitted, setFormSubmitted] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({ program: '', company: '', email: '' })
  const [form, setForm] = useState({ program: '', company: '', link: '', why: '', email: '' })
  const [suggestTurnstileToken, setSuggestTurnstileToken] = useState('')
  const suggestTurnstileReset = useRef(null)

  const [previewProgram, setPreviewProgram] = useState(null)
  const previewTriggerRef = useRef(null)
  const openPreview = (program, e) => {
    previewTriggerRef.current = e?.currentTarget ?? null
    setPreviewProgram(program)
  }
  const closePreview = useCallback(() => {
    setPreviewProgram(null)
    if (previewTriggerRef.current) {
      previewTriggerRef.current.focus()
      previewTriggerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (previewProgram == null) { document.body.style.overflow = ''; return }
    document.body.style.overflow = 'hidden'
    const onKey = e => { if (e.key === 'Escape') closePreview() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [previewProgram, closePreview])

  const [captureEmail, setCaptureEmail] = useState('')
  const [captureLoading, setCaptureLoading] = useState(false)
  const [captureError, setCaptureError] = useState('')
  const [captureTurnstileToken, setCaptureTurnstileToken] = useState('')
  const captureTurnstileReset = useRef(null)
  const [captureSubmitted, setCaptureSubmitted] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return window.localStorage.getItem('jxj.bridge-year.subscribed') === '1' } catch { return false }
  })

  const visibleRoles = roleFilter === 'all'
    ? t.roleCards
    : t.roleCards.filter(c => c.rtags.includes(roleFilter))

  const handleRoleFilter = useCallback(e => {
    const key = e.currentTarget.dataset.key
    const next = new URLSearchParams(searchParams)
    if (!key || key === 'all') next.delete('role')
    else next.set('role', key)
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const el = progressRef.current
      if (!el) return
      const doc = document.documentElement
      const max = (doc.scrollHeight - doc.clientHeight) || 1
      const ratio = Math.min(1, Math.max(0, window.scrollY / max))
      el.style.transform = 'scaleX(' + ratio + ')'
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    update()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    const onKeyDown = e => {
      if (e.key !== '/') return
      const el = document.activeElement
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return
      const firstButton = filtersRef.current?.querySelector('button')
      if (firstButton) {
        e.preventDefault()
        firstButton.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleSubmit = async e => {
    e.preventDefault()
    const errors = { program: '', company: '', email: '' }
    if (!form.program.trim()) errors.program = t.formErrorProgram
    if (!form.company.trim()) errors.company = t.formErrorCompany
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = t.formErrorEmail
    if (errors.program || errors.company || errors.email) {
      setFieldErrors(errors)
      setFormError('')
      return
    }
    if (TURNSTILE_ENABLED && !suggestTurnstileToken) return
    setFieldErrors({ program: '', company: '', email: '' })
    setFormLoading(true)
    setFormError('')
    // Suggestion now flows through the Turnstile-gated submit-form edge function
    // (service role) — the direct anon INSERT on bridge_year_suggestions is
    // revoked (migration 019) so the open write-spam path is closed.
    let ok
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-form`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          type: 'bridge_year_suggestion',
          turnstileToken: suggestTurnstileToken,
          payload: {
            program_name: form.program.trim(),
            company: form.company.trim(),
            link: form.link.trim() || null,
            why: form.why.trim() || null,
            email: form.email.trim() || null,
          },
        }),
      })
      ok = res.ok
    } catch {
      ok = false
    }
    setFormLoading(false)
    if (ok) {
      setFormSubmitted(true)
    } else {
      setFormError(t.formErrorGeneric)
      setSuggestTurnstileToken('')
      suggestTurnstileReset.current?.()
    }
  }

  const setField = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    if (fieldErrors[k]) setFieldErrors(s => ({ ...s, [k]: '' }))
  }

  const handleCaptureSubmit = async e => {
    e.preventDefault()
    const v = captureEmail.trim()
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setCaptureError(t.captureErrorEmail)
      return
    }
    if (TURNSTILE_ENABLED && !captureTurnstileToken) {
      setCaptureError(t.captureErrorGeneric)
      return
    }
    setCaptureError('')
    setCaptureLoading(true)
    // Capture now flows through the Turnstile-gated submit-form edge function
    // (service role) — the direct anon INSERT on bridge_year_subscribers is
    // revoked (migration 019) so the open write-spam path is closed.
    let ok
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-form`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          type: 'bridge_year_subscriber',
          turnstileToken: captureTurnstileToken,
          payload: { email: v },
        }),
      })
      ok = res.ok
    } catch {
      ok = false
    }
    setCaptureLoading(false)
    if (ok) {
      setCaptureSubmitted(true)
      try { window.localStorage.setItem('jxj.bridge-year.subscribed', '1') } catch { /* noop */ }
    } else {
      setCaptureError(t.captureErrorGeneric)
      setCaptureTurnstileToken('')
      captureTurnstileReset.current?.()
    }
  }

  return (
    <ArticleLayout
      title="Bridge Year Hub"
      signoffLine={t.signoffLine}
      signoffSub={t.signoffSub}
      signoffCta={t.signoffCta}
    >
      <div ref={progressRef} className="by-scroll-progress" aria-hidden="true" />
      <style>{`
        html, body { background: var(--color-cream); }
        :root { --by-shadow-warm: 58, 38, 22; }

        .by-scroll-progress {
          position: fixed;
          top: 0;
          left: 0;
          height: 2px;
          width: 100%;
          background: linear-gradient(90deg, var(--color-accent) 0%, var(--color-gold) 100%);
          z-index: 1000;
          pointer-events: none;
          transform: scaleX(0);
          transform-origin: left;
          transition: transform .12s linear;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .by-scroll-progress { transition: none; }
        }

        .by-wrap {
          max-width: 1040px;
          margin: 0 auto;
          padding-left:  clamp(20px,5vw,56px);
          padding-right: clamp(20px,5vw,56px);
        }
        .by-kicker {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: var(--color-muted);
          margin-bottom: 14px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .by-kicker::after {
          content: '';
          width: 24px;
          height: 1px;
          background: currentColor;
          opacity: .5;
        }
        .by-section-title {
          font-family: var(--font-display);
          font-size: clamp(26px,4vw,40px);
          font-weight: 700;
          color: var(--color-dark);
          line-height: 1.15;
          margin-bottom: 10px;
        }
        .by-section-sub {
          font-family: var(--font-display);
          font-size: clamp(16px,2vw,20px);
          font-weight: 400;
          color: var(--color-accent);
          margin-bottom: 20px;
        }
        .by-section-body {
          font-size: clamp(15px,1.8vw,17px);
          color: var(--color-muted);
          line-height: 1.75;
          max-width: 700px;
        }
        .by-section-body strong { color: var(--color-dark); font-weight: 600; }
        .by-divider {
          border: none;
          border-top: 1px solid rgba(0,0,0,.08);
          margin: 0;
        }

        /* HERO */
        .by-hero {
          padding: 120px clamp(20px,5vw,56px) 64px;
          max-width: 1280px;
          margin: 0 auto;
          position: relative;
          overflow: hidden;
        }
        .by-hero::before {
          content: '';
          position: absolute;
          top: 96px;
          left: clamp(20px,5vw,56px);
          width: 56px;
          height: 4px;
          background: var(--color-accent);
          border-radius: 2px;
          z-index: 1;
        }
        .by-hero::after {
          content: '';
          position: absolute;
          top: -18%;
          right: -8%;
          width: 620px;
          height: 620px;
          background: radial-gradient(closest-side, rgba(179,69,57,.09), transparent 70%);
          pointer-events: none;
          z-index: 0;
        }
        .by-hero > * { position: relative; z-index: 1; }
        .by-hero__inner {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(0, .9fr);
          gap: clamp(40px, 5vw, 80px);
          align-items: start;
        }
        @media (max-width: 960px) {
          .by-hero__inner { grid-template-columns: 1fr; gap: 40px; }
        }
        .by-hero__primary { min-width: 0; }
        .by-hero__aside { min-width: 0; padding-top: 4px; }
        .by-hero__aside .by-for__card { max-width: none; }
        .by-hero__kicker {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: var(--color-accent);
          margin-bottom: 18px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .by-hero__kicker::after {
          content: '';
          width: 24px;
          height: 1px;
          background: currentColor;
          opacity: .5;
        }
        .by-hero__title {
          font-family: var(--font-display);
          font-size: clamp(42px,7vw,80px);
          font-weight: 700;
          line-height: 1.04;
          color: var(--color-dark);
          margin-bottom: 14px;
        }
        .by-hero__title em {
          font-style: italic;
          font-family: var(--font-serif, var(--font-display));
          color: var(--color-gold-dark);
          font-weight: 500;
          padding-right: .04em;
        }
        .by-hero__tagline {
          font-family: var(--font-serif, var(--font-display));
          font-size: clamp(18px,2.2vw,24px);
          font-style: italic;
          font-weight: 400;
          color: var(--color-accent);
          margin-bottom: 22px;
          letter-spacing: -.005em;
          max-width: 60ch;
        }
        .by-hero__sub {
          font-family: var(--font-display);
          font-size: clamp(18px,2.5vw,26px);
          font-weight: 400;
          color: var(--color-dark);
          line-height: 1.4;
          max-width: 680px;
          margin-bottom: 28px;
        }
        .by-hero__body {
          font-size: clamp(15px,1.8vw,17px);
          color: var(--color-muted);
          line-height: 1.8;
          max-width: 680px;
          margin-bottom: 40px;
        }
        .by-hero__body strong { color: var(--color-dark); font-weight: 600; }
        .by-jumps { display: flex; flex-direction: column; gap: 10px; }
        .by-jump {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 600;
          color: var(--color-dark);
          text-decoration: none;
          transition: color .2s, gap .2s;
        }
        .by-jump::before {
          content: '→';
          color: var(--color-accent);
          font-weight: 700;
          transition: transform .2s cubic-bezier(.16,1,.3,1);
        }
        .by-jump:hover { color: var(--color-accent); }
        .by-jump:hover::before { transform: translateX(4px); }

        /* IS THIS FOR YOU */
        .by-for {
          padding: 72px clamp(20px,5vw,56px);
          max-width: 1040px;
          margin: 0 auto;
        }
        .by-for__card {
          background: var(--color-navy);
          border-radius: 16px;
          padding: clamp(32px,4vw,52px);
          max-width: 720px;
        }
        .by-for__kicker {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: rgba(232,168,56,.72);
          margin-bottom: 14px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .by-for__kicker::after {
          content: '';
          width: 24px;
          height: 1px;
          background: currentColor;
          opacity: .5;
        }
        .by-for__title {
          font-family: var(--font-display);
          font-size: clamp(22px,3vw,30px);
          font-weight: 700;
          color: var(--color-cream);
          margin-bottom: 18px;
        }
        .by-for__body {
          font-size: clamp(14px,1.7vw,16px);
          color: rgba(242,228,206,.72);
          line-height: 1.8;
        }
        .by-for__body strong { color: var(--color-cream); font-weight: 600; }
        .by-for__list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .by-for__item {
          position: relative;
          padding-left: 22px;
          font-size: clamp(14px,1.6vw,15px);
          color: var(--color-cream);
          line-height: 1.45;
          font-weight: 500;
          letter-spacing: -.005em;
        }
        .by-for__item::before {
          content: '';
          position: absolute;
          left: 0;
          top: .55em;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--color-gold);
          opacity: .85;
        }
        .by-for__footer {
          margin: 18px 0 0;
          padding-top: 16px;
          border-top: 1px solid rgba(242,228,206,.18);
          font-family: var(--font-serif, var(--font-body));
          font-style: italic;
          font-size: 13px;
          color: rgba(242,228,206,.72);
          line-height: 1.55;
        }

        /* APPRENTICESHIPS */
        .by-apprentice {
          padding: 80px clamp(20px,5vw,56px);
          max-width: 1040px;
          margin: 0 auto;
        }
        .by-apprentice__head { margin-bottom: 40px; }

        /* CAPTURE BANNER — sits above the apprentice grid so we capture intent before users click out */
        .by-capture {
          margin-bottom: 32px;
          padding: 24px 28px;
          background: linear-gradient(180deg, rgba(232,168,56,.08) 0%, rgba(255,250,242,.5) 100%);
          border: 1px solid rgba(232,168,56,.32);
          border-radius: 14px;
          display: grid;
          grid-template-columns: minmax(0,1fr) auto;
          gap: 20px;
          align-items: center;
        }
        @media (max-width: 720px) {
          .by-capture { grid-template-columns: 1fr; gap: 16px; }
        }
        .by-capture__copy { min-width: 0; }
        .by-capture__kicker {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: var(--color-gold-dark, var(--color-gold));
          margin-bottom: 6px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .by-capture__kicker::after {
          content: '';
          width: 18px;
          height: 1px;
          background: currentColor;
          opacity: .5;
        }
        .by-capture__title {
          font-family: var(--font-display);
          font-size: clamp(16px,2vw,19px);
          font-weight: 700;
          color: var(--color-dark);
          line-height: 1.3;
          letter-spacing: -.005em;
          margin-bottom: 4px;
          text-wrap: balance;
        }
        .by-capture__sub { font-size: 13px; color: var(--color-muted); line-height: 1.55; max-width: 56ch; }
        .by-capture__form {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .by-capture__input {
          font-family: var(--font-body);
          font-size: 14px;
          padding: 11px 14px;
          border: 1.5px solid rgba(26,25,22,.13);
          border-radius: 10px;
          background: var(--color-white);
          color: var(--color-dark);
          outline: none;
          min-width: 220px;
          transition: border-color .2s, box-shadow .2s;
          box-sizing: border-box;
        }
        .by-capture__input::placeholder { color: var(--color-muted); }
        .by-capture__input:focus { border-color: var(--color-gold); box-shadow: 0 0 0 4px rgba(232,168,56,.16); }
        .by-capture__input.is-invalid { border-color: rgba(179,69,57,.45); }
        .by-capture__input.is-invalid:focus { border-color: var(--color-accent); box-shadow: 0 0 0 4px rgba(179,69,57,.14); }
        .by-capture__btn {
          padding: 11px 22px;
          background: var(--color-dark);
          color: var(--color-cream);
          border: none;
          border-radius: 999px;
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: -.005em;
          cursor: pointer;
          box-shadow: 0 6px 14px -8px rgba(var(--by-shadow-warm),.4), inset 0 1px 0 rgba(255,255,255,.08);
          transition: background .25s, transform .22s cubic-bezier(.16,1,.3,1), box-shadow .25s;
        }
        .by-capture__btn:hover { background: var(--color-gold); color: var(--color-dark); transform: translateY(-1px); box-shadow: 0 12px 22px -10px rgba(232,168,56,.5); }
        .by-capture__btn:active { transform: translateY(0); }
        .by-capture__btn:disabled { opacity: .55; cursor: not-allowed; transform: none; box-shadow: none; }
        .by-capture__btn:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 3px; }
        .by-capture__error {
          flex-basis: 100%;
          font-size: 12px;
          font-weight: 600;
          color: var(--color-accent);
          line-height: 1.4;
          margin-top: 2px;
        }
        .by-capture__error::before {
          content: '';
          display: inline-block;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--color-accent);
          margin-right: 7px;
          vertical-align: .18em;
        }
        .by-capture__success {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--color-dark);
        }
        .by-capture__success-icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(58,125,107,.14);
          color: var(--color-teal);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: inset 0 0 0 1.5px rgba(58,125,107,.22);
        }
        .by-capture__success-text {
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 600;
          line-height: 1.4;
          color: var(--color-dark);
        }
        .by-capture__success-text small { display: block; font-family: var(--font-body); font-size: 12px; font-weight: 400; color: var(--color-muted); margin-top: 2px; }
        .by-capture__trust {
          grid-column: 1 / -1;
          margin-top: 4px;
          font-size: 11px;
          color: var(--color-muted);
          line-height: 1.5;
          letter-spacing: .005em;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .by-capture__trust::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--color-teal);
          flex-shrink: 0;
          opacity: .65;
        }
        @media (prefers-reduced-motion: reduce) {
          .by-capture__btn { transition: none !important; }
          .by-capture__btn:hover { transform: none !important; }
        }
        .by-apprentice__grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }
        .by-apprentice__grid > .by-prog,
        .by-tools__grid > .by-tool-card {
          animation: by-card-in .55s cubic-bezier(.16,1,.3,1) backwards;
          animation-delay: calc(var(--by-i, 0) * 50ms);
        }
        @keyframes by-card-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .by-apprentice__grid > .by-prog,
          .by-tools__grid > .by-tool-card { animation: none !important; }
        }
        .by-prog {
          background: linear-gradient(180deg, rgba(179,69,57,.06) 0%, rgba(255,250,242,.55) 60%);
          border: 1.5px solid rgba(179,69,57,.22);
          border-radius: 14px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 4px 12px -6px rgba(var(--by-shadow-warm),.12);
          transition: transform .22s cubic-bezier(.16,1,.3,1), box-shadow .22s, border-color .22s;
        }
        .by-prog:hover {
          transform: translateY(-3px);
          border-color: rgba(179,69,57,.35);
          box-shadow: 0 14px 32px -10px rgba(var(--by-shadow-warm),.18);
        }
        .by-prog--featured {
          grid-column: 1 / -1;
          background: var(--color-accent);
          border-color: var(--color-accent);
          position: relative;
        }
        .by-prog--featured .by-prog__company { color: rgba(242,228,206,.7); }
        .by-prog--featured .by-prog__name { color: var(--color-cream); }
        .by-prog--featured .by-prog__pill { background: rgba(242,228,206,.14); color: var(--color-cream); }
        .by-prog--featured .by-prog__pill--urgent { background: rgba(232,168,56,.22); color: var(--color-gold); }
        .by-prog--featured .by-prog__pill--pay { background: rgba(58,125,107,.28); color: var(--color-cream); }
        .by-prog--featured .by-prog__note {
          background: rgba(255,255,255,.06);
          border-color: rgba(232,168,56,.35);
        }
        .by-prog--featured .by-prog__note-label { color: var(--color-gold); }
        .by-prog--featured .by-prog__note-text { color: rgba(242,228,206,.85); }
        .by-prog--featured .by-prog__cta {
          background: var(--color-cream);
          color: var(--color-dark);
        }
        .by-prog--featured .by-prog__cta:hover { background: var(--color-gold); color: var(--color-dark); }
        .by-prog--featured-tag {
          display: inline-block;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: var(--color-gold);
          margin-bottom: 8px;
        }
        .by-prog__inner { padding: 24px 24px 20px; flex: 1; display: flex; flex-direction: column; }
        .by-prog__company {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .1em;
          text-transform: uppercase;
          color: var(--color-muted);
          margin-bottom: 6px;
        }
        .by-prog__name {
          font-family: var(--font-display);
          font-size: clamp(16px,1.9vw,20px);
          font-weight: 600;
          color: var(--color-dark);
          line-height: 1.3;
          margin-bottom: 16px;
        }
        .by-prog__meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
        .by-prog__pill {
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(0,0,0,.05);
          color: var(--color-muted);
        }
        .by-prog__pill--urgent { background: rgba(179,69,57,.08); color: var(--color-accent); }
        .by-prog__pill--pay    { background: rgba(58,125,107,.1);  color: var(--color-teal); }
        .by-prog__note {
          background: rgba(232,168,56,.07);
          border: 1px solid rgba(232,168,56,.22);
          border-radius: 8px;
          padding: 12px 14px;
          margin-bottom: 20px;
          flex: 1;
        }
        .by-prog__note-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .1em;
          text-transform: uppercase;
          color: var(--color-gold);
          margin-bottom: 5px;
        }
        .by-prog__note-text { font-size: 13px; color: var(--color-muted); line-height: 1.6; }
        .by-prog__cta {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 13px 20px;
          border-radius: 8px;
          background: var(--color-dark);
          color: var(--color-cream);
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          border: none;
          cursor: pointer;
          transition: background .2s, transform .18s;
          align-self: flex-start;
        }
        .by-prog__cta:hover { background: var(--color-accent); transform: translateY(-1px); }
        .by-apprentice__note {
          margin-top: 32px;
          padding: 0 0 0 18px;
          border-left: none;
          font-family: var(--font-serif, var(--font-body));
          font-style: italic;
          font-size: 15px;
          color: var(--color-muted);
          line-height: 1.7;
          max-width: 640px;
        }
        .by-apprentice__note strong { color: var(--color-dark); font-weight: 600; font-style: normal; }

        /* NEW GRAD ROLES */
        .by-roles {
          padding: 80px clamp(20px,5vw,56px);
          max-width: 1040px;
          margin: 0 auto;
        }
        .by-roles__head { margin-bottom: 28px; }
        /* Applications-open spotlight — sits above filter chips, surfaces actively-accepting programs */
        .by-live { display: flex; flex-direction: column; gap: 14px; margin-bottom: 28px; }
        .by-live__head { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
        .by-live__heading { font-family: var(--font-display); font-size: clamp(18px, 2vw, 22px); font-weight: 700; letter-spacing: -.015em; color: var(--color-dark); margin: 0; }
        .by-live__count { font-size: 11px; color: var(--color-muted); font-variant-numeric: tabular-nums; letter-spacing: .08em; text-transform: uppercase; font-weight: 700; }
        .by-live__card { display: block; position: relative; overflow: hidden; padding: 20px 22px; background: linear-gradient(180deg, rgba(58,125,107,.12) 0%, rgba(58,125,107,.04) 100%); border: 1px solid rgba(58,125,107,.35); border-radius: 14px; color: inherit; text-decoration: none; transition: border-color .3s var(--ease-out), transform .3s var(--ease-out), box-shadow .3s var(--ease-out); }
        .by-live__card:hover { border-color: rgba(58,125,107,.55); transform: translateY(-2px); box-shadow: 0 16px 32px -18px rgba(var(--by-shadow-warm), .28); }
        .by-live__card:active { transform: translateY(0); }
        .by-live__card:focus-visible { outline: 2px solid var(--color-teal); outline-offset: 4px; }
        .by-live__badges { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
        .by-live__live-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--color-accent); padding: 4px 10px; border-radius: 999px; background: rgba(179,69,57,.10); border: 1px solid rgba(179,69,57,.28); }
        .by-live__live-pill::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--color-accent); animation: by-pulse 2s ease-in-out infinite; }
        @keyframes by-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
        .by-live__deadline { font-size: 11px; color: var(--color-muted); letter-spacing: .04em; font-variant-numeric: tabular-nums; margin-left: auto; }
        .by-live__title { font-family: var(--font-display); font-size: clamp(17px, 2vw, 22px); font-weight: 700; line-height: 1.2; letter-spacing: -.02em; color: var(--color-dark); margin: 0 0 4px; }
        .by-live__company { font-size: 13px; color: var(--color-muted); margin: 0 0 14px; line-height: 1.45; }
        .by-live__cta { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; background: var(--color-teal); color: var(--color-cream); border-radius: 999px; font-family: var(--font-display); font-size: 12px; font-weight: 700; letter-spacing: .02em; transition: background .25s, box-shadow .25s; }
        .by-live__card:hover .by-live__cta { background: var(--color-dark); box-shadow: 0 8px 18px -8px rgba(var(--by-shadow-warm), .4); }
        @media (prefers-reduced-motion: reduce) {
          .by-live__live-pill::before { animation: none; }
          .by-live__card, .by-live__cta { transition: none !important; }
          .by-live__card:hover { transform: none !important; }
        }
        @media (max-width: 560px) {
          .by-live__deadline { margin-left: 0; }
        }
        .by-roles__filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 32px; }
        .by-roles__filter {
          padding: 10px 16px;
          border-radius: 14px;
          font-family: var(--font-body);
          cursor: pointer;
          border: 1.5px solid rgba(26,25,22,.12);
          background: rgba(255,250,242,.6);
          color: var(--color-muted);
          transition: background .2s, color .2s, border-color .2s;
          display: inline-flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 1px;
          text-align: left;
          min-width: 0;
        }
        .by-roles__filter:hover { color: var(--color-dark); border-color: rgba(0,0,0,.22); }
        .by-roles__filter:focus-visible { outline: 2px solid var(--color-teal); outline-offset: 2px; }
        .by-roles__filter--active { background: var(--color-teal); color: var(--color-cream); border-color: var(--color-teal); }
        .by-roles__filter-label { font-size: 12px; font-weight: 700; letter-spacing: -.005em; line-height: 1.2; }
        .by-roles__filter-desc { font-size: 10.5px; font-weight: 500; opacity: .72; line-height: 1.2; letter-spacing: .005em; }
        .by-roles__filter--active .by-roles__filter-desc { opacity: .85; }
        .by-roles__list { display: flex; flex-direction: column; gap: 14px; }
        .by-role-card {
          background: transparent;
          border: 1px solid rgba(26,25,22,.1);
          border-radius: 12px;
          padding: 22px 24px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          transition: transform .2s cubic-bezier(.16,1,.3,1), box-shadow .2s, border-color .2s;
        }
        .by-role-card:hover {
          transform: translateX(4px);
          border-color: rgba(58,125,107,.4);
          box-shadow: 4px 4px 18px -6px rgba(var(--by-shadow-warm),.14);
        }
        .by-role-card__left { flex: 1; min-width: 0; }
        .by-role-card__tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
        .by-role-card__tag {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .08em;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 4px;
          background: rgba(58,125,107,.1);
          color: var(--color-teal);
        }
        .by-role-card__tag--remote { background: rgba(91,142,194,.12);  color: var(--color-blue); }
        .by-role-card__tag--rota   { background: rgba(91,142,194,.12);  color: var(--color-blue-light); }
        .by-role-card__tag--data   { background: rgba(232,168,56,.15);  color: var(--color-gold); }
        .by-role-card__title {
          font-family: var(--font-display);
          font-size: clamp(15px,1.8vw,18px);
          font-weight: 600;
          color: var(--color-dark);
          margin-bottom: 4px;
        }
        .by-role-card__company { font-size: 13px; color: var(--color-muted); margin-bottom: 8px; }
        .by-role-card__why { font-size: 13px; color: var(--color-muted); line-height: 1.55; }
        .by-role-card__why strong { color: var(--color-dark); font-weight: 600; }
        .by-role-card__cta {
          flex-shrink: 0;
          padding: 13px 18px;
          border-radius: 8px;
          background: transparent;
          border: 1.5px solid var(--color-teal);
          color: var(--color-teal);
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 600;
          text-decoration: none;
          transition: background .2s, color .2s;
          white-space: nowrap;
        }
        .by-role-card__cta:hover { background: var(--color-teal); color: var(--color-cream); }
        .by-role-card__actions { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; flex-shrink: 0; }
        .by-role-card__preview {
          padding: 8px 14px;
          border-radius: 999px;
          background: transparent;
          border: 1px solid rgba(26,25,22,.18);
          color: var(--color-muted);
          font-family: var(--font-display);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: .02em;
          cursor: pointer;
          transition: background .2s, color .2s, border-color .2s;
          white-space: nowrap;
        }
        .by-role-card__preview:hover { color: var(--color-dark); border-color: rgba(26,25,22,.4); background: rgba(255,250,242,.6); }
        .by-role-card__preview:focus-visible { outline: 2px solid var(--color-teal); outline-offset: 2px; }

        /* Preview modal — mirrors CT a11y pattern (focus restoration, Esc, scroll lock) */
        .by-modal { position: fixed; inset: 0; z-index: 200; display: flex; align-items: center; justify-content: center; padding: clamp(16px, 4vw, 40px); animation: by-modal-in .25s var(--ease-out); }
        @keyframes by-modal-in { from { opacity: 0; } to { opacity: 1; } }
        .by-modal__bg { position: absolute; inset: 0; background: rgba(26,25,22,.72); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
        .by-modal__box {
          position: relative;
          background: var(--color-cream);
          color: var(--color-dark);
          padding: clamp(28px, 4vw, 48px) clamp(24px, 4vw, 48px) clamp(24px, 3.5vw, 40px);
          max-width: 620px;
          width: 100%;
          max-height: calc(100dvh - 48px);
          overflow-y: auto;
          border-radius: 4px;
          box-shadow: 0 30px 80px -20px rgba(26,25,22,.55), 0 0 0 1px rgba(26,25,22,.06);
          animation: by-modal-box-in .35s var(--ease-out);
        }
        @keyframes by-modal-box-in { from { transform: translateY(24px) scale(.97); } to { transform: translateY(0) scale(1); } }
        .by-modal__box::before {
          content: '';
          position: absolute;
          left: 0; right: 0; top: 0;
          height: 4px;
          background: linear-gradient(90deg, var(--color-accent) 0%, var(--color-accent) 38%, var(--color-gold) 38%, var(--color-gold) 62%, var(--color-teal) 62%, var(--color-teal) 100%);
          border-radius: 4px 4px 0 0;
        }
        .by-modal__close {
          position: absolute; top: 14px; right: 14px;
          width: 36px; height: 36px;
          display: inline-flex; align-items: center; justify-content: center;
          color: var(--color-muted);
          background: transparent;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          transition: background .2s, color .2s;
        }
        .by-modal__close:hover { background: rgba(26,25,22,.06); color: var(--color-dark); }
        .by-modal__close:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 2px; }
        .by-modal__tags { display: flex; gap: 6px; flex-wrap: wrap; margin: 4px 0 16px; }
        .by-modal__title { font-family: var(--font-display); font-size: clamp(22px, 3vw, 30px); font-weight: 700; line-height: 1.15; letter-spacing: -.02em; color: var(--color-dark); margin: 0 0 8px; text-wrap: balance; }
        .by-modal__company { font-size: 14px; color: var(--color-muted); margin: 0 0 20px; line-height: 1.5; }
        .by-modal__why { font-size: 15px; color: var(--color-dark); line-height: 1.7; margin: 0 0 28px; text-wrap: pretty; }
        .by-modal__why strong { color: var(--color-accent); font-weight: 600; }
        .by-modal__cta {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 12px 22px;
          background: var(--color-dark);
          color: var(--color-cream);
          border-radius: 999px;
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: .02em;
          text-decoration: none;
          transition: background .25s, transform .22s, box-shadow .25s;
          box-shadow: 0 6px 16px -8px rgba(var(--by-shadow-warm), .35);
        }
        .by-modal__cta:hover { background: var(--color-accent); transform: translateY(-2px); box-shadow: 0 14px 26px -12px rgba(179,69,57,.5); }
        .by-modal__cta:active { transform: translateY(0); }
        .by-modal__cta:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 3px; }
        @media (prefers-reduced-motion: reduce) {
          .by-modal, .by-modal__box { animation: none !important; }
          .by-modal__cta { transition: none !important; }
          .by-modal__cta:hover { transform: none !important; }
        }

        /* BRIDGE CTA — surfaces the suggest form before users commit to scrolling further (LS pattern) */
        .by-bridge {
          max-width: 1040px;
          margin: 0 auto;
          padding: 0 clamp(20px,5vw,56px) 56px;
        }
        .by-bridge__inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
          padding: 24px 28px;
          background: rgba(232,168,56,.06);
          border: 1px solid rgba(232,168,56,.22);
          border-radius: 14px;
        }
        .by-bridge__copy {
          font-family: var(--font-display);
          font-size: clamp(17px,2vw,21px);
          font-weight: 600;
          color: var(--color-dark);
          line-height: 1.3;
          letter-spacing: -.005em;
        }
        .by-bridge__copy em {
          font-style: italic;
          font-family: var(--font-serif, var(--font-display));
          color: var(--color-gold-dark);
          font-weight: 500;
        }
        .by-bridge__cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 20px;
          background: var(--color-dark);
          color: var(--color-cream);
          border-radius: 999px;
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: -.005em;
          text-decoration: none;
          box-shadow: 0 6px 14px -8px rgba(var(--by-shadow-warm),.4), inset 0 1px 0 rgba(255,255,255,.08);
          transition: background .25s, transform .22s cubic-bezier(.16,1,.3,1), box-shadow .25s;
        }
        .by-bridge__cta:hover {
          background: var(--color-accent);
          transform: translateY(-1px);
          box-shadow: 0 12px 22px -10px rgba(179,69,57,.5);
        }
        .by-bridge__cta:active { transform: translateY(0); }
        .by-bridge__cta:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 3px; }
        .by-bridge__cta::after { content: '↓'; font-size: 13px; line-height: 1; }
        @media (prefers-reduced-motion: reduce) {
          .by-bridge__cta { transition: none !important; }
          .by-bridge__cta:hover { transform: none !important; }
        }

        /* SPRINT PATH */
        .by-sprint {
          background: var(--color-navy);
          padding: clamp(64px,8vw,100px) clamp(20px,5vw,56px);
        }
        .by-sprint__inner { max-width: 1040px; margin: 0 auto; }
        .by-sprint__kicker {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: var(--color-gold);
          margin-bottom: 14px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .by-sprint__kicker::after {
          content: '';
          width: 24px;
          height: 1px;
          background: currentColor;
          opacity: .5;
        }
        .by-sprint__title {
          font-family: var(--font-display);
          font-size: clamp(28px,4.5vw,48px);
          font-weight: 700;
          color: var(--color-cream);
          margin-bottom: 10px;
        }
        .by-sprint__sub {
          font-family: var(--font-display);
          font-size: clamp(16px,2vw,20px);
          font-weight: 400;
          color: rgba(232,168,56,.9);
          margin-bottom: 22px;
        }
        .by-sprint__intro {
          font-size: clamp(15px,1.8vw,17px);
          color: rgba(242,228,206,.65);
          line-height: 1.8;
          max-width: 680px;
          margin-bottom: 56px;
        }
        .by-sprint__intro strong { color: var(--color-cream); font-weight: 600; }
        .by-sprint__intro em { font-style: italic; color: rgba(242,228,206,.8); }
        .by-sprint__steps { display: flex; flex-direction: column; gap: 0; }
        .by-step {
          display: grid;
          grid-template-columns: 80px 1fr;
          gap: 0 24px;
          padding: 32px 0;
          border-bottom: 1px solid rgba(242,228,206,.08);
        }
        .by-step:last-child { border-bottom: none; }
        .by-step__num {
          font-family: var(--font-display);
          font-size: clamp(36px,5vw,56px);
          font-weight: 700;
          color: rgba(242,228,206,.12);
          line-height: 1;
          padding-top: 4px;
          text-align: right;
        }
        .by-step__title {
          font-family: var(--font-display);
          font-size: clamp(17px,2.2vw,22px);
          font-weight: 600;
          color: var(--color-cream);
          margin-bottom: 10px;
        }
        .by-step__body {
          font-size: clamp(14px,1.7vw,16px);
          color: rgba(242,228,206,.62);
          line-height: 1.8;
          margin-bottom: 14px;
        }
        .by-step__body strong { color: var(--color-cream); font-weight: 600; }
        .by-step__tool {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
          font-weight: 600;
          color: var(--color-gold);
          text-decoration: none;
          transition: color .2s;
        }
        .by-step__tool::before { content: '↗'; font-size: 11px; }
        .by-step__tool:hover { color: var(--color-cream); }

        /* TOOLS */
        .by-tools {
          padding: 80px clamp(20px,5vw,56px) clamp(96px,12vw,128px);
          max-width: 1040px;
          margin: 0 auto;
        }
        .by-tools__head { margin-bottom: 36px; }
        .by-tools__grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px,1fr));
          gap: 16px;
        }
        .by-tool-card {
          background: linear-gradient(180deg, rgba(58,125,107,.06) 0%, rgba(255,250,242,.4) 60%);
          border: 1.5px solid rgba(58,125,107,.3);
          border-radius: 12px;
          padding: 22px 22px 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 4px 12px -6px rgba(var(--by-shadow-warm),.1);
          transition: transform .2s cubic-bezier(.16,1,.3,1), box-shadow .2s, border-color .2s, background .2s;
        }
        .by-tool-card:hover {
          transform: translateY(-2px);
          border-color: var(--color-teal);
          background: rgba(58,125,107,.04);
          box-shadow: 0 10px 24px -8px rgba(var(--by-shadow-warm),.18);
        }
        .by-tool-card__name {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 600;
          color: var(--color-dark);
          line-height: 1.3;
        }
        .by-tool-card__desc { font-size: 13px; color: var(--color-muted); line-height: 1.6; flex: 1; }
        .by-tool-card__link {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 700;
          color: var(--color-teal);
          text-decoration: none;
          transition: color .2s;
        }
        .by-tool-card__link:hover { color: var(--color-dark); }

        /* FOLLOW */
        .by-follow {
          padding: 80px clamp(20px,5vw,56px) clamp(96px,12vw,128px);
          max-width: 1040px;
          margin: 0 auto;
        }
        .by-follow__inner {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .by-follow-card {
          border: none;
          border-radius: 14px;
          padding: 32px 28px;
          color: var(--color-cream);
        }
        .by-follow-card--jose    { background: var(--color-teal); }
        .by-follow-card--jocelyn { background: var(--color-accent); }
        .by-follow-card__label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: rgba(242,228,206,.72);
          display: inline-block;
          margin-bottom: 14px;
        }
        .by-follow-card__name {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 700;
          color: var(--color-cream);
          margin-bottom: 10px;
          letter-spacing: -.005em;
        }
        .by-follow-card__desc { font-size: 14px; color: rgba(242,228,206,.78); line-height: 1.7; margin-bottom: 22px; }
        .by-follow-card__cta {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 11px 20px;
          border-radius: 8px;
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          background: var(--color-cream);
          color: var(--color-dark);
          transition: transform .18s, background .2s, color .2s;
        }
        .by-follow-card__cta:hover { transform: translateY(-1px); background: var(--color-gold); color: var(--color-dark); }

        /* SUGGEST FORM — full-bleed teal section (CT pattern) */
        .by-suggest {
          background: var(--color-teal);
          padding: clamp(56px,8vw,96px) clamp(20px,5vw,56px);
          margin: 0;
          max-width: none;
          position: relative;
          overflow: hidden;
          scroll-margin-top: 96px;
        }
        .by-suggest::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle at 84% 76%, rgba(232,168,56,.12) 0%, transparent 50%);
          pointer-events: none;
        }
        .by-suggest__inner {
          max-width: 1240px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0,1fr) minmax(0,1.4fr);
          gap: clamp(40px,5vw,72px);
          align-items: start;
          position: relative;
        }
        @media (max-width: 860px) {
          .by-suggest__inner { grid-template-columns: 1fr; gap: 36px; }
        }
        .by-suggest__copy { max-width: 460px; }
        .by-suggest__box {
          background: rgba(0,0,0,.12);
          border: 1px solid rgba(242,228,206,.22);
          border-radius: 14px;
          padding: clamp(24px,3vw,32px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
        }
        .by-suggest__kicker {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: var(--color-gold);
          margin-bottom: 14px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .by-suggest__kicker::after {
          content: '';
          width: 24px;
          height: 1px;
          background: currentColor;
          opacity: .5;
        }
        .by-suggest__title {
          font-family: var(--font-display);
          font-size: clamp(28px,4vw,46px);
          font-weight: 700;
          color: var(--color-cream);
          line-height: 1.05;
          letter-spacing: -.025em;
          text-wrap: balance;
          margin-bottom: 16px;
          max-width: 18ch;
        }
        .by-suggest__title em {
          font-style: italic;
          font-family: var(--font-serif, var(--font-display));
          color: var(--color-gold);
          font-weight: 500;
          padding-right: .04em;
        }
        .by-suggest__sub { font-size: 15px; color: rgba(242,228,206,.7); line-height: 1.7; margin-bottom: 0; max-width: 50ch; }
        .by-suggest__row { margin-bottom: 16px; }
        .by-suggest__label {
          display: block;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .12em;
          color: rgba(242,228,206,.85);
          margin-bottom: 7px;
        }
        .by-suggest__input,
        .by-suggest__textarea {
          width: 100%;
          font-family: var(--font-body);
          font-size: 15px;
          padding: 12px 14px;
          border: 1.5px solid rgba(242,228,206,.32);
          border-radius: 10px;
          background: rgba(0,0,0,.18);
          color: var(--color-cream);
          outline: none;
          transition: border-color .2s, background .2s, box-shadow .2s;
          box-sizing: border-box;
        }
        .by-suggest__input::placeholder,
        .by-suggest__textarea::placeholder { color: rgba(242,228,206,.55); }
        .by-suggest__textarea { min-height: 90px; resize: vertical; line-height: 1.55; }
        .by-suggest__input:focus,
        .by-suggest__textarea:focus {
          border-color: var(--color-gold);
          background: rgba(255,255,255,.1);
          box-shadow: 0 0 0 4px rgba(232,168,56,.16);
        }
        .by-suggest__input.is-invalid,
        .by-suggest__textarea.is-invalid { border-color: rgba(232,168,56,.6); }
        .by-suggest__input.is-invalid:focus,
        .by-suggest__textarea.is-invalid:focus {
          border-color: var(--color-gold);
          box-shadow: 0 0 0 4px rgba(232,168,56,.24);
        }
        .by-suggest__row__error {
          display: block;
          margin-top: 6px;
          font-size: 12px;
          font-weight: 600;
          color: var(--color-gold);
          line-height: 1.4;
        }
        .by-suggest__row__error::before {
          content: '';
          display: inline-block;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--color-gold);
          margin-right: 7px;
          vertical-align: .18em;
        }
        .by-suggest__btn {
          margin-top: 4px;
          padding: 14px 28px;
          background: var(--color-gold);
          color: var(--color-dark);
          border: none;
          border-radius: 999px;
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -.005em;
          cursor: pointer;
          box-shadow: 0 8px 20px -10px rgba(232,168,56,.4);
          transition: background .25s, transform .22s cubic-bezier(.16,1,.3,1), box-shadow .25s;
        }
        .by-suggest__btn:hover {
          background: var(--color-cream);
          transform: translateY(-2px);
          box-shadow: 0 14px 24px -12px rgba(232,228,206,.5);
        }
        .by-suggest__btn:active { transform: translateY(0); }
        .by-suggest__btn:disabled { opacity: .55; cursor: not-allowed; transform: none; box-shadow: none; }
        .by-suggest__error-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 14px;
          padding: 14px 16px;
          background: rgba(232,168,56,.08);
          border: 1px solid rgba(232,168,56,.3);
          border-radius: 10px;
        }
        .by-suggest__error-card__msg {
          flex: 1;
          font-size: 13px;
          color: var(--color-cream);
          line-height: 1.5;
        }
        .by-suggest__error-card__msg strong { color: var(--color-gold); font-weight: 700; }
        .by-suggest__error-card__retry {
          flex-shrink: 0;
          padding: 7px 14px;
          background: transparent;
          border: 1.5px solid var(--color-gold);
          color: var(--color-gold);
          border-radius: 999px;
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: -.005em;
          cursor: pointer;
          transition: background .2s, color .2s;
        }
        .by-suggest__error-card__retry:hover { background: var(--color-gold); color: var(--color-dark); }
        .by-suggest__error-card__retry:focus-visible { outline: 2px solid var(--color-cream); outline-offset: 2px; }
        .by-jump:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 3px; border-radius: 3px; }
        .by-prog__cta:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 2px; }
        .by-role-card__cta:focus-visible { outline: 2px solid var(--color-teal); outline-offset: 2px; }
        .by-step__tool:focus-visible { outline: 2px solid var(--color-teal); outline-offset: 2px; border-radius: 3px; }
        .by-follow-card__cta:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 3px; }
        .by-suggest__btn:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 2px; }
        .by-suggest__success {
          text-align: center;
          padding: 32px 0;
        }
        .by-suggest__success h3 {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 700;
          color: var(--color-cream);
          margin-bottom: 8px;
          letter-spacing: -.01em;
        }
        .by-suggest__success p { font-size: 15px; color: rgba(242,228,206,.7); line-height: 1.7; }

        @media (max-width: 768px) {
          .by-follow__inner { grid-template-columns: 1fr; }
          .by-apprentice__grid { grid-template-columns: 1fr; }
          .by-tools__grid { grid-template-columns: 1fr; }
          .by-hero { padding: 88px 20px 48px; }
          .by-apprentice, .by-roles, .by-tools, .by-follow, .by-suggest { padding-top: 48px; padding-bottom: 48px; }
        }
        @media (max-width: 560px) {
          .by-step { grid-template-columns: 48px 1fr; gap: 0 16px; }
          .by-role-card { flex-direction: column; }
          .by-role-card__cta { align-self: flex-start; }
        }
        @media (max-width: 480px) {
          .by-hero { padding: 80px 16px 40px; }
        }
      `}</style>

      {/* HERO */}
      <header className="by-hero" id="top">
        <div className="by-hero__inner">
          <div className="by-hero__primary">
            <p className="by-hero__kicker">{t.heroKicker}</p>
            <h1 className="by-hero__title">{t.heroTitle} <em>{t.heroTitleEm}</em></h1>
            {t.heroTagline && <p className="by-hero__tagline">{t.heroTagline}</p>}
            <p className="by-hero__sub">{t.heroSub}</p>
            <p className="by-hero__body" dangerouslySetInnerHTML={{ __html: t.heroBody }} />
            <nav className="by-jumps" aria-label={t.heroJumpsAriaLabel}>
              <a href="#apprenticeships" className="by-jump">{t.heroJump1}</a>
              <a href="#roles" className="by-jump">{t.heroJump2}</a>
              <a href="#sprint" className="by-jump">{t.heroJump3}</a>
            </nav>
          </div>
          <aside className="by-hero__aside" aria-label={t.forKicker}>
            <div className="by-for__card">
              <p className="by-for__kicker">{t.forKicker}</p>
              <h2 className="by-for__title">{t.forTitle}</h2>
              {Array.isArray(t.forItems) ? (
                <ul className="by-for__list">
                  {t.forItems.map((item, i) => (
                    <li key={i} className="by-for__item">{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="by-for__body" dangerouslySetInnerHTML={{ __html: t.forBody }} />
              )}
              {t.forFooter && <p className="by-for__footer">{t.forFooter}</p>}
            </div>
          </aside>
        </div>
      </header>

      <hr className="by-divider" />

      {/* APPRENTICESHIPS */}
      <section className="by-apprentice" id="apprenticeships">
        <div className="by-apprentice__head">
          <p className="by-kicker">{t.apprenticeKicker}</p>
          <h2 className="by-section-title">{t.apprenticeTitle}</h2>
          <p className="by-section-sub">{t.apprenticeSub}</p>
          <p className="by-section-body">{t.apprenticeBody}</p>
        </div>

        <div className="by-capture" aria-label={t.captureTitle}>
          {captureSubmitted ? (
            <div className="by-capture__success">
              <span className="by-capture__success-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 22 22" fill="none"><path d="M5 11.5l4 4L17 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
              <p className="by-capture__success-text">
                {t.captureSuccessTitle}
                <small>{t.captureSuccessBody}</small>
              </p>
            </div>
          ) : (
            <>
              <div className="by-capture__copy">
                <p className="by-capture__kicker">{t.captureKicker}</p>
                <p className="by-capture__title">{t.captureTitle}</p>
                <p className="by-capture__sub">{t.captureSub}</p>
              </div>
              <form className="by-capture__form" onSubmit={handleCaptureSubmit}>
                <label htmlFor="captureEmail" className="visually-hidden" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}>{t.formLabelEmail}</label>
                <input
                  id="captureEmail"
                  type="email"
                  className={`by-capture__input${captureError ? ' is-invalid' : ''}`}
                  placeholder={t.capturePlaceholder}
                  value={captureEmail}
                  onChange={e => { setCaptureEmail(e.target.value); if (captureError) setCaptureError('') }}
                  aria-invalid={!!captureError}
                  aria-describedby={captureError ? 'captureEmail-error' : undefined}
                  autoComplete="email"
                />
                <button type="submit" className="by-capture__btn" disabled={captureLoading || !captureEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(captureEmail.trim()) || (TURNSTILE_ENABLED && !captureTurnstileToken)}>
                  {captureLoading ? t.captureSubmitting : t.captureButton}
                </button>
                <Turnstile onToken={setCaptureTurnstileToken} resetRef={captureTurnstileReset} />
                {captureError && <span id="captureEmail-error" className="by-capture__error" role="alert">{captureError}</span>}
              </form>
              {t.captureTrust && <p className="by-capture__trust">{t.captureTrust}</p>}
            </>
          )}
        </div>

        <div className="by-apprentice__grid">
          {t.programs.map((prog, idx) => (
            <div className={`by-prog${idx === 0 ? ' by-prog--featured' : ''}`} key={prog.name} style={{ '--by-i': idx % 12 }}>
              <div className="by-prog__inner">
                {idx === 0 && <span className="by-prog--featured-tag">{t.featuredLabel ?? 'Start here'}</span>}
                <p className="by-prog__company">{prog.company}</p>
                <h3 className="by-prog__name">{prog.name}</h3>
                <div className="by-prog__meta">
                  {prog.pills.map(pill => (
                    <span key={pill.label} className={`by-prog__pill${pill.type ? ` by-prog__pill--${pill.type}` : ''}`}>{pill.label}</span>
                  ))}
                </div>
                <div className="by-prog__note">
                  <p className="by-prog__note-label">{t.apprenticeNoteLabel}</p>
                  <p className="by-prog__note-text">{prog.note}</p>
                </div>
                <a href={prog.href} target="_blank" rel="noopener noreferrer" className="by-prog__cta">
                  {prog.ctaLabel}
                  <ExtIcon />
                </a>
              </div>
            </div>
          ))}
        </div>

        <p className="by-apprentice__note" dangerouslySetInnerHTML={{ __html: t.apprenticeFootnote }} />
      </section>

      <hr className="by-divider" />

      {/* NEW GRAD ROLES */}
      <section className="by-roles" id="roles">
        <div className="by-roles__head">
          <p className="by-kicker">{t.rolesKicker}</p>
          <h2 className="by-section-title">{t.rolesTitle}</h2>
          <p className="by-section-sub">{t.rolesSub}</p>
          <p className="by-section-body">{t.rolesBody}</p>
        </div>

        {(() => {
          const openPrograms = (t.roleCards || []).filter(c => c.applicationStatus === 'open')
          if (openPrograms.length === 0) return null
          return (
            <section className="by-live" aria-labelledby="by-live-heading">
              <div className="by-live__head">
                <h3 className="by-live__heading" id="by-live-heading">{t.openProgramsHeading}</h3>
                <span className="by-live__count">{openPrograms.length} {openPrograms.length === 1 ? t.openProgramsCountSingular : t.openProgramsCountPlural}</span>
              </div>
              {openPrograms.map(p => (
                <a
                  key={p.title}
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="by-live__card"
                >
                  <div className="by-live__badges">
                    <span className="by-live__live-pill" aria-label={t.statusOpen}>{t.statusOpen}</span>
                    {p.deadlineLabel && <span className="by-live__deadline">{p.deadlineLabel}</span>}
                  </div>
                  <h4 className="by-live__title">{p.title}</h4>
                  <p className="by-live__company">{p.company}</p>
                  <span className="by-live__cta">
                    {p.ctaLabel}
                    <ExtIcon />
                  </span>
                </a>
              ))}
            </section>
          )
        })()}

        <div className="by-roles__filters" role="group" aria-label={t.rolesFiltersAriaLabel} ref={filtersRef}>
          {t.roleFilters.map(f => (
            <button
              key={f.key}
              data-key={f.key}
              className={`by-roles__filter${roleFilter === f.key ? ' by-roles__filter--active' : ''}`}
              onClick={handleRoleFilter}
            >
              <span className="by-roles__filter-label">{f.label}</span>
              {f.description && <span className="by-roles__filter-desc">{f.description}</span>}
            </button>
          ))}
        </div>

        <div className="by-roles__list">
          {visibleRoles.map(card => (
            <div className="by-role-card" key={card.title}>
              <div className="by-role-card__left">
                <div className="by-role-card__tags">
                  {card.tags.map(tag => (
                    <span key={tag.label} className={`by-role-card__tag${tag.type ? ` by-role-card__tag--${tag.type}` : ''}`}>{tag.label}</span>
                  ))}
                </div>
                <h3 className="by-role-card__title">{card.title}</h3>
                <p className="by-role-card__company">{card.company}</p>
                <p className="by-role-card__why" dangerouslySetInnerHTML={{ __html: card.why }} />
              </div>
              <div className="by-role-card__actions">
                <button type="button" className="by-role-card__preview" onClick={e => openPreview(card, e)}>{t.previewLabel}</button>
                <a href={card.href} target="_blank" rel="noopener noreferrer" className="by-role-card__cta">{card.ctaLabel}</a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {previewProgram && (
        <div className="by-modal" onClick={closePreview}>
          <div className="by-modal__bg" />
          <div className="by-modal__box" role="dialog" aria-modal="true" aria-labelledby="by-modal-title" onClick={e => e.stopPropagation()}>
            <button type="button" className="by-modal__close" onClick={closePreview} aria-label={t.modalCloseLabel}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
              </svg>
            </button>
            <div className="by-modal__tags">
              {previewProgram.tags.map(tag => (
                <span key={tag.label} className={`by-role-card__tag${tag.type ? ` by-role-card__tag--${tag.type}` : ''}`}>{tag.label}</span>
              ))}
            </div>
            <h3 className="by-modal__title" id="by-modal-title">{previewProgram.title}</h3>
            <p className="by-modal__company">{previewProgram.company}</p>
            <p className="by-modal__why" dangerouslySetInnerHTML={{ __html: previewProgram.why }} />
            <a href={previewProgram.href} target="_blank" rel="noopener noreferrer" className="by-modal__cta">
              {previewProgram.ctaLabel}
              <ExtIcon />
            </a>
          </div>
        </div>
      )}

      {/* BRIDGE CTA */}
      <div className="by-bridge">
        <div className="by-bridge__inner">
          <p className="by-bridge__copy">{t.bridgeCopyPrefix} <em>{t.bridgeCopyEm}</em></p>
          <a href="#suggest" className="by-bridge__cta">{t.bridgeCtaLabel}</a>
        </div>
      </div>

      {/* SPRINT PATH */}
      <section className="by-sprint" id="sprint">
        <div className="by-sprint__inner">
          <p className="by-sprint__kicker">{t.sprintKicker}</p>
          <h2 className="by-sprint__title">{t.sprintTitle}</h2>
          <p className="by-sprint__sub">{t.sprintSub}</p>
          <p className="by-sprint__intro" dangerouslySetInnerHTML={{ __html: t.sprintIntro }} />

          <div className="by-sprint__steps">
            {t.sprintSteps.map(step => (
              <div className="by-step" key={step.num}>
                <div className="by-step__num">{step.num}</div>
                <div className="by-step__content">
                  <h3 className="by-step__title">{step.title}</h3>
                  <p className="by-step__body" dangerouslySetInnerHTML={{ __html: step.body }} />
                  {step.anchor ? (
                    <a href={step.toolLink} className="by-step__tool">{step.toolLabel}</a>
                  ) : (
                    <Link to={step.toolLink} className="by-step__tool">{step.toolLabel}</Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TOOLS */}
      <section className="by-tools" id="tools">
        <div className="by-tools__head">
          <p className="by-kicker">{t.toolsKicker}</p>
          <h2 className="by-section-title">{t.toolsTitle}</h2>
          <p className="by-section-sub">{t.toolsSub}</p>
        </div>
        <div className="by-tools__grid">
          {t.tools.map((tool, idx) => (
            <div className="by-tool-card" key={tool.name} style={{ '--by-i': idx % 12 }}>
              <h3 className="by-tool-card__name">{tool.name}</h3>
              <p className="by-tool-card__desc">{tool.desc}</p>
              <Link to="/career-templates" className="by-tool-card__link">{tool.linkLabel}</Link>
            </div>
          ))}
        </div>
      </section>

      <hr className="by-divider" />

      {/* FOLLOW */}
      <section className="by-follow">
        <p className="by-kicker">{t.followKicker}</p>
        <h2 className="by-section-title" style={{ marginBottom: '8px' }}>{t.followTitle}</h2>
        <p className="by-section-body" style={{ marginBottom: '36px' }}>{t.followBody}</p>
        <div className="by-follow__inner">
          <div className="by-follow-card by-follow-card--jose">
            <span className="by-follow-card__label">{t.joseCardLabel}</span>
            <h3 className="by-follow-card__name">{t.joseCardName}</h3>
            <p className="by-follow-card__desc">{t.joseCardDesc}</p>
            <a href="https://www.linkedin.com/in/cjxsez/" target="_blank" rel="noopener noreferrer" className="by-follow-card__cta">
              {t.joseCardCta}
            </a>
          </div>
          <div className="by-follow-card by-follow-card--jocelyn">
            <span className="by-follow-card__label">{t.jocelynCardLabel}</span>
            <h3 className="by-follow-card__name">{t.jocelynCardName}</h3>
            <p className="by-follow-card__desc">{t.jocelynCardDesc}</p>
            <a href="https://www.linkedin.com/in/jocelyn-vazquez/" target="_blank" rel="noopener noreferrer" className="by-follow-card__cta">
              {t.jocelynCardCta}
            </a>
          </div>
        </div>
      </section>

      <hr className="by-divider" />

      {/* SUGGEST FORM */}
      <section className="by-suggest" id="suggest">
        <div className="by-suggest__inner">
          <div className="by-suggest__copy">
            <p className="by-suggest__kicker">{t.suggestKicker}</p>
            <h2 className="by-suggest__title">{t.suggestTitlePrefix ?? t.suggestTitle}{t.suggestTitleEm && <> <em>{t.suggestTitleEm}</em></>}</h2>
            <p className="by-suggest__sub">{t.suggestSub}</p>
          </div>
          <div className="by-suggest__box">
          {formSubmitted ? (
            <div className="by-suggest__success">
              <h3>{t.formSuccessTitle}</h3>
              <p>{t.formSuccessBody}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="by-suggest__row">
                <label className="by-suggest__label" htmlFor="sgProgram">{t.formLabelProgram}</label>
                <input
                  className={`by-suggest__input${fieldErrors.program ? ' is-invalid' : ''}`}
                  type="text"
                  id="sgProgram"
                  placeholder={t.formPlaceholderProgram}
                  value={form.program}
                  onChange={e => setField('program', e.target.value)}
                  aria-invalid={!!fieldErrors.program}
                  aria-describedby={fieldErrors.program ? 'sgProgram-error' : undefined}
                />
                {fieldErrors.program && <span id="sgProgram-error" className="by-suggest__row__error" role="alert">{fieldErrors.program}</span>}
              </div>
              <div className="by-suggest__row">
                <label className="by-suggest__label" htmlFor="sgCompany">{t.formLabelCompany}</label>
                <input
                  className={`by-suggest__input${fieldErrors.company ? ' is-invalid' : ''}`}
                  type="text"
                  id="sgCompany"
                  placeholder={t.formPlaceholderCompany}
                  value={form.company}
                  onChange={e => setField('company', e.target.value)}
                  aria-invalid={!!fieldErrors.company}
                  aria-describedby={fieldErrors.company ? 'sgCompany-error' : undefined}
                />
                {fieldErrors.company && <span id="sgCompany-error" className="by-suggest__row__error" role="alert">{fieldErrors.company}</span>}
              </div>
              <div className="by-suggest__row">
                <label className="by-suggest__label" htmlFor="sgLink">{t.formLabelLink}</label>
                <input className="by-suggest__input" type="url" id="sgLink" placeholder="https://…" value={form.link} onChange={e => setField('link', e.target.value)} />
              </div>
              <div className="by-suggest__row">
                <label className="by-suggest__label" htmlFor="sgWhy">{t.formLabelWhy}</label>
                <textarea className="by-suggest__textarea" id="sgWhy" placeholder={t.formPlaceholderWhy} value={form.why} onChange={e => setField('why', e.target.value)} />
              </div>
              <div className="by-suggest__row">
                <label className="by-suggest__label" htmlFor="sgEmail">{t.formLabelEmail}</label>
                <input
                  className={`by-suggest__input${fieldErrors.email ? ' is-invalid' : ''}`}
                  type="email"
                  id="sgEmail"
                  placeholder={t.formPlaceholderEmail}
                  value={form.email}
                  onChange={e => setField('email', e.target.value)}
                  onBlur={e => {
                    const v = e.target.value.trim()
                    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
                      setFieldErrors(s => ({ ...s, email: t.formErrorEmail }))
                    }
                  }}
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? 'sgEmail-error' : undefined}
                />
                {fieldErrors.email && <span id="sgEmail-error" className="by-suggest__row__error" role="alert">{fieldErrors.email}</span>}
              </div>
              {formError && (
                <div role="alert" className="by-suggest__error-card">
                  <span className="by-suggest__error-card__msg"><strong>{t.formErrorLabel}</strong> {formError}</span>
                  <button type="submit" className="by-suggest__error-card__retry" disabled={formLoading}>{formLoading ? t.formSubmitting : t.formRetryLabel}</button>
                </div>
              )}
              <Turnstile onToken={setSuggestTurnstileToken} resetRef={suggestTurnstileReset} />
              <button className="by-suggest__btn" type="submit" disabled={formLoading || !form.program.trim() || !form.company.trim() || (TURNSTILE_ENABLED && !suggestTurnstileToken)}>{formLoading ? t.formSubmitting : t.formSubmit}</button>
            </form>
          )}
          </div>
        </div>
      </section>

    </ArticleLayout>
  )
}
