import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ArticleLayout from '../components/ArticleLayout'
import { useT } from '../hooks/useT'
import Turnstile, { TURNSTILE_ENABLED } from '../components/Turnstile'

const UPCOMING_PANELS = [
  {
    id: 'up1',
    date: 'May 20, 2026',
    calStart: '2026-05-20T18:30',
    calEnd: '2026-05-20T20:00',
    title: 'From Internship Search to First Offer',
    desc: 'A conversation about what actually changes between looking for internships and preparing for full-time roles. This panel focuses on timing, positioning, confidence, and the mistakes students make when they assume the same strategy works for both.',
    time: '6:30 PM ET',
    bestFor: 'Juniors, Seniors, Recent Grads',
    panelists: ['Campus recruiter at a major company', 'Recent graduate in a first full-time role', 'Student who converted an internship into an offer'],
    tags: [{ label: 'Internships', type: 'blue' }, { label: 'New Grad', type: 'gold' }, { label: 'Recruiting', type: 'muted' }],
    ctaKey: 'ctaReserve',
  },
  {
    id: 'up2',
    date: 'June 5, 2026',
    calStart: '2026-06-05T19:30',
    calEnd: '2026-06-05T21:00',
    title: 'First-Gen Voices in Tech',
    desc: 'A panel centered on the experiences first-generation students and professionals carry into internships, interviews, and full-time roles. This session is focused on honesty, language, confidence, and navigating spaces that were not built with everyone in mind.',
    time: '7:30 PM ET',
    bestFor: 'First-Gen, Transfer, Underrepresented',
    panelists: ['First-gen software engineer', 'First-gen product or data professional', 'Student leader or community advocate'],
    tags: [{ label: 'First-Gen in Tech', type: 'teal' }, { label: 'Community', type: 'blue' }, { label: 'Identity', type: 'muted' }],
    ctaKey: 'ctaRsvpZoom',
  },
  {
    id: 'up3',
    date: 'June 18, 2026',
    calStart: '2026-06-18T19:00',
    calEnd: '2026-06-18T20:30',
    title: 'What Recruiters Wish Students Knew Earlier',
    desc: 'A practical session with recruiters and early-career hiring voices about resumes, outreach, interview signals, application timing, and the small things students do that either help them stand out or quietly knock them out of the process.',
    time: '7:00 PM ET',
    bestFor: 'Anyone in internship or new grad recruiting',
    panelists: ['University recruiter', 'Program manager or talent partner', 'Early-career professional on what worked'],
    tags: [{ label: 'Recruiting', type: 'navy' }, { label: 'Interviewing', type: 'blue' }, { label: 'Resume', type: 'muted' }],
    ctaKey: 'ctaSaveSpot',
  },
]

const ARCHIVE_CARDS = [
  {
    id: 'takeaways-1',
    topics: ['bridge-year', 'internships', 'new-grad'],
    date: 'April 3, 2026',
    title: 'Still Recruiting in April: What Now?',
    recap: 'A candid conversation for students and recent grads still searching late in the cycle. The panel focused on how to reset your search, where to look next, how to talk about your timeline without shame, and what kinds of roles and programs still make sense when things did not go according to plan.',
    panelists: 'Recent grad in a bridge-year search · Professional who found a late-cycle opportunity · Community builder supporting first-gen students',
    tags: [{ label: 'Bridge Year', type: 'accent' }, { label: 'Late-Cycle Recruiting', type: 'gold' }, { label: 'Internships', type: 'teal' }, { label: 'Confidence', type: 'muted' }, { label: 'New Grad', type: 'muted' }],
    takeaways: [
      'Late-cycle recruiting is real, but requires a narrower and more intentional strategy - not more applications.',
      'Students often need better positioning and a clearer narrative, not just more volume in their search.',
      'Alternative entry points like apprenticeships and niche fellowships matter more than most people realize late in the cycle.',
      'Talking about your timeline without shame is a skill - and it is one you can practice and get better at before the interview room.',
    ],
  },
  {
    id: 'takeaways-2',
    topics: ['interviewing', 'first-gen'],
    date: 'March 14, 2026',
    title: 'How to Navigate Rejection Without Spiraling',
    recap: 'This session focused on the emotional and strategic side of recruiting setbacks. Panelists discussed how to process rejection, learn from interviews, protect confidence, and keep moving without losing momentum or identity in the process.',
    panelists: 'Early-career professional · Student mental health and support voice · Student leader who navigated repeated rejection',
    tags: [{ label: 'Interviewing', type: 'blue' }, { label: 'Resilience', type: 'accent' }, { label: 'First-Gen', type: 'teal' }, { label: 'Confidence', type: 'muted' }],
    takeaways: [
      'Rejection is data, not a verdict - the way you process it determines whether it becomes information or identity.',
      'Building a short post-rejection ritual (reflect, document, reset) helps break the spiral faster than pushing straight into more applications.',
      'First-gen students are statistically more likely to over-personalize rejection - separating performance from worth is a core skill to develop early.',
      'The students who bounce back quickest usually have one trusted person in their corner who normalizes the experience.',
    ],
  },
  {
    id: 'takeaways-3',
    topics: ['networking'],
    date: 'February 22, 2026',
    title: 'Coffee Chats That Actually Lead Somewhere',
    recap: 'A session about how to approach networking without sounding transactional, how to ask better questions, and how to turn one conversation into long-term connection and career insight.',
    panelists: 'Technical recruiter · Recent grad in their first role · Student community leader',
    tags: [{ label: 'Networking', type: 'navy' }, { label: 'Coffee Chats', type: 'blue' }, { label: 'LinkedIn', type: 'gold' }, { label: 'Relationships', type: 'muted' }],
    takeaways: [
      'The best first messages are specific, short, and show you actually read the other person\'s profile - not templated.',
      'Asking "what do you wish someone had told you at my stage?" almost always unlocks the most honest, useful parts of the conversation.',
      'A coffee chat only "leads somewhere" if you follow up within 48 hours and stay in touch in a non-transactional way after.',
      'Most people in tech are genuinely willing to talk - the barrier is almost always on the student side, not the professional side.',
    ],
  },
]

function addToCalendar(title, start, end) {
  const startStr = start.replace(/[-:]/g, '') + '00'
  const endStr = end.replace(/[-:]/g, '') + '00'
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//JoseJocelyn//Panels//EN',
    'BEGIN:VEVENT',
    'DTSTART:' + startStr,
    'DTEND:' + endStr,
    'SUMMARY:' + title + ' - J&J Partner Panel',
    'DESCRIPTION:Hosted by Jose Cruz-Lopez and Jocelyn Vazquez. Live on Zoom.',
    'URL:https://josejocelyn.com/partner-panels',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
  const blob = new Blob([ics], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.ics'
  // Some browsers (notably older Firefox) only fire the download reliably
  // when the anchor is actually in the DOM at click time.
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revocation so the browser has started the download before the
  // blob URL is invalidated, rather than racing it immediately after click().
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export default function PartnerPanels() {
  const t = useT('partnerPanels')
  const [openTakeaway, setOpenTakeaway] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const topicChips = t.topicChips || []
  const validTopicKeys = topicChips.map(c => c.key)
  const urlTopic = searchParams.get('topic') || ''
  const activeTopic = urlTopic && validTopicKeys.includes(urlTopic) ? urlTopic : 'all'
  const setActiveTopic = key => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (!key || key === 'all') next.delete('topic')
      else next.set('topic', key)
      return next
    }, { replace: true })
  }
  const filtersRef = useRef(null)

  useEffect(() => {
    const onKeyDown = e => {
      if (e.key !== '/') return
      const el = document.activeElement
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return
      const firstChip = filtersRef.current?.querySelector('button')
      if (firstChip) {
        e.preventDefault()
        firstChip.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
  const [mode, setMode] = useState('suggest')
  const [suggestSubmitted, setSuggestSubmitted] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestError, setSuggestError] = useState('')
  const [suggestTurnstileToken, setSuggestTurnstileToken] = useState('')
  const suggestTurnstileReset = useRef(null)
  const [panelistSubmitted, setPanelistSubmitted] = useState(false)
  const [panelistLoading, setPanelistLoading] = useState(false)
  const [panelistError, setPanelistError] = useState('')
  const [panelistTurnstileToken, setPanelistTurnstileToken] = useState('')
  const panelistTurnstileReset = useRef(null)
  const [suggestForm, setSuggestForm] = useState({ topic: '', why: '', stage: '', stageOther: '', category: '', categoryOther: '', email: '' })
  const [panelistForm, setPanelistForm] = useState({ name: '', email: '', linkedin: '', role: '', topic: '', interest: '', notes: '' })

  const filteredArchive = activeTopic === 'all'
    ? ARCHIVE_CARDS
    : ARCHIVE_CARDS.filter(c => c.topics.includes(activeTopic))

  function toggleTakeaway(id) {
    setOpenTakeaway(prev => prev === id ? null : id)
  }

  function tintFromTags(tags) {
    const first = tags?.find(t => t.type && t.type !== 'muted')
    return first ? first.type : ''
  }

  async function submitSuggest(e) {
    e.preventDefault()
    const stageOtherNeeded = suggestForm.stage === 'Other' && !suggestForm.stageOther.trim()
    const categoryOtherNeeded = suggestForm.category === 'Other' && !suggestForm.categoryOther.trim()
    if (!suggestForm.topic || !suggestForm.why || !suggestForm.stage || !suggestForm.category || stageOtherNeeded || categoryOtherNeeded) {
      setSuggestError(t.suggestErrorRequired)
      return
    }
    if (TURNSTILE_ENABLED && !suggestTurnstileToken) {
      setSuggestError(t.suggestErrorGeneric)
      return
    }
    const stagePayload = suggestForm.stage === 'Other'
      ? `Other: ${suggestForm.stageOther.trim()}`
      : suggestForm.stage
    const categoryPayload = suggestForm.category === 'Other'
      ? `Other: ${suggestForm.categoryOther.trim()}`
      : suggestForm.category
    setSuggestLoading(true)
    setSuggestError('')
    // Suggestion now flows through the Turnstile-gated submit-form edge function
    // (service role) — the direct anon INSERT on panel_suggestions is revoked
    // (migration 019) so the open write-spam path is closed.
    let ok = false
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-form`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          type: 'panel_suggestion',
          turnstileToken: suggestTurnstileToken,
          payload: {
            topic: suggestForm.topic,
            why_helpful: suggestForm.why,
            stage: stagePayload,
            category: categoryPayload,
            email: suggestForm.email || null,
          },
        }),
      })
      ok = res.ok
    } catch {
      ok = false
    }
    setSuggestLoading(false)
    if (ok) {
      setSuggestSubmitted(true)
      setSuggestTurnstileToken('')
      suggestTurnstileReset.current?.()
    } else {
      setSuggestError(t.suggestErrorGeneric)
      setSuggestTurnstileToken('')
      suggestTurnstileReset.current?.()
    }
  }

  async function submitPanelist(e) {
    e.preventDefault()
    if (!panelistForm.name || !panelistForm.email || !panelistForm.linkedin || !panelistForm.role || !panelistForm.topic || !panelistForm.interest) {
      setPanelistError(t.panelistErrorRequired)
      return
    }
    if (TURNSTILE_ENABLED && !panelistTurnstileToken) {
      setPanelistError(t.panelistErrorGeneric)
      return
    }
    setPanelistLoading(true)
    setPanelistError('')
    // Insert now flows through the Turnstile-gated submit-form edge function
    // (service role). status is forced to 'pending' server-side (moderation queue).
    let ok = false
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-form`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          type: 'panelist',
          turnstileToken: panelistTurnstileToken,
          payload: {
            name: panelistForm.name,
            email: panelistForm.email,
            linkedin_url: panelistForm.linkedin,
            role_title: panelistForm.role,
            topic: panelistForm.topic,
            interested_in: panelistForm.interest,
            notes: panelistForm.notes || null,
          },
        }),
      })
      ok = res.ok
    } catch {
      ok = false
    }
    setPanelistLoading(false)
    if (!ok) {
      setPanelistError(t.panelistErrorGeneric)
      setPanelistTurnstileToken('')
      panelistTurnstileReset.current?.()
    } else {
      setPanelistSubmitted(true)
      setPanelistTurnstileToken('')
      panelistTurnstileReset.current?.()
    }
  }

  return (
    <ArticleLayout title={`${t.heroTitlePrefix}${t.heroTitleEm}`}>
      <style>{`
        html, body { background: var(--color-cream); }

        .pp-wrap {
          max-width: 1040px;
          margin: 0 auto;
          padding-left: clamp(20px,5vw,56px);
          padding-right: clamp(20px,5vw,56px);
        }

        .pp-kicker {
          font-size: 11px; font-weight: 700; letter-spacing: .14em;
          text-transform: uppercase; color: var(--color-muted); margin-bottom: 14px;
        }
        .pp-section-title {
          font-family: var(--font-display);
          font-size: clamp(26px,4vw,40px); font-weight: 700;
          color: var(--color-dark); line-height: 1.15; margin-bottom: 10px;
        }
        .pp-section-sub {
          font-family: var(--font-display);
          font-size: clamp(16px,2vw,20px); font-weight: 400;
          color: var(--color-accent); margin-bottom: 20px;
        }
        .pp-section-body {
          font-size: clamp(15px,1.8vw,17px); color: var(--color-muted);
          line-height: 1.75; max-width: 700px;
        }
        .pp-section-body strong { color: var(--color-dark); font-weight: 600; }
        .pp-divider { border: none; border-top: 1px solid rgba(0,0,0,.08); margin: 0; }

        .pp-tag {
          display: inline-block; font-size: 10px; font-weight: 700;
          letter-spacing: .06em; text-transform: uppercase;
          padding: 3px 8px; border-radius: 4px;
        }
        .pp-tag--blue    { background: rgba(91,142,194,.12);  color: var(--color-blue); }
        .pp-tag--teal    { background: rgba(58,125,107,.1);   color: var(--color-teal); }
        .pp-tag--gold    { background: rgba(232,168,56,.14);  color: var(--color-gold-dark); }
        .pp-tag--accent  { background: rgba(179,69,57,.1);    color: var(--color-accent); }
        .pp-tag--navy    { background: rgba(22,43,68,.1);     color: var(--color-navy); }
        .pp-tag--muted   { background: rgba(0,0,0,.06);       color: var(--color-muted); }

        .pp-btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 13px 26px; background: var(--color-dark);
          color: var(--color-cream); border-radius: 8px;
          font-family: var(--font-display); font-size: 14px; font-weight: 600;
          text-decoration: none; border: 1.5px solid var(--color-dark); cursor: pointer;
          transition: background .2s, transform .18s cubic-bezier(.16,1,.3,1);
        }
        .pp-btn-primary:hover { background: var(--color-accent); border-color: var(--color-accent); transform: translateY(-1px); }
        .pp-btn-secondary {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 13px 26px; background: transparent;
          color: var(--color-dark); border-radius: 8px;
          font-family: var(--font-display); font-size: 14px; font-weight: 600;
          text-decoration: none; border: 1.5px solid rgba(0,0,0,.2); cursor: pointer;
          transition: border-color .2s, color .2s, transform .18s cubic-bezier(.16,1,.3,1);
        }
        .pp-btn-secondary:hover { border-color: var(--color-dark); color: var(--color-accent); transform: translateY(-1px); }

        /* DISABLED / COMING-SOON CTA STATE */
        .pp-cta--disabled,
        a.pp-cta--disabled,
        button.pp-cta--disabled {
          opacity: .55; cursor: not-allowed; pointer-events: none;
          background: transparent !important;
          color: var(--color-muted) !important;
          border-color: rgba(0,0,0,.12) !important;
          box-shadow: none !important;
        }
        .pp-cta--disabled::after { content: ' · soon'; font-size: .85em; opacity: .7; letter-spacing: 0; }

        /* HERO */
        .pp-hero {
          padding: 120px clamp(20px,5vw,56px) 64px;
          max-width: 1040px; margin: 0 auto;
        }
        .pp-hero__kicker {
          font-size: 11px; font-weight: 700; letter-spacing: .14em;
          text-transform: uppercase; color: var(--color-muted); margin-bottom: 18px;
        }
        .pp-hero__title {
          font-family: var(--font-display);
          font-size: clamp(42px,7vw,80px); font-weight: 700;
          line-height: 1.04; color: var(--color-dark); margin-bottom: 14px;
        }
        .pp-hero__title em { font-style: normal; color: var(--color-gold); }
        .pp-hero__sub {
          font-family: var(--font-display);
          font-size: clamp(18px,2.5vw,26px); font-weight: 400;
          color: var(--color-dark); line-height: 1.4;
          max-width: 700px; margin-bottom: 22px;
        }
        .pp-hero__body {
          font-size: clamp(15px,1.8vw,17px); color: var(--color-muted);
          line-height: 1.8; max-width: 680px; margin-bottom: 36px;
        }
        .pp-hero__body strong { color: var(--color-dark); font-weight: 600; }
        .pp-hero__ctas { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 48px; }

        .pp-stats {
          display: flex; flex-wrap: wrap; gap: 36px;
          padding-top: 32px;
          border-top: 1px solid rgba(0,0,0,.08);
        }
        .pp-stat__num {
          font-family: var(--font-display);
          font-size: clamp(28px,4vw,40px); font-weight: 700;
          color: var(--color-dark); line-height: 1;
        }
        .pp-stat__num em { font-style: normal; color: var(--color-gold); }
        .pp-stat__label { font-size: 13px; color: var(--color-muted); margin-top: 5px; }

        /* FEATURED */
        .pp-featured {
          max-width: 1040px; margin: 0 auto;
          padding: 80px clamp(20px,5vw,56px) 88px;
        }
        .pp-featured__head { margin-bottom: 28px; }
        .pp-featured-card {
          background: linear-gradient(180deg, rgba(255,250,242,.9) 0%, rgba(255,250,242,.6) 100%);
          border: 1px solid rgba(26,25,22,.14);
          border-radius: 20px; overflow: hidden;
          display: grid; grid-template-columns: 1fr 340px;
          min-height: 380px;
          box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 10px 30px -16px rgba(63,42,28,.18);
        }
        .pp-featured-card__body {
          padding: clamp(28px,4vw,52px);
          display: flex; flex-direction: column; gap: 18px;
        }
        .pp-featured-card__eyebrow {
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        }
        .pp-featured-card__live-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 12px; border-radius: 20px;
          background: rgba(58,125,107,.1); color: var(--color-teal);
          font-size: 11px; font-weight: 700; letter-spacing: .08em;
          text-transform: uppercase;
        }
        .pp-featured-card__live-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--color-teal); flex-shrink: 0;
          animation: pulseDot 1.8s ease-in-out infinite;
        }
        @keyframes pulseDot {
          0%,100% { opacity: 1; transform: scale(1); }
          50%      { opacity: .4; transform: scale(.75); }
        }
        .pp-featured-card__title {
          font-family: var(--font-display);
          font-size: clamp(22px,3vw,32px); font-weight: 700;
          color: var(--color-dark); line-height: 1.2;
        }
        .pp-featured-card__desc {
          font-size: clamp(14px,1.6vw,15px); color: var(--color-muted);
          line-height: 1.75; flex: 1;
        }
        .pp-featured-card__desc strong { color: var(--color-dark); font-weight: 600; }
        .pp-featured-card__panelists { display: flex; flex-direction: column; gap: 6px; }
        .pp-featured-card__panelists-label {
          font-size: 10px; font-weight: 700; letter-spacing: .1em;
          text-transform: uppercase; color: var(--color-muted); margin-bottom: 4px;
        }
        .pp-featured-card__panelist {
          font-size: 13px; color: var(--color-muted); line-height: 1.5;
          display: flex; align-items: flex-start; gap: 8px;
        }
        .pp-featured-card__panelist::before {
          content: ''; flex-shrink: 0; width: 5px; height: 5px; border-radius: 50%;
          background: var(--color-gold); margin-top: 8px; opacity: .85;
        }
        .pp-featured-card__actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; }
        .pp-featured-card__note {
          font-size: 12px; color: var(--color-muted);
          line-height: 1.55; margin-top: 10px; font-style: italic;
        }
        .pp-featured-card__sidebar {
          padding: clamp(24px,3vw,40px);
          background: linear-gradient(180deg, rgba(232,168,56,.08) 0%, rgba(255,250,242,.4) 100%);
          display: flex; flex-direction: column; gap: 22px;
          border-left: 1px solid rgba(232,168,56,.18);
        }
        .pp-featured-card__detail-label {
          font-size: 10px; font-weight: 700; letter-spacing: .1em;
          text-transform: uppercase; color: var(--color-muted); margin-bottom: 2px;
        }
        .pp-featured-card__detail-value {
          font-size: clamp(13px,1.5vw,14px); color: var(--color-dark); font-weight: 600;
        }
        .pp-featured-card__detail-sub { font-size: 12px; color: var(--color-muted); margin-top: 1px; }

        @media (max-width: 760px) {
          .pp-featured-card { grid-template-columns: 1fr; }
          .pp-featured-card__sidebar { border-left: none; border-top: 1px solid rgba(232,168,56,.18); }
        }

        /* UPCOMING */
        .pp-upcoming {
          max-width: 1040px; margin: 0 auto;
          padding: 80px clamp(20px,5vw,56px) 88px;
        }
        .pp-upcoming__head { margin-bottom: 32px; }
        .pp-upcoming__grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .pp-panel-card--featured {
          grid-column: 1 / -1;
          padding: 36px 36px 30px;
          background: linear-gradient(180deg, rgba(232,168,56,.5) 0%, rgba(232,168,56,.18) 28%, rgba(255,250,242,.55) 58%);
          border-color: rgba(232,168,56,.65);
          display: grid; grid-template-columns: 1.3fr 1fr; column-gap: 36px; row-gap: 14px;
        }
        .pp-panel-card--featured:hover {
          border-color: rgba(232,168,56,.62);
          box-shadow: 0 1px 0 rgba(255,255,255,.7) inset, 0 22px 44px -16px rgba(232,168,56,.38);
        }
        .pp-panel-card--featured > .pp-panel-card__featured-tag { grid-column: 1 / -1; }
        .pp-panel-card--featured > .pp-panel-card__date-badge { grid-column: 1 / -1; }
        .pp-panel-card--featured > .pp-panel-card__title { grid-column: 1; }
        .pp-panel-card--featured > .pp-panel-card__desc { grid-column: 1; grid-row: span 2; }
        .pp-panel-card--featured > .pp-panel-card__meta { grid-column: 2; grid-row: 3; }
        .pp-panel-card--featured > .pp-panel-card__panelists { grid-column: 2; grid-row: 4; }
        .pp-panel-card--featured > .pp-panel-card__tags { grid-column: 1 / -1; }
        .pp-panel-card--featured > .pp-panel-card__actions { grid-column: 1 / -1; }

        /* Per-topic tint variants — mirrors CT's --outreach/--apply/--interview/--offers/--job system.
           Tints boosted ~2x from initial pass since PP cards are wider/taller and the previous .06-.09
           opacities read as washed out at this scale. */
        .pp-panel-card--blue    { background: linear-gradient(180deg, rgba(91,142,194,.45) 0%, rgba(91,142,194,.17) 28%, rgba(255,250,242,.55) 58%); border-color: rgba(91,142,194,.6); }
        .pp-panel-card--teal    { background: linear-gradient(180deg, rgba(58,125,107,.45) 0%, rgba(58,125,107,.17) 28%, rgba(255,250,242,.55) 58%); border-color: rgba(58,125,107,.6); }
        .pp-panel-card--gold    { background: linear-gradient(180deg, rgba(232,168,56,.5)  0%, rgba(232,168,56,.18) 28%, rgba(255,250,242,.55) 58%); border-color: rgba(232,168,56,.65); }
        .pp-panel-card--accent  { background: linear-gradient(180deg, rgba(179,69,57,.4)   0%, rgba(179,69,57,.15)  28%, rgba(255,250,242,.55) 58%); border-color: rgba(179,69,57,.55); }
        .pp-panel-card--navy    { background: linear-gradient(180deg, rgba(22,43,68,.35)   0%, rgba(22,43,68,.13)   28%, rgba(255,250,242,.55) 58%); border-color: rgba(22,43,68,.55); }
        .pp-panel-card--blue:hover    { border-color: rgba(91,142,194,.52); box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 18px 36px -14px rgba(91,142,194,.32); }
        .pp-panel-card--teal:hover    { border-color: rgba(58,125,107,.55); box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 18px 36px -14px rgba(58,125,107,.32); }
        .pp-panel-card--gold:hover    { border-color: rgba(232,168,56,.6);  box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 18px 36px -14px rgba(232,168,56,.32); }
        .pp-panel-card--accent:hover  { border-color: rgba(179,69,57,.5);   box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 18px 36px -14px rgba(179,69,57,.3); }
        .pp-panel-card--navy:hover    { border-color: rgba(22,43,68,.55);   box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 18px 36px -14px rgba(22,43,68,.32); }

        .pp-archive-card--blue    { background: linear-gradient(180deg, rgba(91,142,194,.45) 0%, rgba(91,142,194,.17) 28%, rgba(255,250,242,.55) 58%); border-color: rgba(91,142,194,.6); }
        .pp-archive-card--teal    { background: linear-gradient(180deg, rgba(58,125,107,.45) 0%, rgba(58,125,107,.17) 28%, rgba(255,250,242,.55) 58%); border-color: rgba(58,125,107,.6); }
        .pp-archive-card--gold    { background: linear-gradient(180deg, rgba(232,168,56,.5)  0%, rgba(232,168,56,.18) 28%, rgba(255,250,242,.55) 58%); border-color: rgba(232,168,56,.65); }
        .pp-archive-card--accent  { background: linear-gradient(180deg, rgba(179,69,57,.4)   0%, rgba(179,69,57,.15)  28%, rgba(255,250,242,.55) 58%); border-color: rgba(179,69,57,.55); }
        .pp-archive-card--navy    { background: linear-gradient(180deg, rgba(22,43,68,.35)   0%, rgba(22,43,68,.13)   28%, rgba(255,250,242,.55) 58%); border-color: rgba(22,43,68,.55); }
        .pp-archive-card--blue:hover    { border-color: rgba(91,142,194,.52); box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 16px 32px -14px rgba(91,142,194,.32); }
        .pp-archive-card--teal:hover    { border-color: rgba(58,125,107,.55); box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 16px 32px -14px rgba(58,125,107,.32); }
        .pp-archive-card--gold:hover    { border-color: rgba(232,168,56,.6);  box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 16px 32px -14px rgba(232,168,56,.32); }
        .pp-archive-card--accent:hover  { border-color: rgba(179,69,57,.5);   box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 16px 32px -14px rgba(179,69,57,.3); }
        .pp-archive-card--navy:hover    { border-color: rgba(22,43,68,.55);   box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 16px 32px -14px rgba(22,43,68,.32); }
        .pp-panel-card--featured .pp-panel-card__title {
          font-size: clamp(20px,2.5vw,26px);
        }
        .pp-panel-card--featured .pp-panel-card__date-badge {
          background: var(--color-gold);
          color: var(--color-dark);
        }
        .pp-panel-card__featured-tag {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 10px; font-weight: 700; letter-spacing: .12em;
          text-transform: uppercase; color: var(--color-accent);
          margin-bottom: -4px;
        }
        .pp-panel-card__featured-tag::before {
          content: ''; width: 16px; height: 1px; background: var(--color-accent); opacity: .6;
        }
        @media (max-width: 760px) {
          .pp-upcoming__grid { grid-template-columns: 1fr; }
          .pp-panel-card--featured {
            grid-column: auto; padding: 26px;
            grid-template-columns: 1fr;
          }
          .pp-panel-card--featured > .pp-panel-card__title,
          .pp-panel-card--featured > .pp-panel-card__desc,
          .pp-panel-card--featured > .pp-panel-card__meta,
          .pp-panel-card--featured > .pp-panel-card__panelists { grid-column: 1; grid-row: auto; }
        }
        .pp-panel-card {
          background: linear-gradient(180deg, rgba(255,250,242,.85) 0%, rgba(255,250,242,.55) 100%);
          border: 1px solid rgba(26,25,22,.13);
          border-radius: 16px; padding: 26px;
          display: flex; flex-direction: column; gap: 14px;
          box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 4px 12px -6px rgba(63,42,28,.12);
          transition: transform .28s cubic-bezier(.16,1,.3,1), box-shadow .28s cubic-bezier(.16,1,.3,1), border-color .28s;
        }
        .pp-panel-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 16px 36px -12px rgba(63,42,28,.22);
          border-color: rgba(26,25,22,.22);
        }
        .pp-panel-card__date-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(232,168,56,.12); color: var(--color-gold);
          font-size: 11px; font-weight: 700;
          padding: 5px 11px; border-radius: 6px; align-self: flex-start;
        }
        .pp-panel-card__title {
          font-family: var(--font-display);
          font-size: clamp(16px,1.9vw,19px); font-weight: 700;
          color: var(--color-dark); line-height: 1.25;
        }
        .pp-panel-card__desc { font-size: 13px; color: var(--color-muted); line-height: 1.7; flex: 1; }
        .pp-panel-card__meta { display: flex; flex-direction: column; gap: 5px; }
        .pp-panel-card__meta-row {
          display: flex; align-items: center; gap: 8px;
          font-size: 12px; color: var(--color-muted);
        }
        .pp-panel-card__meta-icon { flex-shrink: 0; display: inline-flex; color: var(--color-gold-dark); opacity: .8; }
        .pp-panel-card__meta-icon svg { width: 13px; height: 13px; stroke-width: 1.6; }
        .pp-panel-card__meta-val { font-weight: 500; color: var(--color-dark); }
        .pp-panel-card__panelists { font-size: 12px; color: var(--color-muted); line-height: 1.65; }
        .pp-panel-card__panelists strong { color: var(--color-dark); font-weight: 600; font-size: 11px; letter-spacing:.04em; text-transform:uppercase; display:block; margin-bottom:4px; }
        .pp-panel-card__tags { display: flex; flex-wrap: wrap; gap: 5px; }
        .pp-panel-card__actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
        .pp-panel-card__cta-primary {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          padding: 13px 16px; background: var(--color-dark); color: var(--color-cream);
          border-radius: 8px; font-family: var(--font-display); font-size: 12px; font-weight: 600;
          text-decoration: none; border: none; cursor: pointer; flex: 1;
          transition: background .2s, transform .15s;
        }
        .pp-panel-card__cta-primary:hover { background: var(--color-accent); transform: translateY(-1px); }
        .pp-panel-card__cta-sm {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 13px 12px; background: transparent;
          color: var(--color-muted); border-radius: 8px;
          font-family: var(--font-display); font-size: 11px; font-weight: 600;
          text-decoration: none; border: 1.5px solid rgba(0,0,0,.12); cursor: pointer; flex-shrink: 0;
          transition: border-color .2s, color .2s;
        }
        .pp-panel-card__cta-sm:hover { border-color: var(--color-dark); color: var(--color-dark); }

        @media (max-width: 560px) { .pp-upcoming__grid { grid-template-columns: 1fr; } }

        /* ARCHIVE */
        .pp-archive {
          max-width: 1040px; margin: 0 auto;
          padding: 80px clamp(20px,5vw,56px) 88px;
        }
        .pp-archive__head { margin-bottom: 24px; }
        .pp-archive .pp-topics__chips { margin-bottom: 28px; }
        .pp-archive__list { display: flex; flex-direction: column; gap: 16px; }
        .pp-archive-card {
          background: linear-gradient(180deg, rgba(255,250,242,.85) 0%, rgba(255,250,242,.55) 100%);
          border: 1px solid rgba(26,25,22,.13);
          border-radius: 16px; overflow: hidden;
          box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 4px 12px -6px rgba(63,42,28,.1);
          transition: border-color .28s, box-shadow .28s, transform .28s cubic-bezier(.16,1,.3,1);
        }
        .pp-archive-card:hover {
          border-color: rgba(26,25,22,.22);
          box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 14px 30px -14px rgba(63,42,28,.22);
          transform: translateY(-2px);
        }
        .pp-archive-card__main {
          padding: 26px 28px;
          display: grid; grid-template-columns: 1fr auto;
          gap: 20px; align-items: flex-start;
        }
        .pp-archive-card__date {
          font-size: 11px; font-weight: 700; letter-spacing: .08em;
          text-transform: uppercase; color: var(--color-muted); margin-bottom: 8px;
        }
        .pp-archive-card__title {
          font-family: var(--font-display);
          font-size: clamp(17px,2.2vw,22px); font-weight: 700;
          color: var(--color-dark); line-height: 1.2; margin-bottom: 10px;
        }
        .pp-archive-card__recap {
          font-size: 13px; color: var(--color-muted); line-height: 1.75;
          max-width: 560px; margin-bottom: 12px;
        }
        .pp-archive-card__panelists {
          font-size: 12px; color: var(--color-muted); margin-bottom: 10px; line-height: 1.6;
        }
        .pp-archive-card__panelists strong { color: var(--color-dark); font-weight: 600; }
        .pp-archive-card__tags { display: flex; flex-wrap: wrap; gap: 5px; }
        .pp-archive-card__actions {
          display: flex; flex-direction: column; gap: 8px;
          flex-shrink: 0; min-width: min(150px, 100%); align-items: stretch;
        }
        .pp-archive-card__cta {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          padding: 13px 14px; border-radius: 8px;
          font-family: var(--font-display); font-size: 12px; font-weight: 600;
          text-decoration: none; border: 1.5px solid; cursor: pointer;
          transition: background .2s, color .2s, border-color .2s, transform .15s;
          text-align: center; background: none;
        }
        .pp-archive-card__cta--watch { background: var(--color-accent); color: var(--color-cream); border-color: var(--color-accent); }
        .pp-archive-card__cta--watch:hover { background: oklch(from var(--color-accent) calc(l - 0.05) c h); border-color: transparent; transform: translateY(-1px); }
        .pp-archive-card__cta--flyer { color: var(--color-muted); border-color: rgba(0,0,0,.12); }
        .pp-archive-card__cta--flyer:hover { border-color: var(--color-dark); color: var(--color-dark); }
        .pp-archive-card__cta--takeaways { color: var(--color-teal); border-color: rgba(58,125,107,.25); }
        .pp-archive-card__cta--takeaways:hover { background: rgba(58,125,107,.06); }

        .pp-takeaways {
          display: grid; grid-template-rows: 0fr;
          transition: grid-template-rows .4s cubic-bezier(.16,1,.3,1);
          border-top: 1px solid rgba(0,0,0,.08);
          background: rgba(0,0,0,.02);
        }
        .pp-takeaways.open { grid-template-rows: 1fr; }
        .pp-takeaways__inner {
          overflow: hidden; min-height: 0;
          padding: 22px 28px;
        }
        .pp-takeaways__title {
          font-size: 11px; font-weight: 700; letter-spacing: .1em;
          text-transform: uppercase; color: var(--color-teal); margin-bottom: 12px;
        }
        .pp-takeaways__list { display: flex; flex-direction: column; gap: 10px; }
        .pp-takeaways__item {
          display: flex; align-items: flex-start; gap: 10px;
          font-size: 13px; color: var(--color-muted); line-height: 1.65;
        }
        .pp-takeaways__item::before {
          content: '→'; color: var(--color-teal); flex-shrink: 0; font-weight: 700; font-size: 12px; margin-top: 1px;
        }

        @media (max-width: 640px) {
          .pp-archive-card__main { grid-template-columns: 1fr; }
          .pp-archive-card__actions { flex-direction: row; flex-wrap: wrap; }
        }

        /* MID-PAGE BRIDGE CTA (ported from CC/LS) */
        .pp-bridge { max-width: 1040px; margin: 0 auto; padding: 0 clamp(20px,5vw,56px) 24px; }
        .pp-bridge__inner {
          display: flex; align-items: center; justify-content: space-between; gap: 24px;
          flex-wrap: wrap; padding: 24px 28px;
          background: rgba(232,168,56,.06);
          border: 1px solid rgba(232,168,56,.22);
          border-radius: 14px;
        }
        .pp-bridge__copy {
          font-family: var(--font-display);
          font-size: clamp(17px,2vw,21px); font-weight: 600;
          color: var(--color-dark); line-height: 1.3; letter-spacing: -.005em;
        }
        .pp-bridge__copy em {
          font-style: italic;
          font-family: var(--font-serif, var(--font-display));
          color: var(--color-gold-dark); font-weight: 500;
        }
        .pp-bridge__cta {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 11px 20px; background: var(--color-dark); color: var(--color-cream);
          border-radius: 999px; font-family: var(--font-display);
          font-size: 13px; font-weight: 700; letter-spacing: -.005em;
          text-decoration: none;
          box-shadow: 0 6px 14px -8px rgba(63,42,28,.4), inset 0 1px 0 rgba(255,255,255,.08);
          transition: background .25s, transform .22s cubic-bezier(.16,1,.3,1), box-shadow .25s;
        }
        .pp-bridge__cta:hover {
          background: var(--color-teal); transform: translateY(-1px);
          box-shadow: 0 12px 22px -10px rgba(58,125,107,.5);
        }
        .pp-bridge__cta::after { content: '↓'; font-size: 13px; line-height: 1; }
        @media (prefers-reduced-motion: reduce) {
          .pp-bridge__cta { transition: none !important; }
          .pp-bridge__cta:hover { transform: none !important; }
        }

        /* TOPICS */
        .pp-topics {
          max-width: 1040px; margin: 0 auto;
          padding: 80px clamp(20px,5vw,56px) 88px;
        }
        .pp-topics__head { margin-bottom: 28px; }
        .pp-topics__chips { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 24px; }
        .pp-topic-chip {
          display: inline-flex; flex-direction: column; align-items: flex-start; gap: 1px;
          padding: 9px 16px;
          border: 1.5px solid rgba(0,0,0,.1);
          border-radius: 14px;
          font-family: var(--font-body);
          color: var(--color-muted); cursor: pointer;
          transition: border-color .18s, color .18s, background .18s, transform .15s cubic-bezier(.16,1,.3,1);
          user-select: none;
          text-align: left; min-width: 0;
        }
        .pp-topic-chip:hover { border-color: var(--color-dark); color: var(--color-dark); transform: translateY(-1px); }
        .pp-topic-chip:active { transform: translateY(0); }
        .pp-topic-chip.active { border-color: var(--color-navy); background: var(--color-navy); color: var(--color-cream); }
        .pp-topic-chip__label { font-size: 13px; font-weight: 700; letter-spacing: -.005em; line-height: 1.2; }
        .pp-topic-chip__desc { font-size: 10.5px; font-weight: 500; opacity: .72; line-height: 1.2; letter-spacing: .005em; }
        .pp-topic-chip.active .pp-topic-chip__desc { opacity: .85; }
        @media (prefers-reduced-motion: reduce) {
          .pp-topic-chip { transition: none !important; }
          .pp-topic-chip:hover { transform: none !important; }
        }
        .pp-topics__note {
          font-size: clamp(14px,1.6vw,15px); color: var(--color-muted); line-height: 1.7;
          max-width: 640px; font-style: italic; margin-top: 4px;
        }

        /* FAQ (side-by-side list — not an accordion, per audit rules) */
        .pp-faq {
          max-width: 1040px; margin: 0 auto;
          padding: 80px clamp(20px,5vw,56px) 88px;
        }
        .pp-faq__head { margin-bottom: 32px; max-width: 640px; }
        .pp-faq__title {
          font-family: var(--font-display);
          font-size: clamp(24px,3.4vw,36px); font-weight: 700;
          color: var(--color-dark); line-height: 1.15; letter-spacing: -.015em;
          margin-bottom: 6px;
        }
        .pp-faq__grid {
          display: grid; grid-template-columns: 1fr 1fr;
          column-gap: 48px; row-gap: 28px;
        }
        .pp-faq__item { display: flex; flex-direction: column; gap: 8px; }
        .pp-faq__q {
          font-family: var(--font-display);
          font-size: 16px; font-weight: 700; color: var(--color-dark);
          line-height: 1.35; letter-spacing: -.005em;
          display: flex; gap: 10px; align-items: flex-start;
        }
        .pp-faq__q::before {
          content: ''; flex-shrink: 0; width: 4px; height: 18px;
          background: var(--color-gold); border-radius: 999px; margin-top: 3px;
        }
        .pp-faq__a {
          font-size: 14px; color: var(--color-muted);
          line-height: 1.7; padding-left: 14px;
        }
        @media (max-width: 720px) {
          .pp-faq__grid { grid-template-columns: 1fr; row-gap: 24px; }
        }

        /* GET-INVOLVED TOGGLE (segmented control inside the merged form card) */
        .pp-getinvolved__toggle {
          display: inline-flex; gap: 4px; padding: 4px;
          background: rgba(26,25,22,.05);
          border: 1px solid rgba(26,25,22,.08);
          border-radius: 999px;
          margin-bottom: 22px;
        }
        .pp-getinvolved__toggle-btn {
          padding: 9px 18px; font-family: var(--font-display);
          font-size: 13px; font-weight: 700; letter-spacing: -.005em;
          color: var(--color-muted); background: transparent;
          border: none; border-radius: 999px; cursor: pointer;
          transition: background .22s, color .22s, box-shadow .22s;
        }
        .pp-getinvolved__toggle-btn:hover { color: var(--color-dark); }
        .pp-getinvolved__toggle-btn.active {
          background: var(--color-dark); color: var(--color-cream);
          box-shadow: 0 2px 6px -2px rgba(26,25,22,.3);
        }
        .pp-getinvolved__toggle-btn:focus-visible {
          outline: 2px solid var(--color-gold); outline-offset: 2px;
        }
        .pp-getinvolved__perks {
          margin-top: 18px; padding-top: 18px;
          border-top: 1px solid rgba(26,25,22,.08);
          display: flex; flex-direction: column; gap: 10px;
        }
        .pp-getinvolved__perk {
          display: flex; align-items: flex-start; gap: 10px;
          font-size: 13px; color: var(--color-muted); line-height: 1.55;
        }
        .pp-getinvolved__perk-icon {
          width: 20px; height: 20px; border-radius: 50%;
          background: rgba(232,168,56,.18); color: var(--color-gold-dark);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; margin-top: 1px;
        }
        .pp-getinvolved__perk-icon svg { width: 11px; height: 11px; stroke-width: 2; }
        @media (prefers-reduced-motion: reduce) {
          .pp-getinvolved__toggle-btn { transition: none !important; }
        }

        /* SUGGEST FORM */
        .pp-suggest {
          max-width: 1040px; margin: 0 auto;
          padding: 80px clamp(20px,5vw,56px) 88px;
        }
        .pp-suggest__layout { display: grid; grid-template-columns: 1fr 1.4fr; gap: 60px; align-items: flex-start; }
        .pp-suggest__intro-kicker {
          font-size: 11px; font-weight: 700; letter-spacing: .14em;
          text-transform: uppercase; color: var(--color-muted); margin-bottom: 12px;
        }
        .pp-suggest__intro-title {
          font-family: var(--font-display);
          font-size: clamp(22px,3vw,32px); font-weight: 700;
          color: var(--color-dark); line-height: 1.2; margin-bottom: 16px;
        }
        .pp-suggest__intro-body { font-size: clamp(14px,1.6vw,15px); color: var(--color-muted); line-height: 1.75; }
        .pp-suggest__intro-body strong { color: var(--color-dark); font-weight: 600; }

        .pp-form-box {
          background: var(--color-white);
          border: 1px solid rgba(0,0,0,.08);
          border-radius: 16px;
          padding: clamp(26px,4vw,44px);
        }
        .pp-form-row { margin-bottom: 16px; }
        .pp-form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .pp-form-label {
          display: block; font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: .09em;
          color: var(--color-muted); margin-bottom: 6px;
        }
        .pp-form-label span { color: var(--color-accent); }
        .pp-form-input,
        .pp-form-select,
        .pp-form-textarea {
          width: 100%; font-family: var(--font-body); font-size: 15px;
          padding: 11px 14px; border: 1.5px solid rgba(0,0,0,.12);
          border-radius: 8px; background: var(--color-white);
          color: var(--color-dark); outline: none; transition: border-color .2s;
          box-sizing: border-box;
        }
        .pp-form-input:focus,
        .pp-form-select:focus,
        .pp-form-textarea:focus { border-color: var(--color-gold); }
        .pp-form-textarea { min-height: 80px; resize: vertical; line-height: 1.6; }
        .pp-form-select {
          appearance: none; cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%238A7E72' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 12px center;
        }
        .pp-form-note { font-size: 12px; color: var(--color-muted); line-height: 1.6; margin-top: 10px; font-style: italic; }
        .pp-form-btn {
          width: 100%; padding: 14px 24px; background: var(--color-dark);
          color: var(--color-cream); border: none; border-radius: 8px;
          font-family: var(--font-display); font-size: 14px; font-weight: 600;
          cursor: pointer; transition: background .2s, transform .18s; margin-top: 4px;
        }
        .pp-form-btn:hover { background: var(--color-accent); transform: translateY(-1px); }
        .pp-form-success { text-align: center; padding: 40px 20px; }
        .pp-form-success__icon {
          width: 56px; height: 56px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 24px; margin: 0 auto 16px;
        }
        .pp-form-success__icon--gold { background: rgba(232,168,56,.12); color: var(--color-gold-dark); }
        .pp-form-success__icon--teal { background: rgba(58,125,107,.1);  color: var(--color-teal); }
        .pp-form-success__title {
          font-family: var(--font-display); font-size: 22px;
          font-weight: 700; color: var(--color-dark); margin-bottom: 8px;
        }
        .pp-form-success__body { font-size: 14px; color: var(--color-muted); line-height: 1.7; }

        @media (max-width: 740px) {
          .pp-suggest__layout { grid-template-columns: 1fr; gap: 36px; }
          .pp-form-row-2 { grid-template-columns: 1fr; }
        }

        /* PANELIST SECTION */
        .pp-panelist { background: var(--color-navy); padding: 80px clamp(20px,5vw,56px) 88px; }
        .pp-panelist__inner {
          max-width: 1040px; margin: 0 auto;
          display: grid; grid-template-columns: 1fr 1.4fr; gap: 60px; align-items: flex-start;
        }
        .pp-panelist__intro-kicker {
          font-size: 11px; font-weight: 700; letter-spacing: .14em;
          text-transform: uppercase; color: rgba(242,228,206,.45); margin-bottom: 12px;
        }
        .pp-panelist__intro-title {
          font-family: var(--font-display);
          font-size: clamp(22px,3vw,32px); font-weight: 700;
          color: var(--color-cream); line-height: 1.2; margin-bottom: 16px;
        }
        .pp-panelist__intro-body { font-size: clamp(14px,1.6vw,15px); color: rgba(242,228,206,.65); line-height: 1.75; }
        .pp-panelist__intro-body strong { color: var(--color-cream); font-weight: 600; }
        .pp-panelist__perks { margin-top: 24px; display: flex; flex-direction: column; gap: 12px; }
        .pp-panelist__perk {
          display: flex; align-items: flex-start; gap: 10px;
          font-size: 14px; color: rgba(242,228,206,.65); line-height: 1.5;
        }
        .pp-panelist__perk-icon {
          width: 22px; height: 22px; border-radius: 50%;
          background: rgba(232,168,56,.2); color: var(--color-gold);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; margin-top: 1px;
        }
        .pp-panelist__perk-icon svg { width: 12px; height: 12px; stroke-width: 2; }
        .pp-form-box--dark {
          background: rgba(255,255,255,.05);
          border: 1px solid rgba(255,255,255,.1);
        }
        .pp-form-box--dark .pp-form-input,
        .pp-form-box--dark .pp-form-select,
        .pp-form-box--dark .pp-form-textarea {
          background: rgba(255,255,255,.07);
          border-color: rgba(255,255,255,.15);
          color: var(--color-cream);
        }
        .pp-form-box--dark .pp-form-input::placeholder,
        .pp-form-box--dark .pp-form-textarea::placeholder { color: rgba(242,228,206,.35); }
        .pp-form-box--dark .pp-form-label { color: rgba(242,228,206,.55); }
        .pp-form-box--dark .pp-form-input:focus,
        .pp-form-box--dark .pp-form-select:focus,
        .pp-form-box--dark .pp-form-textarea:focus { border-color: var(--color-gold); }
        .pp-form-box--dark .pp-form-select {
          background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='rgba(242,228,206,0.45)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 12px center;
          color-scheme: dark;
        }
        .pp-form-box--dark .pp-form-btn { background: var(--color-gold); color: var(--color-dark); }
        .pp-form-box--dark .pp-form-btn:hover { background: var(--color-gold); }
        .pp-form-box--dark .pp-form-success__title { color: var(--color-cream); }
        .pp-form-box--dark .pp-form-success__body { color: rgba(242,228,206,.65); }

        @media (max-width: 740px) { .pp-panelist__inner { grid-template-columns: 1fr; gap: 36px; } }

        /* ECOSYSTEM (cream surface — inverted from dark to break the cascading dark stripes at page bottom; matches CC pattern) */
        .pp-eco {
          background: linear-gradient(180deg, rgba(242,228,206,.55) 0%, rgba(242,228,206,.25) 100%);
          padding: 88px clamp(20px,5vw,56px); position: relative; overflow: hidden;
        }
        .pp-eco__inner { max-width: 1040px; margin: 0 auto; position: relative; }
        .pp-eco__kicker {
          font-size: 11px; font-weight: 800; letter-spacing: .2em;
          text-transform: uppercase; color: var(--color-accent); margin-bottom: 14px;
          display: inline-flex; align-items: center; gap: 10px;
        }
        .pp-eco__kicker::after { content: ''; width: 24px; height: 1px; background: var(--color-accent); opacity: .5; }
        .pp-eco__title {
          font-family: var(--font-display);
          font-size: clamp(20px,3vw,30px); font-weight: 700;
          color: var(--color-dark); margin-bottom: 8px; line-height: 1.25;
          letter-spacing: -.02em;
        }
        .pp-eco__body {
          font-size: clamp(14px,1.6vw,15px); color: rgba(26,25,22,.7);
          line-height: 1.75; max-width: 680px; margin-bottom: 36px;
        }
        .pp-eco__body strong { color: var(--color-gold-dark); font-weight: 600; }
        .pp-eco__grid {
          display: grid;
          grid-template-columns: repeat(auto-fill,minmax(200px,1fr));
          gap: 14px;
        }
        .pp-eco__link {
          background: rgba(255,255,255,.6); border: 1px solid rgba(26,25,22,.08);
          border-radius: 14px; padding: 22px 24px; text-decoration: none;
          transition: background .25s, border-color .25s, transform .25s cubic-bezier(.16,1,.3,1), box-shadow .25s;
          display: block; position: relative;
        }
        .pp-eco__link::after {
          content: '→'; position: absolute; top: 22px; right: 22px;
          font-size: 14px; color: var(--color-accent);
          opacity: 0; transform: translateX(-4px);
          transition: opacity .25s, transform .25s cubic-bezier(.16,1,.3,1);
        }
        .pp-eco__link:hover {
          background: rgba(255,255,255,.9); border-color: rgba(179,69,57,.22);
          transform: translateY(-2px);
          box-shadow: 0 12px 24px -16px rgba(63,42,28,.22);
        }
        .pp-eco__link:hover::after { opacity: 1; transform: translateX(0); }
        .pp-eco__link-title { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--color-dark); margin-bottom: 6px; letter-spacing: -.005em; }
        .pp-eco__link-desc { font-size: 12px; color: rgba(26,25,22,.6); line-height: 1.55; }

        /* CLOSING */
        .pp-closing { background: var(--color-accent); padding: 64px clamp(20px,5vw,56px); text-align: center; }
        .pp-closing__inner { max-width: 680px; margin: 0 auto; }
        .pp-closing__headline {
          font-family: var(--font-display);
          font-size: clamp(22px,4vw,36px); font-weight: 700;
          color: var(--color-cream); line-height: 1.2; margin-bottom: 28px;
        }
        .pp-closing__btns { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
        .pp-closing__btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 14px 28px; background: var(--color-cream); color: var(--color-accent);
          border-radius: 8px; font-family: var(--font-display);
          font-size: 14px; font-weight: 700; text-decoration: none;
          border: 1.5px solid var(--color-cream);
          transition: background .2s, color .2s, transform .18s;
        }
        .pp-closing__btn-primary:hover { background: var(--color-dark); color: var(--color-cream); border-color: var(--color-dark); transform: translateY(-1px); }
        .pp-closing__btn-secondary {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 14px 28px; background: transparent; color: var(--color-cream);
          border-radius: 8px; font-family: var(--font-display);
          font-size: 14px; font-weight: 700; text-decoration: none;
          border: 1.5px solid rgba(242,228,206,.5);
          transition: border-color .2s, background .2s, transform .18s;
        }
        .pp-closing__btn-secondary:hover { border-color: var(--color-cream); background: rgba(255,255,255,.08); transform: translateY(-1px); }

        .pp-btn-primary:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 2px; }
        .pp-btn-secondary:focus-visible { outline: 2px solid var(--color-dark); outline-offset: 2px; }
        .pp-panel-card__cta-primary:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 2px; }
        .pp-panel-card__cta-sm:focus-visible { outline: 2px solid var(--color-dark); outline-offset: 2px; }
        .pp-archive-card__cta:focus-visible { outline: 2px solid var(--color-teal); outline-offset: 2px; }
        .pp-topic-chip:focus-visible { outline: 2px solid var(--color-navy); outline-offset: 2px; }
        .pp-form-btn:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 2px; border-radius: 8px; }
        .pp-eco__link:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 2px; }
        .pp-closing__btn-primary:focus-visible { outline: 2px solid var(--color-dark); outline-offset: 2px; }
        .pp-closing__btn-secondary:focus-visible { outline: 2px solid var(--color-cream); outline-offset: 2px; }

        @media (max-width: 768px) {
          .pp-hero { padding: 88px 20px 48px; }
          .pp-stats { gap: 20px; }
          .pp-featured, .pp-upcoming, .pp-archive,
          .pp-topics, .pp-suggest { padding-top: 48px; padding-bottom: 48px; }
          .pp-panelist { padding: 48px 20px; }
          .pp-eco { padding: 48px 20px; }
          .pp-closing { padding: 48px 20px; }
          .pp-section-title { font-size: clamp(22px,5vw,30px); }
          .pp-btn-primary, .pp-btn-secondary { padding: 13px 20px; font-size: 13px; }
          .pp-topic-chip { padding: 10px 14px; font-size: 12px; }
        }
        @media (max-width: 480px) {
          .pp-hero { padding: 80px 16px 40px; }
          .pp-hero__ctas { flex-direction: column; }
          .pp-hero__ctas a { text-align: center; justify-content: center; }
          .pp-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 24px; }
          .pp-archive-card__cta { padding: 13px 14px; font-size: 11px; }
          .pp-archive-card__actions { gap: 8px; }
        }
      `}</style>

      {/* HERO */}
      <header className="pp-hero" id="top">
        <p className="pp-hero__kicker">{t.heroKicker}</p>
        <h1 className="pp-hero__title">{t.heroTitlePrefix}<em>{t.heroTitleEm}</em></h1>
        <p className="pp-hero__sub">{t.heroSub}</p>
        <p className="pp-hero__body">
          {t.heroBody} <strong>{t.heroBodyStrong}</strong> {t.heroBodyTail}
        </p>
        <div className="pp-hero__ctas">
          <a href="#upcoming" className="pp-btn-primary">{t.heroCtaUpcoming}</a>
          <a href="#archive" className="pp-btn-secondary">{t.heroCtaArchive}</a>
        </div>
        <div className="pp-stats">
          <div>
            <div className="pp-stat__num">{t.stat1Num}</div>
            <div className="pp-stat__label">{t.stat1Label}</div>
          </div>
          <div>
            <div className="pp-stat__num">{t.stat2Num}</div>
            <div className="pp-stat__label">{t.stat2Label}</div>
          </div>
          <div>
            <div className="pp-stat__num">{t.stat3Num}</div>
            <div className="pp-stat__label">{t.stat3Label}</div>
          </div>
          <div>
            <div className="pp-stat__num">{t.stat4Num}</div>
            <div className="pp-stat__label">{t.stat4Label}</div>
          </div>
        </div>
      </header>

      <hr className="pp-divider" />

      {/* FAQ — moved to top so attendees get logistics before browsing what's on offer */}
      <section className="pp-faq" id="faq">
        <div className="pp-faq__head">
          <p className="pp-kicker">{t.faqKicker}</p>
          <h2 className="pp-faq__title">{t.faqTitle}</h2>
        </div>
        <div className="pp-faq__grid">
          {(t.faqItems || []).map(item => (
            <div key={item.q} className="pp-faq__item">
              <h3 className="pp-faq__q">{item.q}</h3>
              <p className="pp-faq__a">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="pp-divider" />

      {/* FEATURED PANEL */}
      <section className="pp-featured" id="featured">
        <div className="pp-featured__head">
          <p className="pp-kicker">{t.featuredKicker}</p>
          <h2 className="pp-section-title">{t.featuredTitle}</h2>
        </div>
        <div className="pp-featured-card">
          <div className="pp-featured-card__body">
            <div className="pp-featured-card__eyebrow">
              <span className="pp-featured-card__live-badge">
                <span className="pp-featured-card__live-dot" />
                {t.featuredLiveBadge}
              </span>
              <span className="pp-tag pp-tag--gold">May 8, 2026</span>
              <span className="pp-tag pp-tag--muted">Zoom</span>
            </div>
            <h3 className="pp-featured-card__title">Breaking Into Tech Without a Traditional Path</h3>
            <p className="pp-featured-card__desc">
              A live conversation with apprentices, career changers, first-generation professionals, and early-career technologists about how they found their way into tech without a perfectly linear path. This session is designed for students and recent grads who feel like they are behind, off-track, or trying to enter the industry without the <strong>&ldquo;usual&rdquo; credentials</strong>.
            </p>
            <div className="pp-featured-card__panelists">
              <p className="pp-featured-card__panelists-label">{t.featuredPanelistsLabel}</p>
              <div className="pp-featured-card__panelist">A first-gen software engineer who landed through an apprenticeship</div>
              <div className="pp-featured-card__panelist">A recent grad working in data analytics</div>
              <div className="pp-featured-card__panelist">A professional who pivoted into tech from another field</div>
              <div className="pp-featured-card__panelist">A recruiter focused on early-career access and inclusion</div>
            </div>
            <div className="pp-featured-card__actions">
              <a href="#" className="pp-btn-primary pp-cta--disabled" aria-disabled="true" tabIndex={-1}>{t.featuredBtnRsvp}</a>
              <button className="pp-btn-secondary" onClick={() => addToCalendar('Breaking Into Tech Without a Traditional Path', '2026-05-08T19:00', '2026-05-08T20:30')}>{t.featuredBtnCalendar}</button>
              <a href="#" className="pp-btn-secondary pp-cta--disabled" aria-disabled="true" tabIndex={-1}>{t.featuredBtnFlyer}</a>
            </div>
            <p className="pp-featured-card__note">{t.featuredNote}</p>
          </div>
          <div className="pp-featured-card__sidebar">
            <div>
              <p className="pp-featured-card__detail-label">{t.featuredDetailDate}</p>
              <p className="pp-featured-card__detail-value">Thursday, May 8, 2026</p>
            </div>
            <div>
              <p className="pp-featured-card__detail-label">{t.featuredDetailTime}</p>
              <p className="pp-featured-card__detail-value">7:00 PM ET</p>
              <p className="pp-featured-card__detail-sub">4:00 PM PT · 6:00 PM CT</p>
            </div>
            <div>
              <p className="pp-featured-card__detail-label">{t.featuredDetailFormat}</p>
              <p className="pp-featured-card__detail-value">{t.featuredFormatValue}</p>
              <p className="pp-featured-card__detail-sub">{t.featuredFormatFree}</p>
            </div>
            <div>
              <p className="pp-featured-card__detail-label">{t.featuredDetailHosted}</p>
              <p className="pp-featured-card__detail-value">Jose Cruz-Lopez</p>
              <p className="pp-featured-card__detail-sub">{t.featuredDetailHostedSub}</p>
            </div>
            <div>
              <p className="pp-featured-card__detail-label">{t.featuredDetailBestFor}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '6px' }}>
                <span className="pp-tag pp-tag--teal">Students</span>
                <span className="pp-tag pp-tag--gold">Recent Grads</span>
                <span className="pp-tag pp-tag--accent">Bridge Year</span>
                <span className="pp-tag pp-tag--navy">Career Changers</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className="pp-divider" />

      {/* UPCOMING PANELS */}
      <section className="pp-upcoming" id="upcoming">
        <div className="pp-upcoming__head">
          <p className="pp-kicker">{t.upcomingKicker}</p>
          <h2 className="pp-section-title">{t.upcomingTitle}</h2>
          <p className="pp-section-sub">{t.upcomingSub}</p>
          <p className="pp-section-body">{t.upcomingBody} <strong>{t.upcomingBodyStrong}</strong></p>
        </div>
        <div className="pp-upcoming__grid">
          {UPCOMING_PANELS.map((panel, idx) => {
            const tint = tintFromTags(panel.tags)
            return (
            <article key={panel.id} className={`pp-panel-card${idx === 0 ? ' pp-panel-card--featured' : (tint ? ` pp-panel-card--${tint}` : '')}`}>
              {idx === 0 && <span className="pp-panel-card__featured-tag">{t.upcomingFeaturedTag || 'Next up'}</span>}
              <span className="pp-panel-card__date-badge">{panel.date}</span>
              <h3 className="pp-panel-card__title">{panel.title}</h3>
              <p className="pp-panel-card__desc">{panel.desc}</p>
              <div className="pp-panel-card__meta">
                <div className="pp-panel-card__meta-row">
                  <span className="pp-panel-card__meta-icon" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5V8l2.4 1.6"/></svg>
                  </span>
                  <span>{panel.time} &nbsp;·&nbsp; <span className="pp-panel-card__meta-val">{t.upcomingMetaZoom}</span></span>
                </div>
                <div className="pp-panel-card__meta-row">
                  <span className="pp-panel-card__meta-icon" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="2.5"/><path d="M2 13.5c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5"/><circle cx="11.5" cy="5.5" r="2"/><path d="M11 10c1.8 0 3.5 1.1 3.5 3"/></svg>
                  </span>
                  <span>{t.upcomingMetaBestFor} <span className="pp-panel-card__meta-val">{panel.bestFor}</span></span>
                </div>
              </div>
              <div className="pp-panel-card__panelists">
                <strong>{t.upcomingPanelistsLabel}</strong>
                {panel.panelists.map((p) => (
                  <span key={p}>{p}<br /></span>
                ))}
              </div>
              <div className="pp-panel-card__tags">
                {panel.tags.map(tag => (
                  <span key={tag.label} className={`pp-tag pp-tag--${tag.type}`}>{tag.label}</span>
                ))}
              </div>
              <div className="pp-panel-card__actions">
                <a href="#" className="pp-panel-card__cta-primary pp-cta--disabled" aria-disabled="true" tabIndex={-1}>{t[panel.ctaKey]}</a>
                <button className="pp-panel-card__cta-sm" onClick={() => addToCalendar(panel.title, panel.calStart, panel.calEnd)}>{t.upcomingBtnCalendar}</button>
                <a href="#" className="pp-panel-card__cta-sm pp-cta--disabled" aria-disabled="true" tabIndex={-1}>{t.upcomingBtnFlyer}</a>
              </div>
            </article>
            )
          })}
        </div>
      </section>

      <hr className="pp-divider" />

      {/* PAST PANELS ARCHIVE — topic filter chips integrated above the list */}
      <section className="pp-archive" id="archive">
        <div className="pp-archive__head">
          <p className="pp-kicker">{t.archiveKicker}</p>
          <h2 className="pp-section-title">{t.archiveTitle}</h2>
          <p className="pp-section-sub">{t.archiveSub}</p>
          <p className="pp-section-body">{t.archiveBody} <strong>{t.archiveBodyStrong}</strong></p>
        </div>

        {/* Topic filter chips — moved here from former standalone section */}
        <div className="pp-topics__chips" ref={filtersRef} role="tablist" aria-label={t.topicsTitle}>
          {topicChips.map(chip => (
            <button
              key={chip.key}
              type="button"
              className={`pp-topic-chip${activeTopic === chip.key ? ' active' : ''}`}
              aria-pressed={activeTopic === chip.key}
              onClick={() => setActiveTopic(chip.key)}
            >
              <span className="pp-topic-chip__label">{chip.label}</span>
              {chip.description && <span className="pp-topic-chip__desc">{chip.description}</span>}
            </button>
          ))}
        </div>

        <div className="pp-archive__list">
          {filteredArchive.length === 0 && (
            <p style={{ color: 'var(--color-muted)', fontSize: 15, padding: '40px 0' }}>{t.archiveEmptyState}</p>
          )}
          {filteredArchive.map(card => {
            const tint = tintFromTags(card.tags)
            return (
            <article key={card.id} className={`pp-archive-card${tint ? ` pp-archive-card--${tint}` : ''}`}>
              <div className="pp-archive-card__main">
                <div>
                  <p className="pp-archive-card__date">{card.date}</p>
                  <h3 className="pp-archive-card__title">{card.title}</h3>
                  <p className="pp-archive-card__recap">{card.recap}</p>
                  <p className="pp-archive-card__panelists">
                    <strong>{t.archivePanelistsLabel}</strong> {card.panelists}
                  </p>
                  <div className="pp-archive-card__tags">
                    {card.tags.map(tag => (
                      <span key={tag.label} className={`pp-tag pp-tag--${tag.type}`}>{tag.label}</span>
                    ))}
                  </div>
                </div>
                <div className="pp-archive-card__actions">
                  <a href="#" className="pp-archive-card__cta pp-archive-card__cta--watch pp-cta--disabled" aria-disabled="true" tabIndex={-1}>{t.archiveBtnWatch}</a>
                  <a href="#" className="pp-archive-card__cta pp-archive-card__cta--flyer pp-cta--disabled" aria-disabled="true" tabIndex={-1}>{t.archiveBtnFlyer}</a>
                  <button
                    className="pp-archive-card__cta pp-archive-card__cta--takeaways"
                    aria-expanded={openTakeaway === card.id}
                    onClick={() => toggleTakeaway(card.id)}
                  >
                    {openTakeaway === card.id ? t.archiveBtnHideTakeaways : t.archiveBtnShowTakeaways}
                  </button>
                </div>
              </div>
              <div className={`pp-takeaways${openTakeaway === card.id ? ' open' : ''}`}>
                <div className="pp-takeaways__inner">
                  <p className="pp-takeaways__title">{t.archiveTakeawaysTitle}</p>
                  <div className="pp-takeaways__list">
                    {card.takeaways.map((takeaway) => (
                      <div key={takeaway} className="pp-takeaways__item">{takeaway}</div>
                    ))}
                  </div>
                </div>
              </div>
            </article>
            )
          })}
        </div>
      </section>

      <div className="pp-bridge">
        <div className="pp-bridge__inner">
          <p className="pp-bridge__copy">{t.bridgeCopyPrefix} <em>{t.bridgeCopyEm}</em></p>
          <a href="#suggest" className="pp-bridge__cta">{t.bridgeCtaLabel}</a>
        </div>
      </div>

      <hr className="pp-divider" />

      {/* GET INVOLVED — merged suggest + apply-to-speak in one card */}
      <section className="pp-suggest" id="suggest">
        <a id="panelist" style={{ position: 'absolute', marginTop: '-90px' }} aria-hidden="true" />
        <div className="pp-suggest__layout">
          <div>
            <p className="pp-suggest__intro-kicker">{mode === 'suggest' ? t.suggestKicker : t.panelistKicker}</p>
            <h2 className="pp-suggest__intro-title">{mode === 'suggest' ? t.suggestTitle : t.panelistTitle}</h2>
            <p className="pp-suggest__intro-body">
              {mode === 'suggest' ? (
                <>{t.suggestBody} <strong>{t.suggestBodyStrong}</strong> {t.suggestBodyTail}</>
              ) : (
                <>{t.panelistBody} <strong>{t.panelistBodyStrong}</strong> {t.panelistBodyTail}</>
              )}
            </p>
            {mode === 'speak' && (
              <div className="pp-getinvolved__perks">
                {[t.panelistPerk1, t.panelistPerk2, t.panelistPerk3, t.panelistPerk4].map(p => (
                  <div key={p} className="pp-getinvolved__perk">
                    <span className="pp-getinvolved__perk-icon" aria-hidden="true">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3 3 7-7"/></svg>
                    </span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="pp-form-box">
            <div className="pp-getinvolved__toggle" role="tablist" aria-label={t.modeToggleLabel || 'Form mode'}>
              <button
                role="tab"
                type="button"
                aria-selected={mode === 'suggest'}
                className={`pp-getinvolved__toggle-btn${mode === 'suggest' ? ' active' : ''}`}
                onClick={() => setMode('suggest')}
              >
                {t.modeSuggestLabel || 'Suggest a topic'}
              </button>
              <button
                role="tab"
                type="button"
                aria-selected={mode === 'speak'}
                className={`pp-getinvolved__toggle-btn${mode === 'speak' ? ' active' : ''}`}
                onClick={() => setMode('speak')}
              >
                {t.modeSpeakLabel || 'Apply to speak'}
              </button>
            </div>

            {mode === 'suggest' && (suggestSubmitted ? (
              <div className="pp-form-success">
                <div className="pp-form-success__icon pp-form-success__icon--gold">{t.suggestSuccessIcon}</div>
                <div className="pp-form-success__title">{t.suggestSuccessTitle}</div>
                <p className="pp-form-success__body">{t.suggestSuccessBody}</p>
              </div>
            ) : (
              <form onSubmit={submitSuggest}>
                <div className="pp-form-row">
                  <label className="pp-form-label" htmlFor="suggestTopic">{t.suggestLabelTopic} <span>{t.suggestLabelTopicRequired}</span></label>
                  <input className="pp-form-input" type="text" id="suggestTopic" placeholder={t.suggestPlaceholderTopic} value={suggestForm.topic} onChange={e => setSuggestForm(f => ({ ...f, topic: e.target.value }))} />
                </div>
                <div className="pp-form-row">
                  <label className="pp-form-label" htmlFor="suggestWhy">{t.suggestLabelWhy} <span>{t.suggestLabelWhyRequired}</span></label>
                  <textarea className="pp-form-textarea" id="suggestWhy" placeholder={t.suggestPlaceholderWhy} value={suggestForm.why} onChange={e => setSuggestForm(f => ({ ...f, why: e.target.value }))} />
                </div>
                <div className="pp-form-row pp-form-row-2">
                  <div>
                    <label className="pp-form-label" htmlFor="suggestStage">{t.suggestLabelStage} <span>{t.suggestLabelStageRequired}</span></label>
                    <select className="pp-form-select" id="suggestStage" value={suggestForm.stage} onChange={e => setSuggestForm(f => ({ ...f, stage: e.target.value }))}>
                      {t.suggestStageOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    {suggestForm.stage === 'Other' && (
                      <input
                        className="pp-form-input"
                        type="text"
                        placeholder={t.suggestStageOtherPlaceholder || 'Tell us your stage'}
                        value={suggestForm.stageOther}
                        onChange={e => setSuggestForm(f => ({ ...f, stageOther: e.target.value }))}
                        aria-label={t.suggestStageOtherPlaceholder || 'Tell us your stage'}
                        style={{ marginTop: 8 }}
                      />
                    )}
                  </div>
                  <div>
                    <label className="pp-form-label" htmlFor="suggestCategory">{t.suggestLabelCategory} <span>{t.suggestLabelCategoryRequired}</span></label>
                    <select className="pp-form-select" id="suggestCategory" value={suggestForm.category} onChange={e => setSuggestForm(f => ({ ...f, category: e.target.value }))}>
                      {t.suggestCategoryOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    {suggestForm.category === 'Other' && (
                      <input
                        className="pp-form-input"
                        type="text"
                        placeholder={t.suggestCategoryOtherPlaceholder || 'Tell us the category'}
                        value={suggestForm.categoryOther}
                        onChange={e => setSuggestForm(f => ({ ...f, categoryOther: e.target.value }))}
                        aria-label={t.suggestCategoryOtherPlaceholder || 'Tell us the category'}
                        style={{ marginTop: 8 }}
                      />
                    )}
                  </div>
                </div>
                <div className="pp-form-row">
                  <label className="pp-form-label" htmlFor="suggestEmail">{t.suggestLabelEmail} <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{t.suggestEmailNote}</span></label>
                  <input className="pp-form-input" type="email" id="suggestEmail" placeholder={t.suggestPlaceholderEmail} value={suggestForm.email} onChange={e => setSuggestForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                {suggestError && <p role="alert" style={{ color: 'var(--color-accent)', fontSize: 13, marginBottom: 10 }}>{suggestError}</p>}
                <Turnstile onToken={setSuggestTurnstileToken} resetRef={suggestTurnstileReset} />
                <button className="pp-form-btn" type="submit" disabled={suggestLoading || !suggestForm.topic.trim() || !suggestForm.why.trim() || !suggestForm.stage || !suggestForm.category || (suggestForm.stage === 'Other' && !suggestForm.stageOther.trim()) || (suggestForm.category === 'Other' && !suggestForm.categoryOther.trim()) || (TURNSTILE_ENABLED && !suggestTurnstileToken)}>{suggestLoading ? t.suggestBtnSubmitting : t.suggestBtnSubmit}</button>
                <p className="pp-form-note">{t.suggestFormNote}</p>
              </form>
            ))}

            {mode === 'speak' && (panelistSubmitted ? (
              <div className="pp-form-success">
                <div className="pp-form-success__icon pp-form-success__icon--teal">{t.panelistSuccessIcon}</div>
                <div className="pp-form-success__title">{t.panelistSuccessTitle}</div>
                <p className="pp-form-success__body">{t.panelistSuccessBody}</p>
              </div>
            ) : (
              <form onSubmit={submitPanelist}>
                <div className="pp-form-row pp-form-row-2">
                  <div>
                    <label className="pp-form-label" htmlFor="plName">{t.panelistLabelName} <span>{t.panelistLabelNameRequired}</span></label>
                    <input className="pp-form-input" type="text" id="plName" placeholder={t.panelistPlaceholderName} value={panelistForm.name} onChange={e => setPanelistForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="pp-form-label" htmlFor="plEmail">{t.panelistLabelEmail} <span>{t.panelistLabelEmailRequired}</span></label>
                    <input className="pp-form-input" type="email" id="plEmail" placeholder={t.panelistPlaceholderEmail} value={panelistForm.email} onChange={e => setPanelistForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                </div>
                <div className="pp-form-row">
                  <label className="pp-form-label" htmlFor="plLinkedIn">{t.panelistLabelLinkedIn} <span>{t.panelistLabelLinkedInRequired}</span></label>
                  <input className="pp-form-input" type="url" id="plLinkedIn" placeholder={t.panelistPlaceholderLinkedIn} value={panelistForm.linkedin} onChange={e => setPanelistForm(f => ({ ...f, linkedin: e.target.value }))} />
                </div>
                <div className="pp-form-row">
                  <label className="pp-form-label" htmlFor="plRole">{t.panelistLabelRole} <span>{t.panelistLabelRoleRequired}</span></label>
                  <input className="pp-form-input" type="text" id="plRole" placeholder={t.panelistPlaceholderRole} value={panelistForm.role} onChange={e => setPanelistForm(f => ({ ...f, role: e.target.value }))} />
                </div>
                <div className="pp-form-row">
                  <label className="pp-form-label" htmlFor="plTopic">{t.panelistLabelTopic} <span>{t.panelistLabelTopicRequired}</span></label>
                  <textarea className="pp-form-textarea" id="plTopic" placeholder={t.panelistPlaceholderTopic} value={panelistForm.topic} onChange={e => setPanelistForm(f => ({ ...f, topic: e.target.value }))} />
                </div>
                <div className="pp-form-row">
                  <label className="pp-form-label" htmlFor="plInterest">{t.panelistLabelInterest} <span>{t.panelistLabelInterestRequired}</span></label>
                  <select className="pp-form-select" id="plInterest" value={panelistForm.interest} onChange={e => setPanelistForm(f => ({ ...f, interest: e.target.value }))}>
                    {t.panelistInterestOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="pp-form-row">
                  <label className="pp-form-label" htmlFor="plNotes">{t.panelistLabelNotes}</label>
                  <textarea className="pp-form-textarea" id="plNotes" placeholder={t.panelistPlaceholderNotes} value={panelistForm.notes} onChange={e => setPanelistForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                {panelistError && <p role="alert" style={{ color: 'var(--color-accent)', fontSize: 13, marginBottom: 10 }}>{panelistError}</p>}
                <Turnstile onToken={setPanelistTurnstileToken} resetRef={panelistTurnstileReset} />
                <button className="pp-form-btn" type="submit" disabled={panelistLoading || !panelistForm.name.trim() || !panelistForm.email.trim() || !panelistForm.linkedin.trim() || !panelistForm.role.trim() || !panelistForm.topic.trim() || !panelistForm.interest || (TURNSTILE_ENABLED && !panelistTurnstileToken)}>{panelistLoading ? t.panelistBtnSubmitting : t.panelistBtnSubmit}</button>
              </form>
            ))}
          </div>
        </div>
      </section>

      {/* ECOSYSTEM */}
      <section className="pp-eco" id="ecosystem">
        <div className="pp-eco__inner">
          <p className="pp-eco__kicker">{t.ecoKicker}</p>
          <h2 className="pp-eco__title">{t.ecoTitle}</h2>
          <p className="pp-eco__body">
            {t.ecoBody} <strong>{t.ecoBodyStrong}</strong> {t.ecoBodyTail}
          </p>
          <div className="pp-eco__grid">
            {t.ecoLinks.map(link => (
              <Link key={link.to} to={link.to} className="pp-eco__link">
                <div className="pp-eco__link-title">{link.title}</div>
                <div className="pp-eco__link-desc">{link.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING STRIP */}
      <section className="pp-closing">
        <div className="pp-closing__inner">
          <h2 className="pp-closing__headline">{t.closingHeadline}</h2>
          <div className="pp-closing__btns">
            <a href="#upcoming" className="pp-closing__btn-primary">{t.closingBtnUpcoming}</a>
            <a href="#archive" className="pp-closing__btn-secondary">{t.closingBtnArchive}</a>
          </div>
        </div>
      </section>
    </ArticleLayout>
  )
}
