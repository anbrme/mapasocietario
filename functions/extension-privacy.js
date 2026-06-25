/**
 * /extension-privacy — privacy policy for the "Mapa Societario — Spanish company
 * lookup" Chrome extension. Static, self-contained HTML (bilingual EN/ES) so it
 * can be used as the Chrome Web Store "Privacy policy URL".
 * Mirrors chrome-extension/PRIVACY.md.
 */

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Privacy Policy — Mapa Societario Chrome Extension</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="index, follow">
<style>
  body{font-family:-apple-system,system-ui,"Segoe UI",sans-serif;max-width:720px;
       margin:64px auto;padding:0 22px;color:#0f172a;line-height:1.6}
  h1{font-size:1.7rem;margin-bottom:.2rem}
  h2{font-size:1.15rem;margin-top:2.2rem;color:#1a5fb4}
  .sub{color:#64748b;margin-top:0}
  ul{padding-left:1.2rem}
  hr{border:none;border-top:1px solid #e2e8f0;margin:3rem 0}
  a{color:#1a5fb4}
  code{background:#f1f5f9;padding:1px 5px;border-radius:4px}
</style>
</head>
<body>

<h1>Privacy Policy</h1>
<p class="sub">Mapa Societario — Spanish company lookup (Chrome extension) · Last updated 25 June 2026</p>

<p><strong>This extension does not read the pages you visit and does not track you.</strong></p>
<ul>
  <li>It runs only when you explicitly select text and choose <em>“Look up Spanish company”</em> (or open the side panel). It uses no content scripts and does not read page content.</li>
  <li>The text you select is sent to <code>https://api.ncdata.eu</code> solely to look up the matching Spanish company in public BORME (Registro Mercantil) data, and to return that company’s registry information.</li>
  <li>No analytics, no cookies, no advertising identifiers. No data is sold or shared, and none is used for tracking, advertising, or creditworthiness/lending.</li>
  <li>Company data shown is unofficial and provided as-is; see <a href="https://www.boe.es/diario_borme/">the official BORME</a> and <a href="https://mapasocietario.es">mapasocietario.es</a> for the source.</li>
</ul>
<p>Contact: <a href="mailto:anurnberg@nurnbergconsulting.com">anurnberg@nurnbergconsulting.com</a></p>

<hr>

<h1>Política de Privacidad</h1>
<p class="sub">Mapa Societario — búsqueda de empresas españolas (extensión de Chrome) · Última actualización 25 de junio de 2026</p>

<p><strong>Esta extensión no lee las páginas que visitas ni te rastrea.</strong></p>
<ul>
  <li>Solo se activa cuando seleccionas texto explícitamente y eliges <em>“Look up Spanish company”</em> (o abres el panel lateral). No usa <em>content scripts</em> ni lee el contenido de las páginas.</li>
  <li>El texto que seleccionas se envía a <code>https://api.ncdata.eu</code> únicamente para localizar la empresa española correspondiente en datos públicos del BORME (Registro Mercantil) y devolver su información registral.</li>
  <li>Sin analítica, sin cookies, sin identificadores publicitarios. No se vende ni se comparte ningún dato, ni se usa para rastreo, publicidad o evaluación de solvencia.</li>
  <li>Los datos mostrados son no oficiales y se ofrecen tal cual; consulta <a href="https://www.boe.es/diario_borme/">el BORME oficial</a> y <a href="https://mapasocietario.es">mapasocietario.es</a> para la fuente.</li>
</ul>
<p>Contacto: <a href="mailto:anurnberg@nurnbergconsulting.com">anurnberg@nurnbergconsulting.com</a></p>

</body>
</html>`;

export const onRequestGet = () =>
  new Response(HTML, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
