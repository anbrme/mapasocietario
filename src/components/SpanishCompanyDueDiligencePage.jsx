import React from 'react';
import {
  Box,
  Button,
  Chip,
  Link,
  Paper,
  Typography,
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import DescriptionIcon from '@mui/icons-material/Description';
import GavelIcon from '@mui/icons-material/Gavel';
import SearchIcon from '@mui/icons-material/Search';
import SecurityIcon from '@mui/icons-material/Security';
import VerifiedIcon from '@mui/icons-material/Verified';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import LegalDisclaimer from './LegalDisclaimer';

const SECTIONS = [
  {
    title: 'What a Spanish company due diligence report covers',
    body: [
      'Mapa Societario helps review Spanish companies using BORME corporate registry publications, relationship graphs, officer history, capital events, sole-shareholder declarations, fully-owned participations, and risk-oriented checks.',
      'Reports are designed for KYB, compliance, counterparty screening, supplier onboarding, investment screening, investigative research, and preliminary M&A review.',
    ],
  },
  {
    title: 'Why Spanish due diligence needs registry context',
    body: [
      'A company name alone is rarely enough. Useful due diligence usually requires understanding current and former administrators, corporate appointments and resignations, companies connected through the same officers, sole shareholders, and changes over time.',
      'Mapa Societario turns that registry context into an explorable graph first, then a paid PDF report when you need a document for internal files.',
    ],
  },
  {
    title: 'Additional checks',
    body: [
      'The report workflow can include BOE sanctions checks and flags administrators who match current or former Spanish Congress deputies. These signals are useful because political exposure and official sanctions are often missed in basic company lookups.',
      'The service is not a substitute for official certificates, legal advice, or a direct Registro Mercantil search. It is a fast research and documentation layer built on public sources.',
    ],
  },
];

const FEATURES = [
  { icon: <AccountTreeIcon />, title: 'Corporate relationship graph', text: 'Explore companies, officers, sole shareholders, and fully-owned participations before ordering.' },
  { icon: <GavelIcon />, title: 'BORME event history', text: 'Review appointments, resignations, capital events, changes, and relevant registry publications.' },
  { icon: <SecurityIcon />, title: 'Risk checks', text: 'Includes sanctions-oriented checks and Congress deputy matches where available.' },
  { icon: <DescriptionIcon />, title: 'PDF report', text: 'A practical report for compliance files, supplier reviews, investor screening, and internal records.' },
];

export default function SpanishCompanyDueDiligencePage() {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0e1a', px: { xs: 2.25, sm: 4 }, py: { xs: 4, sm: 6 } }}>
      <Helmet>
        <title>Spanish Company Due Diligence Reports | Mapa Societario</title>
        <meta
          name="description"
          content="Spanish company due diligence reports using BORME registry data, corporate relationship graphs, officer history, BOE sanctions checks, sole shareholders, and fully-owned participations."
        />
        <link rel="canonical" href="https://mapasocietario.es/spanish-company-due-diligence" />
        <meta property="og:title" content="Spanish Company Due Diligence Reports | Mapa Societario" />
        <meta property="og:description" content="Due diligence reports for Spanish companies with BORME registry data, officer history, relationship graphs, sanctions checks, and PDF delivery." />
        <meta property="og:url" content="https://mapasocietario.es/spanish-company-due-diligence" />
        <meta property="og:type" content="article" />
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
            Spanish company due diligence reports
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 740, lineHeight: 1.7, mb: 3 }}>
            Investigate Spanish companies with registry-based corporate relationship mapping, officer history,
            sole-shareholder and fully-owned participation checks, BOE sanctions checks, and downloadable PDF reports.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
            {['BORME registry data', 'Officer history', 'BOE sanctions checks', 'PDF report', 'No subscription'].map((chip) => (
              <Chip key={chip} label={chip} size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.18)' }} />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 4 }}>
            <Button variant="contained" startIcon={<SearchIcon />} onClick={() => navigate('/app')} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
              Search a Spanish company
            </Button>
            <Button variant="outlined" startIcon={<DescriptionIcon />} onClick={() => navigate('/due-diligence')} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: 'warning.light', borderColor: 'rgba(255,167,38,0.45)' }}>
              See report details
            </Button>
          </Box>
          <LegalDisclaimer dense />
        </Box>

        <Box component="main" sx={{ display: 'grid', gap: 4 }}>
          {SECTIONS.map((section) => (
            <Box component="section" key={section.title}>
              <Typography variant="h5" component="h2" sx={{ fontWeight: 750, mb: 1.5, letterSpacing: 0 }}>
                {section.title}
              </Typography>
              {section.body.map((paragraph) => (
                <Typography key={paragraph} variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.75, mb: 1.5, maxWidth: 780 }}>
                  {paragraph}
                </Typography>
              ))}
            </Box>
          ))}

          <Box component="section" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
            {FEATURES.map((feature) => (
              <Paper key={feature.title} elevation={0} sx={{ p: 2.5, bgcolor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
                <Box sx={{ color: 'primary.light', mb: 1, '& .MuiSvgIcon-root': { fontSize: 24 } }}>{feature.icon}</Box>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.75 }}>
                  {feature.title}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                  {feature.text}
                </Typography>
              </Paper>
            ))}
          </Box>

          <Box component="section" sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', pt: 4 }}>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 750, mb: 1 }}>
              Who operates the service?
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, maxWidth: 780 }}>
              Mapa Societario is operated by Nurnberg Consulting SL, a Madrid-based corporate
              intelligence and business research consultancy active since 2013. See{' '}
              <Link href="/about.html" sx={{ color: 'primary.light' }}>About</Link>,{' '}
              <Link href="/terms.html" sx={{ color: 'primary.light' }}>Terms</Link>, and{' '}
              <Link href="/privacy.html" sx={{ color: 'primary.light' }}>Privacy</Link>.
            </Typography>
          </Box>

          <Box component="section" sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', pt: 4 }}>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 750, mb: 1 }}>
              Need API access or a higher-touch investigation?
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, maxWidth: 780, mb: 2 }}>
              The self-serve report is the fast mid-tier option. For third-party data integrations,
              Spanish registry intelligence is available through <strong>NC Data</strong>. For
              higher-stakes matters, <strong>Nurnberg Consulting SL</strong> can add human analyst work,
              source retrieval, document review, and bespoke conclusions.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
              <Button
                href="mailto:app@ncdata.eu?subject=NC%20Data%20Spanish%20API"
                variant="outlined"
                size="small"
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
              >
                Discuss NC Data API access
              </Button>
              <Button
                href="https://nurnbergconsulting.com"
                target="_blank"
                rel="noopener"
                variant="outlined"
                size="small"
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
              >
                Human-led investigations
              </Button>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', pb: 2 }}>
            <Button variant="contained" startIcon={<VerifiedIcon />} onClick={() => navigate('/app')} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
              Start with a free graph search
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
