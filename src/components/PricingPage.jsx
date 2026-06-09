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
import { useNavigate } from 'react-router-dom';
import LegalDisclaimer from './LegalDisclaimer';
import { isAndroidNativeApp } from '../services/playBillingService';

const LINE_ITEMS = [
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
];

export default function PricingPage() {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0e1a', px: { xs: 2.25, sm: 4 }, py: { xs: 4, sm: 6 } }}>
      <Helmet>
        <title>Pricing | Mapa Societario</title>
        <meta
          name="description"
          content="Mapa Societario pricing: Spanish company due diligence reports from EUR 22.50, with an optional financial statements add-on. No subscription, no account required. Volume pricing for law firms and consultancies."
        />
        <link rel="canonical" href="https://mapasocietario.es/pricing" />
        <meta property="og:title" content="Pricing | Mapa Societario" />
        <meta property="og:description" content="Spanish company due diligence reports from EUR 22.50, optional financial statements add-on, no subscription. Volume pricing for professionals." />
        <meta property="og:url" content="https://mapasocietario.es/pricing" />
        <meta property="og:type" content="website" />
      </Helmet>

      <Box sx={{ maxWidth: 940, mx: 'auto' }}>
        <Box component="header" sx={{ mb: 5 }}>
          <Link href="/" sx={{ color: 'text.secondary', fontSize: '0.85rem', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
            Mapa Societario
          </Link>
          <Typography
            variant="h3"
            component="h1"
            sx={{ fontWeight: 800, letterSpacing: 0, lineHeight: 1.12, fontSize: { xs: '2rem', sm: '2.8rem' }, mt: 4, mb: 2 }}
          >
            Pricing
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 740, lineHeight: 1.7, mb: 3 }}>
            Explore the corporate relationship graph for free. Pay only when you need a documented report.
            No subscription, no account required — one-off purchases per company.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
            {['Pay per company', 'No subscription', 'No account required', 'Free graph exploration'].map((chip) => (
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
              One-off reports
            </Typography>

            <Box sx={{ display: 'grid', gap: 2.5, mt: 2 }}>
              {LINE_ITEMS.map((item) => (
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
                <Typography variant="body1" sx={{ fontWeight: 800 }}>Full report with financial statements</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Report plus the Cuentas Anuales add-on.</Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: 'warning.light', whiteSpace: 'nowrap' }}>€40.00</Typography>
            </Box>

            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 3, lineHeight: 1.6 }}>
              Prices exclude VAT. On the web, taxes are calculated by Stripe at checkout. In the Android app, Google
              Play is the merchant of record and adds VAT per country, so the final price shown there may differ.
            </Typography>

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 3 }}>
              <Button variant="contained" startIcon={<SearchIcon />} onClick={() => navigate('/app')} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
                Search a company
              </Button>
              <Button variant="outlined" startIcon={<DescriptionIcon />} onClick={() => navigate('/spanish-company-due-diligence')} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: 'warning.light', borderColor: 'rgba(255,167,38,0.45)' }}>
                What is in a report
              </Button>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: { xs: 1.5, sm: 3 }, mt: 2.5 }}>
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
                See a sample report
              </Box>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, color: 'text.secondary', fontSize: '0.82rem', fontWeight: 500 }}>
                <VerifiedIcon sx={{ fontSize: 17, color: 'success.light' }} />
                Money-back if the data is wrong or inaccurate
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
                Checking several companies?
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.75, maxWidth: 780, mb: 2.5 }}>
                Law firms, consultancies, and compliance teams running repeat checks can get volume pricing.
                Tell us roughly how many reports you expect and we will set up the right arrangement.
              </Typography>
              <Button
                href="mailto:app@ncdata.eu?subject=Volume%20pricing%20%E2%80%94%20Mapa%20Societario%20reports"
                variant="contained"
                startIcon={<AssessmentIcon />}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
              >
                Get volume pricing
              </Button>
            </Paper>
          )}

          <Box component="section" sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', pt: 4 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, maxWidth: 780 }}>
              Mapa Societario is operated by Nurnberg Consulting SL, a Madrid-based corporate intelligence consultancy
              active since 2013. See{' '}
              <Link href="/about.html" sx={{ color: 'primary.light' }}>About</Link>,{' '}
              <Link href="/terms.html" sx={{ color: 'primary.light' }}>Terms</Link>, and{' '}
              <Link href="/privacy.html" sx={{ color: 'primary.light' }}>Privacy</Link>.
            </Typography>
          </Box>

          <LegalDisclaimer dense />
        </Box>
      </Box>
    </Box>
  );
}
