import React from 'react';
import { Box, Typography, Button, Link, Paper, Chip, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ApartmentIcon from '@mui/icons-material/Apartment';
import BarChartIcon from '@mui/icons-material/BarChart';
import SearchIcon from '@mui/icons-material/Search';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import PreviewIcon from '@mui/icons-material/Preview';
import DescriptionIcon from '@mui/icons-material/Description';
import HubIcon from '@mui/icons-material/Hub';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import LegalDisclaimer from './LegalDisclaimer';
import HeroNetwork from './HeroNetwork';
import { LANDING_COPY } from './landingCopy';
import { siteNav } from '../utils/siteNav';
import { statsService } from '../services/statsService';
import { openListedCompanies } from '../services/listedCompaniesNav';

const SITE_URL = 'https://mapasocietario.es';

// Maps the copy item keys to /bormes/stats/overview fields.
const STAT_FIELD = {
  companies: 'total_companies',
  events: 'total_events',
  officerChanges: 'officer_changes',
  formations: 'constitutions',
};

// Static fallback so the band renders instantly (and survives an API outage)
// with values consistent with the homepage structured data. Refined live on
// mount. Sourced from /bormes/stats/overview.
const STAT_FALLBACK = {
  total_companies: 3130331,
  total_events: 9478088,
  officer_changes: 6363610,
  constitutions: 1711862,
};

// Floor to one decimal in millions — matches the "3.1M / 9.4M" rounding used in
// the structured data and prerendered content, so the figures never disagree.
const fmtMillions = (n) => `${(Math.floor(n / 1e5) / 10).toFixed(1)}M`;

// Company shown in the demo frame. Must match whatever is captured in
// public/graph-demo.png so the click-through lands on the same graph.
const DEMO_COMPANY = 'ACERINOX SA';

const STEP_ICONS = [<SearchIcon />, <TouchAppIcon />, <PreviewIcon />];

const Section = ({ children, sx = {}, ...props }) => (
  <Box
    component="section"
    sx={{ width: '100%', maxWidth: 1200, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: { xs: 5, sm: 6.5 }, ...sx }}
    {...props}
  >
    {children}
  </Box>
);

const SectionHeading = ({ heading, sub }) => (
  <Box sx={{ mb: 4 }}>
    <Typography variant="h5" component="h2" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
      {heading}
    </Typography>
    {sub && (
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75, maxWidth: 560 }}>
        {sub}
      </Typography>
    )}
  </Box>
);

// The homepage is a first-run how-to guide. It teaches search → graph →
// reports and nudges the visitor to bookmark the real workspace at /app.
const GUIDE_SEEN_KEY = 'ms_seen_guide';

// True when the visitor has seen the guide before AND isn't explicitly asking
// for it via ?guide=1. Computed synchronously so we never flash the guide
// before redirecting a returning visitor to the workspace.
function shouldRedirectReturning() {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).get('guide') === '1') return false;
  try {
    return localStorage.getItem(GUIDE_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export default function LandingPage({ lang = 'en' }) {
  const copy = LANDING_COPY[lang];
  const navigate = useNavigate();

  // Returning visitors skip the first-run guide and land straight in /app.
  // First-timers (and crawlers, which have no localStorage) see the guide, so
  // SEO and first impressions are untouched. The /app header "How it works"
  // icon and /?guide=1 always bring the guide back.
  const [redirecting] = React.useState(shouldRedirectReturning);

  React.useEffect(() => {
    if (redirecting) {
      navigate(lang === 'es' ? '/app?lang=es' : '/app', { replace: true });
      return;
    }
    try {
      localStorage.setItem(GUIDE_SEEN_KEY, '1');
    } catch {
      /* storage unavailable (private mode, etc.) — just show the guide */
    }
  }, [redirecting, navigate, lang]);

  // Live coverage figures — start from the static fallback (instant render, no
  // layout shift) and refine from the overview endpoint when it resolves.
  const [stats, setStats] = React.useState(STAT_FALLBACK);
  React.useEffect(() => {
    let alive = true;
    statsService.getOverview()
      .then((d) => { if (alive && d) setStats((prev) => ({ ...prev, ...d })); })
      .catch(() => { /* keep the static fallback */ });
    return () => { alive = false; };
  }, []);

  const canonical = lang === 'es' ? `${SITE_URL}/es/` : `${SITE_URL}/`;
  const nav = siteNav(lang);
  const appHref = lang === 'es' ? '/app?lang=es' : '/app';
  const demoHref = `/app?search=${encodeURIComponent(DEMO_COMPANY)}${lang === 'es' ? '&lang=es' : ''}`;
  const openGraph = () => navigate(appHref);

  // Returning visitor: render nothing while the effect redirects to /app.
  if (redirecting) return null;

  return (
    <>
      <Helmet htmlAttributes={{ lang }}>
        <title>{copy.meta.title}</title>
        <meta name="description" content={copy.meta.description} />
        <link rel="canonical" href={canonical} />
        <link rel="alternate" hrefLang="en" href={`${SITE_URL}/`} />
        <link rel="alternate" hrefLang="es" href={`${SITE_URL}/es/`} />
        <link rel="alternate" hrefLang="x-default" href={`${SITE_URL}/`} />
        <meta property="og:locale" content={copy.meta.ogLocale} />
        <meta property="og:title" content={copy.meta.title} />
        <meta property="og:description" content={copy.meta.ogDescription} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Mapa Societario" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={copy.meta.title} />
        <meta name="twitter:description" content={copy.meta.twitterDescription} />
      </Helmet>

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', bgcolor: '#0a0e1a' }}>
        {/* ---- HEADER NAV ---- */}
        <Box
          component="nav"
          aria-label="Site"
          sx={{
            width: '100%', maxWidth: 1200, mx: 'auto', px: { xs: 2.5, sm: 4 }, pt: { xs: 2, sm: 3 },
            display: 'flex', alignItems: 'center', justifyContent: { xs: 'center', sm: 'flex-start' },
            flexWrap: 'wrap', gap: { xs: 1.5, sm: 3 },
          }}
        >
          {copy.topLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              target={link.external ? '_blank' : undefined}
              rel={link.external ? 'noopener' : undefined}
              sx={{
                color: link.href === '/spanish-company-due-diligence' ? 'warning.light' : 'text.secondary',
                fontWeight: 600, fontSize: { xs: '0.82rem', sm: '0.95rem' }, textDecoration: 'none',
                ...(link.alignRight && { ml: { sm: 'auto' } }),
                '&:hover': { color: 'primary.light', textDecoration: 'underline' },
              }}
            >
              {link.label}
            </Link>
          ))}
        </Box>

        {/* ---- HERO ---- */}
        {/* ---- HERO (two-column on desktop: text left, live graph right) ---- */}
        <Section sx={{ py: { xs: 5, sm: 7 } }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.15fr' }, gap: { xs: 4, md: 5 }, alignItems: 'center' }}>
            {/* Left: headline + CTA */}
            <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
              <Typography variant="overline" sx={{ display: 'block', color: 'primary.light', fontWeight: 700, letterSpacing: '0.12em', fontSize: '0.68rem', mb: 1 }}>
                {copy.hero.eyebrow}
              </Typography>
              <Typography 
                variant="h3"
                component="h1"
                sx={{ fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.12, mb: 2, fontSize: { xs: '1.9rem', sm: '2.6rem', md: '2.9rem' } }}
              >
                {copy.hero.h1}
              </Typography>
              <Typography
                variant="body1"
                sx={{ color: 'text.secondary', lineHeight: 1.6, fontSize: { xs: '0.95rem', sm: '1.1rem' }, mb: 1.5, maxWidth: { xs: 600, md: 520 }, mx: { xs: 'auto', md: 0 } }}
              >
                {copy.hero.subtitle}
              </Typography>
              {/* Compact, keyword-dense definition line — gives Google a strong,
                  intent-matching snippet target high in the DOM instead of the
                  step-by-step "How it works" text it currently lifts. */}
              <Typography
                variant="body2"
                sx={{ color: 'text.disabled', lineHeight: 1.55, fontSize: { xs: '0.85rem', sm: '0.9rem' }, mb: 3.5, maxWidth: { xs: 600, md: 520 }, mx: { xs: 'auto', md: 0 } }}
              >
                {copy.hero.intro}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: { xs: 'center', md: 'flex-start' } }}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<SearchIcon />}
                  onClick={openGraph}
                  sx={{ textTransform: 'none', fontWeight: 600, px: 4.5, py: 1.5, fontSize: '1.05rem', borderRadius: 2, bgcolor: 'primary.main', '&:hover': { bgcolor: '#0d9488' } }}
                >
                  {copy.hero.openCta}
                </Button>
              </Box>
              {/* Secondary destinations that the search-first redesign had buried —
                  prominent under the CTA but not competing with it. */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'center', md: 'flex-start' }, flexWrap: 'wrap', columnGap: 1.5, rowGap: 0.5, mt: 2.5 }}>
                <Link
                  component="button"
                  type="button"
                  onClick={() => openListedCompanies(lang)}
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, color: 'primary.light', fontWeight: 600, fontSize: '0.92rem', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                >
                  <ApartmentIcon sx={{ fontSize: 18 }} /> {copy.quickLinks.listed}
                </Link>
                <Box component="span" sx={{ color: 'text.disabled', display: { xs: 'none', sm: 'inline' } }}>·</Box>
                <Link
                  component="button"
                  type="button"
                  onClick={() => navigate(nav.dashboard)}
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, color: 'primary.light', fontWeight: 600, fontSize: '0.92rem', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                >
                  <BarChartIcon sx={{ fontSize: 18 }} /> {copy.quickLinks.dashboard}
                </Link>
              </Box>
              <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'center', md: 'flex-start' }, gap: 0.5, color: 'text.disabled', mt: 2 }}>
                <BookmarkBorderIcon sx={{ fontSize: 15 }} /> {copy.hero.bookmarkTip}
              </Typography>
            </Box>

            {/* Right: live graph demo (graceful fallback until graph-demo.png exists) */}
            <Box>
              <Box sx={{ borderRadius: 2, border: '1px solid rgba(20,184,166,0.18)', overflow: 'hidden', bgcolor: '#0d1220', boxShadow: '0 20px 60px rgba(0,0,0,0.45)' }}>
                <Box
                  component="a"
                  href={demoHref}
                  aria-label={copy.howItWorks.demoCta}
                  sx={{
                    display: 'block', position: 'relative', width: '100%', aspectRatio: '16 / 9',
                    background: 'radial-gradient(ellipse 70% 70% at 50% 45%, rgba(20,184,166,0.10) 0%, transparent 70%)',
                  }}
                >
                  <HeroNetwork ariaLabel={copy.howItWorks.demoAlt} />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>{copy.howItWorks.demoCaption}</Typography>
                <Link href={demoHref} variant="caption" sx={{ color: 'primary.light', fontWeight: 700, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                  {copy.howItWorks.demoCta}
                </Link>
              </Box>
            </Box>
          </Box>
        </Section>

        {/* ---- STATS / BY THE NUMBERS ---- */}
        <Box sx={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', bgcolor: 'rgba(20,184,166,0.04)' }}>
          <Section sx={{ py: { xs: 4, sm: 5 } }}>
            <SectionHeading heading={copy.stats.heading} sub={copy.stats.sub} />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: { xs: 2.5, sm: 2 } }}>
              {copy.stats.items.map((item) => (
                <Box key={item.key} sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                  <Typography component="div" className="registry-ref" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'primary.light', fontSize: { xs: '1.85rem', sm: '2.25rem' }, lineHeight: 1.05 }}>
                    {fmtMillions(stats[STAT_FIELD[item.key]] ?? STAT_FALLBACK[STAT_FIELD[item.key]])}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.4, display: 'block', mt: 0.5 }}>
                    {item.label}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', mt: 3, letterSpacing: '0.02em' }}>
              {copy.stats.sinceLabel}{' '}
              <Box component="span" className="registry-ref" sx={{ color: 'text.secondary', fontWeight: 700 }}>{copy.stats.sinceValue}</Box>
            </Typography>
          </Section>
        </Box>

        {/* ---- HOW IT WORKS ---- */}
        <Box sx={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', bgcolor: 'rgba(255,255,255,0.015)' }}>
          <Section>
            <SectionHeading heading={copy.howItWorks.heading} sub={copy.howItWorks.sub} />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
              {copy.howItWorks.steps.map((step, i) => (
                <Box key={i} sx={{ p: 2.5, borderRadius: 2, border: '1px solid rgba(255,255,255,0.07)', bgcolor: 'rgba(255,255,255,0.02)' }}>
                  <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: 'rgba(20,184,166,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'primary.main', mb: 1.5, '& .MuiSvgIcon-root': { fontSize: 19 } }}>
                    {STEP_ICONS[i]}
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>{step.title}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.55 }}>{step.desc}</Typography>
                </Box>
              ))}
            </Box>
          </Section>
        </Box>

        {/* ---- REPORTS ---- */}
        <Section>
          <SectionHeading heading={copy.reports.heading} sub={copy.reports.sub} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5, alignItems: 'start' }}>
            {/* Due Diligence (paid) */}
            <Paper elevation={0} sx={{ p: 3, bgcolor: 'rgba(20,184,166,0.07)', border: '1px solid rgba(20,184,166,0.35)', borderRadius: 2, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <DescriptionIcon sx={{ color: 'primary.light' }} />
                <Typography variant="body1" sx={{ fontWeight: 700 }}>{copy.reports.dd.title}</Typography>
              </Box>
              <Chip label={copy.reports.dd.badge} size="small" sx={{ fontWeight: 700, bgcolor: 'rgba(255,255,255,0.08)', color: 'text.primary', border: '1px solid rgba(255,255,255,0.15)', mb: 1.5 }} />
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.6, mb: 1.5 }}>
                {copy.reports.dd.desc}
              </Typography>
              <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, mb: 2 }}>
                {copy.reports.dd.bullets.map((b) => (
                  <Box component="li" key={b} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
                    <CheckCircleOutlineIcon sx={{ fontSize: 16, color: 'success.light', mt: '2px', flexShrink: 0 }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>{b}</Typography>
                  </Box>
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<DescriptionIcon />}
                  onClick={() => navigate(nav.reports)}
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: 'primary.main', color: '#04231f', '&:hover': { bgcolor: 'primary.dark' } }}
                >
                  {copy.reports.dd.buyCta}
                </Button>
                <Link href="/sample-dd-report.pdf" target="_blank" rel="noopener" variant="caption" sx={{ color: 'primary.light', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                  {copy.reports.dd.sampleCta}
                </Link>
              </Box>
            </Paper>

            {/* Relationship report (free) */}
            <Paper elevation={0} sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <HubIcon sx={{ color: 'text.secondary' }} />
                <Typography variant="body1" sx={{ fontWeight: 700 }}>{copy.reports.rel.title}</Typography>
              </Box>
              <Chip label={copy.reports.rel.badge} size="small" sx={{ fontWeight: 700, bgcolor: 'rgba(255,255,255,0.08)', color: 'text.primary', border: '1px solid rgba(255,255,255,0.15)', mb: 1.5 }} />
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.6 }}>
                {copy.reports.rel.desc}
              </Typography>
            </Paper>
          </Box>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', mt: 2.5, lineHeight: 1.6 }}>
            {copy.reports.howToBuy}
          </Typography>
        </Section>

        {/* ---- FAQ ---- */}
        {/* Visible Q&A that backs the homepage FAQPage structured data (the schema
            text matches these answers), so it stays valid after React hydration. */}
        <Section>
          <SectionHeading heading={copy.faq.heading} />
          <Box sx={{ maxWidth: 820 }}>
            {copy.faq.items.map((item, i) => (
              <Accordion
                key={i}
                disableGutters
                elevation={0}
                sx={{
                  bgcolor: 'transparent',
                  borderTop: '1px solid rgba(255,255,255,0.07)',
                  '&:last-of-type': { borderBottom: '1px solid rgba(255,255,255,0.07)' },
                  '&:before': { display: 'none' },
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary' }} />} sx={{ px: 0 }}>
                  <Typography variant="body1" component="h3" sx={{ fontWeight: 600, fontSize: '1rem' }}>{item.q}</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 0, pt: 0 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.65 }}>{item.a}</Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </Section>

        {/* ---- BOOKMARK CALLOUT ---- */}
        <Box sx={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(20,184,166,0.08) 0%, transparent 70%)' }}>
          <Section sx={{ textAlign: 'center' }}>
            <BookmarkBorderIcon sx={{ fontSize: 36, color: 'primary.light', mb: 1.5 }} />
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1.5, letterSpacing: '-0.02em' }}>
              {copy.bookmark.heading}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 520, mx: 'auto', mb: 2.5, lineHeight: 1.6 }}>
              {copy.bookmark.body}
            </Typography>
            <Chip
              label={copy.bookmark.url}
              sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem', bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', mb: 2.5 }}
            />
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<SearchIcon />}
                onClick={openGraph}
                sx={{ textTransform: 'none', fontWeight: 600, px: 4, py: 1.5, borderRadius: 2, bgcolor: 'primary.main', '&:hover': { bgcolor: '#0d9488' } }}
              >
                {copy.bookmark.cta}
              </Button>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>{copy.bookmark.shortcut}</Typography>
            </Box>
          </Section>
        </Box>

        {/* ---- TRUST + PROOF STRIP ---- */}
        <Section sx={{ textAlign: 'center', py: { xs: 4, sm: 5 } }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', maxWidth: 620, mx: 'auto', lineHeight: 1.6, mb: 2.5 }}>
            {copy.operatedBy}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: { xs: 2, sm: 4 } }}>
            {copy.proofItems.map((item) => (
              <Typography
                key={item}
                variant="caption"
                sx={{
                  color: 'text.secondary', fontWeight: 500, fontSize: '0.75rem', letterSpacing: '0.02em',
                  display: 'flex', alignItems: 'center', gap: 0.75,
                  '&::before': { content: '""', display: 'inline-block', width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', opacity: 0.5 },
                }}
              >
                {item}
              </Typography>
            ))}
          </Box>
          <LegalDisclaimer dense language={lang} sx={{ mt: 3, maxWidth: 620, mx: 'auto', textAlign: 'left' }} />
        </Section>

        {/* ---- FOOTER ---- */}
        <Box sx={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', py: 3, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem', lineHeight: 1.5 }}>
            &copy; {new Date().getFullYear()} Mapa Societario &middot; {copy.footer.productOf}{' '}
            <Link href="https://nurnbergconsulting.com" target="_blank" rel="noopener" sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              Nurnberg Consulting SL
            </Link>
            {copy.footer.productOfSuffix}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem', lineHeight: 1.5, maxWidth: 760, px: 2 }}>
            {copy.footer.basedOnPrefix}
            <Link href="https://www.boe.es" target="_blank" rel="noopener" sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              Agencia Estatal Boletín Oficial del Estado
            </Link>
            {copy.footer.basedOnSuffix}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href={nav.reports} variant="caption" sx={{ fontSize: '0.65rem', color: 'warning.light', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.ddReports}
            </Link>
            <Link href={nav.dashboard} variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.dashboard}
            </Link>
            <Link href={nav.about} variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.about}
            </Link>
            <Link href="https://github.com/anbrme/borme-public-api" target="_blank" rel="noopener" variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.apiDocs}
            </Link>
            <Link href={nav.connectClaude} variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.connectClaude}
            </Link>
            <Link href="https://ncdata.eu" target="_blank" rel="noopener" variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.ncdata}
            </Link>
            <Link href={nav.facebook} target="_blank" rel="noopener" variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.facebook}
            </Link>
            <Link href={nav.privacy} variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.privacy}
            </Link>
            <Link href={nav.terms} variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.terms}
            </Link>
          </Box>
        </Box>
      </Box>
    </>
  );
}
