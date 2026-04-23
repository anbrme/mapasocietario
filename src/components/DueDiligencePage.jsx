import React, { lazy, Suspense } from 'react';
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
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

const FEATURES = [
  { icon: <AccountTreeIcon />, title: 'Corporate Structure', desc: 'Full mapping of officers, shareholders, and subsidiaries extracted from official BORME filings.' },
  { icon: <HistoryIcon />, title: 'Officer History', desc: 'Complete timeline of appointments, resignations, and role changes for every director and administrator.' },
  { icon: <SecurityIcon />, title: 'Sanctions Screening', desc: 'Automated cross-check against international sanctions lists and PEP databases.' },
  { icon: <WarningAmberIcon />, title: 'Red Flags & Risk Score', desc: 'AI-powered analysis highlighting unusual patterns, frequent changes, and potential compliance risks.' },
  { icon: <GavelIcon />, title: 'Capital Events', desc: 'Track capital increases, reductions, mergers, and other corporate actions over time.' },
  { icon: <DescriptionIcon />, title: 'PDF Report', desc: 'Professional, downloadable PDF ready for compliance files, investor reviews, or internal records.' },
];

export default function DueDiligencePage() {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Due Diligence Reports | Mapa Societario</title>
        <meta name="description" content="AI-powered due diligence reports for Spanish companies. Sanctions screening, corporate structure, officer history, risk analysis, and more. From EUR 22.50 per company." />
        <link rel="canonical" href="https://mapasocietario.es/due-diligence" />
        <meta property="og:title" content="Due Diligence Reports | Mapa Societario" />
        <meta property="og:description" content="AI-powered due diligence reports for Spanish companies. Sanctions screening, risk analysis, officer history. From EUR 22.50." />
        <meta property="og:url" content="https://mapasocietario.es/due-diligence" />
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
        {/* Hero */}
        <Box sx={{ textAlign: 'center' }}>
          <DescriptionIcon sx={{ fontSize: 48, color: 'warning.main', mb: 1, opacity: 0.8 }} />
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            Due Diligence Reports
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 520, mx: 'auto', lineHeight: 1.6 }}>
            AI-powered corporate intelligence for Spanish companies. Get a comprehensive PDF report with sanctions screening, risk analysis, and full corporate history — based on official BORME data.
          </Typography>
          <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Chip label="From EUR 22.50" color="warning" size="small" sx={{ fontWeight: 600 }} />
            <Chip label="Instant delivery" variant="outlined" size="small" />
            <Chip label="No account needed" variant="outlined" size="small" />
            <Chip label="+ Free monitoring" size="small" sx={{ fontWeight: 600, bgcolor: 'rgba(22,163,74,0.15)', color: '#16a34a' }} />
          </Box>
        </Box>

        {/* CTA */}
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
            borderRadius: 3,
            bgcolor: 'warning.main',
            color: '#000',
            '&:hover': { bgcolor: 'warning.dark' },
          }}
        >
          Search a company to get started
        </Button>

        {/* Features grid */}
        <Box
          component="section"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 2,
            width: '100%',
          }}
        >
          <Typography variant="h6" component="h2" sx={{ gridColumn: '1 / -1', fontWeight: 600, mb: 0.5 }}>
            What's included
          </Typography>
          {FEATURES.map(f => (
            <Paper
              key={f.title}
              elevation={0}
              sx={{
                p: 2,
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 2,
              }}
            >
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                <Box sx={{ color: 'warning.main', mt: 0.25 }}>{f.icon}</Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25 }}>{f.title}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>{f.desc}</Typography>
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>

        {/* Free monitoring included */}
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            p: 3,
            bgcolor: 'rgba(22,163,74,0.06)',
            border: '1px solid rgba(22,163,74,0.2)',
            borderRadius: 2,
          }}
        >
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <NotificationsActiveIcon sx={{ color: '#16a34a', mt: 0.25, fontSize: 28 }} />
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 700, mb: 0.5 }}>
                Monitorización gratuita incluida
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, mb: 1.5 }}>
                Cada informe Due Diligence incluye monitorización gratuita de la empresa. Recibirás alertas
                por email cuando se publiquen nuevos actos en el BORME (nombramientos, ceses, cambios de capital,
                disoluciones) o cuando un regulador internacional emita una advertencia a través de IOSCO.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label="Alertas BORME" variant="outlined" size="small" sx={{ fontSize: '0.7rem', borderColor: 'rgba(22,163,74,0.3)', color: '#16a34a' }} />
                <Chip label="Alertas IOSCO (90+ reguladores)" variant="outlined" size="small" sx={{ fontSize: '0.7rem', borderColor: 'rgba(22,163,74,0.3)', color: '#16a34a' }} />
                <Chip label="Email automático" variant="outlined" size="small" sx={{ fontSize: '0.7rem', borderColor: 'rgba(22,163,74,0.3)', color: '#16a34a' }} />
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* Financial Statements add-on */}
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            p: 3,
            bgcolor: 'rgba(25,118,210,0.04)',
            border: '1px solid rgba(25,118,210,0.15)',
            borderRadius: 2,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Chip
            label="Coming Soon"
            size="small"
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              fontSize: '0.65rem',
              height: 22,
              fontWeight: 700,
              bgcolor: 'rgba(25,118,210,0.15)',
              color: 'primary.light',
            }}
          />
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mb: 1.5 }}>
            <AccountBalanceIcon sx={{ color: 'primary.main', mt: 0.25, fontSize: 28 }} />
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 700, mb: 0.5 }}>
                Financial Statements (Cuentas Anuales)
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, mb: 1.5 }}>
                Add official financial statements from the Registro Mercantil to your Due Diligence report.
                Includes the original PDF plus an AI-powered financial analysis with key ratios, revenue trends,
                and red flags — extracted via OCR and LLM.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label="Official Registro Mercantil document" variant="outlined" size="small" sx={{ fontSize: '0.7rem' }} />
                <Chip label="AI financial analysis" variant="outlined" size="small" sx={{ fontSize: '0.7rem' }} />
                <Chip label="1-2 business days delivery" variant="outlined" size="small" sx={{ fontSize: '0.7rem' }} />
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* Service provided by (trust / ownership) */}
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            p: 3,
            bgcolor: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 2,
          }}
        >
          <Typography
            variant="overline"
            sx={{
              display: 'block',
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: 'primary.light',
              mb: 1,
            }}
          >
            Service provided by
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 1.5,
                bgcolor: 'rgba(25,118,210,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'primary.main',
                flexShrink: 0,
              }}
            >
              <BusinessCenterIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.25 }}>
                Nurnberg Consulting SL
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 0.75, lineHeight: 1.5, fontFamily: 'monospace', fontSize: '0.7rem' }}>
                NIF B86829538 &middot; Madrid, Spain
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1, lineHeight: 1.5 }}>
                Corporate intelligence &amp; business research consultancy, operating since 2013.
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.5 }}>
                Mapa Societario is our dedicated Spanish corporate research product. For multi-jurisdiction
                investigations covering the UK, France, Switzerland and Italy, we also operate{' '}
                <Link
                  href="https://ncdata.eu"
                  target="_blank"
                  rel="noopener"
                  sx={{ color: 'primary.light', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                >
                  NC Data
                </Link>
                , a full-fledged investigation platform for professional users with one-of-a-kind
                tools such as <strong>Document Studio</strong> for fine-tuned AI analysis of
                complex documents.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mt: 1.5, flexWrap: 'wrap' }}>
                <Link
                  href="https://nurnbergconsulting.com"
                  target="_blank"
                  rel="noopener"
                  sx={{
                    fontSize: '0.72rem',
                    color: 'primary.light',
                    textDecoration: 'none',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  <BusinessCenterIcon sx={{ fontSize: 13 }} /> nurnbergconsulting.com
                </Link>
                <Link
                  href="https://ncdata.eu"
                  target="_blank"
                  rel="noopener"
                  sx={{
                    fontSize: '0.72rem',
                    color: 'primary.light',
                    textDecoration: 'none',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  <HubIcon sx={{ fontSize: 13 }} /> ncdata.eu
                </Link>
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* How it works */}
        <Box component="section" sx={{ width: '100%' }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600, mb: 1.5 }}>
            How it works
          </Typography>
          {[
            { step: '1', text: 'Search for a company on the home page' },
            { step: '2', text: 'Click the "Due Diligence" button in the toolbar' },
            { step: '3', text: 'Choose your options and complete payment via Stripe' },
            { step: '4', text: 'Your PDF report is generated and downloaded automatically' },
          ].map(s => (
            <Box key={s.step} sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'center' }}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  bgcolor: 'rgba(255,167,38,0.15)',
                  color: 'warning.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  flexShrink: 0,
                }}
              >
                {s.step}
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>{s.text}</Typography>
            </Box>
          ))}
        </Box>

        {/* Sample report preview */}
        <Accordion
          disableGutters
          elevation={0}
          sx={{
            width: '100%',
            bgcolor: 'rgba(255, 167, 38, 0.04)',
            border: '1px solid rgba(255, 167, 38, 0.2)',
            borderRadius: '8px !important',
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ color: 'warning.main', fontSize: 18 }} />}
            sx={{ minHeight: 44, '& .MuiAccordionSummary-content': { my: 0.75 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DescriptionIcon sx={{ fontSize: 18, color: 'warning.main' }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'warning.light' }}>
                See a sample Due Diligence report
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
            <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>}>
              <SampleReportViewer />
            </Suspense>
          </AccordionDetails>
        </Accordion>

        {/* Trust signals */}
        <Box component="section" sx={{ width: '100%', textAlign: 'center', py: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', lineHeight: 1.6, display: 'block' }}>
            Data sourced from official BORME (Registro Mercantil) filings. Payments securely processed by{' '}
            <Link href="https://stripe.com" target="_blank" rel="noopener" sx={{ color: 'text.secondary' }}>Stripe</Link>.
            Reports available for re-download within 24 hours of purchase.
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', lineHeight: 1.6, display: 'block', mt: 0.5 }}>
            Service provided and invoiced by{' '}
            <Link
              href="https://nurnbergconsulting.com"
              target="_blank"
              rel="noopener"
              sx={{ color: 'text.secondary', fontWeight: 600 }}
            >
              Nurnberg Consulting SL
            </Link>
            {' '}&middot; Madrid, Spain &middot; Operating since 2013
          </Typography>
        </Box>

        {/* Footer nav */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/" variant="caption" sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
            Home
          </Link>
          <Link href="/about.html" variant="caption" sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
            About
          </Link>
          <Link href="/privacy.html" variant="caption" sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
            Privacy
          </Link>
        </Box>
      </Box>
    </>
  );
}
