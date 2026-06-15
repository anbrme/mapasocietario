// mapasocietario/src/utils/relationshipReportHtml.js
// Pure HTML builder for the Relationship Report — used by Copy-for-Word so the
// report pastes formatted into Word/Docs. No DOM, no React.

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export function buildReportHtml(scope, { es = true } = {}) {
  const t = es ? {
    title: 'Informe de Relaciones', notauth: 'No autoritativo',
    summary: 'empresas · administradores · conexiones compartidas',
    companies: 'Empresas analizadas', shared: 'Conexiones compartidas',
    person: 'Persona / entidad', inCompanies: 'Empresas', role: 'Cargo', status: 'Estado',
    ownership: 'Vínculos de propiedad', soleOf: 'es socio único de', lostOf: 'fue socio único de',
    none: 'Ninguna detectada',
    active: 'Vigente', ceased: 'Cesado', mixed: 'Mixto', entity: 'Entidad', individual: 'Persona',
  } : {
    title: 'Relationship Report', notauth: 'Not authoritative',
    summary: 'companies · officers · shared connectors',
    companies: 'Companies analysed', shared: 'Shared connections',
    person: 'Person / entity', inCompanies: 'Companies', role: 'Role', status: 'Status',
    ownership: 'Ownership links', soleOf: 'is sole shareholder of', lostOf: 'was sole shareholder of',
    none: 'None detected',
    active: 'Active', ceased: 'Ceased', mixed: 'Mixed', entity: 'Entity', individual: 'Person',
  };
  const c = scope?.counts || { companies: 0, officers: 0, sharedPeople: 0 };
  const statusLabel = (s) => t[s] || s;

  const connectorRows = (scope?.connectors || []).map(con => `
    <tr>
      <td>${esc(con.name)} <i>(${con.type === 'entity' ? t.entity : t.individual})</i></td>
      <td>${con.companies.map(esc).join(', ')}</td>
      <td>${con.roles.map(esc).join(' / ')}</td>
      <td>${esc(statusLabel(con.status))}</td>
    </tr>`).join('');

  const ownershipRows = (scope?.ownership || []).map(o =>
    `<li>${esc(o.owner)} ${o.lost ? t.lostOf : t.soleOf} ${esc(o.owned)}</li>`).join('');

  return `<div>
  <h2>${t.title}</h2>
  <p><i>${t.notauth}</i></p>
  <p><b>${c.companies}</b> / <b>${c.officers}</b> / <b>${c.sharedPeople}</b> ${t.summary}</p>
  <h3>${t.companies}</h3>
  <p>${(scope?.companies || []).map(esc).join(' · ') || t.none}</p>
  <h3>${t.shared}</h3>
  ${connectorRows
    ? `<table border="1" cellpadding="4" cellspacing="0">
      <thead><tr><th>${t.person}</th><th>${t.inCompanies}</th><th>${t.role}</th><th>${t.status}</th></tr></thead>
      <tbody>${connectorRows}</tbody></table>`
    : `<p>${t.none}</p>`}
  <h3>${t.ownership}</h3>
  ${ownershipRows ? `<ul>${ownershipRows}</ul>` : `<p>${t.none}</p>`}
</div>`;
}
