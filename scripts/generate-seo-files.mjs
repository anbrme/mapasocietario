import { mkdirSync, writeFileSync } from 'node:fs';
import { STUDIES, LANGS, studyPath, hubPath } from '../src/copy/studies.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');

const rawSiteUrl = process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://mapasocietario.es';
const siteUrl = rawSiteUrl.replace(/\/+$/, '');
const buildDate = new Date().toISOString().split('T')[0];

// robots.txt is authored HERE, in git, deliberately. Cloudflare's managed
// robots.txt setting (Bots -> Managed robots.txt) prepends a wholesale
// "Disallow: /" for every known AI crawler and is invisible in the repo, which
// silently contradicted the AEO strategy. That setting must stay OFF so this
// file is the single source of truth.
//
// Content signals (https://contentsignals.org/): search and AI answers are the
// whole point of the AEO work, so both are granted. Training is granted too --
// the facts are BORME-derived public record, and the product's value is
// freshness, which a frozen model cannot substitute for.
//
// The one exception is /empresa/: those pages carry officer names, i.e.
// personal data. Inclusion in a training corpus is effectively irreversible, so
// a later erasure request could not be honoured downstream. Company pages stay
// fully open to search and to AI answers -- only training is withheld.
// The parameter traps below have to be repeated inside every per-crawler group.
// Under the robots standard (RFC 9309 s2.2.1) a crawler obeys exactly ONE
// group -- the most specific one matching its own name -- and inherits nothing
// from "User-agent: *". Giving meta-externalagent a group of its own therefore
// exempted it from these traps, which is how it came to fetch /app/ and
// /due-diligence/ 56,916 times in the three days to 26 Aug 2026 (~19k/day,
// against ~12 real visitors/day). Add a crawler group and you must carry the
// traps into it.
//
// /app and /due-diligence are single-page shells: every query-string combination
// serves byte-identical HTML and already canonicalises back to the bare path.
// Each /empresa page links out with ?search=<name> and ?company=<name>, so the
// ~4k companies in sitemap-demand generate ~16k crawlable duplicates of two
// pages -- crawl budget spent there is crawl budget not spent on /empresa.
// Google folds them anyway ("Duplicate without user-selected canonical"), so
// nothing is lost by never fetching them.
//
// Only the unbounded parameters are blocked. ?lang and ?source take a handful of
// values and are real nav destinations, so they stay crawlable -- blocking those
// too would just trade "Duplicate without user-selected canonical" for "Blocked
// by robots.txt" on pages that ought to be reachable. The bare /app/ and
// /due-diligence/ are unaffected and remain indexable by everyone.
const crawlTrapDisallows = [
  'Disallow: /app/?*search=',
  'Disallow: /app/?*gk=',
  'Disallow: /due-diligence/?*company=',
].join('\n');

// Crawlers that get a group of their own, because /empresa/ is withheld from
// them. Everything else falls under "User-agent: *".
const namedCrawlers = ['GPTBot', 'ClaudeBot', 'CCBot', 'Applebot-Extended', 'meta-externalagent'];

const namedCrawlerGroups = namedCrawlers
  .map((agent) => `User-agent: ${agent}
${crawlTrapDisallows}
Disallow: /empresa/`)
  .join('\n\n');

const robotsTxt = `# Content signals: https://contentsignals.org/
User-agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=yes
Allow: /
${crawlTrapDisallows}

# Officer names on company pages are personal data: open to search and AI
# answers, withheld from model training. Each group repeats the parameter traps
# above -- robots.txt groups do not inherit.
${namedCrawlerGroups}

Sitemap: ${siteUrl}/sitemap.xml
`;

// Keep the barómetro out of the sitemap while it is unpublished (data-reuse licence
// pending). Same flag as generate-barometro.mjs; set BAROMETRO_PUBLISHED=1 to restore.
const BAROMETRO_PUBLISHED = process.env.BAROMETRO_PUBLISHED === '1' || process.env.BAROMETRO_PUBLISHED === 'true';

// /sitemap-demand.xml is served by a Pages Function and lists dynamic
// demand-promoted companies. Now live and returning 200, so enabled by default.
const DEMAND_SITEMAP_PUBLISHED = process.env.DEMAND_SITEMAP_PUBLISHED !== '0' && process.env.DEMAND_SITEMAP_PUBLISHED !== 'false';

const sitemapRoutes = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/app/', changefreq: 'daily', priority: '0.8' },
  { path: '/due-diligence/', changefreq: 'weekly', priority: '0.9' },
  { path: '/spanish-company-due-diligence/', changefreq: 'weekly', priority: '0.9' },
  { path: '/spanish-company-register-search/', changefreq: 'weekly', priority: '0.9' },
  { path: '/company-director-search/', changefreq: 'weekly', priority: '0.9' },
  { path: '/pricing/', changefreq: 'monthly', priority: '0.8' },
  { path: '/dashboard/', changefreq: 'daily', priority: '0.7' },
  { path: '/es/', changefreq: 'weekly', priority: '0.9' },
  { path: '/es/busqueda-registro-mercantil/', changefreq: 'weekly', priority: '0.9' },
  { path: '/es/informes-due-diligence-empresas/', changefreq: 'weekly', priority: '0.8' },
  { path: '/es/buscar-administradores-empresas/', changefreq: 'weekly', priority: '0.8' },
  { path: '/es/borme-grafo-empresas/', changefreq: 'weekly', priority: '0.8' },
  { path: '/es/barometro-empresarial/', changefreq: 'monthly', priority: '0.8' },
  { path: '/es/mapa-relaciones-societarias/', changefreq: 'weekly', priority: '0.8' },
  // Studies and their hub come from src/copy/studies.js: adding a study there
  // puts it in the sitemap and on the hub in one edit, with no chance of a new
  // study being published but never submitted.
  ...LANGS.map((lang) => ({ path: hubPath(lang), changefreq: 'monthly', priority: '0.8' })),
  ...STUDIES.flatMap((study) =>
    LANGS.map((lang) => ({ path: studyPath(study, lang), changefreq: 'monthly', priority: '0.7' }))),
  { path: '/connect-claude/', changefreq: 'monthly', priority: '0.6' },
  { path: '/glossary/', changefreq: 'monthly', priority: '0.7' },
  { path: '/es/glosario/', changefreq: 'monthly', priority: '0.7' },
  { path: '/es/conectar-claude/', changefreq: 'monthly', priority: '0.6' },
  { path: '/about', changefreq: 'monthly', priority: '0.5' },
  { path: '/about-es', changefreq: 'monthly', priority: '0.5' },
  { path: '/faq', changefreq: 'monthly', priority: '0.5' },
  { path: '/faq-es', changefreq: 'monthly', priority: '0.5' },
  { path: '/terms', changefreq: 'monthly', priority: '0.4' },
  { path: '/privacy', changefreq: 'monthly', priority: '0.3' },
].filter((r) => BAROMETRO_PUBLISHED || r.path !== '/es/barometro-empresarial/');

const sitemapUrls = sitemapRoutes.map((route) => `  <url>
    <loc>${siteUrl}${route.path}</loc>
    <lastmod>${buildDate}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`).join('\n');

// Static pages live in sitemap-pages.xml. sitemap.xml is a sitemap INDEX that
// references both this and the (separately generated) sitemap-empresas.xml, so
// Google discovers everything from the single sitemap.xml — robots.txt only
// needs one line, which matters because Cloudflare's managed robots.txt
// overrides our deployed one and lists just sitemap.xml.
const sitemapPagesXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls}
</urlset>
`;

const demandSitemapEntry = DEMAND_SITEMAP_PUBLISHED
  ? `  <sitemap>
    <loc>${siteUrl}/sitemap-demand.xml</loc>
    <lastmod>${buildDate}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${siteUrl}/sitemap-directorio.xml</loc>
    <lastmod>${buildDate}</lastmod>
  </sitemap>
`
  : '';

const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${siteUrl}/sitemap-pages.xml</loc>
    <lastmod>${buildDate}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${siteUrl}/sitemap-empresas.xml</loc>
    <lastmod>${buildDate}</lastmod>
  </sitemap>
${demandSitemapEntry}</sitemapindex>
`;

mkdirSync(publicDir, { recursive: true });
writeFileSync(path.join(publicDir, 'robots.txt'), robotsTxt, 'utf8');
writeFileSync(path.join(publicDir, 'sitemap-pages.xml'), sitemapPagesXml, 'utf8');
writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapIndexXml, 'utf8');
