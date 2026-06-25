import React from 'react';
import { t } from '../i18n.js';
import { appSearchUrl } from '../appSearchUrl.js';

function fmtCapital(value, locale) {
  if (value == null) return null;
  try { return new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-GB',
    { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value); }
  catch { return String(value); }
}

function Row({ label, children }) {
  if (children == null || children === '') return null;
  return (
    <div style={{ display: 'flex', gap: 8, padding: '2px 0', fontSize: 13 }}>
      <span style={{ color: '#888', minWidth: 80 }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}

export default function CompanyCard({ company, locale }) {
  const statusLabel = company.status === 'dissolved' || company.status === 'disuelta'
    ? t(locale, 'statusDissolved') : t(locale, 'statusActive');
  return (
    <div style={{ padding: 12, fontFamily: 'system-ui' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>{company.name}</h2>
      <Row label="NIF">{company.nif}</Row>
      <Row label={t(locale, 'capital')}>{fmtCapital(company.capital, locale)}</Row>
      <Row label={t(locale, 'address')}>{company.address}</Row>
      <Row label={t(locale, 'status')}>{statusLabel}</Row>
      <Row label={t(locale, 'activeOfficers')}>{company.officersActive.length}</Row>
      <Row label={t(locale, 'formerOfficers')}>{company.officersResigned.length}</Row>
      <a href={appSearchUrl(company)} target="_blank" rel="noopener noreferrer"
         style={{ display: 'inline-block', marginTop: 10, fontSize: 13, color: '#1a5fb4' }}>
        → {t(locale, 'viewProfile')}
      </a>
    </div>
  );
}
