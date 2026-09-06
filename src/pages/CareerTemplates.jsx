import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import ArticleLayout from '../components/ArticleLayout'
import { useT } from '../hooks/useT'
import Turnstile, { TURNSTILE_ENABLED } from '../components/Turnstile'

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2"/>
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
  </svg>
)

const ExternalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
)

// Templates that are actually live (id → URL). Everything else shows "coming soon".
// #5 = the Internship Application Tracker → the real "Career Chisme Sheet" Google Sheet.
const TEMPLATE_LINKS = {
  5: 'https://docs.google.com/spreadsheets/d/1O3AkqZiVSXUMq2qfj3tIsy-mWNLgCi3MiNwyNrSFIJM/edit?gid=617684609#gid=617684609',
}

// Card color is assigned per ROW (every 3 cards at desktop) so each row is one
// uniform color, cycling through the brand palette instead of per-category color.
const ROW_COLORS = ['outreach', 'apply', 'interview', 'offers', 'job']

export default function CareerTemplates() {
  const t = useT('careerTemplates')
  const [searchParams, setSearchParams] = useSearchParams()
  const activeFilter = searchParams.get('filter') || 'all'
  const [request, setRequest] = useState('')
  const [reqEmail, setReqEmail] = useState('')
  const [reqCategory, setReqCategory] = useState('')
  const [reqCategoryOther, setReqCategoryOther] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({ request: '', email: '', category: '' })
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileReset = useRef(null)

  const [previewId, setPreviewId] = useState(null)
  const [copied, setCopied] = useState(false)
  const [copiedCardId, setCopiedCardId] = useState(null)
  const [pickerId, setPickerId] = useState(null)
  const [copiedVariantKey, setCopiedVariantKey] = useState(null)
  const previewTriggerRef = useRef(null)
  const pickerTriggerRef = useRef(null)
  const filtersRef = useRef(null)

  useEffect(() => {
    const onKeyDown = e => {
      if (e.key !== '/') return
      const el = document.activeElement
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return
      const firstFilter = filtersRef.current?.querySelector('button')
      if (firstFilter) {
        e.preventDefault()
        firstFilter.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleFilterClick = useCallback(e => {
    const key = e.currentTarget.dataset.key
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (key === 'all') next.delete('filter')
      else next.set('filter', key)
      return next
    }, { replace: true })
  }, [setSearchParams])

  const openPreview = (id, e) => {
    previewTriggerRef.current = e?.currentTarget ?? null
    setPreviewId(id)
    setCopied(false)
  }
  const closePreview = useCallback(() => {
    setPreviewId(null)
    setCopied(false)
    if (previewTriggerRef.current) {
      previewTriggerRef.current.focus()
      previewTriggerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (previewId == null) { document.body.style.overflow = ''; return }
    document.body.style.overflow = 'hidden'
    const onKey = e => { if (e.key === 'Escape') closePreview() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [previewId, closePreview])

  const copyPreview = body => {
    if (!body) return
    navigator.clipboard.writeText(body).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    }).catch(() => { /* clipboard unavailable */ })
  }

  // Copy an available template's body straight from its card.
  const copyTemplate = tmpl => {
    if (!tmpl.body) return
    navigator.clipboard.writeText(tmpl.body).then(() => {
      setCopiedCardId(tmpl.id)
      setTimeout(() => setCopiedCardId(null), 2200)
    }).catch(() => { /* clipboard unavailable */ })
  }

  // Multi-option templates open a picker so users copy just the version they want.
  const openPicker = (id, e) => {
    pickerTriggerRef.current = e?.currentTarget ?? null
    setCopiedVariantKey(null)
    setPickerId(id)
  }
  const closePicker = useCallback(() => {
    setPickerId(null)
    setCopiedVariantKey(null)
    if (pickerTriggerRef.current) {
      pickerTriggerRef.current.focus()
      pickerTriggerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (pickerId == null) { document.body.style.overflow = ''; return }
    document.body.style.overflow = 'hidden'
    const onKey = e => { if (e.key === 'Escape') closePicker() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [pickerId, closePicker])

  const copyVariant = (templateId, index, text) => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopiedVariantKey(`${templateId}-${index}`)
      setTimeout(() => setCopiedVariantKey(null), 2200)
    }).catch(() => { /* clipboard unavailable */ })
  }

  const handleSubmit = async e => {
    e.preventDefault()
    const errors = { request: '', email: '', category: '' }
    if (!request.trim()) errors.request = t.formErrorRequired
    if (reqEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reqEmail.trim())) errors.email = t.formErrorEmail
    if (reqCategory === 'other' && !reqCategoryOther.trim()) errors.category = t.formErrorCategoryOther
    if (errors.request || errors.email || errors.category) {
      setFieldErrors(errors)
      setFormError('')
      return
    }
    if (TURNSTILE_ENABLED && !turnstileToken) return
    setFieldErrors({ request: '', email: '', category: '' })
    setFormLoading(true)
    setFormError('')
    const categoryValue = reqCategory === 'other'
      ? `other: ${reqCategoryOther.trim()}`
      : (reqCategory || null)
    // Request now flows through the Turnstile-gated submit-form edge function
    // (service role) — the direct anon INSERT on template_requests is revoked
    // (migration 019) so the open write-spam path is closed.
    let ok
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-form`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          type: 'template_request',
          turnstileToken,
          payload: {
            request: request.trim(),
            email: reqEmail.trim() || null,
            category: categoryValue,
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
      setTurnstileToken('')
      turnstileReset.current?.()
    }
  }

  const TEMPLATES = t.templates

  const STAGE_LABELS = {
    outreach: t.stageOutreach,
    apply: t.stageApply,
    interview: t.stageInterview,
    offers: t.stageOffers,
    job: t.stageJob,
  }

  const FILTERS = [
    { key: 'all', label: t.filterAll, desc: t.filterAllDesc },
    { key: 'outreach', label: t.filterOutreach, desc: t.filterOutreachDesc },
    { key: 'apply', label: t.filterApply, desc: t.filterApplyDesc },
    { key: 'interview', label: t.filterInterview, desc: t.filterInterviewDesc },
    { key: 'offers', label: t.filterOffers, desc: t.filterOffersDesc },
    { key: 'job', label: t.filterJob, desc: t.filterJobDesc },
  ]

  const visible = activeFilter === 'all'
    ? TEMPLATES
    : TEMPLATES.filter(tmpl => tmpl.cat === activeFilter)

  const countLabel = visible.length === 1
    ? t.countOne
    : t.countMany.replace('{n}', visible.length)

  return (
    <ArticleLayout
      title={t.heroTitle}
      signoffLine={t.signoffLine}
      signoffSub={t.signoffSub}
      signoffCta={t.signoffCta}
    >
      <style>{`
        html, body { background: var(--color-cream); }

        .ct-hero {
          max-width: 1240px;
          margin: 0 auto;
          padding: 96px clamp(20px,5vw,56px) 64px;
          position: relative;
          overflow: hidden;
        }
        .ct-hero::before {
          content: '';
          position: absolute;
          top: 96px;
          left: clamp(20px,5vw,56px);
          width: 56px;
          height: 4px;
          background: var(--color-accent);
          border-radius: 2px;
        }
        .ct-hero::after {
          content: '';
          position: absolute;
          top: -14%;
          right: -10%;
          width: 520px;
          height: 520px;
          background: radial-gradient(closest-side, rgba(179,69,57,.1), transparent 70%);
          pointer-events: none;
          z-index: 0;
        }
        .ct-hero > * { position: relative; z-index: 1; }
        .ct-hero__kicker {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .2em;
          text-transform: uppercase;
          color: var(--color-accent);
          margin: 28px 0 22px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .ct-hero__kicker::after {
          content: '';
          width: 24px;
          height: 1px;
          background: var(--color-accent);
          opacity: .5;
        }
        .ct-hero__title {
          font-family: var(--font-display);
          font-size: clamp(44px, 8vw, 96px);
          font-weight: 700;
          line-height: .98;
          letter-spacing: -.028em;
          color: var(--color-dark);
          margin-bottom: 18px;
          max-width: 18ch;
        }
        .ct-hero__title em {
          font-style: normal;
          color: var(--color-teal);
        }
        .ct-hero__tagline {
          font-family: var(--font-serif, var(--font-display));
          font-size: clamp(18px,2.2vw,24px);
          font-style: italic;
          font-weight: 400;
          color: var(--color-accent);
          margin-bottom: 22px;
          letter-spacing: -.005em;
        }
        .ct-hero__sub {
          font-size: clamp(16px,1.8vw,18px);
          color: var(--color-muted);
          line-height: 1.7;
          max-width: 62ch;
        }
        .ct-hero__sub strong { color: var(--color-dark); font-weight: 600; }

        .ct-controls {
          max-width: 1240px;
          margin: 0 auto;
          padding: 0 clamp(20px,5vw,56px) 40px;
        }
        .ct-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .ct-filter {
          padding: 9px 16px;
          border-radius: 14px;
          font-family: var(--font-display);
          letter-spacing: -.005em;
          cursor: pointer;
          border: 1.5px solid rgba(26,25,22,.1);
          background: rgba(255,255,255,.55);
          color: var(--color-muted);
          transition: background-color .2s, color .2s, border-color .2s, transform .15s, box-shadow .2s;
          display: inline-flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 1px;
          text-align: left;
          min-width: 0;
        }
        .ct-filter:hover { color: var(--color-dark); border-color: rgba(26,25,22,.22); background: rgba(255,255,255,.85); transform: translateY(-1px); box-shadow: 0 4px 12px -4px rgba(63,42,28,.1); }
        .ct-filter:active { transform: translateY(0); }
        .ct-filter:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 3px; border-radius: 14px; }
        .ct-filter__label { font-size: 12px; font-weight: 700; letter-spacing: -.005em; line-height: 1.2; }
        .ct-filter__desc { font-size: 10.5px; font-weight: 500; opacity: .72; line-height: 1.2; letter-spacing: .005em; }
        .ct-filter--active .ct-filter__desc { opacity: .85; }
        .ct-filter--active { background: var(--color-dark); color: var(--color-cream); border-color: var(--color-dark); box-shadow: 0 8px 18px -8px rgba(63,42,28,.32), inset 0 1px 0 rgba(255,255,255,.08); }
        .ct-filter--outreach.ct-filter--active { background: var(--color-teal);  border-color: var(--color-teal); }
        .ct-filter--apply.ct-filter--active    { background: var(--color-blue);  border-color: var(--color-blue); }
        .ct-filter--interview.ct-filter--active { background: var(--color-gold-dark); border-color: var(--color-gold-dark); }
        .ct-filter--offers.ct-filter--active   { background: var(--color-accent); border-color: var(--color-accent); }
        .ct-filter--job.ct-filter--active      { background: var(--color-navy);  border-color: var(--color-navy); }

        .ct-meta {
          max-width: 1240px;
          margin: 0 auto;
          padding: 0 clamp(20px,5vw,56px) 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .ct-count { font-size: 13px; color: var(--color-muted); }
        .ct-count strong { color: var(--color-dark); font-weight: 700; }

        .ct-grid {
          max-width: 1240px;
          margin: 0 auto;
          padding: 0 clamp(20px,5vw,56px) 80px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }
        @media (max-width: 960px) { .ct-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 560px) { .ct-grid { grid-template-columns: 1fr; } }
        .ct-grid > .ct-card { animation: ct-card-in .55s cubic-bezier(.16,1,.3,1) backwards; animation-delay: calc(var(--ct-i, 0) * 50ms); }
        @keyframes ct-card-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

        .ct-card {
          background: linear-gradient(180deg, rgba(255,250,242,.85) 0%, rgba(255,250,242,.55) 100%);
          border: 1px solid rgba(26,25,22,.13);
          border-radius: 14px;
          padding: 24px 24px 22px;
          display: flex;
          flex-direction: column;
          gap: 0;
          box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 4px 12px -6px rgba(63,42,28,.12);
          transition: transform .28s cubic-bezier(.16,1,.3,1), box-shadow .28s cubic-bezier(.16,1,.3,1), border-color .28s;
        }
        .ct-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 16px 36px -12px rgba(63,42,28,.22);
          border-color: rgba(26,25,22,.22);
        }
        /* per-stage tint replaces the banned 3px colored top stripe */
        .ct-card--outreach  { background: linear-gradient(180deg, rgba(58,125,107,.07) 0%, rgba(255,250,242,.55) 60%); border-color: rgba(58,125,107,.22); }
        .ct-card--apply     { background: linear-gradient(180deg, rgba(91,142,194,.07) 0%, rgba(255,250,242,.55) 60%); border-color: rgba(91,142,194,.22); }
        .ct-card--interview { background: linear-gradient(180deg, rgba(232,168,56,.07) 0%, rgba(255,250,242,.55) 60%); border-color: rgba(232,168,56,.26); }
        .ct-card--offers    { background: linear-gradient(180deg, rgba(179,69,57,.06) 0%, rgba(255,250,242,.55) 60%); border-color: rgba(179,69,57,.22); }
        .ct-card--job       { background: linear-gradient(180deg, rgba(22,43,68,.06) 0%, rgba(255,250,242,.55) 60%); border-color: rgba(22,43,68,.2); }

        .ct-card__top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }
        .ct-card__num {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 800;
          letter-spacing: -.005em;
          color: rgba(232,168,56,.55);
          font-variant-numeric: tabular-nums;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .ct-card__badges { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
        .ct-card__stage {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .12em;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 999px;
        }
        .ct-card__stage--outreach  { background: rgba(58,125,107,0.14);  color: var(--color-teal); }
        .ct-card__stage--apply     { background: rgba(91,142,194,0.14);  color: var(--color-blue); }
        .ct-card__stage--interview { background: rgba(232,168,56,0.18);  color: var(--color-gold-dark); }
        .ct-card__stage--offers    { background: rgba(179,69,57,0.12);   color: var(--color-accent); }
        .ct-card__stage--job       { background: rgba(22,43,68,0.12);    color: var(--color-navy); }

        .ct-card__author {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .12em;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 999px;
          color: var(--color-white);
        }
        .ct-card__author--jose    { background: var(--color-teal); }
        .ct-card__author--jocelyn { background: var(--color-accent); }
        .ct-card__author--both    { background: var(--color-navy); }

        .ct-card__title {
          font-family: var(--font-display);
          font-size: clamp(16px,1.8vw,19px);
          font-weight: 700;
          color: var(--color-dark);
          line-height: 1.3;
          letter-spacing: -.005em;
          margin: 14px 0 10px;
        }
        .ct-card__desc {
          font-size: 14px;
          color: var(--color-muted);
          line-height: 1.6;
          flex: 1;
          margin-bottom: 22px;
        }
        .ct-card__cta {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 10px 18px;
          border-radius: 999px;
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: -.005em;
          text-decoration: none;
          cursor: pointer;
          border: 1.5px solid;
          transition: background .25s, color .25s, transform .22s cubic-bezier(.16,1,.3,1), box-shadow .25s;
          align-self: flex-start;
        }
        .ct-card__cta--outreach  { background: transparent; color: var(--color-teal);      border-color: rgba(58,125,107,.5); }
        .ct-card__cta--apply     { background: transparent; color: var(--color-blue);      border-color: rgba(91,142,194,.5); }
        .ct-card__cta--interview { background: transparent; color: var(--color-gold-dark); border-color: rgba(232,168,56,.6); }
        .ct-card__cta--offers    { background: transparent; color: var(--color-accent);    border-color: rgba(179,69,57,.5); }
        .ct-card__cta--job       { background: transparent; color: var(--color-navy);      border-color: rgba(22,43,68,.4); }
        .ct-card__cta:hover { transform: translateY(-1px); }
        .ct-card__cta--outreach:hover  { background: var(--color-teal);   color: var(--color-cream); border-color: var(--color-teal);   box-shadow: 0 8px 16px -8px rgba(58,125,107,.5); }
        .ct-card__cta--apply:hover     { background: var(--color-blue);   color: var(--color-cream); border-color: var(--color-blue);   box-shadow: 0 8px 16px -8px rgba(91,142,194,.5); }
        .ct-card__cta--interview:hover { background: var(--color-gold);   color: var(--color-dark);  border-color: var(--color-gold);   box-shadow: 0 8px 16px -8px rgba(232,168,56,.5); }
        .ct-card__cta--offers:hover    { background: var(--color-accent); color: var(--color-cream); border-color: var(--color-accent); box-shadow: 0 8px 16px -8px rgba(179,69,57,.5); }
        .ct-card__cta--job:hover       { background: var(--color-navy);   color: var(--color-cream); border-color: var(--color-navy);   box-shadow: 0 8px 16px -8px rgba(22,43,68,.5); }
        .ct-card__cta:active { transform: translateY(0); }
        /* Not-yet-available templates: muted, non-interactive badge in place of the CTA */
        .ct-card__cta--soon {
          background: rgba(26,25,22,.04);
          color: var(--color-muted);
          border-color: rgba(26,25,22,.16);
          cursor: default;
        }
        .ct-card__cta--soon:hover { transform: none; }

        /* card actions row — Copy Template + Preview side by side */
        .ct-card__actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: auto; }
        .ct-card__preview {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 14px;
          border-radius: 999px;
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: -.005em;
          text-decoration: none;
          cursor: pointer;
          background: transparent;
          border: 1.5px solid rgba(26,25,22,.18);
          color: var(--color-muted);
          transition: background .25s, color .25s, border-color .25s, transform .22s cubic-bezier(.16,1,.3,1);
        }
        .ct-card__preview:hover { color: var(--color-dark); border-color: var(--color-dark); background: rgba(26,25,22,.05); transform: translateY(-1px); }
        .ct-card__preview:active { transform: translateY(0); }
        .ct-card__preview:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 3px; }

        /* Preview modal */
        .ct-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(26,25,22,.7);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          opacity: 0;
          pointer-events: none;
          transition: opacity .2s;
        }
        .ct-modal-overlay.open { opacity: 1; pointer-events: all; }
        .ct-modal {
          background: var(--color-cream);
          border-radius: 18px;
          padding: 36px clamp(24px, 4vw, 40px) 32px;
          max-width: 640px;
          width: 100%;
          max-height: 85vh;
          overflow-y: auto;
          transform: translateY(12px);
          transition: transform .3s cubic-bezier(.16,1,.3,1);
          position: relative;
          box-shadow: 0 36px 72px -24px rgba(26,25,22,.5), 0 0 0 1px rgba(26,25,22,.06);
        }
        .ct-modal-overlay.open .ct-modal { transform: translateY(0); }
        .ct-modal__close {
          position: absolute;
          top: 14px;
          right: 14px;
          min-width: 44px;
          min-height: 44px;
          border-radius: 50%;
          border: none;
          background: rgba(26,25,22,.06);
          color: var(--color-muted);
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background .15s, color .15s;
        }
        .ct-modal__close:hover { background: rgba(179,69,57,.1); color: var(--color-accent); }
        .ct-modal__close:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 2px; }
        .ct-modal__num { font-family: var(--font-display); font-size: 14px; font-weight: 800; letter-spacing: -.005em; color: rgba(232,168,56,.7); font-variant-numeric: tabular-nums; margin-bottom: 8px; }
        .ct-modal__badges { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
        .ct-modal__title {
          font-family: var(--font-display);
          font-size: clamp(22px, 3vw, 30px);
          font-weight: 700;
          color: var(--color-dark);
          margin-bottom: 14px;
          line-height: 1.15;
          letter-spacing: -.02em;
          max-width: 24ch;
        }
        .ct-modal__intro { font-size: 14px; color: var(--color-muted); line-height: 1.65; margin-bottom: 18px; max-width: 50ch; }
        .ct-modal__intro strong { color: var(--color-dark); font-weight: 700; }
        .ct-modal__body {
          background: var(--color-white);
          border: 1px solid rgba(26,25,22,.1);
          border-radius: 10px;
          padding: 22px 24px;
          font-size: 14px;
          line-height: 1.75;
          color: var(--color-dark);
          margin-bottom: 18px;
          white-space: pre-wrap;
          font-family: var(--font-body);
          max-height: 280px;
          overflow-y: auto;
          box-shadow: 0 1px 3px rgba(63,42,28,.06), inset 0 1px 0 rgba(255,255,255,.6);
        }
        .ct-modal__body--placeholder { font-style: italic; color: var(--color-muted); }
        .ct-modal__copy-btn {
          width: 100%;
          padding: 13px;
          background: var(--color-dark);
          color: var(--color-cream);
          border: none;
          border-radius: 999px;
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: -.005em;
          cursor: pointer;
          box-shadow: 0 8px 20px -10px rgba(26,25,22,.4), inset 0 1px 0 rgba(255,255,255,.08);
          transition: background .25s, transform .22s cubic-bezier(.16,1,.3,1), box-shadow .25s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .ct-modal__copy-btn:hover { background: var(--color-teal); transform: translateY(-1px); box-shadow: 0 12px 24px -10px rgba(58,125,107,.5); }
        .ct-modal__copy-btn:active { transform: translateY(0); }
        .ct-modal__copy-btn.copied { background: var(--color-teal); }
        .ct-modal__copy-btn:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 2px; border-radius: 999px; }

        /* Copy picker — choose which version of a multi-option template to copy */
        .ct-picker__list { display: flex; flex-direction: column; gap: 14px; max-height: 60vh; overflow-y: auto; }
        .ct-picker__item { background: var(--color-white); border: 1px solid rgba(26,25,22,.1); border-radius: 12px; padding: 16px 18px; box-shadow: 0 1px 3px rgba(63,42,28,.06); }
        .ct-picker__item-head { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 8px; flex-wrap: wrap; }
        .ct-picker__item-label { font-family: var(--font-display); font-size: 14px; font-weight: 700; letter-spacing: -.005em; color: var(--color-dark); }
        .ct-picker__item-text { font-size: 13px; line-height: 1.7; color: var(--color-muted); white-space: pre-wrap; margin: 0; }
        .ct-picker__copy { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 999px; border: 1.5px solid var(--color-dark); background: var(--color-dark); color: var(--color-cream); font-family: var(--font-display); font-size: 11px; font-weight: 700; letter-spacing: .02em; cursor: pointer; transition: background .2s, color .2s, transform .2s; }
        .ct-picker__copy:hover { transform: translateY(-1px); }
        .ct-picker__copy.copied { background: var(--color-teal); border-color: var(--color-teal); }
        .ct-picker__copy:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 2px; }

        .ct-empty {
          grid-column: 1 / -1;
          text-align: center;
          padding: 60px 24px;
          color: var(--color-muted);
          font-size: 15px;
          line-height: 1.6;
          background: rgba(232,168,56,.05);
          border: 1px dashed rgba(232,168,56,.25);
          border-radius: 16px;
        }

        .ct-legend {
          max-width: 1240px;
          margin: 0 auto 48px;
          padding: 0 clamp(20px,5vw,56px);
          display: flex;
          flex-wrap: wrap;
          gap: 10px 24px;
        }
        .ct-legend__item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--color-muted); letter-spacing: .02em; }
        .ct-legend__dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 0 2px var(--color-cream), 0 0 0 3px rgba(26,25,22,.08); }
        .ct-legend__dot--outreach  { background: var(--color-teal); }
        .ct-legend__dot--apply     { background: var(--color-blue); }
        .ct-legend__dot--interview { background: var(--color-gold); }
        .ct-legend__dot--offers    { background: var(--color-accent); }
        .ct-legend__dot--job       { background: var(--color-navy); }

        .ct-form-wrap {
          background: var(--color-teal);
          padding: clamp(56px,8vw,96px) clamp(20px,5vw,56px);
          position: relative;
          overflow: hidden;
          scroll-margin-top: 96px;
        }
        .ct-form-wrap::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle at 84% 76%, rgba(232,168,56,.12) 0%, transparent 50%);
          pointer-events: none;
        }
        .ct-form-inner {
          max-width: 1240px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0,1fr) minmax(0,1.4fr);
          gap: clamp(40px,5vw,72px);
          align-items: start;
          position: relative;
        }
        .ct-form-copy__kicker {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .2em;
          text-transform: uppercase;
          color: var(--color-gold);
          margin-bottom: 16px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .ct-form-copy__kicker::after {
          content: '';
          width: 24px;
          height: 1px;
          background: var(--color-gold);
          opacity: .5;
        }
        .ct-form-copy__title {
          font-family: var(--font-display);
          font-size: clamp(28px,4vw,46px);
          font-weight: 700;
          letter-spacing: -.025em;
          color: var(--color-cream);
          line-height: 1.05;
          margin-bottom: 18px;
          max-width: 18ch;
          text-wrap: balance;
        }
        .ct-form-copy__title em {
          font-style: italic;
          font-family: var(--font-serif, var(--font-display));
          color: var(--color-gold);
          font-weight: 500;
          padding-right: .04em;
        }
        .ct-form-copy__sub { font-size: 15px; color: rgba(242,228,206,.7); line-height: 1.7; max-width: 50ch; }
        .ct-form-perks { margin-top: 24px; padding-top: 20px; border-top: 1px solid rgba(242,228,206,.18); display: flex; flex-direction: column; gap: 12px; list-style: none; }
        .ct-form-perk { display: flex; align-items: flex-start; gap: 11px; font-size: 14px; color: rgba(242,228,206,.7); line-height: 1.55; }
        .ct-form-perk__icon { width: 22px; height: 22px; border-radius: 50%; background: rgba(232,168,56,.16); color: var(--color-gold); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; box-shadow: inset 0 0 0 1.5px rgba(232,168,56,.3); }
        .ct-form-perk strong { color: var(--color-cream); font-weight: 700; }
        .ct-form-row { margin-bottom: 16px; }
        .ct-form-label {
          display: block;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(242,228,206,0.85);
          margin-bottom: 7px;
        }
        .ct-form-box { background: rgba(0,0,0,.12); border: 1px solid rgba(242,228,206,.22); border-radius: 14px; padding: clamp(24px,3vw,32px); box-shadow: inset 0 1px 0 rgba(255,255,255,.06); }
        .ct-form-input,
        .ct-form-select,
        .ct-form-textarea {
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
        }
        .ct-form-input::placeholder,
        .ct-form-textarea::placeholder { color: rgba(242,228,206,.55); }
        .ct-form-input:focus,
        .ct-form-select:focus,
        .ct-form-textarea:focus { border-color: var(--color-gold); background: rgba(255,255,255,.1); box-shadow: 0 0 0 4px rgba(232,168,56,.16); }
        .ct-form-input.is-invalid, .ct-form-select.is-invalid, .ct-form-textarea.is-invalid { border-color: rgba(232,168,56,.6); }
        .ct-form-input.is-invalid:focus, .ct-form-select.is-invalid:focus, .ct-form-textarea.is-invalid:focus { border-color: var(--color-gold); box-shadow: 0 0 0 4px rgba(232,168,56,.24); }
        .ct-form-select { appearance: none; cursor: pointer; }
        .ct-form-select option { background: var(--color-navy); color: var(--color-cream); }
        .ct-form-textarea { min-height: 90px; resize: vertical; line-height: 1.55; }
        .ct-form-row__error { display: block; margin-top: 6px; font-size: 12px; font-weight: 600; color: var(--color-gold); line-height: 1.4; }
        .ct-form-row__error::before { content: ''; display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: var(--color-gold); margin-right: 7px; vertical-align: .18em; }
        .ct-form-row__counter { display: block; margin-top: 6px; font-size: 11px; color: rgba(242,228,206,.5); text-align: right; font-variant-numeric: tabular-nums; letter-spacing: .02em; }
        .ct-form-row__counter--warn { color: var(--color-gold); font-weight: 600; }
        .ct-form-error-card { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; padding: 14px 16px; background: rgba(232,168,56,.08); border: 1px solid rgba(232,168,56,.4); border-radius: 10px; }
        .ct-form-error-card__msg { flex: 1; font-size: 13px; color: var(--color-cream); line-height: 1.5; }
        .ct-form-error-card__msg strong { color: var(--color-gold); font-weight: 700; }
        .ct-form-error-card__retry { flex-shrink: 0; padding: 7px 14px; background: transparent; border: 1.5px solid var(--color-gold); color: var(--color-gold); border-radius: 999px; font-family: var(--font-display); font-size: 12px; font-weight: 700; letter-spacing: -.005em; cursor: pointer; transition: background .2s, color .2s; }
        .ct-form-error-card__retry:hover { background: var(--color-gold); color: var(--color-dark); }
        .ct-form-btn {
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
        .ct-form-btn:hover { background: var(--color-cream); transform: translateY(-2px); box-shadow: 0 14px 24px -12px rgba(232,228,206,.5); }
        .ct-form-btn:active { transform: translateY(0); }
        .ct-form-btn:disabled { opacity: .55; cursor: not-allowed; transform: none; box-shadow: none; }
        .ct-form-success { padding: 32px 0; text-align: center; }
        .ct-form-success__icon { width: 52px; height: 52px; border-radius: 50%; background: rgba(232,168,56,.14); color: var(--color-gold); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; box-shadow: inset 0 0 0 1.5px rgba(232,168,56,.3); }
        .ct-form-success__title { font-family: var(--font-display); font-size: 20px; font-weight: 700; color: var(--color-cream); margin-bottom: 6px; letter-spacing: -.01em; }
        .ct-form-success__body { font-size: 14px; color: rgba(242,228,206,.7); line-height: 1.6; }

        @media (max-width: 860px) {
          .ct-form-inner { grid-template-columns: 1fr; gap: 36px; }
        }
        @media (max-width: 768px) {
          .ct-hero { padding: 88px 20px 48px; }
        }
        @media (max-width: 480px) {
          .ct-hero { padding: 80px 16px 40px; }
          .ct-filters { overflow-x: auto; -webkit-overflow-scrolling: touch; flex-wrap: nowrap; padding-bottom: 4px; }
          .ct-filter { flex-shrink: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ct-card, .ct-filter, .ct-form-btn, .ct-form-input, .ct-form-select, .ct-form-textarea,
          .ct-form-error-card__retry, .ct-card__cta, .ct-card__preview, .ct-modal__copy-btn { transition: none !important; }
          .ct-card:hover, .ct-filter:hover, .ct-form-btn:hover, .ct-card__cta:hover,
          .ct-form-error-card__retry:hover, .ct-card__preview:hover, .ct-modal__copy-btn:hover { transform: none !important; }
          .ct-grid > .ct-card { animation: none !important; }
          .ct-modal-overlay, .ct-modal-overlay.open .ct-modal { transition-duration: .01ms !important; }
        }
      `}</style>

      <header className="ct-hero">
        <p className="ct-hero__kicker">{t.heroKicker}</p>
        <h1 className="ct-hero__title" dangerouslySetInnerHTML={{ __html: t.heroTitle }} />
        <p className="ct-hero__tagline">{t.heroTagline}</p>
        <p className="ct-hero__sub">
          {t.heroSub}{' '}
          <strong>{t.heroSubStrong}</strong>{' '}{t.heroSubSuffix}
        </p>
      </header>

      <div className="ct-controls">
        <div className="ct-filters" role="group" aria-label={t.filterAriaLabel} ref={filtersRef}>
          {FILTERS.map(({ key, label, desc }) => (
            <button
              key={key}
              data-key={key}
              className={`ct-filter${key !== 'all' ? ` ct-filter--${key}` : ''}${activeFilter === key ? ' ct-filter--active' : ''}`}
              aria-pressed={activeFilter === key}
              onClick={handleFilterClick}
            >
              <span className="ct-filter__label">{label}</span>
              {desc && <span className="ct-filter__desc">{desc}</span>}
            </button>
          ))}
        </div>
      </div>


      <div className="ct-meta">
        <p className="ct-count">{countLabel}</p>
      </div>

      <div className="ct-grid" aria-label={t.gridAriaLabel}>
        {visible.length === 0 ? (
          <div className="ct-empty" aria-live="polite">{t.emptyState}</div>
        ) : (
          visible.map((tmpl, idx) => {
            const rowColor = ROW_COLORS[Math.floor(idx / 3) % ROW_COLORS.length]
            return (
            <div key={tmpl.id} className={`ct-card ct-card--${rowColor}`} style={{ '--ct-i': idx % 12 }}>
              <div className="ct-card__top">
                <span className="ct-card__num">{tmpl.num}</span>
                <div className="ct-card__badges">
                  <span className={`ct-card__stage ct-card__stage--${rowColor}`}>{STAGE_LABELS[tmpl.stage]}</span>
                  <span className={`ct-card__author ct-card__author--${tmpl.author}`}>
                    {tmpl.author === 'jose' ? t.authorJose : tmpl.author === 'jocelyn' ? t.authorJocelyn : t.authorBoth}
                  </span>
                </div>
              </div>
              <h2 className="ct-card__title">{tmpl.title}</h2>
              <p className="ct-card__desc">{tmpl.desc}</p>
              <div className="ct-card__actions">
                {TEMPLATE_LINKS[tmpl.id] ? (
                  <a href={TEMPLATE_LINKS[tmpl.id]} target="_blank" rel="noopener noreferrer" className={`ct-card__cta ct-card__cta--${rowColor}`}>
                    {tmpl.ctaLabel}
                    {tmpl.ctaIcon === 'copy' ? <CopyIcon /> : <ExternalIcon />}
                  </a>
                ) : tmpl.variants ? (
                  <button type="button" className={`ct-card__cta ct-card__cta--${rowColor}`} onClick={e => openPicker(tmpl.id, e)} aria-haspopup="dialog">
                    {tmpl.ctaLabel}
                    <CopyIcon />
                  </button>
                ) : tmpl.body ? (
                  <button type="button" className={`ct-card__cta ct-card__cta--${rowColor}`} onClick={() => copyTemplate(tmpl)}>
                    {copiedCardId === tmpl.id ? t.modalCopiedLabel : tmpl.ctaLabel}
                    <CopyIcon />
                  </button>
                ) : (
                  <span className="ct-card__cta ct-card__cta--soon" aria-disabled="true">{t.comingSoon}</span>
                )}
                <button
                  type="button"
                  className="ct-card__preview"
                  onClick={e => openPreview(tmpl.id, e)}
                  aria-haspopup="dialog"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  {t.previewLabel}
                </button>
              </div>
            </div>
            )
          })
        )}
      </div>

      <section className="ct-form-wrap" id="suggest">
        <div className="ct-form-inner">
          <div className="ct-form-copy">
            <p className="ct-form-copy__kicker">{t.formKicker}</p>
            <h2 className="ct-form-copy__title">{t.formTitle}</h2>
            <p className="ct-form-copy__sub">{t.formSub}</p>
            <ul className="ct-form-perks">
              {(t.formPerks || []).map((perk, i) => (
                <li key={i} className="ct-form-perk">
                  <span className="ct-form-perk__icon" aria-hidden="true">
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.8l2.4 2.4L9 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <span><strong>{perk.strong}</strong>{perk.rest}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="ct-form-box">
            {formSubmitted ? (
              <div className="ct-form-success">
                <div className="ct-form-success__icon" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M5 11.5l4 4L17 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <p className="ct-form-success__title">{t.formSuccessTitle}</p>
                <p className="ct-form-success__body">{t.formSuccessBody}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="ct-form-row">
                  <label className="ct-form-label" htmlFor="reqField">{t.formLabelRequest}</label>
                  <textarea
                    className={`ct-form-textarea${fieldErrors.request ? ' is-invalid' : ''}`}
                    id="reqField"
                    placeholder={t.formPlaceholderRequest}
                    value={request}
                    maxLength={10000}
                    onChange={e => { setRequest(e.target.value); if (fieldErrors.request) setFieldErrors(s => ({ ...s, request: '' })) }}
                    aria-invalid={!!fieldErrors.request}
                    aria-describedby={fieldErrors.request ? 'reqField-error' : (request.length >= 500 ? 'reqField-counter' : undefined)}
                  />
                  {fieldErrors.request && <span id="reqField-error" className="ct-form-row__error" role="alert">{fieldErrors.request}</span>}
                  {request.length >= 500 && (
                    <span id="reqField-counter" className={`ct-form-row__counter${request.length >= 9000 ? ' ct-form-row__counter--warn' : ''}`} aria-live="polite">
                      {request.length >= 9000 ? `${request.length} / 10000` : `${request.length} chars`}
                    </span>
                  )}
                </div>
                <div className="ct-form-row">
                  <label className="ct-form-label" htmlFor="reqEmailField">{t.formLabelEmail}</label>
                  <input
                    className={`ct-form-input${fieldErrors.email ? ' is-invalid' : ''}`}
                    type="email"
                    id="reqEmailField"
                    placeholder={t.formPlaceholderEmail}
                    value={reqEmail}
                    onChange={e => { setReqEmail(e.target.value); if (fieldErrors.email) setFieldErrors(s => ({ ...s, email: '' })) }}
                    onBlur={e => {
                      const v = e.target.value.trim()
                      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
                        setFieldErrors(s => ({ ...s, email: t.formErrorEmail }))
                      }
                    }}
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? 'reqEmailField-error' : undefined}
                  />
                  {fieldErrors.email && <span id="reqEmailField-error" className="ct-form-row__error" role="alert">{fieldErrors.email}</span>}
                </div>
                <div className="ct-form-row">
                  <label className="ct-form-label" htmlFor="reqCat">{t.formLabelCategory}</label>
                  <select className="ct-form-select" id="reqCat" value={reqCategory} onChange={e => setReqCategory(e.target.value)}>
                    <option value="">{t.formCategoryPlaceholder}</option>
                    <option value="internship-search">{t.catInternshipSearch}</option>
                    <option value="networking-outreach">{t.catNetworkingOutreach}</option>
                    <option value="interview-prep">{t.catInterviewPrep}</option>
                    <option value="offers-negotiation">{t.catOffersNegotiation}</option>
                    <option value="first-job-onboarding">{t.catFirstJobOnboarding}</option>
                    <option value="other">{t.catOther}</option>
                  </select>
                </div>
                {reqCategory === 'other' && (
                  <div className="ct-form-row">
                    <label className="ct-form-label" htmlFor="reqCatOther">{t.formLabelCategoryOther}</label>
                    <input
                      className={`ct-form-input${fieldErrors.category ? ' is-invalid' : ''}`}
                      type="text"
                      id="reqCatOther"
                      placeholder={t.formPlaceholderCategoryOther}
                      value={reqCategoryOther}
                      onChange={e => { setReqCategoryOther(e.target.value); if (fieldErrors.category) setFieldErrors(s => ({ ...s, category: '' })) }}
                      maxLength={120}
                      aria-invalid={!!fieldErrors.category}
                      aria-describedby={fieldErrors.category ? 'reqCatOther-error' : undefined}
                    />
                    {fieldErrors.category && <span id="reqCatOther-error" className="ct-form-row__error" role="alert">{fieldErrors.category}</span>}
                  </div>
                )}
                {formError && (
                  <div role="alert" className="ct-form-error-card">
                    <span className="ct-form-error-card__msg"><strong>{t.formErrorLabel}</strong> {formError}</span>
                    <button type="submit" className="ct-form-error-card__retry" disabled={formLoading}>{formLoading ? t.formBtnSubmitting : t.formRetryLabel}</button>
                  </div>
                )}
                <Turnstile onToken={setTurnstileToken} resetRef={turnstileReset} />
                <button className="ct-form-btn" type="submit" disabled={formLoading || !request.trim() || (TURNSTILE_ENABLED && !turnstileToken)}>{formLoading ? t.formBtnSubmitting : t.formBtnSubmit}</button>
              </form>
            )}
          </div>
        </div>
      </section>

      <div
        className={`ct-modal-overlay${previewId != null ? ' open' : ''}`}
        onClick={closePreview}
        aria-hidden={previewId == null}
      >
        {(() => {
          const tmpl = previewId != null ? TEMPLATES.find(x => x.id === previewId) : null
          if (!tmpl) return null
          const hasContent = !!(tmpl.body || tmpl.variants)
          const body = tmpl.body
            || (tmpl.variants ? tmpl.variants.map(v => `${v.label}\n${v.text}`).join('\n\n') : tmpl.desc)
          return (
            <div
              className="ct-modal"
              role="dialog"
              aria-modal="true"
              aria-label={`${tmpl.title} ${t.previewLabel}`}
              onClick={e => e.stopPropagation()}
            >
              <button type="button" className="ct-modal__close" onClick={closePreview} aria-label={t.modalCloseLabel}>✕</button>
              <div className="ct-modal__num">{tmpl.num}</div>
              <div className="ct-modal__badges">
                <span className={`ct-card__stage ct-card__stage--${tmpl.stage}`}>{STAGE_LABELS[tmpl.stage]}</span>
                <span className={`ct-card__author ct-card__author--${tmpl.author}`}>
                  {tmpl.author === 'jose' ? t.authorJose : tmpl.author === 'jocelyn' ? t.authorJocelyn : t.authorBoth}
                </span>
              </div>
              <h2 className="ct-modal__title">{tmpl.title}</h2>
              <p className="ct-modal__intro">{t.previewIntro}</p>
              <div className={`ct-modal__body${hasContent ? '' : ' ct-modal__body--placeholder'}`}>{body}</div>
              <button
                type="button"
                className={`ct-modal__copy-btn${copied ? ' copied' : ''}`}
                onClick={() => copyPreview(body)}
              >
                <CopyIcon />
                {copied ? t.modalCopiedLabel : t.modalCopyLabel}
              </button>
            </div>
          )
        })()}
      </div>

      <div
        className={`ct-modal-overlay${pickerId != null ? ' open' : ''}`}
        onClick={closePicker}
        aria-hidden={pickerId == null}
      >
        {(() => {
          const tmpl = pickerId != null ? TEMPLATES.find(x => x.id === pickerId) : null
          if (!tmpl?.variants) return null
          return (
            <div
              className="ct-modal ct-picker"
              role="dialog"
              aria-modal="true"
              aria-label={`${tmpl.title} ${t.pickerIntro}`}
              onClick={e => e.stopPropagation()}
            >
              <button type="button" className="ct-modal__close" onClick={closePicker} aria-label={t.modalCloseLabel}>✕</button>
              <h2 className="ct-modal__title">{tmpl.title}</h2>
              <p className="ct-modal__intro">{t.pickerIntro}</p>
              <div className="ct-picker__list">
                {tmpl.variants.map((v, i) => {
                  const isCopied = copiedVariantKey === `${tmpl.id}-${i}`
                  return (
                    <div key={i} className="ct-picker__item">
                      <div className="ct-picker__item-head">
                        <span className="ct-picker__item-label">{v.label}</span>
                        <button
                          type="button"
                          className={`ct-picker__copy${isCopied ? ' copied' : ''}`}
                          onClick={() => copyVariant(tmpl.id, i, v.text)}
                        >
                          <CopyIcon />
                          {isCopied ? t.modalCopiedLabel : t.modalCopyLabel}
                        </button>
                      </div>
                      <p className="ct-picker__item-text">{v.text}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>
    </ArticleLayout>
  )
}
