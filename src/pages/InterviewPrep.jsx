import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ArticleLayout from '../components/ArticleLayout'
import { useT } from '../hooks/useT'
import Turnstile, { TURNSTILE_ENABLED } from '../components/Turnstile'

export default function InterviewPrep() {
  const t = useT('interviewPrep')

  const [searchParams, setSearchParams] = useSearchParams()
  const validTypeKeys = (t.interviewTypes || []).map(it => it.key)
  const urlType = searchParams.get('type') || ''
  const activeTab = urlType && validTypeKeys.includes(urlType) ? urlType : 'recruiter'
  const setActiveTab = useCallback(key => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (!key || key === 'recruiter') next.delete('type')
      else next.set('type', key)
      return next
    }, { replace: true })
  }, [setSearchParams])
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({ role: '', stage: '', type: '', need: '', email: '' })
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileReset = useRef(null)
  const [previewIndex, setPreviewIndex] = useState(null)
  const previewTriggerRef = useRef(null)
  const tabsRef = useRef(null)

  useEffect(() => {
    const onKeyDown = e => {
      if (e.key !== '/') return
      const el = document.activeElement
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return
      const firstTab = tabsRef.current?.querySelector('button')
      if (firstTab) {
        e.preventDefault()
        firstTab.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const openPreview = (i, e) => {
    previewTriggerRef.current = e?.currentTarget ?? null
    setPreviewIndex(i)
  }
  const closePreview = useCallback(() => {
    setPreviewIndex(null)
    if (previewTriggerRef.current) {
      previewTriggerRef.current.focus()
      previewTriggerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (previewIndex == null) { document.body.style.overflow = ''; return }
    document.body.style.overflow = 'hidden'
    const onKey = e => { if (e.key === 'Escape') closePreview() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [previewIndex, closePreview])

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.role) {
      setFormError(t.formErrorRequired)
      return
    }
    if (TURNSTILE_ENABLED && !turnstileToken) {
      setFormError(t.formErrorGeneric)
      return
    }
    setFormLoading(true)
    setFormError('')
    // Request now flows through the Turnstile-gated submit-form edge function
    // (service role) — the direct anon INSERT on interview_prep_requests is
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
          type: 'interview_prep_request',
          turnstileToken,
          payload: {
            description: form.role,
            stage: form.stage || null,
            interview_type: form.type || null,
            help_needed: form.need || null,
            email: form.email || null,
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

  const activePanel = t.interviewTypes.find(it => it.key === activeTab)

  return (
    <ArticleLayout title={`${t.heroTitle} ${t.heroTitleEm}`}>
      <style>{`
        html, body { background: var(--color-cream); }

        .ip-kicker {
          font-size: 11px; font-weight: 700; letter-spacing: .14em;
          text-transform: uppercase; color: var(--color-muted); margin-bottom: 14px;
        }
        .ip-section-title {
          font-family: var(--font-display);
          font-size: clamp(26px,4vw,40px); font-weight: 700;
          color: var(--color-dark); line-height: 1.15; margin-bottom: 10px;
        }
        .ip-section-sub {
          font-family: 'Playfair Display', serif;
          font-style: italic; font-weight: 500;
          font-size: clamp(18px,2.2vw,22px);
          color: var(--color-accent); margin-bottom: 18px;
          letter-spacing: -0.005em; line-height: 1.3;
        }
        .ip-section-body {
          font-size: clamp(14px,1.7vw,16px); color: var(--color-muted);
          line-height: 1.8; max-width: 700px;
        }
        .ip-section-body strong { color: var(--color-dark); font-weight: 600; }
        .ip-divider { border: none; border-top: 1px solid rgba(0,0,0,.08); margin: 0; }

        /* Tag pills — tinted-bg style (matches Career Templates stage badges) */
        .ip-tag {
          display: inline-block; font-size: 10px; font-weight: 800;
          letter-spacing: .12em; text-transform: uppercase;
          padding: 4px 10px; border-radius: 999px;
          border: none;
        }
        .ip-tag--rec  { background: rgba(91,142,194,.14); color: var(--color-blue); }
        .ip-tag--beh  { background: rgba(58,125,107,.14); color: var(--color-teal); }
        .ip-tag--tech { background: rgba(232,168,56,.18); color: var(--color-gold-dark); }
        .ip-tag--case { background: rgba(22,43,68,.12);   color: var(--color-navy); }
        .ip-tag--ow   { background: rgba(0,0,0,.06);      color: var(--color-muted); }
        .ip-tag--fin  { background: rgba(179,69,57,.12);  color: var(--color-accent); }

        /* HERO */
        .ip-hero {
          max-width: 1040px; margin: 0 auto;
          padding: 120px clamp(20px,5vw,56px) 64px;
        }
        .ip-hero__kicker {
          font-size: 11px; font-weight: 700; letter-spacing: .14em;
          text-transform: uppercase; color: var(--color-muted); margin-bottom: 18px;
        }
        .ip-hero__title {
          font-family: var(--font-display);
          font-size: clamp(42px,7vw,80px); font-weight: 700;
          line-height: 1.04; color: var(--color-dark); margin-bottom: 14px;
        }
        .ip-hero__title em { font-family: 'Playfair Display', serif; font-style: italic; font-weight: 500; color: var(--color-accent); letter-spacing: -0.01em; }
        .ip-hero__sub {
          font-family: 'Playfair Display', serif;
          font-style: italic; font-weight: 500;
          font-size: clamp(20px,2.7vw,28px);
          color: var(--color-dark); line-height: 1.35;
          letter-spacing: -0.005em;
          max-width: 680px; margin-bottom: 24px;
        }
        .ip-hero__body {
          font-size: clamp(15px,1.8vw,17px); color: var(--color-muted);
          line-height: 1.8; max-width: 680px; margin-bottom: 40px;
        }
        .ip-hero__body strong { color: var(--color-dark); font-weight: 600; }
        .ip-jumps { display: flex; flex-direction: column; gap: 10px; }
        .ip-jump {
          display: inline-flex; align-items: center; gap: 10px;
          font-family: var(--font-display); font-size: 15px; font-weight: 600;
          color: var(--color-dark); text-decoration: none; transition: color .2s;
        }
        .ip-jump::before {
          content: '→'; color: var(--color-accent); font-weight: 700;
          transition: transform .2s cubic-bezier(.16,1,.3,1);
        }
        .ip-jump:hover { color: var(--color-accent); }
        .ip-jump:hover::before { transform: translateX(4px); }

        /* GRADE LEVEL */
        .ip-grade {
          max-width: 1040px; margin: 0 auto;
          padding: 80px clamp(20px,5vw,56px);
        }
        .ip-grade__head { margin-bottom: 40px; }
        .ip-grade__grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px,1fr));
          gap: 20px;
        }
        .ip-grade-card {
          --card-bg: var(--color-cream);
          --card-fg: var(--color-dark);
          --card-fg-strong: var(--color-dark);
          --card-fg-muted: rgba(26,25,22,.74);
          --card-divider: rgba(26,25,22,.18);
          background: var(--card-bg); color: var(--card-fg);
          border-radius: 14px; overflow: hidden;
          display: flex; flex-direction: column;
          transition: transform .22s cubic-bezier(.16,1,.3,1);
        }
        .ip-grade-card:hover { transform: translateY(-3px); }
        .ip-grade-card--fy {
          --card-bg: var(--color-teal);
          --card-fg: var(--color-cream);
          --card-fg-strong: var(--color-cream);
          --card-fg-muted: rgba(242,228,206,.78);
          --card-divider: rgba(242,228,206,.22);
        }
        .ip-grade-card--jr {
          --card-bg: var(--color-gold);
          --card-fg: var(--color-dark);
          --card-fg-strong: var(--color-dark);
          --card-fg-muted: rgba(26,25,22,.74);
          --card-divider: rgba(26,25,22,.22);
        }
        .ip-grade-card--sr {
          --card-bg: var(--color-navy);
          --card-fg: var(--color-cream);
          --card-fg-strong: var(--color-cream);
          --card-fg-muted: rgba(242,228,206,.78);
          --card-divider: rgba(242,228,206,.22);
        }
        .ip-grade-card--rg {
          --card-bg: var(--color-accent);
          --card-fg: var(--color-cream);
          --card-fg-strong: var(--color-cream);
          --card-fg-muted: rgba(242,228,206,.82);
          --card-divider: rgba(242,228,206,.22);
        }
        .ip-grade-card__inner { padding: 26px 24px; flex: 1; display: flex; flex-direction: column; }
        .ip-grade-card__label {
          font-size: 10px; font-weight: 700; letter-spacing: .12em;
          text-transform: uppercase; padding: 4px 10px; border-radius: 4px;
          color: var(--card-fg-strong); border: 1px solid var(--card-fg-strong);
          background: transparent;
          display: inline-block; align-self: flex-start; margin-bottom: 16px;
          opacity: .82;
        }
        .ip-grade-card__title {
          font-family: 'Playfair Display', serif;
          font-style: italic; font-weight: 600;
          font-size: clamp(19px,2.2vw,22px);
          color: var(--card-fg-strong); margin-bottom: 12px;
          letter-spacing: -0.005em; line-height: 1.25;
        }
        .ip-grade-card__body {
          font-size: 13px; color: var(--card-fg-muted); line-height: 1.75;
          margin-bottom: 22px; flex: 1;
        }
        .ip-grade-card__body strong { color: var(--card-fg-strong); font-weight: 600; }
        .ip-grade-card__resources { border-top: 1px solid var(--card-divider); padding-top: 18px; }
        .ip-grade-card__res-label {
          font-size: 10px; font-weight: 700; letter-spacing: .12em;
          text-transform: uppercase; color: var(--card-fg-muted); margin-bottom: 12px;
        }
        .ip-grade-card__res-list { display: flex; flex-direction: column; gap: 7px; }
        .ip-grade-card__res-item {
          display: flex; align-items: center; gap: 8px;
          font-size: 13px; color: var(--card-fg);
          text-decoration: none; font-weight: 500;
          transition: color .2s, transform .18s cubic-bezier(.16,1,.3,1);
          border-radius: 4px;
        }
        .ip-grade-card__res-item::before {
          content: '→'; font-size: 11px; font-weight: 700;
          color: var(--card-fg-strong); flex-shrink: 0;
          transition: transform .18s cubic-bezier(.16,1,.3,1);
        }
        .ip-grade-card__res-item:hover { color: var(--card-fg-strong); }
        .ip-grade-card__res-item:hover::before { transform: translateX(3px); }
        .ip-grade-card__res-item:focus-visible {
          outline: 2px solid currentColor; outline-offset: 3px;
        }

        /* INTERVIEW TYPES */
        .ip-types {
          background: var(--color-navy);
          padding: clamp(64px,8vw,96px) clamp(20px,5vw,56px);
        }
        .ip-types__inner { max-width: 1040px; margin: 0 auto; }
        .ip-types__kicker {
          font-size: 11px; font-weight: 700; letter-spacing: .14em;
          text-transform: uppercase; color: var(--color-gold); margin-bottom: 14px;
        }
        .ip-types__title {
          font-family: var(--font-display);
          font-size: clamp(28px,4.5vw,48px); font-weight: 700;
          color: var(--color-cream); margin-bottom: 10px;
        }
        .ip-types__sub {
          font-family: 'Playfair Display', serif;
          font-style: italic; font-weight: 500;
          font-size: clamp(18px,2.2vw,22px);
          color: rgba(232,168,56,.9); margin-bottom: 48px;
          letter-spacing: -0.005em; line-height: 1.3;
        }
        .ip-type-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 36px; }
        .ip-type-tab {
          padding: 10px 16px; border-radius: 14px; font-family: var(--font-body);
          cursor: pointer;
          border: 1.5px solid rgba(242,228,206,.2);
          background: transparent; color: rgba(242,228,206,.6);
          transition: background .2s, color .2s, border-color .2s, transform .22s cubic-bezier(.16,1,.3,1);
          display: inline-flex; flex-direction: column; align-items: flex-start;
          gap: 2px; text-align: left; min-width: 0;
        }
        .ip-type-tab:hover { color: var(--color-cream); border-color: rgba(242,228,206,.45); transform: translateY(-1px); }
        .ip-type-tab:active { transform: translateY(0); }
        .ip-type-tab__label { font-size: 13px; font-weight: 700; letter-spacing: -.005em; line-height: 1.2; }
        .ip-type-tab__desc { font-size: 10.5px; font-weight: 500; opacity: .72; line-height: 1.2; letter-spacing: .005em; }
        .ip-type-tab--active .ip-type-tab__desc { opacity: .85; }
        /* Default active fallback — overridden by type-tinted variants below */
        .ip-type-tab--active { background: var(--color-cream); color: var(--color-dark); border-color: var(--color-cream); }
        /* Type-tinted active states — each interview type gets its own brand color when active */
        .ip-type-tab--active.ip-type-tab--rec  { background: var(--color-blue);      color: var(--color-cream); border-color: var(--color-blue); }
        .ip-type-tab--active.ip-type-tab--beh  { background: var(--color-teal);      color: var(--color-cream); border-color: var(--color-teal); }
        .ip-type-tab--active.ip-type-tab--tech { background: var(--color-gold-dark); color: var(--color-cream); border-color: var(--color-gold-dark); }
        .ip-type-tab--active.ip-type-tab--case { background: var(--color-navy);      color: var(--color-cream); border-color: var(--color-navy); }
        .ip-type-tab--active.ip-type-tab--ow   { background: var(--color-cream);     color: var(--color-dark);  border-color: var(--color-cream); }
        .ip-type-tab--active.ip-type-tab--fin  { background: var(--color-accent);    color: var(--color-cream); border-color: var(--color-accent); }
        .ip-type-tab:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 2px; border-radius: 14px; }
        @media (prefers-reduced-motion: reduce) {
          .ip-type-tab { transition: none !important; }
          .ip-type-tab:hover { transform: none !important; }
        }
        .ip-type-panel__inner {
          display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: start;
        }
        .ip-type-panel__desc {
          font-size: clamp(14px,1.7vw,16px); color: rgba(242,228,206,.7); line-height: 1.8;
        }
        .ip-type-panel__desc strong { color: var(--color-cream); font-weight: 600; }
        .ip-type-panel__res-label {
          font-size: 10px; font-weight: 700; letter-spacing: .12em;
          text-transform: uppercase; color: var(--color-gold); margin-bottom: 12px;
        }
        .ip-type-panel__res-list { display: flex; flex-direction: column; gap: 8px; }
        .ip-type-panel__res {
          display: flex; align-items: center; gap: 10px;
          padding: 11px 14px; border-radius: 8px;
          background: rgba(255,255,255,.06); border: 1px solid rgba(242,228,206,.1);
          font-size: 13px; font-weight: 500; color: var(--color-cream);
          text-decoration: none; transition: background .2s, border-color .2s;
        }
        .ip-type-panel__res:hover { background: rgba(255,255,255,.1); border-color: rgba(242,228,206,.25); }
        .ip-type-panel__res::before {
          content: '→'; color: var(--color-gold); font-weight: 700;
          flex-shrink: 0; font-size: 11px;
          transition: transform .18s cubic-bezier(.16,1,.3,1);
        }
        .ip-type-panel__res:hover::before { transform: translateX(3px); }

        /* RESOURCE LIBRARY */
        .ip-library {
          max-width: 1040px; margin: 0 auto;
          padding: 80px clamp(20px,5vw,56px);
        }
        .ip-library__head { margin-bottom: 36px; }
        .ip-library__grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(290px,1fr));
          gap: 18px;
        }
        .ip-res-card {
          background: linear-gradient(180deg, rgba(255,250,242,.85) 0%, rgba(255,250,242,.55) 100%);
          border: 1px solid rgba(26,25,22,.13);
          border-radius: 14px;
          padding: 24px;
          display: flex; flex-direction: column; gap: 0;
          box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 4px 12px -6px rgba(63,42,28,.12);
          transition: transform .28s cubic-bezier(.16,1,.3,1), box-shadow .28s, border-color .28s;
        }
        .ip-res-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 16px 36px -12px rgba(63,42,28,.22);
          border-color: rgba(26,25,22,.22);
        }
        .ip-res-card:nth-child(3n+2) {
          background: linear-gradient(180deg, rgba(232,168,56,.07) 0%, rgba(255,250,242,.55) 60%);
          border-color: rgba(232,168,56,.26);
        }
        .ip-res-card:nth-child(3n+3) {
          background: linear-gradient(180deg, rgba(58,125,107,.07) 0%, rgba(255,250,242,.55) 60%);
          border-color: rgba(58,125,107,.22);
        }
        .ip-res-card__num {
          font-family: 'Playfair Display', serif;
          font-style: italic; font-weight: 600;
          font-size: 15px;
          color: rgba(232,168,56,.7);
          letter-spacing: -0.005em;
          font-variant-numeric: tabular-nums;
          margin-bottom: 12px;
          align-self: flex-start;
        }
        .ip-res-card__name {
          font-family: 'Playfair Display', serif;
          font-style: italic; font-weight: 600;
          font-size: clamp(17px,2vw,20px);
          color: var(--color-dark); line-height: 1.25;
          letter-spacing: -0.005em;
          margin-bottom: 12px;
        }
        .ip-res-card__desc {
          font-size: 13px; color: var(--color-muted); line-height: 1.7;
          flex: 1; margin-bottom: 16px;
        }
        .ip-res-card__tags-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px; }
        .ip-res-card__tag-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
        .ip-res-card__tag-label {
          font-size: 10px; font-weight: 700; letter-spacing: .12em;
          text-transform: uppercase; color: var(--color-muted); margin-right: 4px; flex-shrink: 0;
        }
        /* Dual CTA layout (matches Career Templates) */
        .ip-res-card__actions {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
          margin-top: auto;
        }
        .ip-res-card__cta-primary {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 10px 18px; border-radius: 999px;
          font-family: var(--font-display);
          font-size: 12px; font-weight: 700; letter-spacing: -.005em;
          text-decoration: none; cursor: pointer;
          background: transparent;
          color: var(--color-dark);
          border: 1.5px solid rgba(26,25,22,.5);
          transition: background .25s, color .25s, transform .22s cubic-bezier(.16,1,.3,1), box-shadow .25s, border-color .25s;
        }
        .ip-res-card__cta-primary:hover {
          background: var(--color-dark); color: var(--color-cream);
          border-color: var(--color-dark);
          transform: translateY(-1px);
          box-shadow: 0 8px 16px -8px rgba(26,25,22,.4);
        }
        .ip-res-card__cta-primary:focus-visible {
          outline: 2px solid var(--color-gold); outline-offset: 3px;
        }
        .ip-res-card__cta-secondary {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 10px 14px; border-radius: 999px;
          font-family: var(--font-display);
          font-size: 12px; font-weight: 700; letter-spacing: -.005em;
          text-decoration: none; cursor: pointer;
          background: transparent;
          border: 1.5px solid rgba(26,25,22,.18);
          color: var(--color-muted);
          transition: color .25s, border-color .25s, background .25s, transform .22s cubic-bezier(.16,1,.3,1);
        }
        .ip-res-card__cta-secondary:hover {
          color: var(--color-dark);
          border-color: rgba(26,25,22,.32);
          background: rgba(26,25,22,.04);
          transform: translateY(-1px);
        }
        .ip-res-card__cta-secondary:focus-visible {
          outline: 2px solid var(--color-accent); outline-offset: 3px;
        }

        /* SUGGESTED PATHS */
        .ip-paths-wrap {
          background: color-mix(in oklch, var(--color-cream) 95%, var(--color-teal) 5%);
        }
        .ip-paths {
          max-width: 1040px; margin: 0 auto;
          padding: 80px clamp(20px,5vw,56px);
        }
        .ip-paths__head { margin-bottom: 36px; }
        .ip-paths__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .ip-path-card {
          background: var(--color-cream); border: 1.5px solid rgba(26,25,22,.16);
          border-radius: 14px; padding: 28px;
          transition: border-color .2s;
        }
        .ip-path-card:hover { border-color: rgba(26,25,22,.32); }
        .ip-path-card__num {
          font-family: 'Playfair Display', serif;
          font-style: italic; font-weight: 600;
          font-size: 38px;
          color: rgba(232,168,56,.65);
          line-height: 1; margin-bottom: 10px;
          letter-spacing: -0.01em;
        }
        .ip-path-card__trigger {
          font-family: 'Playfair Display', serif;
          font-style: italic; font-weight: 500;
          font-size: clamp(16px,1.9vw,18px);
          color: var(--color-dark);
          border-bottom: 1px solid rgba(26,25,22,.14);
          padding-bottom: 16px; margin-bottom: 18px; line-height: 1.4;
          letter-spacing: -0.005em;
        }
        .ip-path-card__list { display: flex; flex-direction: column; gap: 8px; }
        .ip-path-card__item {
          display: flex; align-items: flex-start; gap: 8px;
          font-size: 14px; color: var(--color-dark);
          text-decoration: none; font-weight: 500; transition: color .2s;
          border-radius: 4px;
        }
        .ip-path-card__item::before {
          content: '→'; font-size: 11px; font-weight: 700;
          color: var(--color-accent); flex-shrink: 0; margin-top: 2px;
          transition: transform .18s cubic-bezier(.16,1,.3,1);
        }
        .ip-path-card__item:hover { color: var(--color-accent); }
        .ip-path-card__item:hover::before { transform: translateX(3px); }
        .ip-path-card__item:focus-visible {
          outline: 2px solid var(--color-gold); outline-offset: 3px;
        }

        /* ECOSYSTEM */
        .ip-eco {
          background: var(--color-navy);
          padding: clamp(48px,6vw,80px) clamp(20px,5vw,56px);
        }
        .ip-eco__inner {
          max-width: 1040px; margin: 0 auto;
          display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: start;
        }
        .ip-eco__kicker {
          font-size: 11px; font-weight: 700; letter-spacing: .14em;
          text-transform: uppercase; color: var(--color-gold); margin-bottom: 14px;
        }
        .ip-eco__title {
          font-family: var(--font-display); font-size: clamp(22px,3vw,32px);
          font-weight: 700; color: var(--color-cream); margin-bottom: 16px;
        }
        .ip-eco__body {
          font-size: clamp(14px,1.7vw,16px); color: rgba(242,228,206,.65); line-height: 1.8;
        }
        .ip-eco__body strong { color: var(--color-cream); font-weight: 600; }
        .ip-eco__links { display: flex; flex-direction: column; gap: 12px; margin-top: 4px; }
        .ip-eco__link {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 16px 18px; border-radius: 10px;
          background: rgba(255,255,255,.06); border: 1px solid rgba(242,228,206,.1);
          text-decoration: none; transition: background .2s, border-color .2s;
        }
        .ip-eco__link:hover { background: rgba(255,255,255,.1); border-color: rgba(242,228,206,.22); }
        .ip-eco__link-icon {
          font-family: var(--font-display); font-size: 20px; font-weight: 700;
          color: var(--color-gold); flex-shrink: 0; line-height: 1; margin-top: 1px;
        }
        .ip-eco__link-title {
          font-family: var(--font-display); font-size: 14px; font-weight: 600;
          color: var(--color-cream); margin-bottom: 3px;
        }
        .ip-eco__link-desc { font-size: 12px; color: rgba(242,228,206,.55); line-height: 1.5; }

        /* REQUEST FORM */
        .ip-form-wrap {
          max-width: 1040px; margin: 0 auto;
          padding: 80px clamp(20px,5vw,56px) 100px;
        }
        .ip-form-box {
          background: var(--color-cream); border: 1.5px solid rgba(179,69,57,.22);
          border-radius: 16px; padding: clamp(32px,4vw,52px); max-width: 680px;
        }
        .ip-form-box__kicker {
          font-size: 11px; font-weight: 700; letter-spacing: .14em;
          text-transform: uppercase; color: var(--color-muted); margin-bottom: 12px;
        }
        .ip-form-box__title {
          font-family: 'Playfair Display', serif;
          font-style: italic; font-weight: 600;
          font-size: clamp(24px,3.2vw,32px);
          color: var(--color-dark); margin-bottom: 10px;
          letter-spacing: -0.01em; line-height: 1.2;
        }
        .ip-form-box__sub { font-size: 15px; color: var(--color-muted); line-height: 1.7; margin-bottom: 28px; }
        .ip-form-row { margin-bottom: 16px; }
        .ip-form-label {
          display: block; font-size: 12px; font-weight: 700;
          text-transform: uppercase; letter-spacing: .08em;
          color: var(--color-muted); margin-bottom: 6px;
        }
        .ip-form-input,
        .ip-form-select,
        .ip-form-textarea {
          width: 100%; font-family: var(--font-body); font-size: 15px;
          padding: 12px 14px; border: 1.5px solid rgba(26,25,22,.18);
          border-radius: 8px; background: rgba(26,25,22,.04);
          color: var(--color-dark); outline: none; transition: border-color .2s, background .2s;
          box-sizing: border-box;
        }
        .ip-form-input:focus,
        .ip-form-select:focus,
        .ip-form-textarea:focus {
          background: rgba(26,25,22,.02);
        }
        .ip-form-textarea { min-height: 90px; resize: vertical; line-height: 1.55; }
        .ip-form-input:focus,
        .ip-form-select:focus,
        .ip-form-textarea:focus { border-color: var(--color-gold); }
        .ip-form-select { appearance: none; cursor: pointer; }
        .ip-form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
        .ip-form-btn {
          margin-top: 6px; padding: 13px 28px; background: var(--color-dark);
          color: var(--color-cream); border: none; border-radius: 8px;
          font-family: var(--font-display); font-size: 14px; font-weight: 600;
          cursor: pointer; transition: background .2s, transform .18s;
        }
        .ip-form-btn:hover { background: var(--color-accent); transform: translateY(-1px); }
        .ip-form-success { text-align: center; padding: 32px 0; }
        .ip-form-success h3 {
          font-family: 'Playfair Display', serif;
          font-style: italic; font-weight: 600;
          font-size: clamp(22px,2.6vw,26px);
          color: var(--color-dark); margin-bottom: 10px;
          letter-spacing: -0.005em;
        }
        .ip-form-success p {
          font-size: 15px; color: var(--color-muted); line-height: 1.7;
          margin-bottom: 22px;
        }
        .ip-form-success__cta {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 11px 22px; border-radius: 999px;
          border: 1.5px solid var(--color-dark);
          color: var(--color-dark);
          font-family: var(--font-display);
          font-size: 13px; font-weight: 600; letter-spacing: .01em;
          text-decoration: none;
          transition: background .2s, color .2s, transform .18s cubic-bezier(.16,1,.3,1);
        }
        .ip-form-success__cta:hover {
          background: var(--color-dark); color: var(--color-cream);
          transform: translateY(-2px);
        }
        .ip-form-success__cta:focus-visible {
          outline: 2px solid var(--color-gold); outline-offset: 3px;
        }


        /* Focus-visible (a11y pass) */
        .ip-form-input:focus-visible,
        .ip-form-select:focus-visible,
        .ip-form-textarea:focus-visible {
          outline: 2px solid var(--color-gold); outline-offset: 2px;
        }
        .ip-jump:focus-visible {
          outline: 2px solid var(--color-dark); outline-offset: 3px; border-radius: 3px;
        }
        .ip-eco__link:focus-visible {
          outline: 2px solid var(--color-gold); outline-offset: 3px; border-radius: 10px;
        }
        .ip-type-panel__res:focus-visible {
          outline: 2px solid var(--color-gold); outline-offset: 3px; border-radius: 8px;
        }
        .ip-form-btn:focus-visible {
          outline: 2px solid var(--color-gold); outline-offset: 3px;
        }

        /* PREVIEW MODAL (lifted from Career Templates) */
        .ip-modal-overlay {
          position: fixed; inset: 0;
          background: rgba(26,25,22,.7);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 500;
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          opacity: 0; pointer-events: none;
          transition: opacity .2s;
        }
        .ip-modal-overlay.open { opacity: 1; pointer-events: all; }
        .ip-modal {
          background: var(--color-cream);
          border-radius: 18px;
          padding: 36px clamp(24px, 4vw, 40px) 32px;
          max-width: 580px; width: 100%;
          max-height: 85vh; overflow-y: auto;
          transform: translateY(12px);
          transition: transform .3s cubic-bezier(.16,1,.3,1);
          position: relative;
          overflow-x: hidden;
          box-shadow: 0 36px 72px -24px rgba(26,25,22,.5), 0 0 0 1px rgba(26,25,22,.06);
        }
        /* Earthenware brand stripe — matches CT + BY modals for cross-page consistency */
        .ip-modal::before {
          content: '';
          position: absolute;
          left: 0; right: 0; top: 0;
          height: 4px;
          background: linear-gradient(90deg,
            var(--color-accent) 0%, var(--color-accent) 38%,
            var(--color-gold) 38%, var(--color-gold) 62%,
            var(--color-teal) 62%, var(--color-teal) 100%);
          border-radius: 18px 18px 0 0;
        }
        .ip-modal-overlay.open .ip-modal { transform: translateY(0); }
        .ip-modal__close {
          position: absolute; top: 14px; right: 14px;
          min-width: 44px; min-height: 44px;
          border-radius: 50%; border: none;
          background: rgba(26,25,22,.06);
          color: var(--color-muted);
          font-size: 16px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background .15s, color .15s;
        }
        .ip-modal__close:hover { background: rgba(179,69,57,.1); color: var(--color-accent); }
        .ip-modal__close:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 2px; }
        .ip-modal__num {
          font-family: 'Playfair Display', serif;
          font-style: italic; font-weight: 600;
          font-size: 15px;
          color: rgba(232,168,56,.7);
          font-variant-numeric: tabular-nums;
          margin-bottom: 10px;
        }
        .ip-modal__badges { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
        .ip-modal__title {
          font-family: 'Playfair Display', serif;
          font-style: italic; font-weight: 600;
          font-size: clamp(24px,3.2vw,32px);
          color: var(--color-dark);
          margin-bottom: 14px;
          line-height: 1.2;
          letter-spacing: -0.01em;
          max-width: 24ch;
        }
        .ip-modal__desc {
          font-size: 15px; color: var(--color-muted);
          line-height: 1.7; margin-bottom: 22px;
          max-width: 52ch;
        }
        .ip-modal__cta {
          display: inline-flex; align-items: center; justify-content: center;
          gap: 8px; width: 100%;
          padding: 13px;
          background: var(--color-dark); color: var(--color-cream);
          border: none; border-radius: 999px;
          font-family: var(--font-display);
          font-size: 13px; font-weight: 700; letter-spacing: -.005em;
          text-decoration: none; cursor: pointer;
          box-shadow: 0 8px 20px -10px rgba(26,25,22,.4), inset 0 1px 0 rgba(255,255,255,.08);
          transition: background .25s, transform .22s cubic-bezier(.16,1,.3,1), box-shadow .25s;
        }
        .ip-modal__cta:hover { background: var(--color-accent); transform: translateY(-1px); }
        .ip-modal__cta:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 3px; }

                /* CLOSING BEAT */
        .ip-closing {
          background: var(--color-accent);
          padding: clamp(72px,9vw,112px) clamp(20px,5vw,56px);
          position: relative; overflow: hidden;
        }
        .ip-closing__inner {
          max-width: 760px; margin: 0 auto;
          text-align: center; position: relative;
        }
        .ip-closing__mark {
          display: inline-block;
          font-size: clamp(32px,4.5vw,48px);
          color: var(--color-gold);
          transform: rotate(-12deg);
          margin-bottom: 22px;
          line-height: 1;
        }
        .ip-closing__title {
          font-family: 'Playfair Display', serif;
          font-style: italic; font-weight: 600;
          color: var(--color-cream);
          font-size: clamp(28px,4.5vw,46px);
          line-height: 1.2;
          letter-spacing: -0.01em;
          margin-bottom: 22px;
          max-width: 720px; margin-inline: auto;
        }
        .ip-closing__body {
          font-family: var(--font-body);
          font-size: clamp(15px,1.8vw,17px);
          line-height: 1.75;
          color: rgba(242,228,206,.85);
          margin-bottom: 32px;
          max-width: 620px; margin-inline: auto;
        }
        .ip-closing__body strong {
          color: var(--color-gold);
          font-weight: 600;
        }
        .ip-closing__cta {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 14px 30px;
          border: 1.5px solid var(--color-cream);
          border-radius: 999px;
          color: var(--color-cream);
          text-decoration: none;
          font-family: var(--font-display);
          font-size: 14px; font-weight: 600;
          letter-spacing: .01em;
          transition: background .2s, color .2s, transform .18s cubic-bezier(.16,1,.3,1);
        }
        .ip-closing__cta:hover {
          background: var(--color-cream);
          color: var(--color-accent);
          transform: translateY(-2px);
        }
        .ip-closing__cta:focus-visible {
          outline: 2px solid var(--color-gold); outline-offset: 3px;
        }

        @media (max-width: 768px) {
          .ip-hero { padding: 88px 20px 48px; }
          .ip-grade, .ip-library, .ip-paths, .ip-form-wrap { padding-top: 48px; padding-bottom: 48px; }
          .ip-type-tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; flex-wrap: nowrap; padding-bottom: 4px; }
          .ip-type-tab { flex-shrink: 0; }
        }
        @media (max-width: 640px) {
          .ip-type-panel__inner { grid-template-columns: 1fr; gap: 24px; }
          .ip-paths__grid { grid-template-columns: 1fr; }
          .ip-eco__inner { grid-template-columns: 1fr; }
        }
        @media (max-width: 500px) {
          .ip-form-row-2 { grid-template-columns: 1fr; }
          .ip-grade__grid { grid-template-columns: 1fr; }
          .ip-library__grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 480px) {
          .ip-hero { padding: 80px 16px 40px; }
        }
      `}</style>

      {/* HERO */}
      <header className="ip-hero" id="top">
        <p className="ip-hero__kicker">{t.heroKicker}</p>
        <h1 className="ip-hero__title">{t.heroTitle} <em>{t.heroTitleEm}</em></h1>
        <p className="ip-hero__sub">{t.heroSub}</p>
        <p className="ip-hero__body" dangerouslySetInnerHTML={{ __html: t.heroBody }} />
        <nav className="ip-jumps" aria-label={t.heroJumpsAriaLabel}>
          <a href="#by-grade" className="ip-jump">{t.heroJump1}</a>
          <a href="#by-type" className="ip-jump">{t.heroJump2}</a>
          <a href="#resources" className="ip-jump">{t.heroJump3}</a>
          <a href="#paths" className="ip-jump">{t.heroJump4}</a>
        </nav>
      </header>

      {/* S1: GRADE LEVEL */}
      <section className="ip-grade" id="by-grade">
        <div className="ip-grade__head">
          <h2 className="ip-section-title">{t.gradeTitle}</h2>
          <p className="ip-section-sub">{t.gradeSub}</p>
          <p className="ip-section-body">{t.gradeBody}</p>
        </div>
        <div className="ip-grade__grid">
          {t.gradeCards.map(card => (
            <div className={`ip-grade-card ip-grade-card--${card.bar}`} key={card.bar}>
              <div className="ip-grade-card__inner">
                <span className="ip-grade-card__label">{card.label}</span>
                <h3 className="ip-grade-card__title">{card.title}</h3>
                <p className="ip-grade-card__body" dangerouslySetInnerHTML={{ __html: card.body }} />
                <div className="ip-grade-card__resources">
                  <p className="ip-grade-card__res-label">{t.gradeResLabel}</p>
                  <div className="ip-grade-card__res-list">
                    {card.resources.map(r => (
                      <Link key={r.label} to={r.to} className="ip-grade-card__res-item">{r.label}</Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* S2: INTERVIEW TYPES */}
      <section className="ip-types" id="by-type">
        <div className="ip-types__inner">
          <h2 className="ip-types__title">{t.typesTitle}</h2>
          <p className="ip-types__sub">{t.typesSub}</p>

          <div className="ip-type-tabs" role="tablist" aria-label={t.typesTabsAriaLabel} ref={tabsRef} onKeyDown={e => {
            const KEYS = t.interviewTypes.map(it => it.key)
            const idx = KEYS.indexOf(activeTab)
            let next = null
            if (e.key === 'ArrowRight') { e.preventDefault(); next = KEYS[(idx + 1) % KEYS.length] }
            if (e.key === 'ArrowLeft')  { e.preventDefault(); next = KEYS[(idx - 1 + KEYS.length) % KEYS.length] }
            if (e.key === 'Home')       { e.preventDefault(); next = KEYS[0] }
            if (e.key === 'End')        { e.preventDefault(); next = KEYS[KEYS.length - 1] }
            if (next) { setActiveTab(next); setTimeout(() => document.getElementById(`ip-tab-${next}`)?.focus(), 0) }
          }}>
            {t.interviewTypes.map(it => (
              <button
                key={it.key}
                id={`ip-tab-${it.key}`}
                className={`ip-type-tab${activeTab === it.key ? ' ip-type-tab--active' : ''}${it.type ? ` ip-type-tab--${it.type}` : ''}`}
                role="tab"
                aria-selected={activeTab === it.key}
                tabIndex={activeTab === it.key ? 0 : -1}
                onClick={() => setActiveTab(it.key)}
              >
                <span className="ip-type-tab__label">{it.label}</span>
                {it.description && <span className="ip-type-tab__desc">{it.description}</span>}
              </button>
            ))}
          </div>

          {activePanel && (
            <div className="ip-type-panel__inner" role="tabpanel" aria-labelledby={`ip-tab-${activeTab}`} aria-live="polite">
              <div className="ip-type-panel__desc" dangerouslySetInnerHTML={{ __html: `<p>${activePanel.desc}</p>` }} />
              <div>
                <p className="ip-type-panel__res-label">{t.typesResLabel}</p>
                <div className="ip-type-panel__res-list">
                  {activePanel.resources.map(res => (
                    <Link key={res} to="/career-templates" className="ip-type-panel__res">{res}</Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* S3: RESOURCE LIBRARY */}
      <section className="ip-library" id="resources">
        <div className="ip-library__head">
          <h2 className="ip-section-title">{t.libraryTitle}</h2>
          <p className="ip-section-sub">{t.librarySub}</p>
        </div>
        <div className="ip-library__grid">
          {t.resourceCards.map((card, i) => (
            <div className="ip-res-card" key={card.name}>
              <span className="ip-res-card__num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="ip-res-card__name">{card.name}</h3>
              <p className="ip-res-card__desc">{card.desc}</p>
              <div className="ip-res-card__tags-group">
                <div className="ip-res-card__tag-row">
                  <span className="ip-res-card__tag-label">{t.libraryRoundLabel}</span>
                  {card.roundTags.map(tag => (
                    <span key={tag.label} className={`ip-tag ip-tag--${tag.type}`}>{tag.label}</span>
                  ))}
                </div>
              </div>
              <div className="ip-res-card__actions">
                <Link to="/career-templates" className="ip-res-card__cta-primary">
                  {card.ctaLabel}
                </Link>
                <button
                  type="button"
                  className="ip-res-card__cta-secondary"
                  onClick={e => openPreview(i, e)}
                  aria-haspopup="dialog"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  {t.libraryPreviewLabel}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* S4: SUGGESTED PATHS */}
      <div className="ip-paths-wrap">
      <section className="ip-paths" id="paths">
        <div className="ip-paths__head">
          <h2 className="ip-section-title">{t.pathsTitle}</h2>
          <p className="ip-section-sub">{t.pathsSub}</p>
          <p className="ip-section-body">{t.pathsBody}</p>
        </div>
        <div className="ip-paths__grid">
          {t.suggestedPaths.map(path => (
            <div className="ip-path-card" key={path.num}>
              <div className="ip-path-card__num">{path.num}</div>
              <p className="ip-path-card__trigger">{path.trigger}</p>
              <div className="ip-path-card__list">
                {path.items.map(item => (
                  <Link key={item.label} to={item.to} className="ip-path-card__item">{item.label}</Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      </div>

      {/* S5: ECOSYSTEM */}
      <section className="ip-eco" id="ecosystem">
        <div className="ip-eco__inner">
          <div>
            <p className="ip-eco__kicker">{t.ecoKicker}</p>
            <h2 className="ip-eco__title">{t.ecoTitle}</h2>
            <p className="ip-eco__body" dangerouslySetInnerHTML={{ __html: t.ecoBody }} />
          </div>
          <div className="ip-eco__links">
            {t.ecoLinks.map(link => (
              <Link key={link.num} to={link.to} className="ip-eco__link">
                <span className="ip-eco__link-icon">{link.num}</span>
                <div>
                  <p className="ip-eco__link-title">{link.title}</p>
                  <p className="ip-eco__link-desc">{link.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* S6: REQUEST FORM */}
      <section className="ip-form-wrap" id="request">
        <div className="ip-form-box">
          <p className="ip-form-box__kicker">{t.formKicker}</p>
          <h2 className="ip-form-box__title">{t.formTitle}</h2>
          <p className="ip-form-box__sub">{t.formSub}</p>

          {formSubmitted ? (
            <div className="ip-form-success">
              <h3>{t.formSuccessTitle}</h3>
              <p>{t.formSuccessBody}</p>
              <Link to={t.formSuccessCtaTo} className="ip-form-success__cta">{t.formSuccessCta}</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="ip-form-row">
                <label className="ip-form-label" htmlFor="ipRole">{t.formLabelRole}</label>
                <input className="ip-form-input" type="text" id="ipRole" placeholder={t.formPlaceholderRole} value={form.role} onChange={e => setField('role', e.target.value)} />
              </div>
              <div className="ip-form-row-2">
                <div>
                  <label className="ip-form-label" htmlFor="ipStage">{t.formLabelStage}</label>
                  <select className="ip-form-select" id="ipStage" value={form.stage} onChange={e => setField('stage', e.target.value)}>
                    <option value="">{t.formSelectStage}</option>
                    {t.formStageOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="ip-form-label" htmlFor="ipType">{t.formLabelType}</label>
                  <select className="ip-form-select" id="ipType" value={form.type} onChange={e => setField('type', e.target.value)}>
                    <option value="">{t.formSelectType}</option>
                    {t.formTypeOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="ip-form-row">
                <label className="ip-form-label" htmlFor="ipNeed">{t.formLabelNeed}</label>
                <textarea className="ip-form-textarea" id="ipNeed" placeholder={t.formPlaceholderNeed} value={form.need} onChange={e => setField('need', e.target.value)} />
              </div>
              <div className="ip-form-row">
                <label className="ip-form-label" htmlFor="ipEmail">{t.formLabelEmail}</label>
                <input className="ip-form-input" type="email" id="ipEmail" placeholder={t.formPlaceholderEmail} value={form.email} onChange={e => setField('email', e.target.value)} />
              </div>
              {formError && <p role="alert" style={{ color: 'var(--color-accent)', fontSize: '13px', marginBottom: '10px' }}>{formError}</p>}
              <Turnstile onToken={setTurnstileToken} resetRef={turnstileReset} />
              <button className="ip-form-btn" type="submit" disabled={formLoading || !form.role.trim() || (TURNSTILE_ENABLED && !turnstileToken)}>{formLoading ? t.formSubmitting : t.formSubmit}</button>
            </form>
          )}
        </div>
      </section>

      {/* CLOSING BEAT */}
      <section className="ip-closing">
        <div className="ip-closing__inner">
          <span className="ip-closing__mark" aria-hidden="true">✦</span>
          <h2 className="ip-closing__title">{t.closingTitle}</h2>
          <p className="ip-closing__body" dangerouslySetInnerHTML={{ __html: t.closingBody }} />
          <Link to={t.closingCtaTo} className="ip-closing__cta">{t.closingCta}</Link>
        </div>
      </section>

      {/* PREVIEW MODAL */}
      <div
        className={`ip-modal-overlay${previewIndex != null ? ' open' : ''}`}
        onClick={closePreview}
        aria-hidden={previewIndex == null}
      >
        {(() => {
          const card = previewIndex != null ? t.resourceCards[previewIndex] : null
          if (!card) return null
          return (
            <div
              className="ip-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ip-modal-title"
              onClick={e => e.stopPropagation()}
            >
              <button
                type="button"
                className="ip-modal__close"
                onClick={closePreview}
                aria-label={t.previewModalCloseLabel}
              >✕</button>
              <div className="ip-modal__num">{String(previewIndex + 1).padStart(2, '0')}</div>
              <div className="ip-modal__badges">
                {card.roundTags.map(tag => (
                  <span key={tag.label} className={`ip-tag ip-tag--${tag.type}`}>{tag.label}</span>
                ))}
              </div>
              <h2 id="ip-modal-title" className="ip-modal__title">{card.name}</h2>
              <p className="ip-modal__desc">{card.desc}</p>
              <Link to="/career-templates" className="ip-modal__cta" onClick={closePreview}>
                {card.ctaLabel}
              </Link>
            </div>
          )
        })()}
      </div>

      {/* FOOTER */}
      <footer className="art-footer art-footer--wide">
        <span className="art-footer__copy">{t.footerCopy}</span>
        <div className="art-footer__links">
          <Link to="/" className="art-footer__link">{t.footerHome}</Link>
          <Link to="/articles" className="art-footer__link">{t.footerLaVoz}</Link>
          <Link to="/career-templates" className="art-footer__link">{t.footerTemplates}</Link>
          <Link to="/bridge-year" className="art-footer__link">{t.footerBridgeYear}</Link>
        </div>
      </footer>
    </ArticleLayout>
  )
}
