// Pure display mapping for the company findings block. The component that
// renders it (CompanyFindings.jsx) holds no strings: everything a user reads
// is either in the API payload (finding texts, gap sentences — written once,
// server-side, shared with the paid report) or in FINDINGS_COPY here.

export const FINDINGS_COPY = {
  en: {
    nif: nif => `NIF ${nif}`,
    nifMissing: 'NIF not published in BORME',
    nifTellUs: 'know it? tell us',
    changed: (date, type) => `Latest BORME filing: ${date}${type ? ` — ${type}` : ''}`,
    formerly: names => `formerly ${names}`,
    standsOut: 'What stands out',
    verification: 'Needs verification',
    evidence: 'Show in table',
    borme: 'BORME notice',
    offerTitle: 'Get the complete sourced assessment',
    offerBody: 'Every finding with its BORME evidence, sanctions and adverse-media screening, risk interpretation and a PDF.',
    more: n => `and ${n} more finding${n === 1 ? '' : 's'} in the report`,
    unavailable: 'Findings unavailable right now — the table below is unaffected.',
    loading: 'Reading the registry…',
  },
  es: {
    nif: nif => `NIF ${nif}`,
    nifMissing: 'NIF no publicado en el BORME',
    nifTellUs: '¿lo conoces? dínoslo',
    changed: (date, type) => `Última inscripción en el BORME: ${date}${type ? ` — ${type}` : ''}`,
    formerly: names => `anteriormente ${names}`,
    standsOut: 'Lo que destaca',
    verification: 'Pendiente de verificar',
    evidence: 'Ver en la tabla',
    borme: 'Anuncio BORME',
    offerTitle: 'Consigue la evaluación completa con fuentes',
    offerBody: 'Cada hallazgo con su evidencia del BORME, cribado de sanciones y prensa adversa, lectura de riesgo y PDF.',
    more: n => `y ${n} hallazgo${n === 1 ? '' : 's'} más en el informe`,
    unavailable: 'Los hallazgos no están disponibles ahora mismo — la tabla de abajo no se ve afectada.',
    loading: 'Leyendo el registro…',
  },
};

const copyFor = lang => FINDINGS_COPY[lang === 'en' ? 'en' : 'es'];

export function findingsView(payload, lang) {
  const copy = copyFor(lang);
  const company = payload?.company || {};
  const lastFiling = company.last_filing;
  const findings = (Array.isArray(payload?.findings) ? payload.findings : []).map(f => ({
    key: `${f.kind}:${f.date || ''}`,
    kind: f.kind,
    text: f.text,
    date: f.date || null,
    tone: f.cls,
    evidence: Array.isArray(f.evidence) && f.evidence.length ? f.evidence[0] : null,
    bormeUrl: f.borme_ref?.url || null,
  }));
  const moreCount = Number(payload?.more) || 0;
  const previousNames = Array.isArray(company.previous_names) ? company.previous_names.filter(Boolean) : [];
  return {
    header: {
      title: company.name || '',
      nifLabel: company.nif ? copy.nif(company.nif) : copy.nifMissing,
      nifMissing: !company.nif,
      province: company.province || null,
      formerly: previousNames.length ? copy.formerly(previousNames.join(', ')) : null,
    },
    changed: lastFiling?.date ? copy.changed(lastFiling.date, lastFiling.type) : null,
    findings,
    verification: Array.isArray(payload?.verification) ? payload.verification : [],
    offer: { title: copy.offerTitle, body: copy.offerBody, more: moreCount > 0 ? copy.more(moreCount) : null },
    moreCount,
    labels: { standsOut: copy.standsOut, verification: copy.verification, evidence: copy.evidence,
              borme: copy.borme, nifTellUs: copy.nifTellUs, loading: copy.loading },
  };
}

export function findingsErrorView(lang) {
  return { text: copyFor(lang).unavailable };
}

export function findingsVisibleParams(view) {
  const findings = view?.findings || [];
  return {
    count: findings.length,
    concerns: findings.filter(f => f.tone === 'concern').length,
    limitations: findings.filter(f => f.tone === 'limitation').length,
    more: view?.moreCount || 0,
  };
}
