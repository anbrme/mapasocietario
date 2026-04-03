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
import GavelIcon from '@mui/icons-material/Gavel';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SecurityIcon from '@mui/icons-material/Security';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

const CAPABILITIES = [
  {
    icon: <AccountTreeIcon />,
    title: 'Company network graph',
    desc: 'Search any Spanish company and instantly see its directors, officers, and corporate connections in an interactive force graph.',
    color: '#1976d2',
  },
  {
    icon: <PersonIcon />,
    title: 'Officer lookup',
    desc: 'Search an officer by name and discover every company they are or were associated with — appointments, resignations, roles.',
    color: '#f57c00',
  },
  {
    icon: <DescriptionIcon />,
    title: 'Due Diligence PDF',
    desc: 'Purchase a comprehensive AI-powered report with sanctions screening, risk scoring, capital history, and red flag analysis.',
    color: '#f57c00',
  },
  {
    icon: <BarChartIcon />,
    title: 'Analytics dashboard',
    desc: 'Monitor formations, dissolutions, officer changes, and capital trends across Spain — filterable by province and date.',
    color: '#1976d2',
  },
];

const USE_CASES = [
  { icon: <SecurityIcon />, label: 'Compliance / KYC', desc: 'Screen counterparties and verify corporate structures before onboarding.' },
  { icon: <TrendingUpIcon />, label: 'Sales / lead research', desc: 'Identify decision-makers and map corporate groups for targeted outreach.' },
  { icon: <NewspaperIcon />, label: 'Journalists / investigators', desc: 'Trace connections between companies and individuals across the registry.' },
  { icon: <GavelIcon />, label: 'Investors / M&A screening', desc: 'Evaluate corporate history, officer track records, and red flags before deals.' },
];

const DIFFERENTIATORS = [
  { icon: <VerifiedIcon />, title: 'Spanish registry focus', desc: 'Purpose-built for BORME data — not a generic international database.' },
  { icon: <HubIcon />, title: 'Relationship graph', desc: 'Visual network exploration, not just record lookup. See connections at a glance.' },
  { icon: <PaymentsIcon />, title: 'Cheap one-off reports', desc: 'EUR 2.50 per Due Diligence report. No subscription, no account required.' },
  { icon: <SpeedIcon />, title: 'Fast exploratory workflow', desc: 'From search to insight in seconds. Type a name, explore the graph, buy a report.' },
];

const FAQ_ITEMS = [
  {
    question: 'Is the data accurate and up-to-date?',
    answer: 'Data is sourced from official Spanish public registries (BORME) and updated regularly. Since the data is parsed from PDF publications, it may not be 100% perfect — officers are identified by name, and while we use several techniques to avoid mismatches, always verify critical information with official sources.',
  },
  {
    question: 'Do I need to pay or create an account?',
    answer: 'The network graph is completely free — no account, no signup. Due Diligence reports are a paid feature available via a one-time purchase per company (EUR 2.50).',
  },
  {
    question: 'What is a Due Diligence report?',
    answer: 'A comprehensive PDF with AI-powered analysis and sanctions cross-checking, covering corporate structure, full officer history, capital events, red flags, and key changes over time — far more detail than the network graph alone.',
  },
  {
    question: 'Can I get API access?',
    answer: 'Yes. Please write to app@ncdata.eu with a brief description of your intended use case, so that we can tailor our response to your needs.',
  },
];

const PROOF_ITEMS = [
  'Based on official BORME publications',
  'Free graph exploration',
  'Reports from EUR 2.50',
  'No account required',
];

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

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Mapa Societario | Grafo de empresas y administradores en Espa&ntilde;a</title>
        <meta name="description" content="Explora relaciones societarias de empresas espa&ntilde;olas con un grafo interactivo basado en BORME. Informes Due Diligence con IA, sanciones y an&aacute;lisis de riesgos." />
        <link rel="canonical" href="https://mapasocietario.es/" />
        <meta property="og:title" content="Mapa Societario | Grafo de empresas y administradores en Espana" />
        <meta property="og:description" content="Explora relaciones societarias de empresas espanolas con un grafo interactivo basado en BORME. Informes Due Diligence con IA, sanciones y analisis de riesgos." />
        <meta property="og:url" content="https://mapasocietario.es/" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Mapa Societario" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Mapa Societario | Grafo de empresas y administradores en Espana" />
        <meta name="twitter:description" content="Explora relaciones societarias de empresas espanolas con un grafo interactivo basado en BORME. Informes Due Diligence con IA y analisis de riesgos." />
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
              Investigate Spanish companies and directors in seconds
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
              BORME-based corporate relationship search, officer history, and instant due diligence reports.
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
                Search companies and officers
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
                View sample report
              </Button>
            </Box>
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
            {PROOF_ITEMS.map((item) => (
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
          <SectionLabel>What you can do</SectionLabel>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 4, letterSpacing: '-0.02em' }}>
            Explore corporate relationships, investigate officers, and generate reports
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2.5,
            }}
          >
            {CAPABILITIES.map((cap) => (
              <Paper
                key={cap.title}
                elevation={0}
                sx={{
                  p: 3,
                  bgcolor: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 2,
                  transition: 'border-color 0.2s, background-color 0.2s',
                  '&:hover': {
                    borderColor: `${cap.color}40`,
                    bgcolor: 'rgba(255,255,255,0.035)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  <Box
                    sx={{
                      color: cap.color,
                      opacity: 0.8,
                      mt: 0.25,
                      '& .MuiSvgIcon-root': { fontSize: 24 },
                    }}
                  >
                    {cap.icon}
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
            <SectionLabel>How it works</SectionLabel>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 4, letterSpacing: '-0.02em' }}>
              From search to insight in seconds
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 3,
              }}
            >
              {/* Graph preview placeholder */}
              <Box
                sx={{
                  borderRadius: 2,
                  border: '1px solid rgba(25,118,210,0.2)',
                  bgcolor: 'rgba(25,118,210,0.04)',
                  p: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 240,
                  gap: 2,
                }}
              >
                <HubIcon sx={{ fontSize: 64, color: 'primary.main', opacity: 0.3 }} />
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Interactive network graph
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Type a company or officer name and watch the relationship network unfold in real time.
                  </Typography>
                </Box>
                <Button
                  size="small"
                  startIcon={<SearchIcon />}
                  onClick={() => navigate('/app')}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    color: 'primary.main',
                    mt: 1,
                  }}
                >
                  Try it now
                </Button>
              </Box>

              {/* Report preview placeholder */}
              <Box
                sx={{
                  borderRadius: 2,
                  border: '1px solid rgba(255,167,38,0.2)',
                  bgcolor: 'rgba(255,167,38,0.04)',
                  p: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 240,
                  gap: 2,
                }}
              >
                <DescriptionIcon sx={{ fontSize: 64, color: 'warning.main', opacity: 0.3 }} />
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Due Diligence PDF report
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    AI-powered analysis, sanctions screening, officer history, red flags — delivered as a professional PDF.
                  </Typography>
                </Box>
                <Button
                  size="small"
                  startIcon={<DescriptionIcon />}
                  onClick={() => navigate('/due-diligence')}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    color: 'warning.main',
                    mt: 1,
                  }}
                >
                  See sample report
                </Button>
              </Box>
            </Box>
          </Section>
        </Box>

        {/* ============================================================
            USE CASES
        ============================================================ */}
        <Section>
          <SectionLabel>Who it's for</SectionLabel>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 4, letterSpacing: '-0.02em' }}>
            Built for anyone who needs corporate intelligence in Spain
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2.5,
            }}
          >
            {USE_CASES.map((uc) => (
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
                  {uc.icon}
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
            <SectionLabel>Why Mapa Societario</SectionLabel>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 4, letterSpacing: '-0.02em' }}>
              Purpose-built for the Spanish corporate registry
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
                gap: 2.5,
              }}
            >
              {DIFFERENTIATORS.map((d) => (
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
                    {d.icon}
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
            FAQ
        ============================================================ */}
        <Section>
          <SectionLabel>FAQ</SectionLabel>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 3, letterSpacing: '-0.02em' }}>
            Frequently asked questions
          </Typography>
          <Box sx={{ maxWidth: 640 }}>
            {FAQ_ITEMS.map((item) => (
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
              Ready to investigate?
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4, maxWidth: 420, mx: 'auto' }}>
              Search companies and officers for free. Purchase a Due Diligence report when you need deeper analysis.
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
                Search now
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
                Order a due diligence report
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
            &copy; {new Date().getFullYear()} Mapa Societario &middot; Free to use, no account required &middot; Data sourced from BORME (Registro Mercantil)
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link
              href="/due-diligence"
              variant="caption"
              sx={{ fontSize: '0.65rem', color: 'warning.light', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              Due Diligence Reports
            </Link>
            <Link
              href="/dashboard"
              variant="caption"
              sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              Dashboard
            </Link>
            <Link
              href="/about.html"
              target="_blank"
              rel="noopener"
              variant="caption"
              sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              About
            </Link>
            <Link
              href="https://github.com/anbrme/borme-public-api"
              target="_blank"
              rel="noopener"
              variant="caption"
              sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              Public API docs
            </Link>
            <Link
              href="/privacy.html"
              target="_blank"
              rel="noopener"
              variant="caption"
              sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              Privacy & Cookies
            </Link>
          </Box>
        </Box>
      </Box>
    </>
  );
}
