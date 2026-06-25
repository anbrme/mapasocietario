import React, { useState, useEffect, useCallback } from 'react';
import { MSG } from '../api/messages.js';
import { pickLocale, t } from './i18n.js';
import { sendToWorker } from './sendToWorker.js';
import MatchList from './components/MatchList.jsx';
import CompanyCard from './components/CompanyCard.jsx';
import CompanyGraph from './components/CompanyGraph.jsx';

export default function App({ sendImpl = sendToWorker, initialSelection = null }) {
  const locale = pickLocale(typeof navigator !== 'undefined' ? navigator.language : 'en');
  const [view, setView] = useState({ state: 'idle' });

  const resolve = useCallback(async (query) => {
    setView({ state: 'loading' });
    const resp = await sendImpl({ type: MSG.RESOLVE, query });
    if (resp?.type === 'matches') setView({ state: 'matches', matches: resp.matches });
    else setView({ state: 'error' });
  }, [sendImpl]);

  const pick = useCallback(async (match) => {
    setView({ state: 'loading' });
    const resp = await sendImpl({ type: MSG.GET_COMPANY, id: match.id });
    if (resp?.type === 'company') setView({ state: 'company', company: resp.company });
    else setView({ state: 'error' });
  }, [sendImpl]);

  // React to selections broadcast by the service worker.
  useEffect(() => {
    if (initialSelection) resolve(initialSelection);
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;
    const listener = (msg) => { if (msg?.type === MSG.SELECTION) resolve(msg.query); };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [initialSelection, resolve]);

  return (
    <div style={{ fontFamily: 'system-ui', fontSize: 14 }}>
      {view.state === 'idle' && (
        <p style={{ padding: 12, color: '#555' }}>
          {locale === 'es'
            ? 'Selecciona el nombre de una empresa española y usa el clic derecho → "Look up Spanish company".'
            : 'Select a Spanish company name, then right-click → "Look up Spanish company".'}
        </p>
      )}
      {view.state === 'loading' && <p style={{ padding: 12 }}>{t(locale, 'loading')}</p>}
      {view.state === 'error' && <p style={{ padding: 12, color: '#b00' }}>{t(locale, 'error')}</p>}
      {view.state === 'matches' && (
        <MatchList matches={view.matches} locale={locale} onPick={pick} />
      )}
      {view.state === 'company' && (
        <>
          <CompanyCard company={view.company} locale={locale} />
          <CompanyGraph company={view.company} locale={locale} />
        </>
      )}
    </div>
  );
}
