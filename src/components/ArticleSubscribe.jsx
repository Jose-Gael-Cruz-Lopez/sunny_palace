import { useState, useRef } from 'react'
import { useT } from '../hooks/useT'
import Turnstile, { TURNSTILE_ENABLED } from './Turnstile'

export default function ArticleSubscribe({ source }) {
  const t = useT('articleLayout')
  const tForms = useT('forms')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileError, setTurnstileError] = useState(false)
  const turnstileReset = useRef(null)


  async function handleSubmit(e) {
    e.preventDefault()
    const val = email.trim()
    if (!val) return
    if (TURNSTILE_ENABLED && !turnstileToken) return
    setLoading(true)
    setError('')

    // Signup flows through the Turnstile-gated submit-form edge function (service
    // role) instead of a direct anon insert — the anon INSERT on subscribers is
    // revoked (migration 017) so the welcome-email webhook can't be abused. A 409
    // means the email is already subscribed: treat it (and a 2xx) as success.
    let ok = false
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-form`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          type: 'subscriber',
          turnstileToken,
          payload: { email: val, source: source || 'article' },
        }),
      })
      ok = res.ok || res.status === 409
    } catch {
      ok = false
    }

    setLoading(false)
    if (ok) {
      setDone(true)
    } else {
      setError(t.subscribeError)
      setTurnstileToken('')
      turnstileReset.current?.()
    }
  }

  return (
    <div className="art-subscribe">
      <div className="art-subscribe__box">
        <h3 className="art-subscribe__title">{t.subscribeTitle}</h3>
        <p className="art-subscribe__desc">{t.subscribeDesc}</p>
        {done ? (
          <p style={{ color: 'var(--color-teal)', fontWeight: 600, fontSize: 15 }}>
            {t.subscribeSuccess}
          </p>
        ) : (
          <form className="art-subscribe__form" onSubmit={handleSubmit}>
            <input
              type="email"
              className="art-subscribe__input"
              placeholder={t.subscribePlaceholder}
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <button className="art-subscribe__btn" type="submit" disabled={loading || turnstileError || (TURNSTILE_ENABLED && !turnstileToken)}>
              {loading ? t.subscribeBtnLoading : t.subscribeBtnIdle}
            </button>
            {turnstileError && <p role="alert" className="form-error-turnstile">{tForms.errorTurnstile}</p>}
            <Turnstile
              onToken={setTurnstileToken}
              onError={() => setTurnstileError(true)}
              resetRef={turnstileReset}
              className="art-subscribe__turnstile"
            />
          </form>
        )}
        {error && <p style={{ color: 'var(--color-accent)', fontSize: 13, marginTop: 8 }}>{error}</p>}
      </div>
    </div>
  )
}
