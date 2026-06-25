import React, { useState } from 'react';
import { t } from '../i18n.js';

const CAPITAL_SHOW = 3;

function fmtEUR(amount, locale) {
  if (amount == null) return '';
  try {
    return new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-GB', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return String(amount);
  }
}

function fmtYear(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.getFullYear();
}

function compareEntries(a, b) {
  // null dates sort last
  if (!a.date && !b.date) return 0;
  if (!a.date) return 1;
  if (!b.date) return -1;
  return b.date < a.date ? -1 : b.date > a.date ? 1 : 0;
}

export default function CompanyHistory({ company, locale }) {
  const [showAllCapital, setShowAllCapital] = useState(false);

  const isDissolved = company.status === 'dissolved' || company.status === 'disuelta';

  // Build non-capital events
  const nonCapital = [];

  if (company.firstSeen) {
    nonCapital.push({ date: company.firstSeen, label: t(locale, 'evtIncorporated') });
  }

  for (const nc of (company.nameChanges || [])) {
    nonCapital.push({ date: nc.date, label: `${t(locale, 'evtRenamed')}: ${nc.from} → ${nc.to}` });
  }

  for (const ah of (company.addressHistory || [])) {
    nonCapital.push({ date: ah.date, label: `${t(locale, 'evtAddress')}: ${ah.address}` });
  }

  nonCapital.sort(compareEntries);

  // Build capital events (sorted desc)
  const capitalEvents = (company.capitalHistory || [])
    .map((ch) => ({ date: ch.date, label: `${t(locale, 'evtCapital')}: ${fmtEUR(ch.amount, locale)}` }))
    .sort(compareEntries);

  const hiddenCapitalCount = capitalEvents.length > CAPITAL_SHOW ? capitalEvents.length - CAPITAL_SHOW : 0;
  const visibleCapital = showAllCapital ? capitalEvents : capitalEvents.slice(0, CAPITAL_SHOW);

  const isEmpty = nonCapital.length === 0 && capitalEvents.length === 0;

  if (isEmpty && !isDissolved) return null;

  // Merge for display: all non-capital + visible capital, sorted desc
  const allVisible = [...nonCapital, ...visibleCapital].sort(compareEntries);

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui' }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 14, color: '#333' }}>
        {t(locale, 'historyHeading')}
      </h3>

      {isDissolved && (
        <div style={{ marginBottom: 8, padding: '3px 8px', background: '#fde', borderRadius: 4,
          display: 'inline-block', fontSize: 12, color: '#900', fontWeight: 600 }}>
          {t(locale, 'evtDissolved')}
        </div>
      )}

      {allVisible.map((entry, i) => {
        const year = fmtYear(entry.date);
        return (
          <div key={i} style={{ display: 'flex', gap: 8, padding: '2px 0', fontSize: 13 }}>
            <span style={{ color: '#888', minWidth: 40, flexShrink: 0 }}>
              {year ?? ''}
            </span>
            <span>{entry.label}</span>
          </div>
        );
      })}

      {!showAllCapital && hiddenCapitalCount > 0 && (
        <button
          onClick={() => setShowAllCapital(true)}
          style={{ marginTop: 4, fontSize: 12, color: '#1a5fb4', background: 'none',
            border: 'none', cursor: 'pointer', padding: 0 }}>
          {`+${hiddenCapitalCount} ${t(locale, 'showMore')}`}
        </button>
      )}
    </div>
  );
}
