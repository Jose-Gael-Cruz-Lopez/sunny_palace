import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ArticleLayout from '../components/ArticleLayout'
import { supabase } from '../lib/supabase'
import { useT } from '../hooks/useT'
import { safeHttpUrl } from '../lib/safeUrl'
import { OPPORTUNITIES, ARCHIVED_OPPORTUNITIES } from '../data/opportunities'
import Turnstile, { TURNSTILE_ENABLED } from '../components/Turnstile'

const TAB_KEYS = ['all', 'internship', 'research', 'program', 'scholarship']

function matchCard(card, { tab, query, stage, location, deadline }) {
  if (tab !== 'all') {
    if (!card.type.includes(tab)) return false
  }
  if (query) {
    const hay = (card.keywords + ' ' + card.title + ' ' + card.company).toLowerCase()
    if (!hay.includes(query)) return false
  }
  // Community (DB) opportunities may lack stage/location metadata. Treat an unknown (empty)
  // value as "passes" so an active filter narrows the cards that DO have data instead of
  // silently hiding every community submission.
  if (stage && card.stage && !card.stage.includes(stage)) return false
  if (location && card.location && !card.location.includes(location)) return false
  if (deadline && card.deadline && !card.deadline.includes(deadline)) return false
  return true
}

function dbOpportunityToCard(row, t) {
  const abbr = row.company.replace(/\s+/g, '').slice(0, 2).toUpperCase() || '??'
  const typeKey = (row.role_type || '').toLowerCase()
  const tagTypeMap = {
    internship: 'ob-tag--intern', apprenticeship: 'ob-tag--apprent',
    'new grad': 'ob-tag--newgrad', fellowship: 'ob-tag--fellowship',
    program: 'ob-tag--program', scholarship: 'ob-tag--program',
  }
  let deadlineLabel = t.deadlineRolling, deadlineCls = 'rolling', deadlineFilter = 'rolling'
  if (row.deadline) {
    const d = new Date(row.deadline)
    const diffDays = (d - new Date()) / 86400000
    deadlineLabel = `${t.deadlineCloses} ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

    if (diffDays < 0) {
      deadlineLabel = t.deadlineClosed
      deadlineCls = 'closed'
      deadlineFilter = 'closed'
    } else {
      deadlineCls = diffDays < 30 ? 'urgent' : ''
      deadlineFilter = diffDays < 7 ? 'this-week this-month' : diffDays < 30 ? 'this-month' : 'rolling'
    }
  }
  const tags = [{ l: row.role_type || 'Opportunity', c: tagTypeMap[typeKey] || 'ob-tag--muted' }]
  if (row.eligibility) tags.push({ l: row.eligibility, c: 'ob-tag--muted' })
  return {
    id: row.id, logo: abbr, logoStyle: {},
    deadlineLabel, deadlineCls,
    title: row.role, company: row.company,
    tags, meta: [...(row.location ? [row.location] : []), ...(row.pay ? [row.pay] : [])], desc: row.why || '',
    source: t.cardCommunitySource,
    viewLink: row.link, postLink: row.link, postLabel: t.cardViewRole,
    type: typeKey, stage: '', location: /remote/i.test(row.location || '') ? 'remote' : '', deadline: deadlineFilter,
    keywords: `${row.role} ${row.company} ${row.eligibility || ''}`.toLowerCase(),
    _featured: row.status === 'featured',
  }
}

// One color per opportunity type, so logo + tag + tint + CTA all agree per card
// (mirrors the Templates card system). Replaces the old per-item random logo colors.
const LOGO_TINT = {
  scholarship: { background: 'rgba(232,168,56,.16)', color: 'var(--color-gold-dark)' },
  program: { background: 'rgba(179,69,57,.1)', color: 'var(--color-accent)' },
  internship: { background: 'rgba(22,43,68,.1)', color: 'var(--color-navy)' },
  research: { background: 'rgba(58,125,107,.12)', color: 'var(--color-teal)' },
  fellowship: { background: 'rgba(58,125,107,.12)', color: 'var(--color-teal)' },
}
function OBCard({ card, featured, t, idx = 0 }) {
  const safePost = safeHttpUrl(card.postLink)
  const safeView = safeHttpUrl(card.viewLink)
  const typeKey = (card.type || '').split(' ')[0]
  const logoStyle = LOGO_TINT[typeKey] || card.logoStyle || {}
  return (
    <article className={`ob-card${typeKey ? ' ob-card--' + typeKey : ''}${featured ? ' featured' : ''}`} style={{ '--ob-i': idx % 12 }}>
      {featured && <span className="ob-card__featured-badge">{t.cardFeaturedBadge}</span>}
      <div className="ob-card__top">
        <div className="ob-card__company-logo" style={logoStyle}>{card.logo}</div>
        <span className={`ob-card__deadline${card.deadlineCls ? ' ' + card.deadlineCls : ''}`}>{card.deadlineLabel}</span>
      </div>
      <div>
        <div className="ob-card__title">{card.title}</div>
        {card.company && <div className="ob-card__company">{card.company}</div>}
      </div>
      <div className="ob-card__tags">
        {card.tags.map((tag, i) => <span key={`${tag.l}-${i}`} className={`ob-tag ${tag.c}`}>{tag.l}</span>)}
      </div>
      {card.meta.length > 0 && (
        <div className="ob-card__meta">
          {card.meta.map(m => <span key={m} className="ob-card__meta-item">{m}</span>)}
        </div>
      )}
      {card.source && <div className="ob-card__source"><span className="ob-card__source-dot"></span> {card.source}</div>}
      <div className="ob-card__desc">{card.desc}</div>
      <div className="ob-card__actions">
        {safeView
          ? <a href={safeView || undefined} className="ob-card__cta-primary" target="_blank" rel="noopener">{card.viewLabel || t.cardViewRole}</a>
          : <span className="ob-card__cta-primary ob-card__cta-primary--disabled" aria-disabled="true">{card.viewLabel || t.cardViewRole}</span>}
        {card.postLink && (safePost
          ? <a href={safePost} className="ob-card__cta-secondary" target="_blank" rel="noopener">{card.postLabel}</a>
          : <Link to={card.postLink} className="ob-card__cta-secondary">{card.postLabel}</Link>
        )}
      </div>
    </article>
  )
}

// Eco links point at these routes, but they are gated and redirect to `/`,
// so rendering them produces dead links — filter them out of the eco grid.
const GATED_ROUTES = ['/bridge-year', '/interview-prep', '/partner-panels']

export default function OpportunityBoard() {
  const t = useT('opportunityBoard')
  const tForms = useT('forms')
  const [searchParams, setSearchParams] = useSearchParams()
  const urlTab = searchParams.get('tab') || ''
  const tab = TAB_KEYS.includes(urlTab) ? urlTab : 'all'
  const setTab = useCallback(key => {
    const next = new URLSearchParams(searchParams)
    if (!key || key === 'all') next.delete('tab')
    else next.set('tab', key)
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])
  const [search, setSearch] = useState('')
  const searchRef = useRef(null)
  const progressRef = useRef(null)
  const [stage, setStage] = useState('')
  const [location, setLocation] = useState('')
  const [deadline, setDeadline] = useState('')
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileError, setTurnstileError] = useState(false)
  const turnstileReset = useRef(null)
  const [fieldErrors, setFieldErrors] = useState({ role: '', company: '', type: '', link: '', why: '', email: '' })
  const [form, setForm] = useState({ role: '', company: '', type: '', link: '', deadline: '', eligibility: '', why: '', email: '', location: '', pay: '' })

  const setField = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    if (fieldErrors[k]) setFieldErrors(s => ({ ...s, [k]: '' }))
  }

  const [dbOpportunities, setDbOpportunities] = useState([])
  const [dbError, setDbError] = useState(null)
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
      if (searchRef.current) {
        e.preventDefault()
        searchRef.current.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // Public list fetch (status approved/featured). Callable so we can re-fetch after a
  // successful submission — submitted opportunities are now auto-published server-side.
  const fetchOpportunities = useCallback(() => {
    supabase.from('opportunities')
      .select('id,role,company,role_type,link,deadline,eligibility,why,status,created_at,location,pay')
      .in('status', ['approved', 'featured'])
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (error) {
          setDbError(error)
          return
        }
        setDbError(null)
        if (data?.length) setDbOpportunities(data.map(row => dbOpportunityToCard(row, t)))
      })
  }, [t])

  useEffect(() => {
    fetchOpportunities()
  }, [fetchOpportunities])


  const filters = { tab, query: search.toLowerCase().trim(), stage, location, deadline }

  const allFeatured = dbOpportunities.filter(c => c._featured)
  const allMain = [...OPPORTUNITIES, ...dbOpportunities.filter(c => !c._featured)]
  const visibleFeatured = allFeatured.filter(c => matchCard(c, filters))
  const visibleMain = allMain.filter(c => matchCard(c, filters))
  const totalVisible = visibleFeatured.length + visibleMain.length

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errors = { role: '', company: '', type: '', link: '', why: '', email: '' }
    if (!form.role.trim()) errors.role = t.formErrorRole
    if (!form.company.trim()) errors.company = t.formErrorCompany
    if (!form.type) errors.type = t.formErrorType
    if (!form.link.trim()) errors.link = t.formErrorLink
    if (!form.why.trim()) errors.why = t.formErrorWhy
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = t.formErrorEmail
    if (Object.values(errors).some(Boolean)) {
      setFieldErrors(errors)
      setFormError('')
      return
    }
    if (TURNSTILE_ENABLED && !turnstileToken) {
      setFormError(t.formErrorGeneric)
      return
    }
    setFieldErrors({ role: '', company: '', type: '', link: '', why: '', email: '' })
    setFormLoading(true)
    setFormError('')
    // Insert now flows through the Turnstile-gated submit-form edge function
    // (service role). status is forced to 'approved' server-side, so the row is
    // published immediately and we re-fetch the public list on success.
    let ok = false
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-form`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          type: 'opportunity',
          turnstileToken,
          payload: {
            role: form.role.trim(),
            company: form.company.trim(),
            role_type: form.type,
            link: form.link.trim(),
            deadline: form.deadline.trim() || null,
            eligibility: form.eligibility.trim() || null,
            why: form.why.trim(),
            submitted_by: form.email.trim() || null,
            location: form.location.trim() || null,
            pay: form.pay.trim() || null,
          },
        }),
      })
      ok = res.ok
    } catch {
      ok = false
    }
    setFormLoading(false)
    if (!ok) {
      setFormError(t.formErrorGeneric)
      setTurnstileToken('')
      turnstileReset.current?.()
    } else {
      setFormSubmitted(true)
      setTurnstileToken('')
      turnstileReset.current?.()
      // Row is live (approved) — re-fetch so the new opportunity appears in the board.
      fetchOpportunities()
    }
  }

  // Icons sit on the teal Source band, so tint them light or gold-fill for contrast.
  const SOURCE_ITEM_STYLES = [
    { background: 'rgba(255,255,255,.14)', color: 'var(--color-cream)' },
    { background: 'rgba(255,255,255,.14)', color: 'var(--color-cream)' },
    { background: 'var(--color-gold)', color: 'var(--color-dark)' },
  ]

  return (
    <ArticleLayout
      title="Opportunity Board"
      signoffLine={t.signoffLine}
      signoffSub={t.signoffSub}
      signoffCta={t.signoffCta}
    >
      <div ref={progressRef} className="ob-scroll-progress" aria-hidden="true" />
      <style>{`
        html, body { background: var(--color-cream); }
        :root { --ob-shadow-warm: 58, 38, 22; }
        .ob-scroll-progress { position: fixed; top: 0; left: 0; height: 2px; width: 100%; background: linear-gradient(90deg, var(--color-accent) 0%, var(--color-gold) 100%); z-index: 1000; pointer-events: none; transform: scaleX(0); transform-origin: left; transition: transform .12s linear; will-change: transform; }
        @media (prefers-reduced-motion: reduce) { .ob-scroll-progress { transition: none; } }
        .ob-kicker { font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--color-muted); margin-bottom: 14px; display: inline-flex; align-items: center; gap: 10px; }
        .ob-kicker::after { content: ''; width: 24px; height: 1px; background: currentColor; opacity: .5; }
        .ob-section-title { font-family: var(--font-display); font-size: clamp(26px,4vw,40px); font-weight: 700; color: var(--color-dark); line-height: 1.15; margin-bottom: 10px; }
        .ob-section-sub { font-family: var(--font-display); font-size: clamp(16px,2vw,20px); font-weight: 400; color: var(--color-accent); margin-bottom: 20px; }
        .ob-section-body { font-size: clamp(15px,1.8vw,17px); color: var(--color-muted); line-height: 1.75; max-width: 700px; }
        .ob-section-body strong { color: var(--color-dark); font-weight: 600; }
        .ob-divider { border: none; border-top: 1px solid rgba(0,0,0,.08); margin: 0; }

        .ob-hero { padding: 96px clamp(20px,5vw,56px) 64px; max-width: 1240px; margin: 0 auto; position: relative; overflow: hidden; }
        .ob-hero::before { content: ''; position: absolute; top: 96px; left: clamp(20px,5vw,56px); width: 56px; height: 4px; background: var(--color-accent); border-radius: 2px; z-index: 1; }
        .ob-hero::after { content: ''; position: absolute; top: -14%; right: -10%; width: 520px; height: 520px; background: radial-gradient(closest-side, rgba(179,69,57,.1), transparent 70%); pointer-events: none; z-index: 0; }
        .ob-hero > * { position: relative; z-index: 1; }
        .ob-hero__kicker { font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--color-accent); margin-bottom: 18px; display: inline-flex; align-items: center; gap: 10px; }
        .ob-hero__kicker::after { content: ''; width: 24px; height: 1px; background: currentColor; opacity: .5; }
        .ob-hero__title { font-family: var(--font-display); font-size: clamp(42px,7vw,80px); font-weight: 700; line-height: 1.04; color: var(--color-dark); margin-bottom: 14px; }
        .ob-hero__title em { font-style: normal; font-family: var(--font-display); color: var(--color-gold-dark); font-weight: 700; }
        .ob-hero__tagline { font-family: var(--font-serif, var(--font-display)); font-size: clamp(18px,2.2vw,24px); font-style: italic; font-weight: 400; color: var(--color-accent); margin-bottom: 22px; letter-spacing: -.005em; max-width: 60ch; }
        .ob-hero__sub { font-family: var(--font-display); font-size: clamp(18px,2.5vw,26px); font-weight: 400; color: var(--color-dark); line-height: 1.4; max-width: 720px; margin-bottom: 24px; }
        .ob-hero__body { font-size: clamp(15px,1.8vw,17px); color: var(--color-muted); line-height: 1.8; max-width: 680px; margin-bottom: 40px; }
        .ob-hero__body strong { color: var(--color-dark); font-weight: 600; }
        .ob-hero__stats { display: flex; flex-wrap: wrap; gap: 0; border-top: 1px solid rgba(26,25,22,.12); padding-top: 26px; }
        .ob-hero__stat { padding-right: clamp(24px,4vw,52px); margin-right: clamp(24px,4vw,52px); border-right: 1px solid rgba(26,25,22,.12); }
        .ob-hero__stat:last-child { border-right: none; margin-right: 0; padding-right: 0; }
        .ob-hero__stat-value { font-family: var(--font-display); font-size: clamp(28px,4vw,40px); font-weight: 700; color: var(--color-dark); line-height: 1; margin-bottom: 6px; }
        .ob-hero__stat-label { font-size: 13px; font-weight: 500; color: var(--color-muted); line-height: 1.35; max-width: 18ch; }

        .ob-board { max-width: 1240px; margin: 0 auto; padding: 72px clamp(20px,5vw,56px) 80px; }
        .ob-board__head { margin-bottom: 32px; }
        .ob-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid rgba(0,0,0,.08); }
        .ob-tab { padding: 13px 18px; border-radius: 20px; border: 1.5px solid rgba(0,0,0,.1); background: transparent; font-family: var(--font-body); font-size: 13px; font-weight: 600; color: var(--color-muted); cursor: pointer; transition: background .18s, border-color .18s, color .18s; }
        .ob-tab:hover { border-color: var(--color-dark); color: var(--color-dark); }
        .ob-tab.active { background: var(--color-dark); border-color: var(--color-dark); color: var(--color-cream); }
        .ob-tab--internship.active  { background: var(--color-navy);   border-color: var(--color-navy); }
        .ob-tab--research.active    { background: var(--color-teal);   border-color: var(--color-teal); }
        .ob-tab--program.active     { background: var(--color-accent); border-color: var(--color-accent); }
        .ob-tab--scholarship.active { background: var(--color-gold);   border-color: var(--color-gold); color: var(--color-dark); }
        .ob-tab:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 2px; border-radius: 6px; }
        .ob-filter-bar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 28px; align-items: center; }
        .ob-search-wrap { position: relative; flex: 1; min-width: 220px; }
        .ob-search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--color-muted); }
        .ob-search { width: 100%; font-family: var(--font-body); font-size: 15px; padding: 11px 14px 11px 42px; border: 1.5px solid rgba(0,0,0,.12); border-radius: 10px; background: var(--color-white); color: var(--color-dark); outline: none; transition: border-color .2s; }
        .ob-search:focus { border-color: var(--color-gold); }
        .ob-search::placeholder { color: var(--color-muted); }
        .ob-filter-select { font-family: var(--font-body); font-size: 13px; font-weight: 500; padding: 11px 32px 11px 12px; border: 1.5px solid rgba(0,0,0,.12); border-radius: 8px; background: var(--color-white); color: var(--color-dark); outline: none; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%236B5E52' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; transition: border-color .2s; flex-shrink: 0; }
        .ob-filter-select:focus { border-color: var(--color-gold); }
        .ob-results-count { font-size: 13px; color: var(--color-muted); margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; }
        .ob-results-count span { font-weight: 600; color: var(--color-dark); }

        .ob-featured-strip { margin-bottom: 40px; }
        .ob-featured-label { font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--color-gold); margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
        .ob-featured-label::before { content: ''; display: inline-block; width: 20px; height: 2px; background: var(--color-gold); border-radius: 1px; }
        .ob-featured-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(310px,1fr)); gap: 16px; margin-top: 16px; }

        .ob-card { background: linear-gradient(180deg, rgba(255,250,242,.85) 0%, rgba(255,250,242,.55) 100%); border: 1px solid rgba(26,25,22,.1); border-radius: 14px; padding: 22px 24px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 4px 12px -6px rgba(var(--ob-shadow-warm),.12); transition: transform .22s cubic-bezier(.16,1,.3,1), box-shadow .22s, border-color .22s; position: relative; }
        .ob-card:hover { transform: translateY(-3px); border-color: rgba(26,25,22,.22); box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 16px 32px -12px rgba(var(--ob-shadow-warm),.22); }
        .ob-card--internship    { background: linear-gradient(180deg, rgba(22,43,68,.07)  0%, rgba(255,250,242,.55) 60%); border-color: rgba(22,43,68,.22); }
        .ob-card--apprenticeship { background: linear-gradient(180deg, rgba(58,125,107,.07) 0%, rgba(255,250,242,.55) 60%); border-color: rgba(58,125,107,.22); }
        .ob-card--new-grad      { background: linear-gradient(180deg, rgba(232,168,56,.07) 0%, rgba(255,250,242,.55) 60%); border-color: rgba(232,168,56,.26); }
        .ob-card--fellowship    { background: linear-gradient(180deg, rgba(58,125,107,.07) 0%, rgba(255,250,242,.55) 60%); border-color: rgba(58,125,107,.22); }
        .ob-card--research      { background: linear-gradient(180deg, rgba(58,125,107,.07) 0%, rgba(255,250,242,.55) 60%); border-color: rgba(58,125,107,.22); }
        .ob-card--program       { background: linear-gradient(180deg, rgba(179,69,57,.06) 0%, rgba(255,250,242,.55) 60%); border-color: rgba(179,69,57,.22); }
        .ob-card--scholarship   { background: linear-gradient(180deg, rgba(232,168,56,.07) 0%, rgba(255,250,242,.55) 60%); border-color: rgba(232,168,56,.26); }
        .ob-card.featured { border-color: rgba(232,168,56,.42); border-width: 1.5px; background: linear-gradient(180deg, rgba(232,168,56,.07) 0%, rgba(255,250,242,.55) 60%); }
        .ob-card.featured::before { content: ''; position: absolute; top: -1px; left: 18px; width: 36px; height: 6px; background: var(--color-gold); border-radius: 0 0 4px 4px; box-shadow: 0 1px 2px rgba(232,168,56,.4); }
        .ob-card.archived { opacity: .55; pointer-events: none; }
        .ob-card__featured-badge { position: absolute; top: -1px; right: 18px; background: var(--color-gold); color: var(--color-dark); font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; padding: 3px 10px; border-radius: 0 0 6px 6px; }
        .ob-featured-grid > .ob-card,
        .ob-main-grid > .ob-card { animation: ob-card-in .55s cubic-bezier(.16,1,.3,1) backwards; animation-delay: calc(var(--ob-i, 0) * 50ms); }
        @keyframes ob-card-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          .ob-featured-grid > .ob-card,
          .ob-main-grid > .ob-card { animation: none !important; }
        }
        .ob-card__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .ob-card__company-logo { width: 40px; height: 40px; border-radius: 10px; border: 1px solid rgba(0,0,0,.08); background: rgba(0,0,0,.04); display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-size: 14px; font-weight: 700; color: var(--color-dark); flex-shrink: 0; }
        .ob-card__deadline { font-size: 11px; font-weight: 700; color: var(--color-muted); letter-spacing: .04em; flex-shrink: 0; }
        .ob-card__deadline.closed { color: var(--color-muted); opacity: 0.6; }
        .ob-card__deadline.urgent { color: var(--color-accent); }
        .ob-card__deadline.rolling { color: var(--color-teal); }
        .ob-card__title { font-family: var(--font-display); font-size: clamp(14px,1.7vw,16px); font-weight: 700; color: var(--color-dark); line-height: 1.3; }
        .ob-card__company { font-size: 14px; color: var(--color-dark); font-weight: 600; }
        .ob-card__tags { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
        .ob-tag { display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; padding: 3px 10px; border-radius: 999px; }
        .ob-tag--intern    { background: rgba(22,43,68,.08);    color: var(--color-navy); }
        .ob-tag--apprent   { background: rgba(58,125,107,.1);   color: var(--color-teal); }
        .ob-tag--newgrad   { background: rgba(232,168,56,.12);  color: var(--color-gold-dark); }
        .ob-tag--fellowship{ background: rgba(58,125,107,.1);   color: var(--color-teal); }
        .ob-tag--research  { background: rgba(58,125,107,.1);   color: var(--color-teal); }
        .ob-tag--program   { background: rgba(179,69,57,.08);   color: var(--color-accent); }
        .ob-tag--muted     { background: rgba(0,0,0,.1);        color: #3E3A35; }
        .ob-tag--bridge    { background: rgba(58,125,107,.1);   color: var(--color-teal); }
        .ob-card__meta { display: flex; flex-wrap: wrap; gap: 12px; }
        .ob-card__meta-item { font-size: 12px; color: var(--color-muted); display: flex; align-items: center; gap: 4px; }
        .ob-card__desc { font-size: 13px; color: var(--color-muted); line-height: 1.65; flex: 1; }
        .ob-card__desc strong { color: var(--color-dark); font-weight: 600; }
        .ob-card__source { font-size: 11px; color: rgba(0,0,0,.35); display: flex; align-items: center; gap: 5px; }
        .ob-card__source-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--color-gold-dark); flex-shrink: 0; }
        .ob-card__actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: auto; padding-top: 4px; }
        /* Color-outline pill CTA that tracks the card type, matching the Templates card system */
        .ob-card__cta-primary { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 12px 18px; background: transparent; color: var(--color-dark); border: 1.5px solid rgba(26,25,22,.4); border-radius: 999px; font-family: var(--font-display); font-size: 12px; font-weight: 700; letter-spacing: -.005em; text-decoration: none; cursor: pointer; transition: background .25s, color .25s, border-color .25s, transform .22s cubic-bezier(.16,1,.3,1), box-shadow .25s; flex: 1; }
        .ob-card__cta-primary:hover { background: var(--color-dark); color: var(--color-cream); border-color: var(--color-dark); transform: translateY(-1px); box-shadow: 0 8px 16px -8px rgba(26,25,22,.4); }
        .ob-card--internship    .ob-card__cta-primary { color: var(--color-navy);      border-color: rgba(22,43,68,.45); }
        .ob-card--internship    .ob-card__cta-primary:hover { background: var(--color-navy);   color: var(--color-cream); border-color: var(--color-navy);   box-shadow: 0 8px 16px -8px rgba(22,43,68,.5); }
        .ob-card--apprenticeship .ob-card__cta-primary { color: var(--color-teal);      border-color: rgba(58,125,107,.5); }
        .ob-card--apprenticeship .ob-card__cta-primary:hover { background: var(--color-teal);   color: var(--color-cream); border-color: var(--color-teal);   box-shadow: 0 8px 16px -8px rgba(58,125,107,.5); }
        .ob-card--new-grad      .ob-card__cta-primary { color: var(--color-gold-dark); border-color: rgba(232,168,56,.6); }
        .ob-card--new-grad      .ob-card__cta-primary:hover { background: var(--color-gold);   color: var(--color-dark);  border-color: var(--color-gold);   box-shadow: 0 8px 16px -8px rgba(232,168,56,.5); }
        .ob-card--fellowship    .ob-card__cta-primary { color: var(--color-teal);      border-color: rgba(58,125,107,.5); }
        .ob-card--fellowship    .ob-card__cta-primary:hover { background: var(--color-teal);   color: var(--color-cream); border-color: var(--color-teal);   box-shadow: 0 8px 16px -8px rgba(58,125,107,.5); }
        .ob-card--research      .ob-card__cta-primary { color: var(--color-teal);      border-color: rgba(58,125,107,.5); }
        .ob-card--research      .ob-card__cta-primary:hover { background: var(--color-teal);   color: var(--color-cream); border-color: var(--color-teal);   box-shadow: 0 8px 16px -8px rgba(58,125,107,.5); }
        .ob-card--program       .ob-card__cta-primary { color: var(--color-accent);    border-color: rgba(179,69,57,.5); }
        .ob-card--program       .ob-card__cta-primary:hover { background: var(--color-accent); color: var(--color-cream); border-color: var(--color-accent); box-shadow: 0 8px 16px -8px rgba(179,69,57,.5); }
        .ob-card--scholarship   .ob-card__cta-primary { color: var(--color-gold-dark); border-color: rgba(232,168,56,.6); }
        .ob-card--scholarship   .ob-card__cta-primary:hover { background: var(--color-gold); color: var(--color-dark); border-color: var(--color-gold); box-shadow: 0 8px 16px -8px rgba(232,168,56,.5); }
        .ob-card__cta-secondary { display: inline-flex; align-items: center; gap: 6px; padding: 12px 16px; background: transparent; color: var(--color-muted); border-radius: 999px; font-family: var(--font-display); font-size: 12px; font-weight: 700; letter-spacing: -.005em; text-decoration: none; border: 1.5px solid rgba(0,0,0,.14); cursor: pointer; transition: border-color .25s, color .25s, transform .22s cubic-bezier(.16,1,.3,1); flex-shrink: 0; }
        .ob-card__cta-secondary:hover { border-color: var(--color-dark); color: var(--color-dark); transform: translateY(-1px); }
        .ob-card__cta-primary:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 2px; border-radius: 8px; }
        .ob-card__cta-secondary:focus-visible { outline: 2px solid var(--color-dark); outline-offset: 2px; border-radius: 8px; }
        .ob-main-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(310px,1fr)); gap: 16px; }
        .ob-no-results { grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--color-muted); font-size: 15px; }
        .ob-archive-strip { margin-top: 52px; }
        .ob-archive-label { font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--color-muted); margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
        .ob-archive-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(310px,1fr)); gap: 16px; }

        .ob-source { background: var(--color-accent); padding: 80px clamp(20px,5vw,56px); position: relative; overflow: hidden; }
        .ob-source::before { content: ''; position: absolute; inset: 0; background-image: radial-gradient(circle at 12% 14%, rgba(255,255,255,.07) 0%, transparent 48%); pointer-events: none; }
        .ob-source__inner { max-width: 1240px; margin: 0 auto; position: relative; }
        .ob-source .ob-kicker { color: rgba(242,228,206,.72); }
        .ob-source .ob-section-title { color: var(--color-cream); }
        .ob-source .ob-section-sub { color: var(--color-gold); }
        .ob-source__layout { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: flex-start; margin-top: 32px; }
        .ob-source__body { font-size: clamp(14px,1.6vw,15px); color: rgba(242,228,206,.8); line-height: 1.8; }
        .ob-source__body strong { color: #fff; font-weight: 600; }
        .ob-source__body + .ob-source__body { margin-top: 16px; }
        .ob-source__list { display: flex; flex-direction: column; gap: 14px; }
        .ob-source__item { display: flex; align-items: flex-start; gap: 12px; }
        .ob-source__item-icon { width: 32px; height: 32px; border-radius: 8px; background: rgba(255,255,255,.14); color: var(--color-cream); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; flex-shrink: 0; }
        .ob-source__item-title { font-family: var(--font-display); font-size: 14px; font-weight: 700; color: var(--color-cream); margin-bottom: 2px; }
        .ob-source__item-desc { font-size: 13px; color: rgba(242,228,206,.66); line-height: 1.55; }

        .ob-submit { max-width: 1240px; margin: 0 auto; padding: 80px clamp(20px,5vw,56px); }
        .ob-submit__layout { display: grid; grid-template-columns: 1fr 1.5fr; gap: 60px; align-items: flex-start; }
        .ob-submit__intro-kicker { font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--color-accent); margin-bottom: 12px; display: inline-flex; align-items: center; gap: 10px; }
        .ob-submit__intro-kicker::after { content: ''; width: 24px; height: 1px; background: currentColor; opacity: .5; }
        .ob-submit__intro-title { font-family: var(--font-display); font-size: clamp(22px,3vw,32px); font-weight: 700; color: var(--color-dark); line-height: 1.2; margin-bottom: 16px; }
        .ob-submit__intro-body { font-size: clamp(14px,1.6vw,15px); color: var(--color-muted); line-height: 1.75; }
        .ob-submit__intro-body strong { color: var(--color-dark); font-weight: 600; }
        .ob-form-box { background: rgba(255,250,242,.7); border: 1px solid rgba(26,25,22,.13); border-radius: 16px; padding: clamp(28px,4vw,44px); box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 18px 40px -22px rgba(var(--ob-shadow-warm),.18); }
        .ob-form-row { margin-bottom: 16px; }
        .ob-form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .ob-form-label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .09em; color: var(--color-muted); margin-bottom: 6px; }
        .ob-form-label span { color: var(--color-accent); }
        .ob-form-input, .ob-form-select, .ob-form-textarea { width: 100%; font-family: var(--font-body); font-size: 15px; padding: 11px 14px; border: 1.5px solid rgba(0,0,0,.12); border-radius: 8px; background: var(--color-white); color: var(--color-dark); outline: none; transition: border-color .2s; }
        .ob-form-input:focus, .ob-form-select:focus, .ob-form-textarea:focus { border-color: var(--color-gold); box-shadow: 0 0 0 4px rgba(232,168,56,.16); }
        .ob-form-input.is-invalid, .ob-form-select.is-invalid, .ob-form-textarea.is-invalid { border-color: rgba(179,69,57,.45); }
        .ob-form-input.is-invalid:focus, .ob-form-select.is-invalid:focus, .ob-form-textarea.is-invalid:focus { border-color: var(--color-accent); box-shadow: 0 0 0 4px rgba(179,69,57,.14); }
        .ob-form-row__error { display: block; margin-top: 6px; font-size: 12px; font-weight: 600; color: var(--color-accent); line-height: 1.4; }
        .ob-form-row__error::before { content: ''; display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: var(--color-accent); margin-right: 7px; vertical-align: .18em; }
        .ob-form-error-card { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; padding: 14px 16px; background: rgba(179,69,57,.06); border: 1px solid rgba(179,69,57,.22); border-radius: 10px; }
        .ob-form-error-card__msg { flex: 1; font-size: 13px; color: var(--color-dark); line-height: 1.5; font-weight: 500; }
        .ob-form-error-card__msg strong { color: var(--color-accent); font-weight: 700; }
        .ob-form-error-card__retry { flex-shrink: 0; padding: 7px 14px; background: transparent; border: 1.5px solid var(--color-accent); color: var(--color-accent); border-radius: 999px; font-family: var(--font-display); font-size: 12px; font-weight: 700; cursor: pointer; transition: background .2s, color .2s; }
        .ob-form-error-card__retry:hover { background: var(--color-accent); color: var(--color-cream); }
        .ob-form-textarea { min-height: 80px; resize: vertical; line-height: 1.6; }
        .ob-form-select { appearance: none; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%236B5E52' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; }
        .ob-form-btn { width: 100%; padding: 14px 24px; background: var(--color-dark); color: var(--color-cream); border: none; border-radius: 8px; font-family: var(--font-display); font-size: 14px; font-weight: 600; cursor: pointer; transition: background .2s, transform .18s; margin-top: 6px; }
        .ob-form-btn:hover { background: var(--color-accent); transform: translateY(-1px); }
        .ob-form-btn:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 2px; }
        .ob-form-success { text-align: center; padding: 40px 20px; }
        .ob-form-success__icon { width: 56px; height: 56px; border-radius: 50%; background: rgba(232,168,56,.12); color: var(--color-gold-dark); display: flex; align-items: center; justify-content: center; font-size: 24px; margin: 0 auto 16px; }
        .ob-form-success__title { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--color-dark); margin-bottom: 8px; }
        .ob-form-success__body { font-size: 14px; color: var(--color-muted); line-height: 1.7; }

        .ob-eco { background: var(--color-gold); padding: 72px clamp(20px,5vw,56px); position: relative; overflow: hidden; }
        .ob-eco::before { content: ''; position: absolute; inset: 0; background-image: radial-gradient(circle at 84% 76%, rgba(179,69,57,.16) 0%, transparent 52%); pointer-events: none; }
        .ob-eco__inner { max-width: 1240px; margin: 0 auto; position: relative; }
        .ob-eco__kicker { font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--color-accent); margin-bottom: 10px; display: inline-flex; align-items: center; gap: 10px; }
        .ob-eco__kicker::after { content: ''; width: 24px; height: 1px; background: currentColor; opacity: .55; }
        .ob-eco__title { font-family: var(--font-display); font-size: clamp(20px,3vw,28px); font-weight: 700; color: var(--color-dark); margin-bottom: 8px; line-height: 1.25; }
        .ob-eco__body { font-size: clamp(14px,1.6vw,15px); color: rgba(26,25,22,.72); line-height: 1.75; max-width: 680px; margin-bottom: 36px; }
        .ob-eco__grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(200px,1fr)); gap: 14px; }
        .ob-eco__link { background: rgba(26,25,22,.055); border: 1px solid rgba(26,25,22,.14); border-radius: 12px; padding: 18px 20px; display: block; }
        .ob-eco__link-title { font-family: var(--font-display); font-size: 14px; font-weight: 600; color: var(--color-dark); margin-bottom: 4px; }
        .ob-eco__link-desc { font-size: 12px; color: rgba(26,25,22,.6); line-height: 1.5; }

        @media (max-width: 560px) { .ob-featured-grid, .ob-main-grid, .ob-archive-grid { grid-template-columns: 1fr; } }
        @media (max-width: 680px) { .ob-source__layout { grid-template-columns: 1fr; gap: 32px; } }
        @media (max-width: 740px) { .ob-submit__layout { grid-template-columns: 1fr; gap: 36px; } .ob-form-row-2 { grid-template-columns: 1fr; } }
        @media (max-width: 768px) { .ob-hero { padding: 88px 20px 48px; } .ob-board, .ob-source, .ob-submit { padding-top: 48px; padding-bottom: 48px; } }
        @media (max-width: 480px) { .ob-hero { padding: 80px 16px 40px; } .ob-hero__stats { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 20px; } }
      `}</style>

      <header className="ob-hero" id="top">
        <p className="ob-hero__kicker">{t.heroKicker}</p>
        <h1 className="ob-hero__title">{t.heroTitle} <em>{t.heroTitleEm}</em></h1>
        {t.heroTagline && <p className="ob-hero__tagline">{t.heroTagline}</p>}
        <p className="ob-hero__sub">{t.heroSub}</p>
        <p className="ob-hero__body">
          {t.heroBody1} <strong>{t.heroBodyStrong}</strong>{t.heroBody2}
        </p>
        {t.heroStats?.length > 0 && (
          <div className="ob-hero__stats">
            {t.heroStats.map(stat => (
              <div key={stat.label} className="ob-hero__stat">
                <div className="ob-hero__stat-value">{stat.value}</div>
                <div className="ob-hero__stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        )}
      </header>

      <hr className="ob-divider" />

      <section className="ob-board" id="board">
        <div className="ob-board__head">
          <p className="ob-kicker">{t.boardKicker}</p>
          <h2 className="ob-section-title">{t.boardTitle}</h2>
          <p className="ob-section-sub">{t.boardSub}</p>
        </div>

        <div className="ob-tabs" role="group" aria-label={t.tabGroupAriaLabel}>
          {TAB_KEYS.map(key => {
            const labelMap = { all: t.tabAll, internship: t.tabInternship, research: t.tabResearch, program: t.tabProgram, scholarship: t.tabScholarship }
            return (
              <button key={key} id={`ob-tab-${key}`} className={`ob-tab ob-tab--${key}${tab === key ? ' active' : ''}`} aria-pressed={tab === key} onClick={() => setTab(key)}>{labelMap[key]}</button>
            )
          })}
        </div>

        <div className="ob-filter-bar">
          <div className="ob-search-wrap">
            <svg className="ob-search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 10L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input ref={searchRef} type="text" className="ob-search" placeholder={t.searchPlaceholder} aria-label={t.searchAriaLabel} autoComplete="off" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="ob-filter-select" aria-label={t.filterStageAriaLabel} value={stage} onChange={e => setStage(e.target.value)}>
            <option value="">{t.filterStageAll}</option>
            <option value="first-second">{t.filterStageFirstSecond}</option>
            <option value="junior">{t.filterStageJunior}</option>
            <option value="senior">{t.filterStageSenior}</option>
            <option value="recent-grad">{t.filterStageRecentGrad}</option>
            <option value="transition">{t.filterStageTransition}</option>
            <option value="phd">{t.filterStagePhD}</option>
          </select>
          <select className="ob-filter-select" aria-label={t.filterLocationAriaLabel} value={location} onChange={e => setLocation(e.target.value)}>
            <option value="">{t.filterLocationAll}</option>
            <option value="remote">{t.filterLocationRemote}</option>
            <option value="us">{t.filterLocationUS}</option>
            <option value="canada">{t.filterLocationCanada}</option>
            <option value="international">{t.filterLocationInternational}</option>
          </select>
          <select className="ob-filter-select" aria-label={t.filterDeadlineAriaLabel} value={deadline} onChange={e => setDeadline(e.target.value)}>
            <option value="">{t.filterDeadlineAny}</option>
            <option value="this-week">{t.filterDeadlineThisWeek}</option>
            <option value="this-month">{t.filterDeadlineThisMonth}</option>
            <option value="rolling">{t.filterDeadlineRolling}</option>
            <option value="closed">{t.filterDeadlineClosed}</option>
          </select>
        </div>

        <div className="ob-results-count"><span>{totalVisible}</span>&nbsp;{t.opportunitiesShown}</div>

        <div className="ob-main-grid">
          {totalVisible === 0
            ? <p className="ob-no-results">{t.noResults}</p>
            : [
              ...visibleFeatured.map(c => ({ c, featured: true })),
              ...visibleMain.map(c => ({ c, featured: false })),
            ].map(({ c, featured }, i) => <OBCard key={c.id} card={c} featured={featured} t={t} idx={i} />)
          }
        </div>

        {ARCHIVED_OPPORTUNITIES.length > 0 && (
          <div className="ob-archive-strip">
            <p className="ob-archive-label">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, color: 'var(--color-muted)' }}><rect x="1" y="4" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><path d="M5 4V3a2 2 0 1 1 4 0v1" stroke="currentColor" strokeWidth="1.3" /></svg>
              {t.archiveLabel}
            </p>
            <div className="ob-archive-grid">
              {ARCHIVED_OPPORTUNITIES.map(a => (
                <article key={a.id} className="ob-card archived">
                  <div className="ob-card__top">
                    <div className="ob-card__company-logo" style={{ background: 'rgba(0,0,0,.05)', color: 'var(--color-muted)' }}>{a.logo}</div>
                    <span className="ob-card__deadline" style={{ color: 'var(--color-muted)' }}>{a.closed}</span>
                  </div>
                  <div>
                    <div className="ob-card__title">{a.title}</div>
                    <div className="ob-card__company">{a.company}</div>
                  </div>
                  <div className="ob-card__tags">{a.tags.map(tag => <span key={tag} className="ob-tag ob-tag--muted">{tag}</span>)}</div>
                  <div className="ob-card__desc">{a.desc}</div>
                  <div className="ob-card__source"><span className="ob-card__source-dot" style={{ background: 'var(--color-muted)' }}></span> {t.archiveSource}</div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="ob-source" id="source">
        <div className="ob-source__inner">
          <p className="ob-kicker">{t.sourceKicker}</p>
          <h2 className="ob-section-title">{t.sourceTitle}</h2>
          <p className="ob-section-sub">{t.sourceSub}</p>
          <div className="ob-source__layout">
            <div>
              <p className="ob-source__body">{t.sourceBody1Part1} <strong>{t.sourceBody1Strong}</strong>{t.sourceBody1Part2}</p>
              <p className="ob-source__body" style={{ marginTop: '16px' }}>{t.sourceBody2Part1} <strong>{t.sourceBody2Strong}</strong>{t.sourceBody2Part2}</p>
            </div>
            <div className="ob-source__list">
              {t.sourceItems.map((s, i) => (
                <div key={s.title} className="ob-source__item">
                  <span className="ob-source__item-icon" style={SOURCE_ITEM_STYLES[i]}>{s.icon}</span>
                  <div>
                    <div className="ob-source__item-title">{s.title}</div>
                    <div className="ob-source__item-desc">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="ob-submit" id="submit">
        <div className="ob-submit__layout">
          <div>
            <p className="ob-submit__intro-kicker">{t.submitKicker}</p>
            <h2 className="ob-submit__intro-title">{t.submitTitle}</h2>
            <p className="ob-submit__intro-body">{t.submitBody} <strong>{t.submitBodyStrong}</strong>{t.submitBodySuffix}</p>
          </div>
          <div className="ob-form-box">
            {formSubmitted ? (
              <div className="ob-form-success">
                <div className="ob-form-success__icon">✓</div>
                <div className="ob-form-success__title">Your opportunity is now live</div>
                <p className="ob-form-success__body">It has been added to the board below for the community to see. Thank you for helping keep the board current.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="ob-form-row">
                  <label className="ob-form-label" htmlFor="obRoleName">{t.formLabelRole} <span>{t.formLabelRoleRequired}</span></label>
                  <input className={`ob-form-input${fieldErrors.role ? ' is-invalid' : ''}`} type="text" id="obRoleName" placeholder={t.formPlaceholderRole} value={form.role} onChange={e => setField('role', e.target.value)} aria-invalid={!!fieldErrors.role} aria-describedby={fieldErrors.role ? 'obRoleName-error' : undefined} />
                  {fieldErrors.role && <span id="obRoleName-error" className="ob-form-row__error" role="alert">{fieldErrors.role}</span>}
                </div>
                <div className="ob-form-row ob-form-row-2">
                  <div>
                    <label className="ob-form-label" htmlFor="obCompany">{t.formLabelCompany} <span>{t.formLabelCompanyRequired}</span></label>
                    <input className={`ob-form-input${fieldErrors.company ? ' is-invalid' : ''}`} type="text" id="obCompany" placeholder={t.formPlaceholderCompany} value={form.company} onChange={e => setField('company', e.target.value)} aria-invalid={!!fieldErrors.company} aria-describedby={fieldErrors.company ? 'obCompany-error' : undefined} />
                    {fieldErrors.company && <span id="obCompany-error" className="ob-form-row__error" role="alert">{fieldErrors.company}</span>}
                  </div>
                  <div>
                    <label className="ob-form-label" htmlFor="obRoleType">{t.formLabelType} <span>{t.formLabelTypeRequired}</span></label>
                    <select className={`ob-form-select${fieldErrors.type ? ' is-invalid' : ''}`} id="obRoleType" value={form.type} onChange={e => setField('type', e.target.value)} aria-invalid={!!fieldErrors.type} aria-describedby={fieldErrors.type ? 'obRoleType-error' : undefined}>
                      <option value="">{t.formTypeDefault}</option>
                      <option value="internship">{t.formTypeInternship}</option>
                      <option value="apprenticeship">{t.formTypeApprenticeship}</option>
                      <option value="new grad">{t.formTypeNewGrad}</option>
                      <option value="fellowship">{t.formTypeFellowship}</option>
                      <option value="program">{t.formTypeProgram}</option>
                      <option value="scholarship">{t.formTypeScholarship}</option>
                    </select>
                    {fieldErrors.type && <span id="obRoleType-error" className="ob-form-row__error" role="alert">{fieldErrors.type}</span>}
                  </div>
                </div>
                <div className="ob-form-row">
                  <label className="ob-form-label" htmlFor="obLink">{t.formLabelLink} <span>{t.formLabelLinkRequired}</span></label>
                  <input className={`ob-form-input${fieldErrors.link ? ' is-invalid' : ''}`} type="url" id="obLink" placeholder={t.formPlaceholderLink} value={form.link} onChange={e => setField('link', e.target.value)} aria-invalid={!!fieldErrors.link} aria-describedby={fieldErrors.link ? 'obLink-error' : undefined} />
                  {fieldErrors.link && <span id="obLink-error" className="ob-form-row__error" role="alert">{fieldErrors.link}</span>}
                </div>
                <div className="ob-form-row ob-form-row-2">
                  <div>
                    <label className="ob-form-label" htmlFor="obDeadline">{t.formLabelDeadline}</label>
                    <input className="ob-form-input" type="text" id="obDeadline" placeholder={t.formPlaceholderDeadline} value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
                  </div>
                  <div>
                    <label className="ob-form-label" htmlFor="obEligibility">{t.formLabelEligibility}</label>
                    <input className="ob-form-input" type="text" id="obEligibility" placeholder={t.formPlaceholderEligibility} value={form.eligibility} onChange={e => setForm(f => ({ ...f, eligibility: e.target.value }))} />
                  </div>
                </div>
                <div className="ob-form-row ob-form-row-2">
                  <div>
                    <label className="ob-form-label" htmlFor="obLocation">{t.formLabelLocation}</label>
                    <input className="ob-form-input" type="text" id="obLocation" placeholder={t.formPlaceholderLocation} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                  </div>
                  <div>
                    <label className="ob-form-label" htmlFor="obPay">{t.formLabelPay}</label>
                    <input className="ob-form-input" type="text" id="obPay" placeholder={t.formPlaceholderPay} value={form.pay} onChange={e => setForm(f => ({ ...f, pay: e.target.value }))} />
                  </div>
                </div>
                <div className="ob-form-row">
                  <label className="ob-form-label" htmlFor="obWhy">{t.formLabelWhy} <span>{t.formLabelWhyRequired}</span></label>
                  <textarea className={`ob-form-textarea${fieldErrors.why ? ' is-invalid' : ''}`} id="obWhy" placeholder={t.formPlaceholderWhy} value={form.why} onChange={e => setField('why', e.target.value)} aria-invalid={!!fieldErrors.why} aria-describedby={fieldErrors.why ? 'obWhy-error' : undefined}></textarea>
                  {fieldErrors.why && <span id="obWhy-error" className="ob-form-row__error" role="alert">{fieldErrors.why}</span>}
                </div>
                <div className="ob-form-row">
                  <label className="ob-form-label" htmlFor="obEmail">{t.formLabelEmail} <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{t.formEmailOptional}</span></label>
                  <input
                    className={`ob-form-input${fieldErrors.email ? ' is-invalid' : ''}`}
                    type="email"
                    id="obEmail"
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
                    aria-describedby={fieldErrors.email ? 'obEmail-error' : undefined}
                  />
                  {fieldErrors.email && <span id="obEmail-error" className="ob-form-row__error" role="alert">{fieldErrors.email}</span>}
                </div>
                {formError && (
                  <div role="alert" className="ob-form-error-card">
                    <span className="ob-form-error-card__msg"><strong>{t.formErrorLabel}</strong> {formError}</span>
                    <button type="submit" className="ob-form-error-card__retry" disabled={formLoading}>{formLoading ? t.formSubmitting : t.formRetryLabel}</button>
                  </div>
                )}
                {turnstileError && <p role="alert" className="form-error-turnstile">{tForms.errorTurnstile}</p>}
                <Turnstile
                  className="ob-form-turnstile"
                  onToken={setTurnstileToken}
                  onError={() => setTurnstileError(true)}
                  resetRef={turnstileReset}
                />
                <button className="ob-form-btn" type="submit" disabled={formLoading || turnstileError || (TURNSTILE_ENABLED && !turnstileToken)}>
                  {formLoading ? t.formSubmitting : t.formSubmit}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      <hr className="ob-divider" />

      <section className="ob-eco">
        <div className="ob-eco__inner">
          <p className="ob-eco__kicker">{t.ecoKicker}</p>
          <h2 className="ob-eco__title">{t.ecoTitle}</h2>
          <p className="ob-eco__body">{t.ecoBody}</p>
          <div className="ob-eco__grid">
            {t.ecoLinks.filter(l => !GATED_ROUTES.includes(l.to)).map(l => (
              <Link key={l.to} to={l.to} className="ob-eco__link">
                <div className="ob-eco__link-title">{l.title}</div>
                <div className="ob-eco__link-desc">{l.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </ArticleLayout>
  )
}

