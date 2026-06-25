import React from 'react';
import { t } from '../i18n.js';

export default function MatchList({ matches, locale, onPick }) {
  if (!matches || matches.length === 0) {
    return <p style={{ padding: 12, color: '#555' }}>{t(locale, 'noMatches')}</p>;
  }
  return (
    <div>
      <h3 style={{ padding: '8px 12px', margin: 0, fontSize: 13, color: '#555' }}>
        {t(locale, 'matchesHeading')}
      </h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {matches.map((m) => (
          <li key={m.id}>
            <button
              onClick={() => onPick(m)}
              style={{ display: 'block', width: '100%', textAlign: 'left',
                       padding: '10px 12px', border: 'none', borderBottom: '1px solid #eee',
                       background: '#fff', cursor: 'pointer' }}
            >
              <div style={{ fontWeight: 600 }}>{m.name}</div>
              <div style={{ fontSize: 12, color: '#777' }}>
                {[m.location, m.nif].filter(Boolean).join(' · ')}
                {m.isAlias && m.formerName ? ` · (${t(locale, 'formerly')}: ${m.formerName})` : ''}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
