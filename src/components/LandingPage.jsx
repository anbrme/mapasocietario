import React from 'react';
import { Box, Typography, Button, Link } from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import SearchIcon from '@mui/icons-material/Search';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import BarChartIcon from '@mui/icons-material/BarChart';
import DescriptionIcon from '@mui/icons-material/Description';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import LegalDisclaimer from './LegalDisclaimer';
import { isNativeApp, openListedCompanies } from '../services/listedCompaniesNav';
import { LANDING_COPY } from './landingCopy';

const SITE_URL = 'https://mapasocietario.es';

// Quiet text-link styling for the secondary homepage actions. The homepage is
// intentionally light: one primary action (search → graph) and a few low-key
// links into the pages that hold the detail (reports, listed companies, stats).
const secondaryLinkSx = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.5,
  cursor: 'pointer',
  fontSize: '0.82rem',
  fontWeight: 600,
  color: 'text.secondary',
  textDecoration: 'none',
  border: 'none',
  background: 'none',
  p: 0,
  '&:hover': { color: 'primary.light', textDecoration: 'underline' },
};

// Deliberately minimal homepage.
//
// The product's real surface is the interactive graph (/app), which already
// hosts the full company/officer search. The homepage's only job is to look
// calm and trustworthy and get the visitor into the graph in one click — all
// the explanatory detail lives on dedicated pages (about.html, /due-diligence,
// /pricing, the /es SEO pages), reachable from the header and footer.
export default function LandingPage({ lang = 'en' }) {
  const copy = LANDING_COPY[lang];
  const navigate = useNavigate();

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
          bgcolor: '#0a0e1a',
        }}
      >
        {/* ---------------------------------------------------------------
            HEADER NAV — the way to the distributed detail pages
        --------------------------------------------------------------- */}
        <Box
          component="nav"
          aria-label="Site"
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

        {/* ---------------------------------------------------------------
            HERO — name, one-line value prop, trust, one primary action
        --------------------------------------------------------------- */}
        <Box
          component="section"
          sx={{
            width: '100%',
            maxWidth: 680,
            mx: 'auto',
            px: { xs: 2.5, sm: 4 },
            py: { xs: 9, sm: 14 },
            textAlign: 'center',
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <AccountTreeIcon
            sx={{
              fontSize: 56,
              color: 'primary.main',
              opacity: 0.7,
              mb: 2.5,
              mx: 'auto',
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
              fontSize: { xs: '1.75rem', sm: '2.5rem', md: '2.85rem' },
              maxWidth: 620,
              mx: 'auto',
            }}
          >
            {copy.hero.h1}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              maxWidth: 520,
              mx: 'auto',
              lineHeight: 1.6,
              fontSize: { xs: '0.92rem', sm: '1.02rem' },
              mb: 4,
            }}
          >
            {copy.hero.subtitle}
          </Typography>

          <Box>
            <Button
              variant="contained"
              size="large"
              startIcon={<SearchIcon />}
              onClick={() => navigate('/app')}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                px: 4.5,
                py: 1.5,
                fontSize: '1.05rem',
                borderRadius: 2,
                bgcolor: 'primary.main',
                '&:hover': { bgcolor: '#1565c0' },
              }}
            >
              {copy.hero.searchCta}
            </Button>
          </Box>

          {/* Quiet links into the distributed detail pages */}
          <Box
            sx={{
              display: 'flex',
              gap: { xs: 1.75, sm: 3 },
              justifyContent: 'center',
              alignItems: 'center',
              flexWrap: 'wrap',
              mt: 3,
            }}
          >
            <Link component="button" type="button" onClick={() => navigate('/due-diligence')} sx={{ ...secondaryLinkSx, color: 'warning.light' }}>
              <DescriptionIcon sx={{ fontSize: 15 }} /> {copy.footer.ddReports}
            </Link>
            {/* Real anchor (full page load) so the Cloudflare Pages Function
                serves /empresas-cotizadas rather than the SPA fallback. In the
                native app there is no server for that route, so we intercept
                and open the live page in an in-app Custom Tab instead. */}
            <Link
              component="a"
              href="/empresas-cotizadas"
              onClick={(e) => {
                if (isNativeApp()) {
                  e.preventDefault();
                  openListedCompanies();
                }
              }}
              sx={secondaryLinkSx}
            >
              <TrendingUpIcon sx={{ fontSize: 15 }} /> {copy.hero.listedCta}
            </Link>
            <Link component="button" type="button" onClick={() => navigate('/dashboard')} sx={secondaryLinkSx}>
              <BarChartIcon sx={{ fontSize: 15 }} /> {copy.hero.statsCta}
            </Link>
          </Box>

          <Typography
            variant="caption"
            sx={{ color: 'text.disabled', display: 'block', maxWidth: 560, mx: 'auto', mt: 4, lineHeight: 1.6 }}
          >
            {copy.hero.operatedBy}
          </Typography>

          <LegalDisclaimer dense language={lang} sx={{ mt: 3, maxWidth: 620, mx: 'auto' }} />
        </Box>

        {/* ---------------------------------------------------------------
            PROOF STRIP — a few quiet trust signals
        --------------------------------------------------------------- */}
        <Box
          sx={{
            width: '100%',
            borderTop: '1px solid rgba(255,255,255,0.06)',
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

        {/* ---------------------------------------------------------------
            FOOTER
        --------------------------------------------------------------- */}
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
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem', lineHeight: 1.5 }}>
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
            <Link href="/due-diligence" variant="caption" sx={{ fontSize: '0.65rem', color: 'warning.light', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.ddReports}
            </Link>
            <Link href="/dashboard" variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.dashboard}
            </Link>
            <Link href="/about.html" target="_blank" rel="noopener" variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.about}
            </Link>
            <Link href="https://github.com/anbrme/borme-public-api" target="_blank" rel="noopener" variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.apiDocs}
            </Link>
            <Link href="https://ncdata.eu" target="_blank" rel="noopener" variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.ncdata}
            </Link>
            <Link href="/privacy.html" target="_blank" rel="noopener" variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.privacy}
            </Link>
            <Link href="/terms.html" target="_blank" rel="noopener" variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {copy.footer.terms}
            </Link>
          </Box>
        </Box>
      </Box>
    </>
  );
}
