import React from 'react';
import {
  Box,
  Typography,
  Button,
  Link,
  Paper,
  Chip,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import SecurityIcon from '@mui/icons-material/Security';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import HistoryIcon from '@mui/icons-material/History';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import GavelIcon from '@mui/icons-material/Gavel';
import SearchIcon from '@mui/icons-material/Search';
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
        <meta name="description" content="AI-powered due diligence reports for Spanish companies. Sanctions screening, corporate structure, officer history, risk analysis, and more. From EUR 2.50 per company." />
        <link rel="canonical" href="https://mapasocietario.es/due-diligence" />
        <meta property="og:title" content="Due Diligence Reports | Mapa Societario" />
        <meta property="og:description" content="AI-powered due diligence reports for Spanish companies. Sanctions screening, risk analysis, officer history. From EUR 2.50." />
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
            <Chip label="From EUR 2.50" color="warning" size="small" sx={{ fontWeight: 600 }} />
            <Chip label="Instant delivery" variant="outlined" size="small" />
            <Chip label="No account needed" variant="outlined" size="small" />
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

        {/* How it works */}
        <Box component="section" sx={{ width: '100%' }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600, mb: 1.5 }}>
            How it works
          </Typography>
          {[
            { step: '1', text: 'Search for a company on the home page' },
            { step: '2', text: 'Click the "Due Diligence" button in the toolbar' },
            { step: '3', text: 'Complete payment via Stripe (EUR 2.50)' },
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

        {/* Trust signals */}
        <Box component="section" sx={{ width: '100%', textAlign: 'center', py: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', lineHeight: 1.6 }}>
            Data sourced from official BORME (Registro Mercantil) filings. Payments secured by{' '}
            <Link href="https://stripe.com" target="_blank" rel="noopener" sx={{ color: 'text.secondary' }}>Stripe</Link>.
            Reports available for re-download within 24 hours of purchase.
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
