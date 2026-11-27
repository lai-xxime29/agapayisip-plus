import { createContext, useContext, useState } from 'react'
import { CEB } from './ceb'
import { setFormatLang } from './format'

const LangContext = createContext({ lang: 'en', setLang: () => {}, t: (s) => s })

function readSaved() {
  try { return localStorage.getItem('agapay-lang') === 'ceb' ? 'ceb' : 'en' } catch { return 'en' }
}

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(readSaved)
  setFormatLang(lang) // dates follow the language too

  function setLang(next) {
    setLangState(next)
    try { localStorage.setItem('agapay-lang', next) } catch { /* private window: just don't remember it */ }
  }

  // t('English text', { name: 'Ella' }) -> Bisaya if chosen, with {name} filled in
  const t = (en, vars) => {
    let s = lang === 'ceb' ? (CEB[en] ?? en) : en
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v)
    return s
  }

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>
}

export function useLang() { return useContext(LangContext) }

export function LangToggle({ className = '' }) {
  const { lang, setLang } = useLang()
  const btn = (code, label) => (
    <button type="button" onClick={() => setLang(code)} aria-pressed={lang === code}
      className={`px-3 py-1.5 ${lang === code ? 'bg-brand-teal text-white' : 'text-muted'}`}>{label}</button>
  )
  return (
    <div role="group" aria-label="Language" className={`inline-flex rounded-md border border-line overflow-hidden text-xs font-medium ${className}`}>
      {btn('en', 'English')}{btn('ceb', 'Bisaya')}
    </div>
  )
}
