import React, { lazy, Suspense, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Link,
  Paper,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import SecurityIcon from '@mui/icons-material/Security';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import HistoryIcon from '@mui/icons-material/History';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import GavelIcon from '@mui/icons-material/Gavel';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import HubIcon from '@mui/icons-material/Hub';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
const SampleReportViewer = lazy(() => import('./SampleReportViewer'));
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import LegalDisclaimer from './LegalDisclaimer';
import DDCheckoutDialog from './DDCheckoutDialog';
import { normalizeLanguage, getStoredSearchLanguage, getBrowserLanguage } from '../utils/language';
import { siteNav } from '../utils/siteNav';

const SITE_URL = 'https://mapasocietario.es';

// Icons paired by index with COPY.features / COPY.ladder.items.
const FEATURE_ICONS = [
  <AccountTreeIcon />, <HistoryIcon />, <SecurityIcon />, <WarningAmberIcon />, <GavelIcon />, <DescriptionIcon />,
];
const LADDER_ICONS = [<DescriptionIcon />, <HubIcon />, <BusinessCenterIcon />, <AccountBalanceIcon />];

const COPY = {
  en: {
    meta: {
      title: 'Spanish Company Due Diligence Reports | Mapa Societario',
      description:
        'Spanish company due diligence reports with BORME registry data, officer history, corporate relationship graphs, BOE sanctions checks, risk analysis, and PDF delivery from EUR 22.50.',
      ogDescription:
        'Spanish company due diligence with BORME registry data, sanctions checks, risk analysis, officer history, and PDF delivery. From EUR 22.50.',
    },
    banner: {
      eyebrow: 'Due Diligence report',
      desc: 'Comprehensive PDF with AI analysis, sanctions screening, red flags and full corporate history — EUR 22.50, no account needed.',
      getReport: 'Get the report · EUR 22.50',
      exploreFree: 'Explore the free graph',
      sample: 'See a sample report (PDF)',
    },
    heroTitle: 'Spanish Company Due Diligence Reports',
    heroSub:
      'AI-powered corporate intelligence for Spanish companies. Get a comprehensive PDF report with sanctions screening, risk analysis, and full corporate history — based on official BORME data.',
    chips: {
      from: 'From EUR 22.50',
      instant: 'Instant delivery',
      noAccount: 'No account needed',
      monitoring: '+ Free monitoring',
      sample: 'See a sample report (PDF)',
    },
    ctaSearch: 'Search a company to get started',
    includedHeading: "What's included",
    features: [
      { title: 'Corporate Structure', desc: 'Full mapping of officers, shareholders, and subsidiaries extracted from official BORME filings.' },
      { title: 'Officer History', desc: 'Complete timeline of appointments, resignations, and role changes for every director and administrator.' },
      { title: 'Sanctions Screening', desc: 'Automated cross-check against international sanctions lists and PEP databases.' },
      { title: 'Red Flags & Risk Score', desc: 'AI-powered analysis highlighting unusual patterns, frequent changes, and potential compliance risks.' },
      { title: 'Capital Events', desc: 'Track capital increases, reductions, mergers, and other corporate actions over time.' },
      { title: 'PDF Report', desc: 'Professional, downloadable PDF ready for compliance files, investor reviews, or internal records.' },
    ],
    monitoring: {
      title: 'Free monitoring included',
      body: 'Every Due Diligence report includes free monitoring of the company. You will receive email alerts when new BORME filings are published (appointments, resignations, capital changes, dissolutions) or when an international regulator issues a warning through IOSCO.',
      chips: ['BORME alerts', 'IOSCO alerts (90+ regulators)', 'Automatic email'],
    },
    fs: {
      title: 'Financial Statements (Cuentas Anuales)',
      body: 'Add official financial statements from the Registro Mercantil to your Due Diligence report. Includes the original PDF plus an AI-powered financial analysis with key ratios, revenue trends, and red flags — extracted via OCR and LLM.',
      chips: ['Official Registro Mercantil document', 'AI financial analysis', '30-45 minutes delivery', '+EUR 17.50 per company'],
    },
    serviceBy: {
      label: 'Service provided by',
      tagline: 'Corporate intelligence & business research consultancy, operating since 2013.',
      nif: 'NIF B86829538 · Madrid, Spain',
      bodyPre: 'Mapa Societario is our dedicated Spanish corporate research product. For multi-jurisdiction investigations covering the UK, France, Switzerland and Italy, we also operate ',
      bodyMid: ', a full-fledged investigation platform for professional users with one-of-a-kind tools such as ',
      docStudio: 'Document Studio',
      bodyPost: ' for fine-tuned AI analysis of complex documents.',
    },
    ladder: {
      heading: 'Choose the right level of work',
      items: [
        { title: 'Self-serve report', text: 'Instant Spanish company due diligence PDF with graph context, BORME history, BOE sanctions checks, and monitoring.', action: 'Start with search' },
        { title: 'NC Data API', text: 'Spanish registry intelligence for third-party platforms, compliance products, and data integrations through NC Data.', action: 'Discuss API access' },
        { title: 'Human-led investigation', text: 'For higher-stakes cases, Nurnberg Consulting adds analyst work, source retrieval, document review, and bespoke conclusions.', action: 'Visit Nurnberg Consulting' },
        { title: 'Multi-country platform', text: 'NC Data supports broader investigations beyond Spain, including other European jurisdictions and advanced document workflows.', action: 'Visit NC Data' },
      ],
    },
    howItWorks: {
      heading: 'How it works',
      steps: [
        'Search for a company on the home page',
        'Click the "Due Diligence" button in the toolbar',
        'Choose your options and complete payment via Stripe',
        'Your PDF report is generated and downloaded automatically',
      ],
    },
    sampleAccordion: 'See a sample Due Diligence report',
    commitment: {
      label: 'Our commitment to you',
      realPeopleStrong: 'Real people behind the product.',
      realPeopleText: 'Email',
      realPeopleText2: 'with any question — we usually reply within a few hours on business days.',
      qualityStrong: 'Data quality guarantee.',
      qualityText: "If your report contains data quality issues, email us within 7 days and we'll re-issue it at no cost or refund the purchase.",
      redownloadStrong: 'Re-download for 7 days.',
      redownloadText: 'Save your order link to come back and download your report again at any time within the first week.',
      privacyStrong: 'Privacy by default.',
      privacyText: 'Your email is used only to deliver the report and, if you opt in, BORME alerts. We never resell or share it. See our',
      privacyPolicy: 'privacy policy',
    },
    trust: {
      sourcedPre: 'Data sourced from official BORME (Registro Mercantil) filings. Payments securely processed by ',
      sourcedPost: '. Reports available for re-download for 7 days after purchase.',
      invoicedPre: 'Service provided and invoiced by ',
      invoicedPost: ' · Madrid, Spain · Operating since 2013',
    },
    footer: { home: 'Home', about: 'About', terms: 'Terms', privacy: 'Privacy', contact: 'Contact' },
  },

  es: {
    meta: {
      title: 'Informes due diligence de empresas españolas | Mapa Societario',
      description:
        'Informes due diligence de empresas españolas con datos del BORME, historial de administradores, grafos de relaciones societarias, comprobación de sanciones del BOE, análisis de riesgo y entrega en PDF desde 22,50 €.',
      ogDescription:
        'Due diligence de empresas españolas con datos del BORME, comprobación de sanciones, análisis de riesgo, historial de administradores y entrega en PDF. Desde 22,50 €.',
    },
    banner: {
      eyebrow: 'Informe due diligence',
      desc: 'PDF completo con análisis por IA, comprobación de sanciones, señales de alerta e historial societario completo: 22,50 €, sin necesidad de cuenta.',
      getReport: 'Conseguir el informe · 22,50 €',
      exploreFree: 'Explorar el grafo gratis',
      sample: 'Ver un informe de ejemplo (PDF)',
    },
    heroTitle: 'Informes due diligence de empresas españolas',
    heroSub:
      'Inteligencia corporativa por IA para empresas españolas. Obtén un PDF completo con comprobación de sanciones, análisis de riesgo e historial societario completo, basado en datos oficiales del BORME.',
    chips: {
      from: 'Desde 22,50 €',
      instant: 'Entrega instantánea',
      noAccount: 'Sin necesidad de cuenta',
      monitoring: '+ Monitorización gratis',
      sample: 'Ver un informe de ejemplo (PDF)',
    },
    ctaSearch: 'Busca una empresa para empezar',
    includedHeading: 'Qué incluye',
    features: [
      { title: 'Estructura societaria', desc: 'Mapeo completo de administradores, socios y filiales extraído de publicaciones oficiales del BORME.' },
      { title: 'Historial de administradores', desc: 'Cronología completa de nombramientos, ceses y cambios de cargo de cada administrador.' },
      { title: 'Comprobación de sanciones', desc: 'Cruce automático con listas internacionales de sanciones y bases de datos de PEP.' },
      { title: 'Señales de alerta y riesgo', desc: 'Análisis por IA que destaca patrones inusuales, cambios frecuentes y posibles riesgos de compliance.' },
      { title: 'Eventos de capital', desc: 'Sigue ampliaciones y reducciones de capital, fusiones y otros actos societarios a lo largo del tiempo.' },
      { title: 'Informe en PDF', desc: 'PDF profesional y descargable, listo para expedientes de compliance, revisiones de inversores o archivo interno.' },
    ],
    monitoring: {
      title: 'Monitorización gratuita incluida',
      body: 'Cada informe due diligence incluye monitorización gratuita de la empresa. Recibirás alertas por correo cuando se publiquen nuevas inscripciones en el BORME (nombramientos, ceses, cambios de capital, disoluciones) o cuando un regulador internacional emita una advertencia a través de IOSCO.',
      chips: ['Alertas BORME', 'Alertas IOSCO (90+ reguladores)', 'Correo automático'],
    },
    fs: {
      title: 'Cuentas anuales',
      body: 'Añade las cuentas anuales oficiales del Registro Mercantil a tu informe due diligence. Incluye el PDF original más un análisis financiero por IA con ratios clave, evolución de ingresos y señales de alerta, extraído mediante OCR y LLM.',
      chips: ['Documento oficial del Registro Mercantil', 'Análisis financiero por IA', 'Entrega en 30-45 minutos', '+17,50 € por empresa'],
    },
    serviceBy: {
      label: 'Servicio prestado por',
      tagline: 'Consultora de inteligencia corporativa e investigación empresarial, en activo desde 2013.',
      nif: 'NIF B86829538 · Madrid, España',
      bodyPre: 'Mapa Societario es nuestro producto dedicado a la investigación societaria en España. Para investigaciones multijurisdiccionales que cubren Reino Unido, Francia, Suiza e Italia, operamos también ',
      bodyMid: ', una plataforma de investigación completa para usuarios profesionales con herramientas únicas como ',
      docStudio: 'Document Studio',
      bodyPost: ' para el análisis por IA ajustado de documentos complejos.',
    },
    ladder: {
      heading: 'Elige el nivel de trabajo adecuado',
      items: [
        { title: 'Informe autoservicio', text: 'PDF de due diligence de empresa española al instante, con contexto del grafo, historial BORME, comprobación de sanciones del BOE y monitorización.', action: 'Empezar con la búsqueda' },
        { title: 'API NC Data', text: 'Inteligencia del registro español para plataformas de terceros, productos de compliance e integraciones de datos a través de NC Data.', action: 'Consultar acceso a la API' },
        { title: 'Investigación con analistas', text: 'Para casos de mayor exigencia, Nurnberg Consulting añade trabajo de analista, obtención de fuentes, revisión documental y conclusiones a medida.', action: 'Visitar Nurnberg Consulting' },
        { title: 'Plataforma multipaís', text: 'NC Data permite investigaciones más amplias más allá de España, incluidas otras jurisdicciones europeas y flujos documentales avanzados.', action: 'Visitar NC Data' },
      ],
    },
    howItWorks: {
      heading: 'Cómo funciona',
      steps: [
        'Busca una empresa en la página de inicio',
        'Pulsa el botón "Due Diligence" en la barra de herramientas',
        'Elige tus opciones y completa el pago con Stripe',
        'Tu informe en PDF se genera y se descarga automáticamente',
      ],
    },
    sampleAccordion: 'Ver un informe due diligence de ejemplo',
    commitment: {
      label: 'Nuestro compromiso contigo',
      realPeopleStrong: 'Personas reales detrás del producto.',
      realPeopleText: 'Escribe a',
      realPeopleText2: 'con cualquier duda; solemos responder en pocas horas en días laborables.',
      qualityStrong: 'Garantía de calidad de datos.',
      qualityText: 'Si tu informe contiene problemas de calidad de datos, escríbenos en 7 días y lo reemitimos sin coste o te devolvemos el importe.',
      redownloadStrong: 'Redescarga durante 7 días.',
      redownloadText: 'Guarda el enlace de tu pedido para volver y descargar tu informe de nuevo en cualquier momento durante la primera semana.',
      privacyStrong: 'Privacidad por defecto.',
      privacyText: 'Tu correo se usa solo para entregar el informe y, si lo aceptas, las alertas BORME. Nunca lo revendemos ni compartimos. Consulta nuestra',
      privacyPolicy: 'política de privacidad',
    },
    trust: {
      sourcedPre: 'Datos procedentes de publicaciones oficiales del BORME (Registro Mercantil). Pagos procesados de forma segura por ',
      sourcedPost: '. Los informes pueden volver a descargarse durante 7 días tras la compra.',
      invoicedPre: 'Servicio prestado y facturado por ',
      invoicedPost: ' · Madrid, España · En activo desde 2013',
    },
    footer: { home: 'Inicio', about: 'Acerca de', terms: 'Términos', privacy: 'Privacidad', contact: 'Contacto' },
  },
};

export default function DueDiligencePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lang =
    normalizeLanguage(searchParams.get('lang')) || getStoredSearchLanguage() || getBrowserLanguage() || 'en';
  const t = COPY[lang] || COPY.en;
  const nav = siteNav(lang);
  const canonical = lang === 'es' ? `${SITE_URL}/due-diligence?lang=es` : `${SITE_URL}/due-diligence`;
  const appHref = lang === 'es' ? '/app?lang=es' : '/app';

  // When arriving from the hero search box or an /empresa SEO page, the target
  // company is passed as ?company=. We show a company-scoped buy banner and let
  // the visitor open checkout on click (never auto-open — that reads as a trap).
  const company = (searchParams.get('company') || '').trim();
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const ladderLinks = [
    appHref,
    'mailto:app@ncdata.eu?subject=NC%20Data%20Spanish%20API',
    'https://nurnbergconsulting.com',
    'https://ncdata.eu',
  ];
  const ladderExternal = [false, false, true, true];

  return (
    <>
      <Helmet htmlAttributes={{ lang }}>
        <title>{t.meta.title}</title>
        <meta name="description" content={t.meta.description} />
        <link rel="canonical" href={canonical} />
        <link rel="alternate" hrefLang="en" href={`${SITE_URL}/due-diligence`} />
        <link rel="alternate" hrefLang="es" href={`${SITE_URL}/due-diligence?lang=es`} />
        <link rel="alternate" hrefLang="x-default" href={`${SITE_URL}/due-diligence`} />
        <meta property="og:title" content={t.meta.title} />
        <meta property="og:description" content={t.meta.ogDescription} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="product" />
      </Helmet>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minHeight: '100vh',
          px: 2,
          py: 4,
          maxWidth: 720,
          mx: 'auto',
          gap: 4,
        }}
      >
        <Box sx={{ width: '100%', textAlign: 'left' }}>
          <Link href={nav.home} sx={{ color: 'text.secondary', fontSize: '0.85rem', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
            &larr; Mapa Societario
          </Link>
        </Box>
        {/* Company-scoped buy banner — shown when a visitor arrives from the
            hero search box or an /empresa SEO page via ?company=. */}
        {company && (
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              p: { xs: 2.5, sm: 3 },
              bgcolor: 'rgba(255,167,38,0.06)',
              border: '1px solid rgba(255,167,38,0.3)',
              borderRadius: 2,
              textAlign: 'center',
            }}
          >
            <Typography variant="overline" sx={{ display: 'block', color: 'warning.light', fontWeight: 700, letterSpacing: '0.12em', fontSize: '0.65rem' }}>
              {t.banner.eyebrow}
            </Typography>
            <Typography variant="h5" component="p" sx={{ fontWeight: 700, mb: 1 }}>
              {company}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, maxWidth: 520, mx: 'auto', lineHeight: 1.6 }}>
              {t.banner.desc}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<DescriptionIcon />}
                onClick={() => setCheckoutOpen(true)}
                sx={{ textTransform: 'none', fontWeight: 700, px: 3, borderRadius: 2, bgcolor: 'warning.main', color: '#000', '&:hover': { bgcolor: 'warning.dark' } }}
              >
                {t.banner.getReport}
              </Button>
              <Button
                variant="outlined"
                startIcon={<AccountTreeIcon />}
                onClick={() => navigate(`/app?search=${encodeURIComponent(company)}${lang === 'es' ? '&lang=es' : ''}`)}
                sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
              >
                {t.banner.exploreFree}
              </Button>
            </Box>
            <Box sx={{ mt: 1.5 }}>
              <Link href="/sample-dd-report.pdf" target="_blank" rel="noopener" sx={{ fontSize: '0.8rem', color: 'warning.light', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                {t.banner.sample}
              </Link>
            </Box>
          </Paper>
        )}

        {/* Hero */}
        <Box sx={{ textAlign: 'center' }}>
          <DescriptionIcon sx={{ fontSize: 48, color: 'warning.main', mb: 1, opacity: 0.8 }} />
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            {t.heroTitle}
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 520, mx: 'auto', lineHeight: 1.6 }}>
            {t.heroSub}
          </Typography>
          <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Chip label={t.chips.from} color="warning" size="small" sx={{ fontWeight: 600 }} />
            <Chip label={t.chips.instant} variant="outlined" size="small" />
            <Chip label={t.chips.noAccount} variant="outlined" size="small" />
            <Chip label={t.chips.monitoring} size="small" sx={{ fontWeight: 600, bgcolor: 'rgba(22,163,74,0.15)', color: '#16a34a' }} />
            <Chip
              label={t.chips.sample}
              size="small"
              component="a"
              href="/sample-dd-report.pdf"
              target="_blank"
              rel="noopener"
              clickable
              icon={<DescriptionIcon sx={{ fontSize: 16, color: 'warning.light' }} />}
              variant="outlined"
              sx={{ fontWeight: 600, color: 'warning.light', borderColor: 'rgba(255,167,38,0.5)' }}
            />
          </Box>
        </Box>

        {/* CTA */}
        <Button
          variant="contained"
          size="large"
          startIcon={<SearchIcon />}
          onClick={() => navigate(appHref)}
          sx={{ textTransform: 'none', fontWeight: 600, px: 4, py: 1.5, fontSize: '1rem', borderRadius: 3, bgcolor: 'warning.main', color: '#000', '&:hover': { bgcolor: 'warning.dark' } }}
        >
          {t.ctaSearch}
        </Button>

        {/* Features grid */}
        <Box component="section" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, width: '100%' }}>
          <Typography variant="h6" component="h2" sx={{ gridColumn: '1 / -1', fontWeight: 600, mb: 0.5 }}>
            {t.includedHeading}
          </Typography>
          {t.features.map((f, i) => (
            <Paper key={f.title} elevation={0} sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                <Box sx={{ color: 'warning.main', mt: 0.25 }}>{FEATURE_ICONS[i]}</Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25 }}>{f.title}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>{f.desc}</Typography>
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>

        {/* Free monitoring included */}
        <Paper elevation={0} sx={{ width: '100%', p: 3, bgcolor: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <NotificationsActiveIcon sx={{ color: '#16a34a', mt: 0.25, fontSize: 28 }} />
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 700, mb: 0.5 }}>{t.monitoring.title}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, mb: 1.5 }}>{t.monitoring.body}</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {t.monitoring.chips.map((c) => (
                  <Chip key={c} label={c} variant="outlined" size="small" sx={{ fontSize: '0.7rem', borderColor: 'rgba(22,163,74,0.3)', color: '#16a34a' }} />
                ))}
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* Financial Statements add-on */}
        <Paper elevation={0} sx={{ width: '100%', p: 3, bgcolor: 'rgba(25,118,210,0.04)', border: '1px solid rgba(25,118,210,0.15)', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mb: 1.5 }}>
            <AccountBalanceIcon sx={{ color: 'primary.main', mt: 0.25, fontSize: 28 }} />
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 700, mb: 0.5 }}>{t.fs.title}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, mb: 1.5 }}>{t.fs.body}</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {t.fs.chips.map((c, i) => (
                  <Chip key={c} label={c} variant="outlined" size="small" sx={{ fontSize: '0.7rem', ...(i === t.fs.chips.length - 1 ? { fontWeight: 600 } : {}) }} />
                ))}
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* Service provided by (trust / ownership) */}
        <Paper elevation={0} sx={{ width: '100%', p: 3, bgcolor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 }}>
          <Typography variant="overline" sx={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', color: 'primary.light', mb: 1 }}>
            {t.serviceBy.label}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <Box sx={{ width: 48, height: 48, borderRadius: 1.5, bgcolor: 'rgba(25,118,210,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'primary.main', flexShrink: 0 }}>
              <BusinessCenterIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.25 }}>Nurnberg Consulting SL</Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 0.75, lineHeight: 1.5, fontFamily: 'monospace', fontSize: '0.7rem' }}>
                {t.serviceBy.nif}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1, lineHeight: 1.5 }}>
                {t.serviceBy.tagline}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.5 }}>
                {t.serviceBy.bodyPre}
                <Link href="https://ncdata.eu" target="_blank" rel="noopener" sx={{ color: 'primary.light', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                  NC Data
                </Link>
                {t.serviceBy.bodyMid}<strong>{t.serviceBy.docStudio}</strong>{t.serviceBy.bodyPost}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mt: 1.5, flexWrap: 'wrap' }}>
                <Link href="https://nurnbergconsulting.com" target="_blank" rel="noopener" sx={{ fontSize: '0.72rem', color: 'primary.light', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 0.5, '&:hover': { textDecoration: 'underline' } }}>
                  <BusinessCenterIcon sx={{ fontSize: 13 }} /> nurnbergconsulting.com
                </Link>
                <Link href="https://ncdata.eu" target="_blank" rel="noopener" sx={{ fontSize: '0.72rem', color: 'primary.light', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 0.5, '&:hover': { textDecoration: 'underline' } }}>
                  <HubIcon sx={{ fontSize: 13 }} /> ncdata.eu
                </Link>
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* Product ladder */}
        <Box component="section" sx={{ width: '100%' }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600, mb: 1.5 }}>
            {t.ladder.heading}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            {t.ladder.items.map((item, i) => (
              <Paper key={item.title} elevation={0} sx={{ p: 2.5, bgcolor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                  <Box sx={{ color: 'primary.light', mt: 0.25 }}>{LADDER_ICONS[i]}</Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>{item.title}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.6, mb: 1.25 }}>{item.text}</Typography>
                    <Link
                      href={ladderLinks[i]}
                      target={ladderExternal[i] ? '_blank' : undefined}
                      rel={ladderExternal[i] ? 'noopener' : undefined}
                      variant="caption"
                      sx={{ color: 'primary.light', fontWeight: 700, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                    >
                      {item.action}
                    </Link>
                  </Box>
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>

        {/* How it works */}
        <Box component="section" sx={{ width: '100%' }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600, mb: 1.5 }}>
            {t.howItWorks.heading}
          </Typography>
          {t.howItWorks.steps.map((text, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'center' }}>
              <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'rgba(255,167,38,0.15)', color: 'warning.main', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                {i + 1}
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>{text}</Typography>
            </Box>
          ))}
        </Box>

        {/* Sample report preview */}
        <Accordion disableGutters elevation={0} sx={{ width: '100%', bgcolor: 'rgba(255, 167, 38, 0.04)', border: '1px solid rgba(255, 167, 38, 0.2)', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'warning.main', fontSize: 18 }} />} sx={{ minHeight: 44, '& .MuiAccordionSummary-content': { my: 0.75 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DescriptionIcon sx={{ fontSize: 18, color: 'warning.main' }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'warning.light' }}>{t.sampleAccordion}</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
            <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>}>
              <SampleReportViewer />
            </Suspense>
          </AccordionDetails>
        </Accordion>

        {/* Our commitment */}
        <Paper elevation={0} sx={{ width: '100%', p: 3, bgcolor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 }}>
          <Typography variant="overline" sx={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', color: 'primary.light', mb: 1 }}>
            {t.commitment.label}
          </Typography>
          <Box component="ul" sx={{ pl: 2.5, my: 0, '& li': { mb: 0.75 } }}>
            <Typography component="li" variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.6, display: 'list-item' }}>
              <strong>{t.commitment.realPeopleStrong}</strong> {t.commitment.realPeopleText}{' '}
              <Link href="mailto:app@ncdata.eu" sx={{ color: 'primary.light', fontWeight: 600 }}>app@ncdata.eu</Link>
              {' '}{t.commitment.realPeopleText2}
            </Typography>
            <Typography component="li" variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.6, display: 'list-item' }}>
              <strong>{t.commitment.qualityStrong}</strong> {t.commitment.qualityText}
            </Typography>
            <Typography component="li" variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.6, display: 'list-item' }}>
              <strong>{t.commitment.redownloadStrong}</strong> {t.commitment.redownloadText}
            </Typography>
            <Typography component="li" variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.6, display: 'list-item' }}>
              <strong>{t.commitment.privacyStrong}</strong> {t.commitment.privacyText}{' '}
              <Link href={nav.privacy} sx={{ color: 'primary.light' }}>{t.commitment.privacyPolicy}</Link>.
            </Typography>
          </Box>
        </Paper>

        {/* Trust signals */}
        <Box component="section" sx={{ width: '100%', textAlign: 'center', py: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <LegalDisclaimer dense language={lang} sx={{ mb: 2, textAlign: 'left' }} />
          <Typography variant="caption" sx={{ color: 'text.disabled', lineHeight: 1.6, display: 'block' }}>
            {t.trust.sourcedPre}
            <Link href="https://stripe.com" target="_blank" rel="noopener" sx={{ color: 'text.secondary' }}>Stripe</Link>
            {t.trust.sourcedPost}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', lineHeight: 1.6, display: 'block', mt: 0.5 }}>
            {t.trust.invoicedPre}
            <Link href="https://nurnbergconsulting.com" target="_blank" rel="noopener" sx={{ color: 'text.secondary', fontWeight: 600 }}>Nurnberg Consulting SL</Link>
            {t.trust.invoicedPost}
          </Typography>
        </Box>

        {/* Footer nav */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href={nav.home} variant="caption" sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>{t.footer.home}</Link>
          <Link href={nav.about} variant="caption" sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>{t.footer.about}</Link>
          <Link href={nav.terms} variant="caption" sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>{t.footer.terms}</Link>
          <Link href={nav.privacy} variant="caption" sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>{t.footer.privacy}</Link>
          <Link href="mailto:app@ncdata.eu" variant="caption" sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>{t.footer.contact}</Link>
        </Box>

        <DDCheckoutDialog
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          companyName={company}
          country="es"
          language={lang}
        />
      </Box>
    </>
  );
}
