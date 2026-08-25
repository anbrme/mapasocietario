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
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { ThemeProvider, createTheme, useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import LegalDisclaimer from './LegalDisclaimer';
import FeedbackWidget from './FeedbackWidget';
import HeroNetwork from './HeroNetwork';
import LandingEntitySearch from './LandingEntitySearch';
import { LANDING_COPY } from './landingCopy';
import { FREE_FIRST_REPORT_COPY, FREE_FIRST_REPORT_CODE, SAMPLE_REPORT_URL } from '../copy/freeFirstReport';
import { siteNav } from '../utils/siteNav';
import { statsService } from '../services/statsService';
import { millionsLabel, REGISTRY_SCALE_RAW } from '../copy/registryScale';
import { openListedCompanies } from '../services/listedCompaniesNav';
import { trackEvent, trackUserManualDownload } from '../utils/track';
import { isReturningGuideVisit, markGuideSeen } from '../utils/firstRunGuide';

const SITE_URL = 'https://mapasocietario.es';

// Maps the copy item keys to /bormes/stats/overview fields.
const STAT_FIELD = {
  companies: 'total_companies',
  events: 'total_events',
  officerChanges: 'officer_changes',
  formations: 'constitutions',
};

// Static fallback so the band renders instantly (and survives an API outage).
// Same generated figures the FAQ and the structured data quote, rather than a
// second hardcoded set to drift against them.
const STAT_FALLBACK = {
  total_companies: REGISTRY_SCALE_RAW.totalCompanies,
  total_events: REGISTRY_SCALE_RAW.totalEvents,
  officer_changes: REGISTRY_SCALE_RAW.officerChanges,
  constitutions: REGISTRY_SCALE_RAW.constitutions,
};

// Company shown in the demo frame. Must match whatever is captured in
// public/graph-demo.png so the click-through lands on the same graph.
const DEMO_COMPANY = 'ACERINOX SA';

const STEP_ICONS = [<SearchIcon />, <TouchAppIcon />, <PreviewIcon />, <NotificationsActiveIcon />];
const PROFESSIONAL_ICONS = [<FactCheckIcon />, <ManageSearchIcon />, <AccountBalanceIcon />];

const navLinkSx = (link) => ({
  color: link.highlight ? 'warning.light' : 'text.secondary',
  fontWeight: 600,
  fontSize: { xs: '0.88rem', sm: '1rem' },
  textDecoration: 'none',
  '&:hover': { color: 'primary.light', textDecoration: 'underline' },
});

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

// Web body copy sits at 16px+; the workspace defaults (14px body2, 12px
// caption) are too tight for a page people read rather than operate.
const LANDING_TYPOGRAPHY = {
  body1: { fontSize: '1.0625rem' },
  body2: { fontSize: '1rem' },
  caption: { fontSize: '0.875rem' },
  h5: { fontSize: '1.75rem' },
  h6: { fontSize: '1.3rem' },
};

function useLandingTheme() {
  const outerTheme = useTheme();
  return React.useMemo(
    () => createTheme(outerTheme, { typography: LANDING_TYPOGRAPHY }),
    [outerTheme],
  );
}

// The homepage is a first-run how-to guide. It teaches search → graph →
// reports and nudges the visitor to bookmark the real workspace at /app.
//
// True when the visitor has seen the guide before AND isn't explicitly asking
// for it via ?guide=1. Computed synchronously so we never flash the guide
// before redirecting a returning visitor to the workspace. usePageTracking
// asks the same question to keep the skipped view out of GA4.
function shouldRedirectReturning() {
  if (typeof window === 'undefined') return false;
  return isReturningGuideVisit({ search: window.location.search, storage: window.localStorage });
}

export default function LandingPage({ lang = 'en' }) {
  const copy = LANDING_COPY[lang];
  const offer = FREE_FIRST_REPORT_COPY[lang] || FREE_FIRST_REPORT_COPY.en;
  const navigate = useNavigate();
  const landingTheme = useLandingTheme();

  // The language switcher renders outside the wrapping link group, so split it
  // out rather than positioning it with ml:auto inside the flow.
  const languageLink = copy.topLinks.find((link) => link.alignRight);
  const mainLinks = copy.topLinks.filter((link) => !link.alignRight);

  // Returning visitors skip the first-run guide and land straight in /app.
  // First-timers (and crawlers, which have no localStorage) see the guide, so
  // SEO and first impressions are untouched. The /app header "How it works"
  // icon and /?guide=1 always bring the guide back.
  const [redirecting] = React.useState(shouldRedirectReturning);

  React.useEffect(() => {
    if (redirecting) {
      trackEvent('home_graph_auto_redirect', { language: lang });
      navigate(
        lang === 'es'
          ? '/app/?lang=es&source=returning_home_redirect'
          : '/app/?source=returning_home_redirect',
        { replace: true }
      );
      return;
    }
    markGuideSeen(typeof window === 'undefined' ? null : window.localStorage);
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
  const appHref = lang === 'es' ? '/app/?lang=es' : '/app/';
  const graphHref = (placement) => `${appHref}${appHref.includes('?') ? '&' : '?'}source=home_${placement}`;
  const demoHref = `/app/?search=${encodeURIComponent(DEMO_COMPANY)}${lang === 'es' ? '&lang=es' : ''}&source=home_demo`;
  const openGraph = (placement) => {
    trackEvent('home_graph_click', { placement, language: lang });
    navigate(graphHref(placement));
  };
  const trackDemoClick = () => trackEvent('home_graph_click', { placement: 'demo', language: lang });

  // Returning visitor: render nothing while the effect redirects to /app.
  if (redirecting) return null;

  return (
    <ThemeProvider theme={landingTheme}>
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
        {/* ---- HEADER NAV ----
             The language switcher lives in its own column rather than in the
             wrapping flow: with ml:auto it was the item that wrapped, stranding
             it alone on a second row whenever the link set was wide (as in EN). */}
        <Box
          component="nav"
          aria-label="Site"
          sx={{
            width: '100%', maxWidth: 1200, mx: 'auto', px: { xs: 2.5, sm: 4 }, pt: { xs: 2, sm: 3 },
            display: 'flex', alignItems: 'flex-start', flexWrap: 'nowrap',
            justifyContent: { xs: 'center', sm: 'space-between' }, gap: { xs: 1.5, sm: 3 },
          }}
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: { xs: 'center', sm: 'flex-start' }, gap: { xs: 1.5, sm: 2.5 } }}>
            {mainLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noopener' : undefined}
                sx={navLinkSx(link)}
              >
                {link.label}
              </Link>
            ))}
          </Box>
          {languageLink && (
            <Link
              href={languageLink.href}
              target={languageLink.external ? '_blank' : undefined}
              rel={languageLink.external ? 'noopener' : undefined}
              sx={{ ...navLinkSx(languageLink), flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              {languageLink.label}
            </Link>
          )}
        </Box>

        {/* ---- HERO ---- */}
        {/* ---- HERO (two-column on desktop: text left, live graph right) ---- */}
        <Section sx={{ py: { xs: 5, sm: 7 } }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.15fr' }, gap: { xs: 4, md: 5 }, alignItems: 'center' }}>
            {/* Left: headline + CTA */}
            <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
              <Typography variant="overline" sx={{ display: 'block', color: 'primary.light', fontWeight: 700, letterSpacing: '0.12em', fontSize: '0.72rem', mb: 1 }}>
                {copy.hero.eyebrow}
              </Typography>
              <Typography 
                variant="h3"
                component="h1"
                sx={{ fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.12, mb: 2, fontSize: { xs: '2rem', sm: '2.7rem', md: '3rem' } }}
              >
                {copy.hero.h1}
              </Typography>
              <Typography
                variant="body1"
                sx={{ color: 'text.secondary', lineHeight: 1.6, fontSize: { xs: '1.05rem', sm: '1.2rem' }, mb: 1.5, maxWidth: { xs: 600, md: 520 }, mx: { xs: 'auto', md: 0 } }}
              >
                {copy.hero.subtitle}
              </Typography>
              {/* Compact, keyword-dense definition line — gives Google a strong,
                  intent-matching snippet target high in the DOM instead of the
                  step-by-step "How it works" text it currently lifts. */}
              <Typography
                variant="body2"
                sx={{ color: 'text.disabled', lineHeight: 1.6, fontSize: { xs: '0.95rem', sm: '1rem' }, mb: 3.5, maxWidth: { xs: 600, md: 520 }, mx: { xs: 'auto', md: 0 } }}
              >
                {copy.hero.intro}
              </Typography>
              <LandingEntitySearch lang={lang} navigate={navigate} />
              <Box sx={{ display: 'flex', justifyContent: { xs: 'center', md: 'flex-start' }, flexWrap: 'wrap', gap: 1.25 }}>
                <Button
                  variant="text"
                  size="small"
                  startIcon={<SearchIcon />}
                  onClick={() => openGraph('hero')}
                  sx={{ textTransform: 'none', fontWeight: 650, color: 'primary.light' }}
                >
                  {copy.hero.openCta}
                </Button>
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
                  onClick={trackDemoClick}
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
                <Link href={demoHref} onClick={trackDemoClick} variant="caption" sx={{ color: 'primary.light', fontWeight: 700, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
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
                  <Typography component="div" className="registry-ref" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'primary.light', fontSize: { xs: '2rem', sm: '2.45rem' }, lineHeight: 1.05 }}>
                    {millionsLabel(stats[STAT_FIELD[item.key]] ?? STAT_FALLBACK[STAT_FIELD[item.key]], lang)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.4, display: 'block', mt: 0.5 }}>
                    {item.label}
                  </Typography>
                </Box>
              ))}
            </Box>
            {/* The three data destinations used to sit in the hero, where they
                competed with the search box for the visitor's first action.
                They belong with the coverage figures they let you explore. */}
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 2.5, rowGap: 1, mt: 3 }}>
              <Link
                component="button"
                type="button"
                onClick={() => openListedCompanies(lang)}
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, color: 'primary.light', fontWeight: 600, fontSize: '0.95rem', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                <ApartmentIcon sx={{ fontSize: 18 }} /> {copy.quickLinks.listed}
              </Link>
              <Link
                component="button"
                type="button"
                onClick={() => navigate(nav.dashboard)}
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, color: 'primary.light', fontWeight: 600, fontSize: '0.95rem', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                <BarChartIcon sx={{ fontSize: 18 }} /> {copy.quickLinks.dashboard}
              </Link>
              <Link
                component="a"
                href={lang === 'en' ? '/en/studies/ibex-35-interlocking-boards/' : '/estudios/consejos-cruzados-ibex-35/'}
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, color: 'primary.light', fontWeight: 600, fontSize: '0.95rem', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                <HubIcon sx={{ fontSize: 18 }} /> {copy.quickLinks.study}
              </Link>
            </Box>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', mt: 3, letterSpacing: '0.02em' }}>
              {copy.stats.sinceLabel}{' '}
              <Box component="span" className="registry-ref" sx={{ color: 'text.secondary', fontWeight: 700 }}>{copy.stats.sinceValue}</Box>
            </Typography>
          </Section>
        </Box>

        {/* ---- WHO IT IS FOR + DATA QUALITY (one credibility band) ----
             Left untinted on purpose: the stats band above and how-it-works
             below are both tinted, so this keeps the bands alternating. */}
        <Section>
          <SectionHeading heading={copy.professional.heading} sub={copy.professional.sub} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
            {copy.professional.items.map((item, index) => (
              <Paper
                key={item.key}
                elevation={0}
                sx={{ p: 2.75, bgcolor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 2, height: '100%' }}
              >
                <Box sx={{ color: 'primary.light', mb: 1.5, '& .MuiSvgIcon-root': { fontSize: 25 } }}>
                  {PROFESSIONAL_ICONS[index]}
                </Box>
                <Typography variant="overline" sx={{ color: 'text.disabled', fontWeight: 700, letterSpacing: '0.09em', fontSize: '0.68rem' }}>
                  {item.audience}
                </Typography>
                <Typography component="h3" variant="h6" sx={{ fontWeight: 700, mt: 0.25, mb: 1 }}>
                  {item.title}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.65, mb: 2 }}>
                  {item.desc}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => openGraph(`professional_${item.key}`)}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  {item.cta}
                </Button>
              </Paper>
            ))}
          </Box>

          {/* Data quality reads as evidence for the cards above, so it stays
              inside the same band instead of opening a second trust section. */}
          <Box sx={{ mt: { xs: 4, sm: 5 }, pt: { xs: 3.5, sm: 4 }, borderTop: '1px solid rgba(255,255,255,0.09)' }}>
            <Typography component="h3" variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.01em', mb: 3 }}>
              {copy.quality.heading}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: { xs: 2.5, md: 3 }, columnGap: { md: 6 } }}>
              {copy.quality.items.map(item => (
                <Box key={item.title} sx={{ display: 'flex', gap: 1.25 }}>
                  <CheckCircleOutlineIcon sx={{ color: 'primary.light', fontSize: 19, mt: 0.25, flexShrink: 0 }} />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>{item.title}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.65 }}>{item.desc}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Section>

        {/* ---- HOW IT WORKS ---- */}
        <Box sx={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', bgcolor: 'rgba(255,255,255,0.015)' }}>
          <Section>
            <SectionHeading heading={copy.howItWorks.heading} sub={copy.howItWorks.sub} />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
              {copy.howItWorks.steps.map((step, i) => (
                <Box key={i} sx={{ p: 2.5, borderRadius: 2, border: '1px solid rgba(255,255,255,0.07)', bgcolor: 'rgba(255,255,255,0.02)' }}>
                  <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: 'rgba(20,184,166,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'primary.main', mb: 1.5, '& .MuiSvgIcon-root': { fontSize: 19 } }}>
                    {STEP_ICONS[i]}
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.75 }}>{step.title}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.65 }}>{step.desc}</Typography>
                </Box>
              ))}
            </Box>

            {/* The printable version of exactly these steps. It sat in the hero
                as an outlined button of equal weight to the product itself;
                here it reads as "take this with you" once the steps are read. */}
            <Box sx={{ display: 'flex', justifyContent: { xs: 'center', sm: 'flex-start' }, mt: 2.5 }}>
              <Button
                component="a"
                href={nav.userGuidePdf}
                download="mapa-societario-user-guide-en-es.pdf"
                onClick={() => trackUserManualDownload('how_it_works', lang)}
                variant="text"
                size="small"
                startIcon={<SaveAltIcon />}
                sx={{ textTransform: 'none', fontWeight: 650, color: 'primary.light' }}
              >
                {copy.hero.userGuidePdfCta}
              </Button>
            </Box>

            <Paper
              elevation={0}
              sx={{
                mt: 2.5,
                p: { xs: 2.5, sm: 3 },
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'auto 1fr auto' },
                alignItems: 'center',
                gap: { xs: 2, sm: 2.5 },
                bgcolor: 'rgba(20,184,166,0.07)',
                border: '1px solid rgba(20,184,166,0.30)',
                borderRadius: 2,
              }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  bgcolor: 'rgba(20,184,166,0.14)',
                  color: 'primary.light',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <StickyNote2Icon sx={{ fontSize: 21 }} />
                  <SaveAltIcon sx={{ fontSize: 21 }} />
                </Box>
              </Box>
              <Box>
                <Typography variant="overline" sx={{ color: 'primary.light', fontWeight: 700, letterSpacing: '0.1em', fontSize: '0.7rem' }}>
                  {copy.howItWorks.snapshot.eyebrow}
                </Typography>
                <Typography variant="body1" component="h3" sx={{ fontWeight: 700, mb: 0.5 }}>
                  {copy.howItWorks.snapshot.title}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.65, display: 'block', maxWidth: 720 }}>
                  {copy.howItWorks.snapshot.desc}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1.5 }}>
                  {copy.howItWorks.snapshot.features.map((feature) => (
                    <Box key={feature} sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                      <CheckCircleOutlineIcon sx={{ fontSize: 15, color: 'primary.light' }} />
                      <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 600 }}>
                        {feature}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'row', sm: 'column' }, alignItems: { xs: 'center', sm: 'flex-end' }, gap: 1 }}>
                <Chip
                  label={copy.howItWorks.snapshot.badge}
                  size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.07)', color: 'text.secondary', border: '1px solid rgba(255,255,255,0.10)' }}
                />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => openGraph('snapshot')}
                  sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  {copy.howItWorks.snapshot.cta}
                </Button>
              </Box>
            </Paper>
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
              <Typography variant="body2" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.65, mb: 1.75 }}>
                {copy.reports.dd.desc}
              </Typography>
              <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, mb: 2 }}>
                {copy.reports.dd.bullets.map((b) => (
                  <Box component="li" key={b} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
                    <CheckCircleOutlineIcon sx={{ fontSize: 16, color: 'success.light', mt: '2px', flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.55 }}>{b}</Typography>
                  </Box>
                ))}
              </Box>
              {/* The offer converts, but until now it was only announced on
                  /due-diligence, /pricing and inside the checkout dialog —
                  never on the page organic search actually lands on. */}
              {FREE_FIRST_REPORT_CODE && (
                <Box
                  sx={{
                    p: 1.5, mb: 2, borderRadius: 2,
                    bgcolor: 'rgba(250,204,21,0.09)',
                    border: '1px solid rgba(250,204,21,0.4)',
                  }}
                >
                  <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: 'warning.light', mb: 0.5 }}>
                    🎁 {offer.headline}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.5 }}>
                    {offer.body}
                  </Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<DescriptionIcon />}
                  onClick={() => navigate(nav.reports)}
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: 'primary.main', color: '#04231f', '&:hover': { bgcolor: 'primary.dark' } }}
                >
                  {FREE_FIRST_REPORT_CODE ? offer.cta : copy.reports.dd.buyCta}
                </Button>
                <Button
                  component="a"
                  href={SAMPLE_REPORT_URL}
                  target="_blank"
                  rel="noopener"
                  variant="outlined"
                  size="small"
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: 'primary.light', borderColor: 'rgba(255,255,255,0.28)', '&:hover': { borderColor: 'primary.light', bgcolor: 'rgba(255,255,255,0.06)' } }}
                >
                  {copy.reports.dd.sampleCta}
                </Button>
              </Box>
            </Paper>

            {/* Relationship report (free) */}
            <Paper elevation={0} sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <HubIcon sx={{ color: 'text.secondary' }} />
                <Typography variant="body1" sx={{ fontWeight: 700 }}>{copy.reports.rel.title}</Typography>
              </Box>
              <Chip label={copy.reports.rel.badge} size="small" sx={{ fontWeight: 700, bgcolor: 'rgba(255,255,255,0.08)', color: 'text.primary', border: '1px solid rgba(255,255,255,0.15)', mb: 1.5 }} />
              <Typography variant="body2" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.65 }}>
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
        {/* ---- WHAT THIS IS, AND WHAT IT ISN'T ----
             The single home for every caveat. Disclosure used to be scattered
             across the hero, the quality items, four FAQ answers and the
             footer; stating it once, in full, is both honester and lighter. */}
        <Box sx={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', bgcolor: 'rgba(255,255,255,0.015)' }}>
          <Section>
            <SectionHeading heading={copy.limits.heading} sub={copy.limits.sub} />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: { xs: 3.5, md: 6 }, alignItems: 'start' }}>
              {[
                { title: copy.limits.isTitle, items: copy.limits.is, icon: 'yes' },
                { title: copy.limits.isntTitle, items: copy.limits.isnt, icon: 'no' },
              ].map(col => (
                <Box key={col.title}>
                  <Typography component="h3" variant="body1" sx={{ fontWeight: 700, mb: 1.75 }}>
                    {col.title}
                  </Typography>
                  <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                    {col.items.map(item => (
                      <Box component="li" key={item} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 1.5 }}>
                        {col.icon === 'yes'
                          ? <CheckCircleOutlineIcon sx={{ color: 'primary.light', fontSize: 18, mt: '3px', flexShrink: 0 }} />
                          : <RemoveCircleOutlineIcon sx={{ color: 'text.disabled', fontSize: 18, mt: '3px', flexShrink: 0 }} />}
                        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.65 }}>{item}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
          </Section>
        </Box>

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
                  <Typography variant="body1" component="h3" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>{item.q}</Typography>
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
              sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.95rem', bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', mb: 2.5 }}
            />
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<SearchIcon />}
                onClick={() => openGraph('bookmark')}
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
                  color: 'text.secondary', fontWeight: 500, fontSize: '0.85rem', letterSpacing: '0.02em',
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
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.78rem', lineHeight: 1.5 }}>
            &copy; {new Date().getFullYear()} Mapa Societario &middot; {copy.footer.productOf}{' '}
            <Link href="https://nurnbergconsulting.com" target="_blank" rel="noopener" sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              Nurnberg Consulting SL
            </Link>
            {copy.footer.productOfSuffix}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.78rem', lineHeight: 1.5, maxWidth: 760, px: 2 }}>
            {copy.footer.basedOnPrefix}
            <Link href="https://www.boe.es" target="_blank" rel="noopener" sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              Agencia Estatal Boletín Oficial del Estado
            </Link>
            {copy.footer.basedOnSuffix}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href={nav.reports} variant="caption" sx={{ fontSize: '0.78rem', color: 'warning.light', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.ddReports}
            </Link>
            <Link href={nav.dashboard} variant="caption" sx={{ fontSize: '0.78rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.dashboard}
            </Link>
            <Link href={nav.about} variant="caption" sx={{ fontSize: '0.78rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.about}
            </Link>
            <Link href="https://github.com/anbrme/borme-public-api" target="_blank" rel="noopener" variant="caption" sx={{ fontSize: '0.78rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.apiDocs}
            </Link>
            <Link href={nav.connectClaude} variant="caption" sx={{ fontSize: '0.78rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.connectClaude}
            </Link>
            <Link href={nav.glossary} variant="caption" sx={{ fontSize: '0.78rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.glossary}
            </Link>
            <Link href="https://ncdata.eu" target="_blank" rel="noopener" variant="caption" sx={{ fontSize: '0.78rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.ncdata}
            </Link>
            <Link href={nav.facebook} target="_blank" rel="noopener" variant="caption" sx={{ fontSize: '0.78rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.facebook}
            </Link>
            <Link href={nav.privacy} variant="caption" sx={{ fontSize: '0.78rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.privacy}
            </Link>
            <Link href={nav.terms} variant="caption" sx={{ fontSize: '0.78rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.terms}
            </Link>
          </Box>
        </Box>
      </Box>
      <FeedbackWidget lang={lang} />
    </ThemeProvider>
  );
}
