import React from 'react';
import {
  Box,
  Typography,
  Button,
  Link,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import SearchIcon from '@mui/icons-material/Search';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import DescriptionIcon from '@mui/icons-material/Description';
import BarChartIcon from '@mui/icons-material/BarChart';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import VerifiedIcon from '@mui/icons-material/Verified';
import SpeedIcon from '@mui/icons-material/Speed';
import HubIcon from '@mui/icons-material/Hub';
import PaymentsIcon from '@mui/icons-material/Payments';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import PublicIcon from '@mui/icons-material/Public';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import EventIcon from '@mui/icons-material/Event';
import GavelIcon from '@mui/icons-material/Gavel';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SecurityIcon from '@mui/icons-material/Security';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import MouseIcon from '@mui/icons-material/Mouse';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import PreviewIcon from '@mui/icons-material/Preview';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import LegalDisclaimer from './LegalDisclaimer';
import { isNativeApp, openListedCompanies } from '../services/listedCompaniesNav';
import { LANDING_COPY } from './landingCopy';

const SITE_URL = 'https://mapasocietario.es';

// Structural (non-copy) counterparts of the copy arrays in landingCopy.jsx.
// Each array MUST keep the same length and order as its copy counterpart;
// they are zipped by index at render time.
const CAPABILITY_META = [
  { icon: <AccountTreeIcon />, color: '#1976d2', href: '/app' },
  { icon: <PersonIcon />, color: '#f57c00', href: '/app' },
  { icon: <DescriptionIcon />, color: '#f57c00', href: '/due-diligence' },
  { icon: <BarChartIcon />, color: '#1976d2', href: '/dashboard' },
];

const USE_CASE_ICONS = [<SecurityIcon />, <TrendingUpIcon />, <NewspaperIcon />, <GavelIcon />];

const STEP_ICONS = [<SearchIcon />, <TouchAppIcon />, <MouseIcon />, <PreviewIcon />, <ZoomInIcon />, <DescriptionIcon />];

const DIFFERENTIATOR_ICONS = [<VerifiedIcon />, <HubIcon />, <PaymentsIcon />, <SpeedIcon />];

const PROFESSIONAL_META = [
  { icon: <DescriptionIcon />, href: '/spanish-company-due-diligence' },
  { icon: <NotificationsActiveIcon />, href: '/due-diligence' },
  { icon: <HubIcon />, href: 'mailto:app@ncdata.eu?subject=Spanish%20company%20data%20API' },
  { icon: <BusinessCenterIcon />, href: 'https://nurnbergconsulting.com', external: true },
];

// Company shown in the landing demo screenshot. MUST match the company
// captured in public/graph-demo.png so the click-through lands on the
// same graph the visitor just saw.
const DEMO_COMPANY = 'ACERINOX SA';

// Quiet styling shared by the two secondary hero buttons so they never drift.
const secondaryHeroButtonSx = {
  textTransform: 'none',
  fontWeight: 600,
  px: 2.5,
  py: 1,
  borderRadius: 2,
  borderColor: 'rgba(255,255,255,0.23)',
  color: 'text.secondary',
  '&:hover': {
    borderColor: 'rgba(255,255,255,0.4)',
    bgcolor: 'rgba(255,255,255,0.05)',
    color: 'text.primary',
  },
};

// Shared section wrapper for consistent vertical rhythm
const Section = ({ children, sx = {}, ...props }) => (
  <Box
    component="section"
    sx={{
      width: '100%',
      maxWidth: 960,
      mx: 'auto',
      px: { xs: 2.5, sm: 4 },
      py: { xs: 5, sm: 7 },
      ...sx,
    }}
    {...props}
  >
    {children}
  </Box>
);

const SectionLabel = ({ children }) => (
  <Typography
    variant="overline"
    sx={{
      display: 'block',
      fontSize: '0.65rem',
      fontWeight: 700,
      letterSpacing: '0.12em',
      color: 'primary.main',
      mb: 1,
    }}
  >
    {children}
  </Typography>
);

export default function LandingPage({ lang = 'en' }) {
  const copy = LANDING_COPY[lang];
  const navigate = useNavigate();

  // Hide the demo frame entirely if the screenshot asset is missing —
  // never render a broken image.
  const [demoImgOk, setDemoImgOk] = React.useState(true);

  const canonical = lang === 'es' ? `${SITE_URL}/es/` : `${SITE_URL}/`;

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

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minHeight: '100vh',
          overflowY: 'auto',
          bgcolor: '#0a0e1a',
        }}
      >
        {/* ============================================================
            HERO
        ============================================================ */}
        <Box
          sx={{
            width: '100%',
            position: 'relative',
            overflow: 'hidden',
            // Subtle radial gradient to create depth behind hero
            background: 'radial-gradient(ellipse 70% 50% at 50% 30%, rgba(25,118,210,0.08) 0%, transparent 70%)',
          }}
        >
          <Box
            component="nav"
            aria-label="Site information"
            sx={{
              width: '100%',
              maxWidth: 960,
              mx: 'auto',
              px: { xs: 2.5, sm: 4 },
              pt: { xs: 2, sm: 2.5 },
              display: 'flex',
              alignItems: 'center',
              justifyContent: { xs: 'center', sm: 'flex-start' },
              flexWrap: 'wrap',
              gap: { xs: 1.25, sm: 2.25 },
            }}
          >
            {copy.topLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noopener' : undefined}
                variant="caption"
                sx={{
                  color: link.href === '/spanish-company-due-diligence' ? 'warning.light' : 'text.secondary',
                  fontWeight: 650,
                  fontSize: '0.72rem',
                  textDecoration: 'none',
                  ...(link.alignRight && { ml: { sm: 'auto' } }),
                  '&:hover': { color: 'primary.light', textDecoration: 'underline' },
                }}
              >
                {link.label}
              </Link>
            ))}
          </Box>
          <Section sx={{ textAlign: 'center', py: { xs: 8, sm: 12 } }}>
            <AccountTreeIcon
              sx={{
                fontSize: 56,
                color: 'primary.main',
                opacity: 0.7,
                mb: 2,
                filter: 'drop-shadow(0 0 20px rgba(25,118,210,0.35))',
              }}
            />
            <Typography
              variant="h3"
              component="h1"
              sx={{
                fontWeight: 700,
                letterSpacing: '-0.03em',
                lineHeight: 1.15,
                mb: 2,
                fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' },
                maxWidth: 700,
                mx: 'auto',
              }}
            >
              {copy.hero.h1}
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: 'text.secondary',
                maxWidth: 560,
                mx: 'auto',
                lineHeight: 1.6,
                fontSize: { xs: '0.9rem', sm: '1rem' },
                mb: 4,
              }}
            >
              {copy.hero.subtitle}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'text.disabled',
                display: 'block',
                maxWidth: 620,
                mx: 'auto',
                mb: 3,
                lineHeight: 1.6,
              }}
            >
              {copy.hero.operatedBy}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<SearchIcon />}
                onClick={() => navigate('/app')}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 4,
                  py: 1.5,
                  fontSize: '1rem',
                  borderRadius: 2,
                  bgcolor: 'primary.main',
                  '&:hover': { bgcolor: '#1565c0' },
                }}
              >
                {copy.hero.searchCta}
              </Button>
              {/* Real anchor (full page load) so the Cloudflare Pages Function
                  serves /empresas-cotizadas rather than the SPA fallback. In the
                  native app there is no server for that route, so we intercept
                  and open the live page in an in-app Custom Tab instead. */}
              <Button
                variant="outlined"
                size="medium"
                component="a"
                href="/empresas-cotizadas"
                onClick={(e) => {
                  if (isNativeApp()) {
                    e.preventDefault();
                    openListedCompanies();
                  }
                }}
                startIcon={<TrendingUpIcon />}
                sx={secondaryHeroButtonSx}
              >
                {copy.hero.listedCta}
              </Button>
              <Button
                variant="outlined"
                size="medium"
                startIcon={<BarChartIcon />}
                onClick={() => navigate('/dashboard')}
                sx={secondaryHeroButtonSx}
              >
                {copy.hero.statsCta}
              </Button>
            </Box>
            {/* Trust row — the two signals that most reduce buyer hesitation
                (see what you get + money-back), moved up to first impression
                instead of being buried on the /due-diligence page. */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: { xs: 1.5, sm: 3 },
                mt: 3,
              }}
            >
              <Box
                component="a"
                href="/sample-dd-report.pdf"
                target="_blank"
                rel="noopener"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  color: 'warning.light',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                <DescriptionIcon sx={{ fontSize: 17 }} />
                {copy.hero.sampleReportCta}
              </Box>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  color: 'text.secondary',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                }}
              >
                <VerifiedIcon sx={{ fontSize: 17, color: 'success.light' }} />
                {copy.hero.moneyBack}
              </Box>
            </Box>
            {!isNativeApp() && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                {/* Official Google Play badge (per brand guidelines — unaltered). */}
                <Box
                  component="a"
                  href="https://play.google.com/store/apps/details?id=es.mapasocietario.app"
                  target="_blank"
                  rel="noopener"
                  aria-label={copy.hero.playBadgeAlt}
                  sx={{ display: 'inline-block', transition: 'opacity .15s', '&:hover': { opacity: 0.85 } }}
                >
                  <Box
                    component="img"
                    src="/google-play-badge.svg"
                    alt={copy.hero.playBadgeAlt}
                    sx={{ height: 56, width: 'auto', display: 'block' }}
                  />
                </Box>
              </Box>
            )}
            <LegalDisclaimer dense language={lang} sx={{ mt: 4, maxWidth: 760, mx: 'auto' }} />
          </Section>
        </Box>

        {/* ============================================================
            PROOF STRIP
        ============================================================ */}
        <Box
          sx={{
            width: '100%',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            bgcolor: 'rgba(255,255,255,0.015)',
          }}
        >
          <Box
            sx={{
              maxWidth: 960,
              mx: 'auto',
              px: { xs: 2.5, sm: 4 },
              py: { xs: 2, sm: 2.5 },
              display: 'flex',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: { xs: 2, sm: 5 },
            }}
          >
            {copy.proofItems.map((item) => (
              <Typography
                key={item}
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  letterSpacing: '0.02em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  '&::before': {
                    content: '""',
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    opacity: 0.5,
                  },
                }}
              >
                {item}
              </Typography>
            ))}
          </Box>
        </Box>

        {/* ============================================================
            WHAT YOU CAN DO
        ============================================================ */}
        <Section>
          <SectionLabel>{copy.capabilities.label}</SectionLabel>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 4, letterSpacing: '-0.02em' }}>
            {copy.capabilities.heading}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2.5,
            }}
          >
            {copy.capabilities.items.map((cap, i) => (
              <Paper
                key={cap.title}
                component="a"
                href={CAPABILITY_META[i].href}
                elevation={0}
                sx={{
                  display: 'block',
                  p: 3,
                  bgcolor: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 2,
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'border-color 0.2s, background-color 0.2s, transform 0.2s',
                  '&:hover': {
                    borderColor: `${CAPABILITY_META[i].color}80`,
                    bgcolor: 'rgba(255,255,255,0.04)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  <Box
                    sx={{
                      color: CAPABILITY_META[i].color,
                      opacity: 0.8,
                      mt: 0.25,
                      '& .MuiSvgIcon-root': { fontSize: 24 },
                    }}
                  >
                    {CAPABILITY_META[i].icon}
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {cap.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.55 }}>
                      {cap.desc}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            ))}
          </Box>
        </Section>

        {/* ============================================================
            VISUAL / DEMO SECTION
        ============================================================ */}
        <Box
          sx={{
            width: '100%',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            bgcolor: 'rgba(255,255,255,0.015)',
          }}
        >
          <Section>
            <SectionLabel>{copy.howItWorks.label}</SectionLabel>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1, letterSpacing: '-0.02em' }}>
              {copy.howItWorks.heading}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4, maxWidth: 560 }}>
              {copy.howItWorks.sub}
            </Typography>
            {demoImgOk && (
              <Box sx={{ mb: 4 }}>
                <Box
                  sx={{
                    borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.1)',
                    overflow: 'hidden',
                    bgcolor: '#0d1220',
                  }}
                >
                  {/* Browser-chrome top bar */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
                      <Box key={c} sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c, opacity: 0.8 }} />
                    ))}
                    <Typography variant="caption" sx={{ ml: 1, color: 'text.disabled', fontSize: '0.68rem' }}>
                      mapasocietario.es/app
                    </Typography>
                  </Box>
                  <Box component="a" href={`/app?search=${encodeURIComponent(DEMO_COMPANY)}`} sx={{ display: 'block' }}>
                    <Box
                      component="img"
                      src="/graph-demo.png"
                      alt={copy.howItWorks.demoAlt(DEMO_COMPANY)}
                      onError={() => setDemoImgOk(false)}
                      sx={{ display: 'block', width: '100%', height: 'auto', aspectRatio: '16 / 9', objectFit: 'cover' }}
                    />
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {copy.howItWorks.demoCaption(DEMO_COMPANY)}
                  </Typography>
                  <Link
                    href={`/app?search=${encodeURIComponent(DEMO_COMPANY)}`}
                    variant="caption"
                    sx={{ color: 'primary.light', fontWeight: 700, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                  >
                    {copy.howItWorks.demoCta}
                  </Link>
                </Box>
              </Box>
            )}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
                gap: 2,
              }}
            >
              {copy.howItWorks.steps.map((step, i) => (
                <Box
                  key={i}
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.07)',
                    bgcolor: 'rgba(255,255,255,0.02)',
                    display: 'flex',
                    gap: 2,
                    alignItems: 'flex-start',
                    transition: 'border-color 0.2s, background-color 0.2s',
                    '&:hover': {
                      borderColor: 'rgba(25,118,210,0.25)',
                      bgcolor: 'rgba(255,255,255,0.035)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: 'rgba(25,118,210,0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: 'primary.main',
                      '& .MuiSvgIcon-root': { fontSize: 18 },
                    }}
                  >
                    {STEP_ICONS[i]}
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {step.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.55 }}>
                      {step.desc}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mt: 3, justifyContent: 'center' }}>
              <Button
                size="small"
                variant="contained"
                startIcon={<SearchIcon />}
                onClick={() => navigate('/app')}
                sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
              >
                {copy.howItWorks.tryCta}
              </Button>
              <Button
                size="small"
                variant="outlined"
                component="a"
                href="/sample-dd-report.pdf"
                target="_blank"
                rel="noopener"
                startIcon={<DescriptionIcon />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  borderRadius: 2,
                  borderColor: 'rgba(255,167,38,0.5)',
                  color: 'warning.light',
                  '&:hover': { borderColor: '#f57c00', bgcolor: 'rgba(255,167,38,0.08)' },
                }}
              >
                {copy.howItWorks.sampleCta}
              </Button>
            </Box>
          </Section>
        </Box>

        {/* ============================================================
            USE CASES
        ============================================================ */}
        <Section>
          <SectionLabel>{copy.useCases.label}</SectionLabel>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 4, letterSpacing: '-0.02em' }}>
            {copy.useCases.heading}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2.5,
            }}
          >
            {copy.useCases.items.map((uc, i) => (
              <Box
                key={uc.label}
                sx={{
                  display: 'flex',
                  gap: 2,
                  alignItems: 'flex-start',
                  p: 2.5,
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <Box sx={{ color: 'text.secondary', mt: 0.25, '& .MuiSvgIcon-root': { fontSize: 22 } }}>
                  {USE_CASE_ICONS[i]}
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25 }}>
                    {uc.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                    {uc.desc}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Section>

        {/* ============================================================
            WHY IT'S DIFFERENT
        ============================================================ */}
        <Box
          sx={{
            width: '100%',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            bgcolor: 'rgba(255,255,255,0.015)',
          }}
        >
          <Section>
            <SectionLabel>{copy.differentiators.label}</SectionLabel>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 4, letterSpacing: '-0.02em' }}>
              {copy.differentiators.heading}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
                gap: 2.5,
              }}
            >
              {copy.differentiators.items.map((d, i) => (
                <Box key={d.title} sx={{ textAlign: 'center', p: 2 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      bgcolor: 'rgba(25,118,210,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 1.5,
                      color: 'primary.main',
                      '& .MuiSvgIcon-root': { fontSize: 22 },
                    }}
                  >
                    {DIFFERENTIATOR_ICONS[i]}
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    {d.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                    {d.desc}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Section>
        </Box>

        {/* ============================================================
            PROFESSIONAL PATHS
        ============================================================ */}
        <Section>
          <SectionLabel>{copy.professional.label}</SectionLabel>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1.5, letterSpacing: 0 }}>
            {copy.professional.heading}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4, maxWidth: 680, lineHeight: 1.6 }}>
            {copy.professional.intro}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2.5,
            }}
          >
            {copy.professional.items.map((path, i) => (
              <Paper
                key={path.title}
                elevation={0}
                sx={{
                  p: 2.5,
                  bgcolor: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box sx={{ color: 'primary.light', mt: 0.25, '& .MuiSvgIcon-root': { fontSize: 22 } }}>
                    {PROFESSIONAL_META[i].icon}
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                      {path.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.6, mb: 1.25 }}>
                      {path.desc}
                    </Typography>
                    <Link
                      href={PROFESSIONAL_META[i].href}
                      target={PROFESSIONAL_META[i].external ? '_blank' : undefined}
                      rel={PROFESSIONAL_META[i].external ? 'noopener' : undefined}
                      variant="caption"
                      sx={{ color: 'primary.light', fontWeight: 700, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                    >
                      {path.action}
                    </Link>
                  </Box>
                </Box>
              </Paper>
            ))}
          </Box>
        </Section>

        {/* ============================================================
            SPANISH SEO RESOURCES
        ============================================================ */}
        <Box
          sx={{
            width: '100%',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            bgcolor: 'rgba(255,255,255,0.015)',
          }}
        >
          <Section>
            <SectionLabel>{copy.spanishResources.label}</SectionLabel>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1.5, letterSpacing: 0 }}>
              {copy.spanishResources.heading}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, maxWidth: 620, lineHeight: 1.6 }}>
              {copy.spanishResources.intro}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
              {copy.spanishResources.links.map((resource) => (
                <Button
                  key={resource.href}
                  href={resource.href}
                  variant="outlined"
                  size="small"
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: 2,
                    color: 'primary.light',
                    borderColor: 'rgba(25,118,210,0.35)',
                    '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(25,118,210,0.08)' },
                  }}
                >
                  {resource.label}
                </Button>
              ))}
            </Box>
          </Section>
        </Box>

        {/* ============================================================
            WHO'S BEHIND IT (TRUST / OWNERSHIP)
        ============================================================ */}
        <Section>
          <SectionLabel>{copy.whoIsBehind.label}</SectionLabel>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1, letterSpacing: '-0.02em' }}>
            {copy.whoIsBehind.heading}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, maxWidth: 640, lineHeight: 1.6 }}>
            {copy.whoIsBehind.intro}
          </Typography>

          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, sm: 3.5 },
              bgcolor: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 2,
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 2.5, sm: 3.5 },
              alignItems: { xs: 'flex-start', sm: 'center' },
            }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: 2,
                bgcolor: 'rgba(25,118,210,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'primary.main',
                flexShrink: 0,
                '& .MuiSvgIcon-root': { fontSize: 32 },
              }}
            >
              <BusinessCenterIcon />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 700, mb: 0.5 }}>
                Nurnberg Consulting SL
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.55 }}>
                {copy.whoIsBehind.companyTagline}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 1.5, lineHeight: 1.55, fontFamily: 'monospace' }}>
                NIF B86829538
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: { xs: 1.25, sm: 2.5 },
                  mb: 1.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <LocationOnIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {copy.whoIsBehind.location}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <EventIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {copy.whoIsBehind.since}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <PublicIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Link
                    href="https://nurnbergconsulting.com"
                    target="_blank"
                    rel="noopener"
                    variant="caption"
                    sx={{ color: 'primary.light', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                  >
                    nurnbergconsulting.com
                  </Link>
                </Box>
              </Box>
            </Box>
          </Paper>

          <Box
            sx={{
              mt: 2.5,
              p: { xs: 2.5, sm: 3 },
              borderRadius: 2,
              bgcolor: 'rgba(25,118,210,0.05)',
              border: '1px solid rgba(25,118,210,0.2)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <HubIcon sx={{ fontSize: 18, color: 'primary.light' }} />
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.light' }}>
                {copy.whoIsBehind.ncdata.heading}
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.6, mb: 1.25 }}>
              {copy.whoIsBehind.ncdata.body}
            </Typography>
            <Link
              href="https://ncdata.eu"
              target="_blank"
              rel="noopener"
              variant="caption"
              sx={{
                color: 'primary.light',
                textDecoration: 'none',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              {copy.whoIsBehind.ncdata.cta}
            </Link>
          </Box>
        </Section>

        {/* ============================================================
            FAQ
        ============================================================ */}
        <Section>
          <SectionLabel>{copy.faq.label}</SectionLabel>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 3, letterSpacing: '-0.02em' }}>
            {copy.faq.heading}
          </Typography>
          <Box sx={{ maxWidth: 640 }}>
            {copy.faq.items.map((item) => (
              <Accordion
                key={item.question}
                disableGutters
                elevation={0}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px !important',
                  mb: 1,
                  '&:before': { display: 'none' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.035)' },
                  transition: 'background-color 0.15s',
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary', fontSize: 18 }} />}
                  sx={{ minHeight: 44, '& .MuiAccordionSummary-content': { my: 0.75 } }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {item.question}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.55 }}>
                    {item.answer}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </Section>

        {/* ============================================================
            FINAL CTA
        ============================================================ */}
        <Box
          sx={{
            width: '100%',
            background: 'radial-gradient(ellipse 80% 60% at 50% 80%, rgba(25,118,210,0.08) 0%, transparent 70%)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Section sx={{ textAlign: 'center', py: { xs: 6, sm: 8 } }}>
            <Typography
              variant="h5"
              component="p"
              sx={{ fontWeight: 700, mb: 1.5, letterSpacing: '-0.02em' }}
            >
              {copy.finalCta.heading}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4, maxWidth: 420, mx: 'auto' }}>
              {copy.finalCta.sub}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<SearchIcon />}
                onClick={() => navigate('/app')}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 4,
                  py: 1.5,
                  fontSize: '1rem',
                  borderRadius: 2,
                  bgcolor: 'primary.main',
                  '&:hover': { bgcolor: '#1565c0' },
                }}
              >
                {copy.finalCta.searchCta}
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<DescriptionIcon />}
                onClick={() => navigate('/due-diligence')}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 4,
                  py: 1.5,
                  fontSize: '1rem',
                  borderRadius: 2,
                  borderColor: 'rgba(255,167,38,0.5)',
                  color: 'warning.light',
                  '&:hover': {
                    borderColor: '#f57c00',
                    bgcolor: 'rgba(255,167,38,0.08)',
                  },
                }}
              >
                {copy.finalCta.reportCta}
              </Button>
            </Box>
          </Section>
        </Box>

        {/* ============================================================
            FOOTER
        ============================================================ */}
        <Box
          sx={{
            width: '100%',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            py: 3,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            alignItems: 'center',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: 'text.disabled',
              fontSize: '0.65rem',
              lineHeight: 1.5,
            }}
          >
            &copy; {new Date().getFullYear()} Mapa Societario &middot; {copy.footer.productOf}{' '}
            <Link
              href="https://nurnbergconsulting.com"
              target="_blank"
              rel="noopener"
              sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              Nurnberg Consulting SL
            </Link>
            {copy.footer.productOfSuffix}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem', lineHeight: 1.5, maxWidth: 760, px: 2 }}>
            {copy.footer.basedOnPrefix}
            <Link
              href="https://www.boe.es"
              target="_blank"
              rel="noopener"
              sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              Agencia Estatal Boletín Oficial del Estado
            </Link>
            {copy.footer.basedOnSuffix}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link
              href="/due-diligence"
              variant="caption"
              sx={{ fontSize: '0.65rem', color: 'warning.light', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              {copy.footer.ddReports}
            </Link>
            <Link
              href="/dashboard"
              variant="caption"
              sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              {copy.footer.dashboard}
            </Link>
            <Link
              href="/about.html"
              target="_blank"
              rel="noopener"
              variant="caption"
              sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              {copy.footer.about}
            </Link>
            <Link
              href="https://github.com/anbrme/borme-public-api"
              target="_blank"
              rel="noopener"
              variant="caption"
              sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              {copy.footer.apiDocs}
            </Link>
            <Link
              href="https://ncdata.eu"
              target="_blank"
              rel="noopener"
              variant="caption"
              sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              {copy.footer.ncdata}
            </Link>
            <Link
              href="/privacy.html"
              target="_blank"
              rel="noopener"
              variant="caption"
              sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              {copy.footer.privacy}
            </Link>
            <Link
              href="/terms.html"
              target="_blank"
              rel="noopener"
              variant="caption"
              sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              {copy.footer.terms}
            </Link>
          </Box>
        </Box>
      </Box>
    </>
  );
}
