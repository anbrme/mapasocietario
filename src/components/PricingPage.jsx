import React from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  Link,
  Paper,
  Typography,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import SearchIcon from '@mui/icons-material/Search';
import AssessmentIcon from '@mui/icons-material/Assessment';
import GroupsIcon from '@mui/icons-material/Groups';
import VerifiedIcon from '@mui/icons-material/Verified';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LegalDisclaimer from './LegalDisclaimer';
import { isAndroidNativeApp } from '../services/playBillingService';
import { normalizeLanguage, getStoredSearchLanguage, getBrowserLanguage } from '../utils/language';
import { siteNav } from '../utils/siteNav';

const SITE_URL = 'https://mapasocietario.es';

const COPY = {
  en: {
    title: 'Pricing | Mapa Societario',
    description:
      'Mapa Societario pricing: Spanish company due diligence reports from EUR 22.50, with an optional financial statements add-on. No subscription, no account required. Volume pricing for law firms and consultancies.',
    ogDescription:
      'Spanish company due diligence reports from EUR 22.50, optional financial statements add-on, no subscription. Volume pricing for professionals.',
    brand: 'Mapa Societario',
    h1: 'Pricing',
    intro:
      'Explore the corporate relationship graph for free. Pay only when you need a documented report. No subscription, no account required — one-off purchases per company.',
    chips: ['Pay per company', 'No subscription', 'No account required', 'Free graph exploration'],
    oneOff: 'One-off reports',
    lineItems: [
      {
        label: 'Company due diligence report',
        sub: 'AI analysis, corporate structure, full officer history, capital events, BOE sanctions checks, red flags. Delivered as a PDF.',
        price: '€22.50',
      },
      {
        label: 'Financial statements add-on (optional)',
        sub: 'Optional. If selected, the report gains a dedicated financial analysis section: the official Cuentas Anuales from the Registro Mercantil plus an accurate AI analysis.',
        price: '+€17.50',
      },
    ],
    bundleLabel: 'Full report with financial statements',
    bundleSub: 'Report plus the Cuentas Anuales add-on.',
    bundlePrice: '€40.00',
    taxNote:
      'Prices exclude VAT. On the web, taxes are calculated by Stripe at checkout. In the Android app, Google Play is the merchant of record and adds VAT per country, so the final price shown there may differ.',
    searchCta: 'Search a company',
    reportCta: 'What is in a report',
    sampleCta: 'See a sample report',
    moneyBack: 'Money-back if the data is wrong or inaccurate',
    volumeHeading: 'Checking several companies?',
    volumeBody:
      'Law firms, consultancies, and compliance teams running repeat checks can get volume pricing. Tell us roughly how many reports you expect and we will set up the right arrangement.',
    volumeCta: 'Get volume pricing',
    volumeSubject: 'Volume pricing — Mapa Societario reports',
    operatedBy: 'Mapa Societario is operated by Nurnberg Consulting SL, a Madrid-based corporate intelligence consultancy active since 2013. See',
    aboutLabel: 'About',
    termsLabel: 'Terms',
    privacyLabel: 'Privacy',
  },
  es: {
    title: 'Precios | Mapa Societario',
    description:
      'Precios de Mapa Societario: informes due diligence de empresas españolas desde 22,50 €, con un complemento opcional de cuentas anuales. Sin suscripción ni cuenta. Precios por volumen para despachos y consultoras.',
    ogDescription:
      'Informes due diligence de empresas españolas desde 22,50 €, complemento opcional de cuentas anuales, sin suscripción. Precios por volumen para profesionales.',
    brand: 'Mapa Societario',
    h1: 'Precios',
    intro:
      'Explora el grafo de relaciones societarias gratis. Paga solo cuando necesites un informe documentado. Sin suscripción y sin cuenta: compras sueltas por empresa.',
    chips: ['Pago por empresa', 'Sin suscripción', 'Sin necesidad de cuenta', 'Exploración del grafo gratuita'],
    oneOff: 'Informes sueltos',
    lineItems: [
      {
        label: 'Informe due diligence de empresa',
        sub: 'Análisis por IA, estructura societaria, historial completo de administradores, eventos de capital, comprobación de sanciones del BOE y señales de alerta. Entregado en PDF.',
        price: '22,50 €',
      },
      {
        label: 'Complemento de cuentas anuales (opcional)',
        sub: 'Opcional. Si se selecciona, el informe gana una sección de análisis financiero: las cuentas anuales oficiales del Registro Mercantil más un análisis por IA preciso.',
        price: '+17,50 €',
      },
    ],
    bundleLabel: 'Informe completo con cuentas anuales',
    bundleSub: 'Informe más el complemento de cuentas anuales.',
    bundlePrice: '40,00 €',
    taxNote:
      'Precios sin IVA. En la web, los impuestos los calcula Stripe al pagar. En la app de Android, Google Play es el vendedor registrado y añade el IVA por país, por lo que el precio final mostrado allí puede diferir.',
    searchCta: 'Buscar una empresa',
    reportCta: 'Qué incluye un informe',
    sampleCta: 'Ver un informe de ejemplo',
    moneyBack: 'Devolución del importe si los datos son erróneos o inexactos',
    volumeHeading: '¿Vas a consultar varias empresas?',
    volumeBody:
      'Los despachos, consultoras y equipos de compliance con comprobaciones recurrentes pueden obtener precios por volumen. Dinos cuántos informes prevés y preparamos el acuerdo adecuado.',
    volumeCta: 'Solicitar precios por volumen',
    volumeSubject: 'Precios por volumen — informes Mapa Societario',
    operatedBy: 'Mapa Societario está operado por Nurnberg Consulting SL, una consultora de inteligencia corporativa con sede en Madrid y activa desde 2013. Consulta',
    aboutLabel: 'Acerca de',
    termsLabel: 'Términos',
    privacyLabel: 'Privacidad',
  },
};

export default function PricingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lang =
    normalizeLanguage(searchParams.get('lang')) || getStoredSearchLanguage() || getBrowserLanguage() || 'en';
  const t = COPY[lang] || COPY.en;
  const nav = siteNav(lang);
  const canonical = lang === 'es' ? `${SITE_URL}/pricing?lang=es` : `${SITE_URL}/pricing`;
  // Keep the current language when entering the graph.
  const appHref = lang === 'es' ? '/app?lang=es' : '/app';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0e1a', px: { xs: 2.25, sm: 4 }, py: { xs: 4, sm: 6 } }}>
      <Helmet htmlAttributes={{ lang }}>
        <title>{t.title}</title>
        <meta name="description" content={t.description} />
        <link rel="canonical" href={canonical} />
        <link rel="alternate" hrefLang="en" href={`${SITE_URL}/pricing`} />
        <link rel="alternate" hrefLang="es" href={`${SITE_URL}/pricing?lang=es`} />
        <link rel="alternate" hrefLang="x-default" href={`${SITE_URL}/pricing`} />
        <meta property="og:title" content={t.title} />
        <meta property="og:description" content={t.ogDescription} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="website" />
      </Helmet>

      <Box sx={{ maxWidth: 940, mx: 'auto' }}>
        <Box component="header" sx={{ mb: 5 }}>
          <Link href={nav.home} sx={{ color: 'text.secondary', fontSize: '0.85rem', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
            {t.brand}
          </Link>
          <Typography
            variant="h3"
            component="h1"
            sx={{ fontWeight: 800, letterSpacing: 0, lineHeight: 1.12, fontSize: { xs: '2rem', sm: '2.8rem' }, mt: 4, mb: 2 }}
          >
            {t.h1}
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 740, lineHeight: 1.7, mb: 3 }}>
            {t.intro}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
            {t.chips.map((chip) => (
              <Chip key={chip} label={chip} size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.18)' }} />
            ))}
          </Box>
        </Box>

        <Box component="main" sx={{ display: 'grid', gap: 4 }}>
          {/* One-off pricing card */}
          <Paper
            component="section"
            elevation={0}
            sx={{ p: { xs: 2.5, sm: 4 }, bgcolor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}
          >
            <Typography variant="overline" sx={{ color: 'primary.light', fontWeight: 700, letterSpacing: '0.12em' }}>
              {t.oneOff}
            </Typography>

            <Box sx={{ display: 'grid', gap: 2.5, mt: 2 }}>
              {t.lineItems.map((item) => (
                <Box key={item.label} sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>{item.label}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>{item.sub}</Typography>
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{item.price}</Typography>
                </Box>
              ))}
            </Box>

            <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />

            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body1" sx={{ fontWeight: 800 }}>{t.bundleLabel}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t.bundleSub}</Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: 'warning.light', whiteSpace: 'nowrap' }}>{t.bundlePrice}</Typography>
            </Box>

            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 3, lineHeight: 1.6 }}>
              {t.taxNote}
            </Typography>

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 3 }}>
              <Button variant="contained" startIcon={<SearchIcon />} onClick={() => navigate(appHref)} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
                {t.searchCta}
              </Button>
              <Button variant="outlined" startIcon={<DescriptionIcon />} onClick={() => navigate(nav.reports)} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: 'warning.light', borderColor: 'rgba(255,167,38,0.45)' }}>
                {t.reportCta}
              </Button>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: { xs: 1.5, sm: 3 }, mt: 2.5 }}>
              <Box
                component="a"
                href="/sample-dd-report.pdf"
                target="_blank"
                rel="noopener"
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, color: 'warning.light', fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                <DescriptionIcon sx={{ fontSize: 17 }} />
                {t.sampleCta}
              </Box>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, color: 'text.secondary', fontSize: '0.82rem', fontWeight: 500 }}>
                <VerifiedIcon sx={{ fontSize: 17, color: 'success.light' }} />
                {t.moneyBack}
              </Box>
            </Box>
          </Paper>

          {/* Volume pricing — web only. Hidden in the native Android app to avoid
              steering in-app purchases off Google Play billing (anti-steering policy). */}
          {!isAndroidNativeApp() && (
            <Paper
              component="section"
              elevation={0}
              sx={{ p: { xs: 2.5, sm: 4 }, bgcolor: 'rgba(25,118,210,0.06)', border: '1px solid rgba(25,118,210,0.25)', borderRadius: 3 }}
            >
              <Box sx={{ color: 'primary.light', mb: 1.5, '& .MuiSvgIcon-root': { fontSize: 26 } }}><GroupsIcon /></Box>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 750, mb: 1 }}>
                {t.volumeHeading}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.75, maxWidth: 780, mb: 2.5 }}>
                {t.volumeBody}
              </Typography>
              <Button
                href={`mailto:app@ncdata.eu?subject=${encodeURIComponent(t.volumeSubject)}`}
                variant="contained"
                startIcon={<AssessmentIcon />}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
              >
                {t.volumeCta}
              </Button>
            </Paper>
          )}

          <Box component="section" sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', pt: 4 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, maxWidth: 780 }}>
              {t.operatedBy}{' '}
              <Link href={nav.about} sx={{ color: 'primary.light' }}>{t.aboutLabel}</Link>,{' '}
              <Link href={nav.terms} sx={{ color: 'primary.light' }}>{t.termsLabel}</Link>,{' '}
              <Link href={nav.privacy} sx={{ color: 'primary.light' }}>{t.privacyLabel}</Link>.
            </Typography>
          </Box>

          <LegalDisclaimer dense language={lang} />
        </Box>
      </Box>
    </Box>
  );
}
