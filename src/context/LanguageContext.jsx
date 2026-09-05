import { createContext, useContext, useEffect, useState } from 'react'
import { en } from '../translations/en'

export const LanguageContext = createContext({
  lang: 'en',
  dict: en,
  setLang: () => { throw new Error('useLang must be used inside LanguageProvider') },
})

// localStorage can throw in private mode / storage-disabled browsers — guard every access
// so the provider (which wraps the whole app) can never white-screen on mount or toggle.
function readStoredLang() {
  try {
    return localStorage.getItem('jj-lang') ?? 'en'
  } catch {
    return 'en'
  }
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readStoredLang)
  // English is bundled with the app; Spanish is a separate chunk loaded on demand
  // (only when the visitor is on, or switches to, ES) so EN visitors never pay for it.
  const [esDict, setEsDict] = useState(null)

  useEffect(() => {
    if (lang === 'es' && !esDict) {
      let cancelled = false
      import('../translations/es')
        .then(m => { if (!cancelled) setEsDict(m.es) })
        .catch(err => {
          // Chunk failed to load (offline, flaky network, ...). We already
          // degrade to English (see `dict` below), but log it so a silent,
          // permanent fallback to English isn't invisible in diagnostics.
          if (!cancelled) console.error('Failed to load Spanish translations:', err)
        })
      return () => { cancelled = true }
    }
  }, [lang, esDict])

  function setLang(newLang) {
    setLangState(newLang)
    try {
      localStorage.setItem('jj-lang', newLang)
    } catch {
      // ignore — language still updates in memory for this session
    }
  }

  // Until Spanish finishes loading, render English (useT also falls back per-key).
  const dict = lang === 'es' && esDict ? esDict : en

  return (
    <LanguageContext.Provider value={{ lang, dict, setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  return useContext(LanguageContext)
}
