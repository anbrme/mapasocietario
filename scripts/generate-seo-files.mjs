import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');

const rawSiteUrl = process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://mapasocietario.es';
const siteUrl = rawSiteUrl.replace(/\/+$/, '');
const buildDate = new Date().toISOString().split('T')[0];

const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;

const sitemapRoutes = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/app/', changefreq: 'daily', priority: '0.8' },
  { path: '/due-diligence/', changefreq: 'weekly', priority: '0.9' },
  { path: '/spanish-company-due-diligence/', changefreq: 'weekly', priority: '0.9' },
  { path: '/dashboard/', changefreq: 'daily', priority: '0.7' },
  { path: '/es/', changefreq: 'weekly', priority: '0.9' },
  { path: '/es/informes-due-diligence-empresas/', changefreq: 'weekly', priority: '0.8' },
  { path: '/es/buscar-administradores-empresas/', changefreq: 'weekly', priority: '0.8' },
  { path: '/es/borme-grafo-empresas/', changefreq: 'weekly', priority: '0.8' },
  { path: '/es/barometro-empresarial/', changefreq: 'monthly', priority: '0.8' },
  { path: '/es/mapa-relaciones-societarias/', changefreq: 'weekly', priority: '0.8' },
  { path: '/about', changefreq: 'monthly', priority: '0.5' },
  { path: '/terms', changefreq: 'monthly', priority: '0.4' },
  { path: '/privacy', changefreq: 'monthly', priority: '0.3' },
];

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
</sitemapindex>
`;

mkdirSync(publicDir, { recursive: true });
writeFileSync(path.join(publicDir, 'robots.txt'), robotsTxt, 'utf8');
writeFileSync(path.join(publicDir, 'sitemap-pages.xml'), sitemapPagesXml, 'utf8');
writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapIndexXml, 'utf8');
