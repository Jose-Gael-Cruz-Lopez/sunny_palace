import { useState, useEffect, useRef, useCallback, Fragment } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLang } from '../context/LanguageContext'
import { useT } from '../hooks/useT'
import Turnstile, { TURNSTILE_ENABLED } from '../components/Turnstile'
gsap.registerPlugin(ScrollTrigger)

const SEARCH_INDEX = [
  { label: 'About', description: 'Who we are & our story', type: 'section', target: '#about',
    keywords: ['who we are', 'about us', 'our story', 'jose', 'jocelyn', 'founders', 'co-founders', 'creator', 'hosts', 'people behind', 'first gen', 'first generation', 'mexican american', 'latino', 'latina', 'hispanic', 'latinx', 'chicano', 'brown', 'immigrant', 'immigrants', 'underrepresented', 'minority', 'diversity', 'inclusion', 'equity', 'mission', 'vision', 'values', 'why', 'purpose', 'background', 'journey', 'path', 'how it started', 'origin story', 'why we built this', 'personal story', 'team', 'people', 'real', 'authentic', 'what is campus to career', 'what is this', 'about the platform', 'representation'] },
  { label: 'Services', description: 'All services overview', type: 'section', target: '#services',
    keywords: ['services', 'all services', 'offerings', 'programs', 'what we do', 'what do you offer', 'help', 'resources', 'tools', 'features', 'overview', 'everything', 'explore', 'discover', 'platform', 'career help', 'career support', 'career resources', 'career tools', 'content', 'sprints', 'community', 'categories', 'navigation', 'where to go', 'what can i do here'] },
  { label: 'La Voz del Día', description: 'Daily editorial & career insights', type: 'section', target: '#editorial',
    keywords: ['la voz', 'voz', 'blog', 'articles', 'article', 'editorial', 'daily', 'insights', 'reads', 'reading', 'posts', 'post', 'news', 'writing', 'content', 'career content', 'tips', 'advice', 'guides', 'how to', 'stories', 'perspectives', 'opinions', 'featured', 'latest', 'recent', 'subscribe', 'newsletter', 'digest', 'weekly', 'thought pieces', 'career stories', 'industry insights', 'career reads'] },
  { label: 'LinkedIn Series', description: 'Content · LinkedIn growth tips', type: 'page', to: '/linkedin-series',
    keywords: ['linkedin', 'linked in', 'social media', 'profile', 'linkedin profile', 'optimize profile', 'profile tips', 'improve profile', 'headline', 'summary', 'about section', 'featured section', 'profile picture', 'banner', 'connections', 'followers', 'posts', 'posting', 'content creation', 'content strategy', 'thought leadership', 'articles', 'newsletter', 'carousel', 'personal brand', 'personal branding', 'brand yourself', 'visibility', 'reach', 'impressions', 'engagement', 'likes', 'comments', 'shares', 'algorithm', 'linkedin algorithm', 'beat the algorithm', 'get more views', 'networking online', 'online networking', 'connect on linkedin', 'linkedin networking', 'send connection request', 'inmail', 'online presence', 'digital presence', 'digital identity', 'online reputation', 'get noticed by recruiters', 'attract recruiters', 'linkedin jobs', 'series', 'episodes', 'tips', 'tricks', 'guide', 'growth', 'grow on linkedin'] },
  { label: 'Career Templates', description: 'Content · Plug-and-play career docs', type: 'page', to: '/career-templates',
    keywords: ['templates', 'template', 'free templates', 'free resources', 'downloadable', 'download', 'resume template', 'resume format', 'resume example', 'resume sample', 'ats resume', 'cover letter', 'cover letter template', 'cover letter example', 'how to write cover letter', 'email template', 'professional email', 'cold email template', 'follow up email', 'follow up', 'thank you email', 'thank you note', 'after interview email', 'networking email', 'reach out email', 'introduction email', 'linkedin message template', 'linkedin outreach', 'cold message', 'salary negotiation', 'negotiate offer', 'negotiate salary', 'counter offer', 'how to negotiate', 'negotiation script', 'negotiation email', 'negotiation', 'tracker', 'job tracker', 'application tracker', 'track applications', 'stay organized', 'spreadsheet', 'job search tracker', 'application spreadsheet', 'career tracker', '30 60 90', 'brag document', 'brag doc', 'goal setting', 'documents', 'docs', 'google doc', 'notion', 'scripts', 'plug and play', 'copy paste', 'materials', 'career documents', 'plug in', 'ready to use'] },
  { label: 'Bridge Year Sprint', description: 'Sprints · Bridge year program', type: 'page', to: '/bridge-year', comingSoon: true,
    keywords: ['bridge year', 'gap year', 'underclassmen', 'freshman', 'freshmen', 'sophomore', 'junior', 'first year', 'second year', 'third year', '1st year', '2nd year', '3rd year', 'early in college', 'new to college', 'just started college', 'early career', 'beginner', 'new to tech', 'new to industry', 'just starting', 'getting started', 'start', 'foundation', 'no experience', 'no internship yet', 'build experience', 'first internship', 'land first internship', 'break into tech', 'break into industry', 'pivot', 'career switcher', 'program', 'cohort', 'sprint', 'accountability', 'structured program', 'curriculum', 'first gen', 'nontraditional', 'transfer student', 'community college', 'returning student', 'underprivileged', 'low income', 'limited resources', 'lost', 'confused', 'overwhelmed', 'dont know where to start', 'where do i start', 'what should i do', 'need direction', 'what to do', 'roadmap', 'plan', 'career plan', 'career path', 'career roadmap', 'explore', 'discover', 'next steps', 'step by step', 'where to begin', 'early stage', 'guidance', 'help me start'] },
  { label: 'Interview Prep', description: 'Sprints · Interview preparation', type: 'page', to: '/interview-prep', comingSoon: true,
    keywords: ['interview', 'interviews', 'prep', 'preparation', 'prepare', 'practice', 'mock', 'mock interview', 'practice interview', 'get ready for interview', 'technical interview', 'coding interview', 'behavioral interview', 'system design interview', 'product interview', 'pm interview', 'design interview', 'case interview', 'consulting interview', 'finance interview', 'behavioral', 'technical', 'coding', 'algorithm', 'algorithms', 'data structure', 'data structures', 'dynamic programming', 'binary search', 'trees', 'graphs', 'arrays', 'linked list', 'recursion', 'big o', 'time complexity', 'leetcode', 'leet code', 'hackerrank', 'codewars', 'oa', 'online assessment', 'coding challenge', 'take home', 'star method', 'star framework', 'tell me about yourself', 'greatest strength', 'weakness', 'why this company', 'why this role', 'leadership', 'teamwork', 'conflict', 'failure', 'success', 'accomplishment', 'behavioral questions', 'faang', 'maang', 'big tech', 'google', 'meta', 'amazon', 'microsoft', 'apple', 'netflix', 'stripe', 'airbnb', 'uber', 'doordash', 'startup', 'underclassmen', 'new grad', 'new graduate', 'entry level', 'junior', 'tips', 'how to', 'guide', 'cheat sheet', 'nervous', 'anxious', 'scared', 'intimidated', 'unprepared', 'struggling', 'failing interviews', 'bombing interviews', 'need help', 'confidence', 'offer', 'job offer', 'return offer', 'rejection', 'rejected', 'phone screen', 'phone interview', 'technical screen', 'onsite', 'virtual interview', 'zoom interview', 'questions', 'common questions', 'internship interview', 'job interview', 'intern', 'cracking the interview', 'python', 'java', 'javascript', 'sql'] },
  { label: 'Opportunity Board', description: 'Community · Jobs & internships', type: 'page', to: '/opportunity-board',
    keywords: ['jobs', 'job', 'work', 'gig', 'career', 'internship', 'internships', 'intern', 'opportunities', 'opportunity', 'listing', 'listings', 'posting', 'postings', 'board', 'apply', 'application', 'applying', 'hire', 'hiring', 'recruited', 'recruiting', 'recruiter', 'hr', 'human resources', 'new grad', 'new graduate', 'recent grad', 'recent graduate', 'fresh grad', 'college grad', 'entry level', 'junior', 'first job', 'first real job', 'post grad', 'after college', 'after graduation', 'no experience', '0 years experience', 'summer', 'summer 2025', 'summer 2026', 'summer internship', 'summer program', 'fall', 'spring', 'winter', 'co-op', 'coop', 'fellowship', 'apprenticeship', 'full time', 'fulltime', 'part time', 'contract', 'freelance', 'remote', 'hybrid', 'in person', 'onsite', 'relocation', 'paid', 'stipend', 'salary', 'compensation', 'hourly', 'wage', 'unpaid', 'role', 'position', 'opening', 'employment', 'company', 'job board', 'job search', 'job hunting', 'find a job', 'find work', 'career opportunities', 'tech job', 'technology', 'software', 'engineering', 'software engineer', 'swe', 'product manager', 'pm', 'tpm', 'data science', 'data analytics', 'ux', 'ui', 'design', 'marketing', 'finance', 'consulting', 'banking', 'investment banking', 'healthcare', 'biotech', 'startup', 'faang', 'google', 'meta', 'amazon', 'microsoft', 'apple', 'business', 'mis', 'non-cs', 'nontechnical', 'stem', 'cs', 'computer science', 'diversity hiring', 'underrepresented', 'visa', 'sponsorship', 'opt', 'cpt', 'h1b', 'international', 'where to find jobs', 'career search'] },
  { label: 'Coffee Chat Network', description: 'Community · Connect with professionals', type: 'page', to: '/coffee-chat',
    keywords: ['coffee chat', 'coffee chats', 'virtual coffee', 'grab coffee', 'coffee meeting', 'networking', 'network', 'build connections', 'connect', 'connection', 'connections', 'meet professionals', 'meet people', 'reach out', 'cold email', 'cold outreach', 'linkedin message', 'mentor', 'mentors', 'mentorship', 'mentoring', 'mentee', 'find a mentor', 'get mentored', 'advisory', 'advisor', 'guide', 'guidance', 'career guidance', 'career advice', 'informational interview', 'info interview', 'info chat', 'industry insights', 'learning from professionals', 'professional', 'professionals', 'industry professional', 'industry expert', 'recruiter', 'hiring manager', 'engineer', 'designer', 'alumni', 'alum', 'alums', 'upperclassmen', 'peers', 'community', 'people', 'relationship', 'relationship building', 'professional development', 'professional network', 'talk to someone', 'talk to someone in the industry', 'get advice', 'ask questions', 'career questions', 'career path', 'day in the life', 'what is it like to work at', 'company culture', 'chat', 'talk', 'conversation', 'meet', 'meeting', 'zoom call', 'phone call', 'virtual meeting', 'advice', 'support', 'learn', 'how to reach out', 'how to network'] },
  { label: 'Resume Reviews', description: 'Community · Get your resume reviewed', type: 'page', to: '/resume-reviews',
    keywords: ['resume', 'resumes', 'cv', 'curriculum vitae', 'bio', 'professional profile', 'review', 'reviews', 'reviewed', 'feedback', 'critique', 'critiqued', 'help', 'resume help', 'improve', 'improve resume', 'fix', 'fix my resume', 'check', 'check my resume', 'proofread', 'edit', 'polish', 'polish up', 'ats', 'ats friendly', 'applicant tracking', 'keyword', 'keywords', 'format', 'formatting', 'layout', 'design', 'one page', 'two page', 'one pager', 'chronological', 'functional', 'skills', 'experience', 'work experience', 'projects', 'extracurriculars', 'clubs', 'gpa', 'education', 'certifications', 'awards', 'honors', 'leadership', 'bullet points', 'action verbs', 'quantify', 'metrics', 'numbers', 'accomplishments', 'achievements', 'results', 'student resume', 'college resume', 'undergrad resume', 'undergraduate', 'graduate', 'new grad resume', 'entry level resume', 'first resume', 'no experience resume', 'limited experience', 'tech resume', 'software engineer resume', 'swe resume', 'pm resume', 'product manager resume', 'data science resume', 'ux resume', 'marketing resume', 'internship resume', 'career changer resume', 'transfer student', 'nontraditional', 'international student resume', 'get reviewed', 'submit resume', 'share resume', 'see other resumes', 'browse resumes', 'resume examples', 'resume inspiration', 'showcase', 'upload', 'first gen resume', 'weak resume', 'strong resume', 'bad resume'] },
  { label: 'Partner Panels', description: 'Community · Live panels with partners', type: 'page', to: '/partner-panels', comingSoon: true,
    keywords: ['panel', 'panels', 'event', 'events', 'live', 'live event', 'webinar', 'webinars', 'talk', 'talks', 'speaker', 'speakers', 'panelist', 'panelists', 'industry talk', 'industry expert', 'fireside chat', 'fireside chats', 'roundtable', 'summit', 'workshop', 'seminar', 'recording', 'recordings', 'replay', 'rewatch', 'watch', 'listen', 'video', 'watch again', 'presentation', 'q&a', 'qa', 'questions', 'discussion', 'conversation', 'partners', 'partner', 'partner companies', 'company', 'sponsor', 'recruiter panel', 'alumni panel', 'career panel', 'tech panel', 'diversity panel', 'first gen panel', 'recruiting panel', 'zoom', 'virtual', 'online', 'live stream', 'past events', 'archive', 'past panels', 'previous panels', 'rsvp', 'register', 'sign up', 'attend', 'upcoming', 'schedule', 'next event', 'future events', '30 under 30', 'industry professionals speaking', 'hear from professionals', 'learn from professionals'] },
]

const CONFETTI_COLORS = ['#E8A838','#B34539','#3A7D6B','#5B8EC2','#F2E4CE','#f5c026','#ff6b6b','#ff9ff3','#54a0ff','#5f27cd','#01a3a4','#feca57','#ff6348','#7bed9f']
const PINATA_STAGES = [{ at: 0, src: '/pinanta/step1.png' },{ at: 3, src: '/pinanta/step2.png' },{ at: 5, src: '/pinanta/step3.png' }]
const HITS_TO_BREAK = 7

// Waitlist mode: when true, hides nav links, search, and every section after the hero,
// and replaces the Get in Touch CTA with a Waitlist button.
// LAUNCHED — waitlist mode is now OFF, so the full site is live. Set back to
// `!import.meta.env.DEV` (or `true`) to re-enable the pre-launch waitlist gate.
const WAITLIST_MODE = false

export default function Home() {
  const navigate = useNavigate()
  const { lang, setLang } = useLang()
  const t = useT('home')
  const tForms = useT('forms')
  const tNav = useT('nav')

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef(null)
  const [aboutTab, setAboutTab] = useState('who-we-are')
  const [servicesTab, setServicesTab] = useState('content')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalSent, setModalSent] = useState(false)
  const [modalName, setModalName] = useState('')
  const [modalEmail, setModalEmail] = useState('')
  const [modalMessage, setModalMessage] = useState('')
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState('')
  const [modalToken, setModalToken] = useState('')
  const [modalTurnstileError, setModalTurnstileError] = useState(false)
  const modalTurnstileReset = useRef(null)
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [waitlistSent, setWaitlistSent] = useState(false)
  const [waitlistName, setWaitlistName] = useState('')
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistSchool, setWaitlistSchool] = useState('')
  const [waitlistLoading, setWaitlistLoading] = useState(false)
  const [waitlistError, setWaitlistError] = useState('')
  const [waitlistToken, setWaitlistToken] = useState('')
  const [waitlistTurnstileError, setWaitlistTurnstileError] = useState(false)
  const waitlistTurnstileReset = useRef(null)
  const waitlistRef = useRef(null)
  const [newsletterOpen, setNewsletterOpen] = useState(false)
  const [newsletterSent, setNewsletterSent] = useState(false)
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterLoading, setNewsletterLoading] = useState(false)
  const [newsletterError, setNewsletterError] = useState('')
  const [newsletterToken, setNewsletterToken] = useState('')
  const [newsletterTurnstileError, setNewsletterTurnstileError] = useState(false)
  const newsletterTurnstileReset = useRef(null)
  const newsletterRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [navOnHero, setNavOnHero] = useState(true)
  const [navHidden, setNavHidden] = useState(false)
  const [loaderDone, setLoaderDone] = useState(false)

  const pinataRef = useRef(null)
  const pinataImgRef = useRef(null)
  const pinataHitsRef = useRef(0)
  const pinataBrokenRef = useRef(false)
  const [pinataWrapClass, setPinataWrapClass] = useState('pinata--idle')
  const [pinataVisible, setPinataVisible] = useState(true)
  const [pinataMsg, setPinataMsg] = useState('')

  const footerRef = useRef(null)
  const canvasRef = useRef(null)
  const galleryRef = useRef(null)
  const loaderRef = useRef(null)
  const loaderFillRef = useRef(null)
  const gsapCtxRef = useRef(null)
  const modalRef = useRef(null)

  const openModal = useCallback((e) => {
    e?.preventDefault()
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setTimeout(() => {
      setModalSent(false)
      setModalName('')
      setModalEmail('')
      setModalMessage('')
      setModalError('')
      setModalToken('')
      modalTurnstileReset.current?.()
    }, 400)
  }, [])

  const handleModalSubmit = useCallback(async () => {
    if (!modalEmail.trim() || !modalMessage.trim()) return
    if (TURNSTILE_ENABLED && !modalToken) return
    setModalLoading(true)
    setModalError('')
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-contact-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ name: modalName.trim(), email: modalEmail.trim(), message: modalMessage.trim(), turnstileToken: modalToken }),
      })
      if (!res.ok) throw new Error('Failed to send')
      setModalSent(true)
    } catch {
      setModalError(t.modalError)
      setModalToken('')
      modalTurnstileReset.current?.()
    }
    setModalLoading(false)
  }, [modalName, modalEmail, modalMessage, modalToken, t])

  const handleModalKeyDown = useCallback((e) => {
    if (e.key !== 'Tab' || !modalRef.current) return
    const focusable = Array.from(
      modalRef.current.querySelectorAll('input, button:not([disabled]), [tabindex]:not([tabindex="-1"])')
    ).filter(el => !el.closest('[aria-hidden="true"]'))
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus() }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }, [])

  useEffect(() => {
    if (modalOpen) {
      setTimeout(() => {
        modalRef.current?.querySelector('input, button:not([disabled])')?.focus()
      }, 50)
      const onKey = (e) => { if (e.key === 'Escape') closeModal() }
      document.addEventListener('keydown', onKey)
      return () => document.removeEventListener('keydown', onKey)
    }
  }, [modalOpen, closeModal])

  useEffect(() => {
    document.body.style.overflow = (modalOpen || waitlistOpen || newsletterOpen || menuOpen) ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [modalOpen, waitlistOpen, newsletterOpen, menuOpen])

  const openWaitlist = useCallback((e) => {
    e?.preventDefault()
    setWaitlistOpen(true)
  }, [])

  const closeWaitlist = useCallback(() => {
    setWaitlistOpen(false)
    setTimeout(() => {
      setWaitlistSent(false)
      setWaitlistName('')
      setWaitlistEmail('')
      setWaitlistSchool('')
      setWaitlistError('')
      setWaitlistToken('')
      waitlistTurnstileReset.current?.()
    }, 400)
  }, [])

  const handleWaitlistSubmit = useCallback(async () => {
    if (!waitlistName.trim() || !waitlistEmail.trim()) return
    if (TURNSTILE_ENABLED && !waitlistToken) return
    setWaitlistLoading(true)
    setWaitlistError('')
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/add-to-waitlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          name: waitlistName.trim(),
          email: waitlistEmail.trim(),
          school: waitlistSchool.trim() || null,
          lang,
          turnstileToken: waitlistToken,
        }),
      })
      if (!res.ok) throw new Error('Failed to sign up')
      setWaitlistSent(true)
    } catch {
      setWaitlistError(t.waitlistError)
      setWaitlistToken('')
      waitlistTurnstileReset.current?.()
    }
    setWaitlistLoading(false)
  }, [waitlistName, waitlistEmail, waitlistSchool, lang, waitlistToken, t])

  const handleWaitlistKeyDown = useCallback((e) => {
    if (e.key !== 'Tab' || !waitlistRef.current) return
    const focusable = Array.from(
      waitlistRef.current.querySelectorAll('input, button:not([disabled]), [tabindex]:not([tabindex="-1"])')
    ).filter(el => !el.closest('[aria-hidden="true"]'))
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus() }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }, [])

  useEffect(() => {
    if (waitlistOpen) {
      setTimeout(() => {
        waitlistRef.current?.querySelector('input, button:not([disabled])')?.focus()
      }, 50)
      const onKey = (e) => { if (e.key === 'Escape') closeWaitlist() }
      document.addEventListener('keydown', onKey)
      return () => document.removeEventListener('keydown', onKey)
    }
  }, [waitlistOpen, closeWaitlist])

  const openNewsletter = useCallback((e) => {
    e?.preventDefault()
    setNewsletterOpen(true)
  }, [])

  const closeNewsletter = useCallback(() => {
    setNewsletterOpen(false)
    setTimeout(() => {
      setNewsletterSent(false)
      setNewsletterEmail('')
      setNewsletterError('')
      setNewsletterToken('')
      newsletterTurnstileReset.current?.()
    }, 400)
  }, [])

  const handleNewsletterSubmit = useCallback(async () => {
    if (!newsletterEmail.trim()) return
    if (TURNSTILE_ENABLED && !newsletterToken) return
    setNewsletterLoading(true)
    setNewsletterError('')
    // Signup now flows through the Turnstile-gated submit-form edge function
    // (service role) instead of a direct anon insert — the anon INSERT on
    // subscribers is revoked (migration 017) so the welcome-email webhook can't
    // be abused. A 409 means the email is already subscribed: treat as success.
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-form`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          type: 'subscriber',
          turnstileToken: newsletterToken,
          payload: { email: newsletterEmail.trim(), source: 'home-la-voz' },
        }),
      })
      if (res.ok || res.status === 409) {
        setNewsletterSent(true)
      } else {
        setNewsletterError(t.newsletterError)
        setNewsletterToken('')
        newsletterTurnstileReset.current?.()
      }
    } catch {
      // Network/CORS failure throws rather than returning a response — surface it instead of hanging.
      setNewsletterError(t.newsletterError)
      setNewsletterToken('')
      newsletterTurnstileReset.current?.()
    } finally {
      setNewsletterLoading(false)
    }
  }, [newsletterEmail, newsletterToken, t])

  const handleNewsletterKeyDown = useCallback((e) => {
    if (e.key !== 'Tab' || !newsletterRef.current) return
    const focusable = Array.from(
      newsletterRef.current.querySelectorAll('input, button:not([disabled]), [tabindex]:not([tabindex="-1"])')
    ).filter(el => !el.closest('[aria-hidden="true"]'))
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus() }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }, [])

  useEffect(() => {
    if (newsletterOpen) {
      setTimeout(() => {
        newsletterRef.current?.querySelector('input, button:not([disabled])')?.focus()
      }, 50)
      const onKey = (e) => { if (e.key === 'Escape') closeNewsletter() }
      document.addEventListener('keydown', onKey)
      return () => document.removeEventListener('keydown', onKey)
    }
  }, [newsletterOpen, closeNewsletter])

  useEffect(() => {
    if (!waitlistSent) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const box = waitlistRef.current
    if (!box) return
    const rect = box.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + Math.min(rect.height * 0.32, 180)
    const pieces = 96
    for (let i = 0; i < pieces; i++) {
      const w = 7 + Math.random() * 14
      const h = 3 + Math.random() * 9
      const color = CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0]
      const el = document.createElement('div')
      el.setAttribute('aria-hidden', 'true')
      el.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:${w}px;height:${h}px;background:${color};border-radius:2px;pointer-events:none;z-index:10100;will-change:transform,opacity;`
      document.body.appendChild(el)
      const angle = Math.random() * Math.PI * 2
      const dist = 140 + Math.random() * 320
      const dur = 1.1 + Math.random() * 1.1
      gsap.set(el, { xPercent: -50, yPercent: -50 })
      const tl = gsap.timeline({ onComplete: () => el.remove() })
      tl.fromTo(el,
        { opacity: 1, scale: 0.6, rotation: Math.random() * 360, x: 0, y: 0 },
        { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist + 140, rotation: `+=${(Math.random() - 0.5) * 760}`, scale: 0.45, duration: dur, ease: 'power3.out' }
      )
      tl.fromTo(el, { opacity: 1 }, { opacity: 0, duration: dur * 0.42, ease: 'power2.in' }, dur * 0.58)
    }
  }, [waitlistSent])

  /* ── Gallery carousel ── */
  function initGallery() {
    const track = galleryRef.current
    if (!track) return
    const cards = Array.from(track.querySelectorAll('.gallery__card'))
    if (!cards.length) return

    const N = cards.length
    let activeIdx = 0
    const CARD_ASPECT = 1350 / 1080
    const BASE_W = 280
    const BASE_H = Math.round(BASE_W * CARD_ASPECT)

    // Set static dimensions once — all subsequent layout calls only mutate transforms
    cards.forEach(card => gsap.set(card, { width: BASE_W, height: BASE_H, left: 0, top: 0 }))

    function getTrackW() { return track.offsetWidth || 1200 }
    function getTrackH() {
      if (track.offsetHeight > 0) return track.offsetHeight
      return window.innerWidth < 768 ? 320 : 480
    }
    function isMob() { return window.innerWidth < 768 }

    function getSlots() {
      const tw = getTrackW()
      const mob = isMob()
      const bigW = mob ? tw * 0.38 : tw * 0.24
      const centerW = mob ? tw * 0.42 : tw * 0.28
      const smallW = mob ? tw * 0.22 : tw * 0.16
      const cx = tw / 2
      const cy = getTrackH() / 2
      return {
        cy,
        slots: [
          { x: cx - tw * 0.37, w: bigW,    rotate:   0, z: 3, opacity: 1 },
          { x: cx - tw * 0.17, w: smallW,  rotate:  12, z: 2, opacity: 1 },
          { x: cx,             w: centerW, rotate:   0, z: 5, opacity: 1 },
          { x: cx + tw * 0.17, w: smallW,  rotate: -10, z: 2, opacity: 1 },
          { x: cx + tw * 0.37, w: bigW,    rotate:   0, z: 3, opacity: 1 },
          { x: cx + tw * 0.58, w: bigW,    rotate:   0, z: 0, opacity: 0 },
        ],
      }
    }

    function layout(animate) {
      const { cy, slots } = getSlots()
      cards.forEach((card, i) => {
        const si = ((i - activeIdx) % N + N) % N
        const slot = slots[si] || slots[slots.length - 1]
        card.style.zIndex = slot.z
        card.setAttribute('aria-hidden', slot.opacity === 0 ? 'true' : 'false')
        const props = {
          x: slot.x - BASE_W / 2,
          y: cy - BASE_H / 2,
          scale: slot.w / BASE_W,
          rotation: slot.rotate,
          opacity: slot.opacity,
        }
        if (animate) {
          gsap.to(card, { ...props, duration: 0.8, ease: 'cubic-bezier(0.16, 1, 0.3, 1)', overwrite: 'auto' })
        } else {
          gsap.set(card, props)
        }
      })
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    layout(false)
    if (reducedMotion) {
      gsap.set(cards, { opacity: (i) => { const si = ((i - activeIdx) % N + N) % N; return si < 5 ? 1 : 0 } })
    } else {
      gsap.to(cards, { opacity: (i) => { const si = ((i - activeIdx) % N + N) % N; return si < 5 ? 1 : 0 }, duration: 0.6, ease: 'power2.out', stagger: 0.06, overwrite: 'auto' })
    }

    cards.forEach((card, i) => card.addEventListener('click', () => { activeIdx = i; layout(true) }))

    const interval = reducedMotion ? null : setInterval(() => { activeIdx = (activeIdx + 1) % N; layout(true) }, 3000)
    let resizeTimer
    const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => layout(false), 150) }
    window.addEventListener('resize', onResize)

    return () => { clearInterval(interval); window.removeEventListener('resize', onResize); clearTimeout(resizeTimer) }
  }

  /* ── Footer dots canvas ── */
  function initFooterDots() {
    const footer = footerRef.current
    const canvas = canvasRef.current
    if (!footer || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let dots = [], wCss = 1, hCss = 1, dpr = 1
    const mouse = { x: 0, y: 0, inside: false }
    let visible = true
    let rafId
    const SPACING = 11, INFLUENCE = 120, MAX_PUSH = 40, LERP = 0.2, DOT_R = 1.05

    function buildDots() {
      dots = []
      for (let y = SPACING * 0.5; y < hCss; y += SPACING) {
        for (let x = SPACING * 0.5; x < wCss; x += SPACING) {
          dots.push({ bx: x, by: y, ox: 0, oy: 0, g: 0.18 + Math.random() * 0.42 })
        }
      }
    }

    function resize() {
      const rect = footer.getBoundingClientRect()
      wCss = Math.max(1, rect.width)
      hCss = Math.max(1, rect.height)
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(wCss * dpr)
      canvas.height = Math.floor(hCss * dpr)
      canvas.style.width = `${wCss}px`
      canvas.style.height = `${hCss}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      buildDots()
    }

    function draw() {
      if (!visible) return
      ctx.clearRect(0, 0, wCss, hCss)
      const rect = footer.getBoundingClientRect()
      const mx = mouse.x - rect.left, my = mouse.y - rect.top
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i]
        let tx = 0, ty = 0
        if (!reduced && mouse.inside) {
          const dx = d.bx - mx, dy = d.by - my, dist = Math.hypot(dx, dy)
          if (dist < INFLUENCE && dist > 0.001) {
            const t = 1 - dist / INFLUENCE, push = t * t * MAX_PUSH
            tx = (dx / dist) * push; ty = (dy / dist) * push
          }
        }
        d.ox += (tx - d.ox) * LERP; d.oy += (ty - d.oy) * LERP
        if (!mouse.inside) { d.ox *= 0.93; d.oy *= 0.93 }
        ctx.fillStyle = `rgba(26,25,22,${d.g})`
        ctx.beginPath(); ctx.arc(d.bx + d.ox, d.by + d.oy, DOT_R, 0, Math.PI * 2); ctx.fill()
      }
    }

    function loop() { rafId = requestAnimationFrame(loop); draw() }

    const onMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true }
    const onTouch = (e) => { if (!e.touches.length) return; mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; mouse.inside = true }
    footer.addEventListener('mousemove', onMove)
    footer.addEventListener('mouseenter', onMove)
    footer.addEventListener('mouseleave', () => { mouse.inside = false })
    footer.addEventListener('touchmove', onTouch, { passive: true })
    footer.addEventListener('touchend', () => { mouse.inside = false })

    const ro = new ResizeObserver(resize)
    ro.observe(footer)
    const io = new IntersectionObserver((entries) => { visible = entries[0]?.isIntersecting !== false }, { threshold: 0 })
    io.observe(footer)

    resize()
    loop()

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect(); io.disconnect()
      footer.removeEventListener('mousemove', onMove)
      footer.removeEventListener('mouseenter', onMove)
      footer.removeEventListener('touchmove', onTouch)
    }
  }

  /* ── Click confetti ── */
  function initClickConfetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const handler = (e) => {
      if (e.target.closest('input, textarea, select, [contenteditable]')) return
      const anchor = e.target.closest('a[href]')
      if (anchor) {
        const href = anchor.getAttribute('href')
        if (href && !href.startsWith('#')) {
          try {
            const resolved = new URL(href, window.location.href)
            if (resolved.origin + resolved.pathname !== window.location.origin + window.location.pathname) return
          } catch {}
        }
      }
      const { clientX: x, clientY: y } = e
      for (let i = 0; i < 48; i++) {
        const w = 10 + Math.random() * 18, h = 4 + Math.random() * 10
        const color = CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0]
        const el = document.createElement('div')
        el.setAttribute('aria-hidden', 'true')
        el.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:${color};border-radius:2px;pointer-events:none;z-index:10050;`
        document.body.appendChild(el)
        const angle = Math.random() * Math.PI * 2, dist = 75 + Math.random() * 185, dur = 0.95 + Math.random() * 0.75
        gsap.set(el, { xPercent: -50, yPercent: -50 })
        const tl = gsap.timeline({ onComplete: () => el.remove() })
        tl.fromTo(el, { opacity: 1, scale: 0.6, rotation: Math.random() * 360, x: 0, y: 0 }, { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, rotation: `+=${(Math.random() - 0.5) * 620}`, scale: 0.4, duration: dur, ease: 'power3.out' })
        tl.fromTo(el, { opacity: 1 }, { opacity: 0, duration: dur * 0.42, ease: 'power2.in' }, dur * 0.58)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }

  /* ── GSAP ScrollTrigger ── */
  function initGSAP() {
    const toggle = 'play none none reverse'
    const persistToggle = 'play none none none'

    gsap.from('.intro__text', { scrollTrigger: { trigger: '.intro__right', start: 'top 80%', toggleActions: persistToggle }, opacity: 0, y: 40, duration: 0.8, ease: 'power2.out' })
    gsap.from('.intro__dot', { scrollTrigger: { trigger: '.intro__right', start: 'top 80%', toggleActions: persistToggle }, scale: 0, duration: 0.5, ease: 'power3.out' })
    gsap.from('.intro__banners', { scrollTrigger: { trigger: '.intro', start: 'top 65%', toggleActions: persistToggle }, clipPath: 'inset(0 100% 0 0)', duration: 1, ease: 'power3.inOut' })
    gsap.from('.about__header', { scrollTrigger: { trigger: '.about', start: 'top 78%', toggleActions: toggle }, y: 30, opacity: 0, duration: 0.7, ease: 'power2.out' })
    gsap.from('.about__intro', { scrollTrigger: { trigger: '.about', start: 'top 70%', toggleActions: toggle }, y: 30, opacity: 0, duration: 0.7, ease: 'power2.out', delay: 0.1 })
    gsap.from('.about__card--jose', { scrollTrigger: { trigger: '.about__cards', start: 'top 80%', toggleActions: toggle }, x: -50, opacity: 0, duration: 0.8, ease: 'power3.out' })
    gsap.from('.about__card--jocelyn', { scrollTrigger: { trigger: '.about__cards', start: 'top 80%', toggleActions: toggle }, x: 50, opacity: 0, duration: 0.8, ease: 'power3.out', delay: 0.12 })
    gsap.from('.about__closing', { scrollTrigger: { trigger: '.about__closing', start: 'top 90%', toggleActions: toggle }, y: 20, opacity: 0, duration: 0.6, ease: 'power2.out' })
    gsap.from('.c2c__title-img', { scrollTrigger: { trigger: '.c2c', start: 'top 75%', toggleActions: toggle }, y: -30, opacity: 0, duration: 0.9, ease: 'power2.out' })
    gsap.from('.c2c__lead', { scrollTrigger: { trigger: '.c2c', start: 'top 65%', toggleActions: toggle }, y: 30, opacity: 0, duration: 0.7, ease: 'power2.out' })
    gsap.utils.toArray('.c2c__node').forEach((node, i) => {
      gsap.from(node, { scrollTrigger: { trigger: '.c2c__pipeline', start: 'top 80%', toggleActions: toggle }, y: 40, opacity: 0, duration: 0.6, ease: 'power3.out', delay: i * 0.14 })
    })
    gsap.from('.c2c__closing', { scrollTrigger: { trigger: '.c2c__closing', start: 'top 92%', toggleActions: toggle }, y: 20, opacity: 0, duration: 0.6, ease: 'power2.out' })
    gsap.from('.services__image-inner', { scrollTrigger: { trigger: '.services', start: 'top 75%', toggleActions: toggle }, clipPath: 'inset(20%)', scale: 1.2, duration: 1, ease: 'power2.out' })
    gsap.from('.services__body', { scrollTrigger: { trigger: '.services__content', start: 'top 75%', toggleActions: toggle }, y: 40, opacity: 0, duration: 0.8, ease: 'power2.out' })
    gsap.fromTo('.interr__char',
      { color: 'rgba(255,255,255,0.2)' },
      { color: '#ffffff', stagger: 0.04, duration: 0.3, ease: 'none',
        scrollTrigger: { trigger: '.interr', start: 'top 75%', end: 'bottom 35%', scrub: 0.6 } }
    )
    if (window.innerWidth >= 1024) {
      gsap.to('.interr__bar--cream', { scrollTrigger: { trigger: '.interr', start: 'top bottom', end: 'bottom top', scrub: 0.35 }, y: -40, ease: 'none' })
      gsap.to('.interr__bar--accent', { scrollTrigger: { trigger: '.interr', start: 'top bottom', end: 'bottom top', scrub: 0.35 }, y: 30, ease: 'none' })
    }
    gsap.from('.editorial__showcase-inner', { scrollTrigger: { trigger: '.editorial__showcase', start: 'top 80%', toggleActions: persistToggle }, y: 60, opacity: 0, duration: 0.8, ease: 'power2.out' })
    gsap.utils.toArray('.editorial__card').forEach((card, i) => {
      gsap.from(card, { scrollTrigger: { trigger: card, start: 'top 88%', toggleActions: toggle }, clipPath: 'inset(0 0 100% 0)', duration: 0.7, ease: 'power3.out', delay: (i % 2) * 0.1 })
    })
    gsap.utils.toArray('.mascot').forEach(mascot => {
      gsap.fromTo(mascot, { opacity: 0, scale: 0, rotate: -30 }, { opacity: 1, scale: 1, rotate: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: mascot.closest('section, footer') || mascot, start: 'top 80%', once: true, toggleActions: persistToggle } })
    })
    gsap.from('.footer__logo-svg', { scrollTrigger: { trigger: '.footer', start: 'top 80%', toggleActions: 'play none none none' }, x: -60, opacity: 0, duration: 0.8, ease: 'power2.out' })
    gsap.from('.footer__cta', { scrollTrigger: { trigger: '.footer', start: 'top 75%', toggleActions: 'play none none none' }, x: 80, rotation: -15, opacity: 0, duration: 0.8, ease: 'power2.out', delay: 0.15 })

    const nav = document.getElementById('nav')
    if (nav) {
      ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom top', onLeave: () => { setNavOnHero(false) }, onEnterBack: () => { setNavOnHero(true) } })
      if (window.innerWidth >= 1024) {
        ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom top', onUpdate(self) {
          const el = document.querySelector('.hero__inner')
          if (el) { el.style.opacity = 1 - self.progress * 1.5; el.style.transform = `scale(${1 - self.progress * 0.12}) translateY(${self.progress * -60}px)` }
        }})
      }
    }

    ScrollTrigger.refresh()
    requestAnimationFrame(() => ScrollTrigger.refresh())
  }

  /* ── Loader + site init ── */
  useEffect(() => {
    window.scrollTo(0, 0)
    history.scrollRestoration = 'manual'

    let cleanupScroll = null
    let cleanupGallery = null
    let cleanupDots = null
    let cleanupConfetti = null
    let tl = null

    const loader = loaderRef.current
    const fill = loaderFillRef.current
    const panels = loader?.querySelectorAll('.loader__panel')

    function afterLoader() {
      // Hide nav on scroll-down past 300px, reveal on scroll-up.
      // Driven by ScrollTrigger (RAF-batched) instead of a per-frame scroll listener.
      const navTrigger = ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: (self) => setNavHidden(self.direction === 1 && self.scroll() > 300),
      })
      cleanupScroll = () => navTrigger.kill()

      const navOffset = 80
      const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
      document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
          const id = a.getAttribute('href')
          if (!id || id === '#') return
          const target = document.querySelector(id)
          if (!target) return
          e.preventDefault()
          const y = target.getBoundingClientRect().top + window.scrollY - navOffset
          window.scrollTo({ top: Math.max(0, y), behavior: reduceMotion() ? 'auto' : 'smooth' })
        })
      })

      cleanupGallery = initGallery()
      cleanupDots = initFooterDots()
      cleanupConfetti = initClickConfetti()
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        initGSAP()
      }
    }

    if (!loader || !fill || !panels?.length) {
      setLoaderDone(true)
      afterLoader()
    } else {
      const wipeEase = 'power3.inOut'
      const wipeDur = 0.88

      tl = gsap.timeline()
      tl.to(fill, { width: '35%', duration: 0.35, ease: 'power2.out' })
        .to(fill, { width: '72%', duration: 0.32, ease: 'power2.out' })
        .to(fill, { width: '100%', duration: 0.28, ease: 'power2.out' })
        .add('wipe')
        .to(panels[0], { xPercent: -100, duration: wipeDur, ease: wipeEase, force3D: true }, 'wipe')
        .to(panels[1], { xPercent: 100, duration: wipeDur, ease: wipeEase, force3D: true }, 'wipe+=0.08')
        .to(panels[2], { xPercent: -100, duration: wipeDur, ease: wipeEase, force3D: true }, 'wipe+=0.16')
        .call(() => { setLoaderDone(true); afterLoader() })
        .fromTo('.hero__sun',     { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.75, ease: 'power2.out', stagger: 0.1 }, 'wipe')
        .fromTo('.hero__j',       { y: 80, opacity: 0 },       { y: 0, opacity: 1, duration: 1.0, ease: 'power3.out', stagger: 0.13 }, 'wipe+=0.05')
        .fromTo('.hero__x',       { scale: 0, opacity: 0 },    { scale: 1, opacity: 1, duration: 0.7, ease: 'power2.out' }, 'wipe+=0.2')
        .fromTo('.hero__names',   { y: 20, opacity: 0 },       { y: 0, opacity: 1, duration: 0.8, ease: 'power2.out' }, 'wipe+=0.3')
        .fromTo('.hero__tagline', { y: 16, opacity: 0 },       { y: 0, opacity: 1, duration: 0.7, ease: 'power2.out' }, 'wipe+=0.4')
        .fromTo('.hero__rule',    { scaleX: 0, opacity: 0 },   { scaleX: 1, opacity: 1, duration: 0.5, ease: 'power2.out', transformOrigin: 'center center' }, 'wipe+=0.48')
        .fromTo('.hero__foot',    { y: 12, opacity: 0 },       { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out' }, 'wipe+=0.55')
    }

    return () => {
      tl?.kill()
      ScrollTrigger.getAll().forEach(t => t.kill())
      cleanupScroll?.()
      cleanupGallery?.()
      cleanupDots?.()
      cleanupConfetti?.()
    }
  }, [])

  /* ── Piñata ── */
  function handlePinataClick(e) {
    if (pinataBrokenRef.current) return
    e.stopPropagation()
    const hits = ++pinataHitsRef.current

    const wrap = pinataRef.current
    wrap.classList.remove('pinata--idle', 'pinata--hit')
    void wrap.offsetWidth
    wrap.classList.add('pinata--hit')

    // Update image
    let best = PINATA_STAGES[0]
    for (const s of PINATA_STAGES) { if (hits >= s.at) best = s }
    if (pinataImgRef.current && pinataImgRef.current.src !== best.src) {
      pinataImgRef.current.src = best.src
    }

    if (hits >= 5) wrap.classList.add('pinata--shaking')

    // Spawn hit stars
    for (let i = 0; i < 6 + hits * 3; i++) {
      const star = document.createElement('div')
      star.className = 'pinata__star'
      star.setAttribute('aria-hidden', 'true')
      const size = 6 + Math.random() * 12
      const color = CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0]
      star.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;width:${size}px;height:${size}px;background:${color};border-radius:${Math.random() > 0.5 ? '50%' : '2px'};transform:rotate(${Math.random() * 360}deg);`
      document.body.appendChild(star)
      const angle = Math.random() * Math.PI * 2, dist = 40 + Math.random() * 100
      gsap.to(star, { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist - 30, opacity: 0, rotation: Math.random() * 720 - 360, duration: 0.6 + Math.random() * 0.4, ease: 'power2.out', onComplete: () => star.remove() })
    }

    if (hits >= HITS_TO_BREAK) {
      pinataBrokenRef.current = true
      wrap.classList.remove('pinata--shaking')

      const vw = window.innerWidth, vh = window.innerHeight
      const frag = document.createDocumentFragment()
      const pieces = []
      for (let i = 0; i < 140; i++) {
        const el = document.createElement('div')
        el.setAttribute('aria-hidden', 'true')
        const w = 8 + Math.random() * 16, h = 4 + Math.random() * 10
        const color = CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0]
        el.style.cssText = `position:fixed;left:${vw * 0.2 + Math.random() * vw * 0.6}px;top:${vh * 0.25 + Math.random() * vh * 0.25}px;width:${w}px;height:${h}px;background:${color};border-radius:${Math.random() > 0.4 ? '2px' : '50%'};pointer-events:none;z-index:10060;will-change:transform,opacity;`
        frag.appendChild(el); pieces.push(el)
      }
      document.body.appendChild(frag)

      requestAnimationFrame(() => {
        wrap.classList.remove('pinata--hit')
        wrap.classList.add('pinata--break')
        pieces.forEach(el => {
          gsap.fromTo(el, { x: 0, y: 0, rotation: 0, scale: 0 }, { x: (Math.random() - 0.5) * vw * 1.4, y: (Math.random() - 0.55) * vh * 1.5, rotation: Math.random() * 900 - 450, scale: 1 + Math.random() * 0.4, opacity: 0, duration: 1.6 + Math.random() * 1.0, delay: Math.random() * 0.08, ease: 'power2.out', onComplete: () => el.remove() })
        })

        setTimeout(() => {
          setPinataVisible(false)
          const msgs = t.breakMsgs
          const msg = msgs[(Math.random() * msgs.length) | 0]
          setPinataMsg(msg)

          setTimeout(() => {
            setPinataMsg('')
            pinataHitsRef.current = 0
            pinataBrokenRef.current = false
            if (pinataImgRef.current) pinataImgRef.current.src = PINATA_STAGES[0].src

            function reveal() {
              setPinataVisible(true)
              const wrap = pinataRef.current
              if (wrap) {
                wrap.classList.remove('pinata--break', 'pinata--hit', 'pinata--shaking', 'pinata--idle')
                void wrap.offsetWidth
                wrap.classList.add('pinata--idle')
              }
            }

            if (pinataImgRef.current && typeof pinataImgRef.current.decode === 'function') {
              pinataImgRef.current.decode().then(reveal).catch(reveal)
            } else {
              requestAnimationFrame(reveal)
            }
          }, 7150)
        }, 600)
      })
    } else {
      setTimeout(() => {
        wrap.classList.remove('pinata--hit')
        if (hits < 5) wrap.classList.add('pinata--idle')
      }, 500)
    }
  }

  const searchResults = (() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return SEARCH_INDEX
    const words = q.split(/\s+/).filter(w => w.length > 2)
    return SEARCH_INDEX.filter(item => {
      const haystack = `${item.label} ${item.description} ${item.keywords.join(' ')}`.toLowerCase()
      return haystack.includes(q) || words.some(w => haystack.includes(w))
    })
  })()

  const openSearch = () => { setSearchOpen(true); setSearchQuery(''); setTimeout(() => searchInputRef.current?.focus(), 50) }
  const closeSearch = () => { setSearchOpen(false); setSearchQuery('') }

  const handleSearchSelect = (item) => {
    if (item.comingSoon) { closeSearch(); return }
    closeSearch()
    if (item.to) { navigate(item.to); return }
    const el = document.querySelector(item.target)
    if (!el) return
    el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }

  const navClass = ['nav', navOnHero ? 'nav--on-hero' : 'nav--dark', navHidden ? 'nav--hidden' : ''].filter(Boolean).join(' ')

  return (
    <>
      <a href="#hero" className="skip-link">{t.skipToContent}</a>
      {/* LOADER */}
      {!loaderDone && (
        <div className="loader" id="loader" ref={loaderRef}>
          <div className="loader__bands">
            <div className="loader__panel loader__panel--1" />
            <div className="loader__panel loader__panel--2" />
            <div className="loader__panel loader__panel--3" />
          </div>
          <div className="loader__progress">
            <div className="loader__fill" id="loaderFill" ref={loaderFillRef} />
          </div>
        </div>
      )}

      {/* SEARCH PALETTE */}
      {searchOpen && (
        <div className="search-overlay" onClick={closeSearch}>
          <div className="search-palette" onClick={e => e.stopPropagation()} onKeyDown={e => e.key === 'Escape' && closeSearch()}>
            <div className="search-palette__bar">
              <svg className="search-palette__icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.7"/><path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
              <input
                ref={searchInputRef}
                className="search-palette__input"
                placeholder={tNav.searchPlaceholder}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoComplete="off"
              />
              <button className="search-palette__esc" onClick={closeSearch}>Esc</button>
            </div>
            <ul className="search-palette__results">
              {searchResults.length === 0
                ? <li className="search-palette__empty">{tNav.searchNoResults} &ldquo;{searchQuery}&rdquo;</li>
                : searchResults.map(item => (
                  <li key={item.label}>
                    <button
                      className={`search-palette__result${item.comingSoon ? ' search-palette__result--soon' : ''}`}
                      onClick={() => handleSearchSelect(item)}
                      disabled={item.comingSoon}
                      aria-disabled={item.comingSoon || undefined}
                    >
                      <span className="search-palette__result-label">{item.label}</span>
                      <span className="search-palette__result-desc">{item.description}</span>
                      <span className={`search-palette__result-type search-palette__result-type--${item.comingSoon ? 'soon' : item.type}`}>
                        {item.comingSoon ? t.editorialComingSoon : item.type}
                      </span>
                    </button>
                  </li>
                ))
              }
            </ul>
          </div>
        </div>
      )}

      {/* NAV */}
      <nav className={navClass} id="nav">
        <div className="nav__links">
          <button
            className="nav__lang-btn"
            onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
            aria-label={tNav.langToggleLabel}
          >
            <span className={lang === 'en' ? 'nav__lang-active' : 'nav__lang-inactive'}>EN</span>
            <span className="nav__lang-sep"> · </span>
            <span className={lang === 'es' ? 'nav__lang-active' : 'nav__lang-inactive'}>ES</span>
          </button>
          {!WAITLIST_MODE && (
            <>
              <button className="nav__search-btn" aria-label={tNav.searchBtnLabel} onClick={openSearch}>
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" width="17" height="17"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.8"/><path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
              </button>
              <a href="#about" className="nav__link">{tNav.about}</a>
              <div className="nav__services-wrap">
                <a href="#services" className="nav__link" onClick={e => {
                  e.preventDefault()
                  document.getElementById('services')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
                }}>{tNav.services}</a>
                <div className="nav__services-dropdown">
                  <div className="nav__services-group">
                    <span className="nav__services-label">{tNav.contentLabel}</span>
                    <Link to="/linkedin-series" className="nav__services-item">{tNav.linkedInSeries}</Link>
                    <Link to="/career-templates" className="nav__services-item">{tNav.careerTemplates}</Link>
                  </div>
                  <div className="nav__services-group">
                    <span className="nav__services-label">{tNav.sprintsLabel}</span>
                    <span className="nav__services-item nav__services-item--soon" aria-disabled="true">
                      {tNav.bridgeYearSprint}
                      <span className="nav__services-soon">{t.editorialComingSoon}</span>
                    </span>
                    <span className="nav__services-item nav__services-item--soon" aria-disabled="true">
                      {tNav.interviewPrep}
                      <span className="nav__services-soon">{t.editorialComingSoon}</span>
                    </span>
                  </div>
                  <div className="nav__services-group">
                    <span className="nav__services-label">{tNav.communityLabel}</span>
                    <Link to="/opportunity-board" className="nav__services-item">{tNav.opportunityBoard}</Link>
                    <Link to="/coffee-chat" className="nav__services-item">{tNav.coffeeChatNetwork}</Link>
                    <Link to="/resume-reviews" className="nav__services-item">{tNav.resumeReviews}</Link>
                    <span className="nav__services-item nav__services-item--soon" aria-disabled="true">
                      {tNav.partnerPanels}
                      <span className="nav__services-soon">{t.editorialComingSoon}</span>
                    </span>
                  </div>
                </div>
              </div>
              <a href="#editorial" className="nav__link">{tNav.laVoz}</a>
              <button className="nav__link nav__link--cta" onClick={openModal}>
                <span className="nav__link-accent" aria-hidden="true" />
                <span className="nav__link-label">{tNav.getInTouch}</span>
              </button>
            </>
          )}
          {WAITLIST_MODE && (
            <button className="nav__link nav__link--cta" onClick={openWaitlist}>
              <span className="nav__link-accent" aria-hidden="true" />
              <span className="nav__link-label">{tNav.waitlist}</span>
            </button>
          )}
        </div>
        {!WAITLIST_MODE && (
          <button className="nav__search-btn nav__search-btn--mobile" aria-label={tNav.searchBtnLabel} onClick={openSearch}>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" width="19" height="19"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.8"/><path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        )}
        {!WAITLIST_MODE && (
          <button
            className={`nav__burger${menuOpen ? ' nav__burger--open' : ''}`}
            id="navBurger"
            aria-label={menuOpen ? tNav.closeMenu : tNav.openMenu}
            aria-expanded={menuOpen}
            aria-controls="mobileNav"
            onClick={() => setMenuOpen(o => !o)}
          >
            <span /><span /><span />
          </button>
        )}
      </nav>

      {/* MOBILE NAV */}
      {!WAITLIST_MODE && (
      <div className={`mobile-nav${menuOpen ? ' mobile-nav--open' : ''}`} id="mobileNav" role="navigation" aria-label="Mobile navigation" aria-hidden={!menuOpen}>
        <button className="mobile-nav__search" aria-label={tNav.searchBtnLabel} onClick={() => { setMenuOpen(false); openSearch() }}>
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" width="20" height="20"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.7"/><path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
          <span>{tNav.mobileSearch}</span>
        </button>
        <button
          className="nav__lang-btn mobile-nav__link"
          onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
          aria-label={tNav.langToggleLabel}
          style={{ fontSize: 'clamp(22px, 4.5vw, 32px)', fontWeight: 500 }}
        >
          <span className={lang === 'en' ? 'nav__lang-active' : 'nav__lang-inactive'}>EN</span>
          <span className="nav__lang-sep"> · </span>
          <span className={lang === 'es' ? 'nav__lang-active' : 'nav__lang-inactive'}>ES</span>
        </button>
        <a href="#about" className="mobile-nav__link" onClick={() => setMenuOpen(false)}>{tNav.about}</a>
        <a href="#services" className="mobile-nav__link" onClick={() => setMenuOpen(false)}>{tNav.services}</a>
        <a href="#editorial" className="mobile-nav__link" onClick={() => setMenuOpen(false)}>{tNav.laVoz}</a>
        <button className="mobile-nav__link" onClick={() => { setMenuOpen(false); openModal() }}>{tNav.getInTouch}</button>
      </div>
      )}

      <main>

      {/* HERO */}
      <section className="hero" id="hero">
        <div className="hero__chrome-strip hero__chrome-strip--top" aria-hidden="true" />
        <div className="hero__inner">
          <div className="hero__mark-row">
            <div className="hero__sun hero__sun--spin" aria-hidden="true">
              <svg className="hero__sun-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="22" y="22" width="56" height="56" className="hero__sun-square"/>
                <rect x="22" y="22" width="56" height="56" className="hero__sun-square" transform="rotate(45 50 50)"/>
                <circle cx="50" cy="50" r="20" className="hero__sun-core"/>
              </svg>
            </div>
            <div className="hero__jxj">
              <span className="hero__jxj-cell hero__jxj-cell--left"><span className="hero__j">J</span></span>
              <span className="hero__x">×</span>
              <span className="hero__jxj-cell hero__jxj-cell--right"><span className="hero__j">J</span></span>
            </div>
            <div className="hero__sun hero__sun--spin-reverse" aria-hidden="true">
              <svg className="hero__sun-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="22" y="22" width="56" height="56" className="hero__sun-square"/>
                <rect x="22" y="22" width="56" height="56" className="hero__sun-square" transform="rotate(45 50 50)"/>
                <circle cx="50" cy="50" r="20" className="hero__sun-core"/>
              </svg>
            </div>
          </div>
          <h1 className="hero__names">Jose &amp; Jocelyn</h1>
          <p className="hero__tagline" lang="es">El sol sale para todos…</p>
          <div className="hero__rule" aria-hidden="true" />
          <p className="hero__foot">
            <span className="hero__foot-phrase">{t.heroFoot1}</span>
            <span className="hero__foot-sep" aria-hidden="true"> · </span>
            <span className="hero__foot-phrase">{t.heroFoot2}</span>
            <span className="hero__foot-sep" aria-hidden="true"> · </span>
            <span className="hero__foot-phrase">{t.heroFoot3}</span>
          </p>
          {WAITLIST_MODE && (
            <button
              type="button"
              className="hero__waitlist-cta"
              onClick={openWaitlist}
              aria-haspopup="dialog"
              aria-controls="waitlistModal"
            >
              <span className="hero__waitlist-cta-label">{tNav.waitlist}</span>
              <span className="hero__waitlist-cta-arrow" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="13 6 19 12 13 18" />
                </svg>
              </span>
            </button>
          )}
        </div>
        <div className="hero__chrome-strip hero__chrome-strip--bottom" aria-hidden="true" />
      </section>

      {!WAITLIST_MODE && (<>
      {/* INTRO */}
      <section className="intro" id="intro">
        <div className="intro__left">
          <div className="intro__banners" role="group" aria-label="From Campus to Career banners">
            <img src="/images/banner1.png" alt="" className="intro__banner-img" loading="lazy" decoding="async" />
            <img src="/images/banner2.png" alt="" className="intro__banner-img" loading="lazy" decoding="async" />
            <img src="/images/banner3.png" alt="" className="intro__banner-img" loading="lazy" decoding="async" />
            <img src="/images/banner4.png" alt="" className="intro__banner-img" loading="lazy" decoding="async" />
          </div>
        </div>
        <div className="intro__right">
          <div className="intro__dot" aria-hidden="true" />
          <p className="intro__text">{t.introText}</p>
          <img src="/images/sun.png" alt="" className="mascot mascot--sun mascot--intro" aria-hidden="true" loading="lazy" decoding="async" />
        </div>
      </section>

      {/* ABOUT */}
      <section className="about" id="about">
        <div className="about__header">
          <h2 className="about__title">{t.aboutTitle}</h2>
        </div>
        <div className="about__tabs" role="tablist" onKeyDown={e => {
          const KEYS = ['who-we-are', 'mission', 'vision']
          const idx = KEYS.indexOf(aboutTab)
          let next = null
          if (e.key === 'ArrowRight') { e.preventDefault(); next = KEYS[(idx + 1) % KEYS.length] }
          if (e.key === 'ArrowLeft')  { e.preventDefault(); next = KEYS[(idx - 1 + KEYS.length) % KEYS.length] }
          if (e.key === 'Home')       { e.preventDefault(); next = KEYS[0] }
          if (e.key === 'End')        { e.preventDefault(); next = KEYS[KEYS.length - 1] }
          if (next) { setAboutTab(next); setTimeout(() => document.getElementById(`about-tab-${next}`)?.focus(), 0) }
        }}>
          {['who-we-are', 'mission', 'vision'].map((tab, i) => (
            <Fragment key={tab}>
              {i > 0 && <span className="about__tab-sep" aria-hidden="true">|</span>}
              <button
                id={`about-tab-${tab}`}
                role="tab"
                className={`about__tab${aboutTab === tab ? ' about__tab--active' : ''}`}
                aria-selected={aboutTab === tab}
                aria-controls={`about-panel-${tab}`}
                tabIndex={aboutTab === tab ? 0 : -1}
                onClick={() => setAboutTab(tab)}
              >
                {tab === 'who-we-are' ? t.aboutTabWhoWeAre : tab === 'mission' ? t.aboutTabMission : t.aboutTabVision}
              </button>
            </Fragment>
          ))}
        </div>

        <div id="about-panel-who-we-are" role="tabpanel" aria-labelledby="about-tab-who-we-are" className={`about__panel${aboutTab === 'who-we-are' ? ' about__panel--active' : ''}`}>
          <p className="about__panel-subtitle">{t.aboutSubtitle}</p>
          <p className="about__intro" dangerouslySetInnerHTML={{ __html: t.aboutIntro }} />
          <div className="about__cards">
            <div className="about__card about__card--jose">
              <span className="about__card-label">{t.joseLabel}</span>
              <div className="about__card-identity">
                <div className="about__card-photo-wrap">
                  <img src="/images/jose.jpeg" alt="Jose G. Cruz-Lopez" className="about__card-photo about__card-photo--base" width="96" height="96" decoding="async" />
                  <img src="/images/JOSE.png" alt="" className="about__card-photo about__card-photo--alt" width="96" height="96" decoding="async" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="about__card-name">{t.joseName}</h3>
                  <div className="about__card-role-row">
                    <p className="about__card-role">{t.joseRole}</p>
                    <div className="about__card-socials">
                      <a href="https://www.linkedin.com/in/cjxsez/" className="about__card-social about__card-social--linkedin" target="_blank" rel="noopener noreferrer" aria-label="Jose G. Cruz-Lopez on LinkedIn">
                        <img src="/images/linkedin_logo.png" alt="" decoding="async" loading="lazy" />
                      </a>
                      <a href="https://www.instagram.com/cjxsez/" className="about__card-social about__card-social--instagram" target="_blank" rel="noopener noreferrer" aria-label="Jose G. Cruz-Lopez on Instagram">
                        <img src="/images/instagram_logo.png" alt="" decoding="async" loading="lazy" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
              <p className="about__card-desc">{t.joseDesc}</p>
              <div className="about__card-tags">
                {t.joseTags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            </div>
            <div className="about__card about__card--jocelyn">
              <span className="about__card-label">{t.jocelynLabel}</span>
              <div className="about__card-identity">
                <div className="about__card-photo-wrap">
                  <img src="/images/jocelyn.jpeg" alt="Jocelyn Vazquez" className="about__card-photo about__card-photo--base" width="96" height="96" decoding="async" />
                  <img src="/images/JOSECELYN.png" alt="" className="about__card-photo about__card-photo--alt" width="96" height="96" decoding="async" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="about__card-name">{t.jocelynName}</h3>
                  <div className="about__card-role-row">
                    <p className="about__card-role">{t.jocelynRole}</p>
                    <div className="about__card-socials">
                      <a href="https://www.linkedin.com/in/jocelyn-vazquez/?skipRedirect=true" className="about__card-social about__card-social--linkedin" target="_blank" rel="noopener noreferrer" aria-label="Jocelyn Vazquez on LinkedIn">
                        <img src="/images/linkedin_logo.png" alt="" decoding="async" loading="lazy" />
                      </a>
                      <a href="https://www.instagram.com/beautyengineered/" className="about__card-social about__card-social--instagram" target="_blank" rel="noopener noreferrer" aria-label="Jocelyn Vazquez on Instagram">
                        <img src="/images/instagram_logo.png" alt="" decoding="async" loading="lazy" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
              <p className="about__card-desc">{t.jocelynDesc}</p>
              <div className="about__card-tags">
                {t.jocelynTags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            </div>
          </div>
          <p className="about__closing" dangerouslySetInnerHTML={{ __html: t.aboutClosing }} />
        </div>

        <div id="about-panel-mission" role="tabpanel" aria-labelledby="about-tab-mission" className={`about__panel${aboutTab === 'mission' ? ' about__panel--active' : ''}`}>
          <p className="about__label">{t.missionLabel}</p>
          <blockquote className="about__quote" dangerouslySetInnerHTML={{ __html: t.missionQuote }} />
          <p className="about__attribution">{t.missionAttribution}</p>
          <p className="about__body">{t.missionBody}</p>
        </div>

        <div id="about-panel-vision" role="tabpanel" aria-labelledby="about-tab-vision" className={`about__panel${aboutTab === 'vision' ? ' about__panel--active' : ''}`}>
          <p className="about__body">{t.visionBody}</p>
        </div>
      </section>

      {/* CAMPUS TO CAREER */}
      <section className="c2c" id="c2c">
        <div className="c2c__inner">
          <div className="c2c__title-art">
            <img src="/images/c2c-title-collab.png" alt="From Campus to Career" className="c2c__title-img" loading="lazy" decoding="async" />
          </div>
          <div className="c2c__content">
            <p className="c2c__lead">{t.c2cLead}</p>
            <ol className="c2c__pipeline">
              {t.c2cCards.map(({ n, t: title, d }, idx) => {
                const tone = ['navy', 'teal', 'accent', 'gold'][idx]
                return (
                  <li key={n} className={`c2c__node c2c__node--${tone}`}>
                    <div className="c2c__node-marker" aria-hidden="true">
                      <span className="c2c__node-dot" />
                    </div>
                    <div className="c2c__node-body">
                      <span className="c2c__node-num">{n}</span>
                      <h3 className="c2c__node-title">{title}</h3>
                      <p className="c2c__node-desc">{d}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
            <p className="c2c__closing">{t.c2cClosing}</p>
          </div>
        </div>
      </section>

      {/* GALLERY */}
      <section className="gallery" id="gallery" aria-label="From Campus to Career highlights">
        <div className="gallery__track" id="galleryTrack" ref={galleryRef}>
          <div className="gallery__card gallery__card--photo" data-index="0" role="img" aria-label="A degree helps, strategy gets you hired: turn class projects, club work, and jobs into proof of skills" style={{ '--card-bg': '#B34539', '--card-image': "url('/images/gallery-degree-strategy.png')" }} />
          <div className="gallery__card gallery__card--photo" data-index="1" role="img" aria-label="The gap isn't effort, it's access: build access by asking questions and joining career communities" style={{ '--card-bg': '#B34539', '--card-image': "url('/images/gallery-gap-access.png')" }} />
          <div className="gallery__card gallery__card--photo" data-index="2" role="img" aria-label="Your rejection isn't the end: what first-gen students need to hear right now" style={{ '--card-bg': '#B34539', '--card-image': "url('/images/gallery-rejection.png')" }} />
          <div className="gallery__card gallery__card--photo" data-index="3" role="img" aria-label="Some people learn the rules early: study how referrals, networking, and recruiter conversations work" style={{ '--card-bg': '#B34539', '--card-image': "url('/images/gallery-learn-the-rules-early.png')" }} />
          <div className="gallery__card gallery__card--photo" data-index="4" role="img" aria-label="Career clarity should not take years: start small with LinkedIn, resume bullets, and weekly career conversations" style={{ '--card-bg': '#B34539', '--card-image': "url('/images/gallery-career-clarity.png')" }} />
          <div className="gallery__card gallery__card--photo" data-index="5" role="img" aria-label="Students need more than advice: scripts, examples, checklists, and clear next steps" style={{ '--card-bg': '#B34539', '--card-image': "url('/images/gallery-students-need-more.png')" }} />
        </div>
      </section>

      {/* SERVICES */}
      <section className="services" id="services">
        <div className="services__image">
          <div className="services__image-inner">
            <div className="services__pattern" aria-hidden="true">
              <div className={`pinata ${pinataWrapClass}`} id="pinata" ref={pinataRef} style={{ visibility: pinataVisible ? 'visible' : 'hidden' }}>
                <button className="pinata__body" id="pinataBody" aria-label={t.pinataAriaLabel} onClick={handlePinataClick}>
                  <img src="/pinanta/step1.png" alt="" className="pinata__img" id="pinataImg" ref={pinataImgRef} draggable="false" />
                </button>
                <p className="pinata__prompt" id="pinataPrompt">{t.pinataPrompt}</p>
              </div>
              {pinataMsg && <p className="pinata__break-msg" role="status">{pinataMsg}</p>}
            </div>
          </div>
        </div>
        <div className="services__content">
          <div className="services__tabs" role="tablist" onKeyDown={e => {
            const KEYS = ['content', 'sprints', 'community']
            const idx = KEYS.indexOf(servicesTab)
            let next = null
            if (e.key === 'ArrowRight') { e.preventDefault(); next = KEYS[(idx + 1) % KEYS.length] }
            if (e.key === 'ArrowLeft')  { e.preventDefault(); next = KEYS[(idx - 1 + KEYS.length) % KEYS.length] }
            if (e.key === 'Home')       { e.preventDefault(); next = KEYS[0] }
            if (e.key === 'End')        { e.preventDefault(); next = KEYS[KEYS.length - 1] }
            if (next) { setServicesTab(next); setTimeout(() => document.getElementById(`services-tab-${next}`)?.focus(), 0) }
          }}>
            {[['content', t.servicesTabContent], ['sprints', t.servicesTabSprints], ['community', t.servicesTabCommunity]].map(([key, label], i) => (
              <Fragment key={key}>
                {i > 0 && <span className="services__tab-sep" aria-hidden="true">|</span>}
                <button
                  id={`services-tab-${key}`}
                  role="tab"
                  className={`services__tab${servicesTab === key ? ' services__tab--active' : ''}`}
                  aria-selected={servicesTab === key}
                  aria-controls={`services-panel-${key}`}
                  tabIndex={servicesTab === key ? 0 : -1}
                  onClick={() => setServicesTab(key)}
                >
                  {label}
                </button>
              </Fragment>
            ))}
          </div>

          <div id="services-panel-content" role="tabpanel" aria-labelledby="services-tab-content" className={`services__panel${servicesTab === 'content' ? ' services__panel--active' : ''}`}>
            <p className="services__body">{t.servicesContentBody}</p>
            <div className="services__list">
              <div className="services__list-col services__list-col--inline">
                <Link to="/linkedin-series" className="services__list-btn">{tNav.linkedInSeries} →</Link>
                <Link to="/career-templates" className="services__list-btn">{tNav.careerTemplates} →</Link>
              </div>
            </div>
          </div>
          <div id="services-panel-sprints" role="tabpanel" aria-labelledby="services-tab-sprints" className={`services__panel${servicesTab === 'sprints' ? ' services__panel--active' : ''}`}>
            <p className="services__body">{t.servicesSprintsBody}</p>
            <div className="services__list">
              <div className="services__list-col services__list-col--inline">
                <span className="services__list-btn services__list-btn--soon" aria-disabled="true">
                  {tNav.bridgeYearSprint}
                  <span className="services__list-soon">{t.editorialComingSoon}</span>
                </span>
                <span className="services__list-btn services__list-btn--soon" aria-disabled="true">
                  {tNav.interviewPrep}
                  <span className="services__list-soon">{t.editorialComingSoon}</span>
                </span>
              </div>
            </div>
          </div>
          <div id="services-panel-community" role="tabpanel" aria-labelledby="services-tab-community" className={`services__panel${servicesTab === 'community' ? ' services__panel--active' : ''}`}>
            <p className="services__body">{t.servicesCommunityBody}</p>
            <div className="services__list">
              <div className="services__list-col services__list-col--grid-2">
                <Link to="/opportunity-board" className="services__list-btn">{tNav.opportunityBoard} →</Link>
                <Link to="/coffee-chat" className="services__list-btn">{tNav.coffeeChatNetwork} →</Link>
                <Link to="/resume-reviews" className="services__list-btn">{tNav.resumeReviews} →</Link>
                <span className="services__list-btn services__list-btn--soon" aria-disabled="true">
                  {tNav.partnerPanels}
                  <span className="services__list-soon">{t.editorialComingSoon}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INTERRUPTION */}
      <section className="interr">
        <div className="interr__bars" aria-hidden="true">
          <div className="interr__bar interr__bar--cream" />
          <div className="interr__bar interr__bar--accent" />
        </div>
        <div className="interr__text">
          {t.interrLines.map((line, li) => (
            <span key={li} className="interr__line">
              {line.split('').map((char, ci) => (
                <span key={ci} className="interr__char">{char}</span>
              ))}
            </span>
          ))}
        </div>
      </section>

      {/* EDITORIAL */}
      <section className="editorial" id="editorial">
        <div className="editorial__showcase">
          <div className="editorial__showcase-inner">
            <div className="editorial__showcase-content">
              <h2 className="editorial__showcase-title">{t.editorialTitle}</h2>
              <p className="editorial__showcase-desc">{t.editorialDesc}</p>
            </div>
            <img src="/images/moon_2.png" alt="" className="mascot mascot--moon2 mascot--editorial" aria-hidden="true" loading="eager" decoding="async" width="96" height="96" />
          </div>
        </div>
        <div className="editorial__grid">
          <article className="editorial__card editorial__card--soon">
            <span className="editorial__card-soon">{t.editorialComingSoon}</span>
            <div className="editorial__card-tag">{t.card1Tag}</div>
            <h3 className="editorial__card-title">{t.card1Title}</h3>
            <p className="editorial__card-excerpt">{t.card1Excerpt}</p>
          </article>
          <article className="editorial__card editorial__card--dark editorial__card--soon">
            <span className="editorial__card-soon">{t.editorialComingSoon}</span>
            <div className="editorial__card-tag">{t.card2Tag}</div>
            <h3 className="editorial__card-title">{t.card2Title}</h3>
            <p className="editorial__card-excerpt">{t.card2Excerpt}</p>
          </article>
        </div>
        <div className="editorial__grid">
          <article className="editorial__card editorial__card--dark editorial__card--soon">
            <span className="editorial__card-soon">{t.editorialComingSoon}</span>
            <div className="editorial__card-tag">{t.card3Tag}</div>
            <h3 className="editorial__card-title">{t.card3Title}</h3>
            <p className="editorial__card-excerpt">{t.card3Excerpt}</p>
          </article>
          <article className="editorial__card editorial__card--soon">
            <span className="editorial__card-soon">{t.editorialComingSoon}</span>
            <div className="editorial__card-tag">{t.card4Tag}</div>
            <h3 className="editorial__card-title">{t.card4Title}</h3>
            <p className="editorial__card-excerpt">{t.card4Excerpt}</p>
          </article>
        </div>
        <div className="editorial__grid">
          <article className="editorial__card editorial__card--soon">
            <span className="editorial__card-soon">{t.editorialComingSoon}</span>
            <div className="editorial__card-tag">{t.card5Tag}</div>
            <h3 className="editorial__card-title">{t.card5Title}</h3>
            <p className="editorial__card-excerpt">{t.card5Excerpt}</p>
          </article>
          <article className="editorial__card editorial__card--dark editorial__card--soon">
            <span className="editorial__card-soon">{t.editorialComingSoon}</span>
            <div className="editorial__card-tag">{t.card6Tag}</div>
            <h3 className="editorial__card-title">{t.card6Title}</h3>
            <p className="editorial__card-excerpt">{t.card6Excerpt}</p>
          </article>
        </div>
        <div className="editorial__more">
          <button type="button" className="editorial__more-btn" onClick={openNewsletter} aria-haspopup="dialog" aria-controls="newsletterModal">
            {t.editorialNotify}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </button>
        </div>
      </section>
      </>)}

      </main>

      {!WAITLIST_MODE && (<>
      {/* FOOTER */}
      <footer className="footer" id="contact" ref={footerRef}>
        <canvas className="footer__dots-canvas" aria-hidden="true" ref={canvasRef} />
        <div className="footer__logo">
          <svg viewBox="0 0 560 400" className="footer__logo-svg" aria-label="Jose x Jocelyn">
            <text x="0" y="320" className="footer__logo-text">J</text>
            <text x="280" y="320" className="footer__logo-text">J</text>
            <rect x="40" y="42" width="112" height="27" rx="3" transform="rotate(-18 96 55)" fill="#E8A838" />
            <rect x="315" y="42" width="112" height="27" rx="3" transform="rotate(-18 371 55)" fill="#E8A838" />
            <text x="190" y="252" className="footer__logo-x">x</text>
          </svg>
        </div>
        <button className="footer__cta" id="footerCta" onClick={openModal}>
          <span className="footer__cta-text" dangerouslySetInnerHTML={{ __html: t.footerCta }} />
        </button>
        <p className="footer__signoff" lang="es">{t.footerSignoff}</p>
        <div className="footer__bottom">
          <span className="footer__credit">{t.footerCredit}</span>
          <Link to="/privacy" className="footer__credit" style={{ marginLeft: '1.25rem', textDecoration: 'underline', textUnderlineOffset: '2px' }}>{t.footerPrivacy}</Link>
        </div>
      </footer>
      </>)}

      {/* CONTACT MODAL */}
      <div className={`modal${modalOpen ? ' modal--open' : ''}`} id="modal">
        <div className="modal__bg" onClick={closeModal} />
        <div className="modal__box" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={modalRef} onKeyDown={handleModalKeyDown}>
          <button className="modal__close" id="modalClose" onClick={closeModal} aria-label={t.modalClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
          {!modalSent ? (
            <>
              <p className="modal__kicker">{t.modalKicker}</p>
              <h3 className="modal__title" id="modal-title">{t.modalTitle}</h3>
              <div className="modal__field">
                <label className="modal__label" htmlFor="modalName">{t.modalNameLabel}</label>
                <input type="text" id="modalName" className="modal__input" placeholder={t.modalNamePlaceholder} value={modalName} onChange={e => setModalName(e.target.value)} />
              </div>
              <div className="modal__field">
                <label className="modal__label" htmlFor="modalEmail">{t.modalEmailLabel}</label>
                <input type="email" id="modalEmail" className="modal__input" placeholder={t.modalEmailPlaceholder} value={modalEmail} onChange={e => setModalEmail(e.target.value)} />
              </div>
              <div className="modal__field">
                <label className="modal__label" htmlFor="modalMessage">{t.modalMessageLabel}</label>
                <textarea id="modalMessage" className="modal__input modal__textarea" placeholder={t.modalMessagePlaceholder} value={modalMessage} onChange={e => setModalMessage(e.target.value)} rows={4} />
              </div>
              {modalError && <p role="alert" className="modal__error">{modalError}</p>}
              {modalTurnstileError && <p role="alert" className="form-error-turnstile">{tForms.errorTurnstile}</p>}
              <Turnstile onToken={setModalToken} onError={() => setModalTurnstileError(true)} resetRef={modalTurnstileReset} className="modal__turnstile" />
              <div className="modal__footer">
                <button className="modal__btn" disabled={modalLoading || !modalEmail.trim() || !modalMessage.trim() || modalTurnstileError || (TURNSTILE_ENABLED && !modalToken)} onClick={handleModalSubmit}>
                  {modalLoading ? t.modalSending : t.modalSend}
                </button>
                <span className="modal__reassurance">{t.modalReassurance}</span>
              </div>
            </>
          ) : (
            <>
              <p className="modal__kicker">{t.modalKicker}</p>
              <h3 className="modal__title modal__title--sent" id="modal-title">{t.modalSentTitle}</h3>
              <p className="modal__msg">{t.modalSentMsg}</p>
              <p className="modal__signature">{t.modalSentSignature}</p>
              <button className="modal__btn modal__btn--ghost" onClick={closeModal}>{t.modalClose}</button>
            </>
          )}
        </div>
      </div>

      {/* WAITLIST MODAL */}
      <div className={`modal${waitlistOpen ? ' modal--open' : ''}`} id="waitlistModal">
        <div className="modal__bg" onClick={closeWaitlist} />
        <div className="modal__box" role="dialog" aria-modal="true" aria-labelledby="waitlist-title" ref={waitlistRef} onKeyDown={handleWaitlistKeyDown}>
          <button className="modal__close" onClick={closeWaitlist} aria-label={t.modalClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
          {!waitlistSent ? (
            <>
              <p className="modal__kicker">{t.waitlistKicker}</p>
              <h3 className="modal__title" id="waitlist-title">{t.waitlistTitle}</h3>
              <div className="modal__field">
                <label className="modal__label" htmlFor="waitlistName">{t.waitlistNameLabel}</label>
                <input type="text" id="waitlistName" className="modal__input" placeholder={t.waitlistNamePlaceholder} value={waitlistName} onChange={e => setWaitlistName(e.target.value)} />
              </div>
              <div className="modal__field">
                <label className="modal__label" htmlFor="waitlistEmail">{t.waitlistEmailLabel}</label>
                <input type="email" id="waitlistEmail" className="modal__input" placeholder={t.waitlistEmailPlaceholder} value={waitlistEmail} onChange={e => setWaitlistEmail(e.target.value)} />
              </div>
              <div className="modal__field">
                <label className="modal__label" htmlFor="waitlistSchool">{t.waitlistSchoolLabel}</label>
                <input type="text" id="waitlistSchool" className="modal__input" placeholder={t.waitlistSchoolPlaceholder} value={waitlistSchool} onChange={e => setWaitlistSchool(e.target.value)} />
              </div>
              {waitlistError && <p role="alert" className="modal__error">{waitlistError}</p>}
              {waitlistTurnstileError && <p role="alert" className="form-error-turnstile">{tForms.errorTurnstile}</p>}
              <Turnstile onToken={setWaitlistToken} onError={() => setWaitlistTurnstileError(true)} resetRef={waitlistTurnstileReset} className="modal__turnstile" />
              <div className="modal__footer">
                <button className="modal__btn" disabled={waitlistLoading || !waitlistName.trim() || !waitlistEmail.trim() || waitlistTurnstileError || (TURNSTILE_ENABLED && !waitlistToken)} onClick={handleWaitlistSubmit}>
                  {waitlistLoading ? t.waitlistSubmitting : t.waitlistSubmit}
                </button>
                <span className="modal__reassurance">{t.waitlistReassurance}</span>
              </div>
            </>
          ) : (
            <div className="modal__celebrate">
              <p className="modal__kicker modal__kicker--celebrate">{t.waitlistKicker}</p>
              <div className="modal__title-row modal__title--celebrate">
                <h3 className="modal__title modal__title--sent" id="waitlist-title">{t.waitlistSentTitle}</h3>
                <img
                  src="/images/sun.png"
                  alt=""
                  aria-hidden="true"
                  className="modal__sun"
                  draggable="false"
                />
              </div>
              <p className="modal__msg modal__msg--celebrate">{t.waitlistSentMsg}</p>
              <p className="modal__signature modal__signature--celebrate">{t.waitlistSentSignature}</p>
              <button className="modal__btn modal__btn--ghost modal__btn--celebrate" onClick={closeWaitlist}>{t.modalClose}</button>
            </div>
          )}
        </div>
      </div>

      {/* NEWSLETTER MODAL — notify-me signup for La Voz del Día (saved to subscribers) */}
      <div className={`modal${newsletterOpen ? ' modal--open' : ''}`} id="newsletterModal">
        <div className="modal__bg" onClick={closeNewsletter} />
        <div className="modal__box" role="dialog" aria-modal="true" aria-labelledby="newsletter-title" ref={newsletterRef} onKeyDown={handleNewsletterKeyDown}>
          <button className="modal__close" onClick={closeNewsletter} aria-label={t.modalClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
          {!newsletterSent ? (
            <>
              <p className="modal__kicker">{t.newsletterKicker}</p>
              <h3 className="modal__title" id="newsletter-title">{t.newsletterTitle}</h3>
              <p className="modal__msg">{t.newsletterSub}</p>
              <div className="modal__field">
                <label className="modal__label" htmlFor="newsletterEmail">{t.newsletterEmailLabel}</label>
                <input
                  type="email"
                  id="newsletterEmail"
                  className="modal__input"
                  placeholder={t.newsletterEmailPlaceholder}
                  value={newsletterEmail}
                  onChange={e => setNewsletterEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleNewsletterSubmit() }}
                />
              </div>
              {newsletterError && <p role="alert" className="modal__error">{newsletterError}</p>}
              {newsletterTurnstileError && <p role="alert" className="form-error-turnstile">{tForms.errorTurnstile}</p>}
              <Turnstile onToken={setNewsletterToken} onError={() => setNewsletterTurnstileError(true)} resetRef={newsletterTurnstileReset} className="modal__turnstile" />
              <div className="modal__footer">
                <button className="modal__btn" disabled={newsletterLoading || !newsletterEmail.trim() || newsletterTurnstileError || (TURNSTILE_ENABLED && !newsletterToken)} onClick={handleNewsletterSubmit}>
                  {newsletterLoading ? t.newsletterSubmitting : t.newsletterSubmit}
                </button>
                <span className="modal__reassurance">{t.newsletterReassurance}</span>
              </div>
            </>
          ) : (
            <>
              <p className="modal__kicker">{t.newsletterKicker}</p>
              <h3 className="modal__title modal__title--sent" id="newsletter-title">{t.newsletterSentTitle}</h3>
              <p className="modal__msg">{t.newsletterSentMsg}</p>
              <button className="modal__btn modal__btn--ghost" onClick={closeNewsletter}>{t.modalClose}</button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
