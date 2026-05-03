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
import MouseIcon from '@mui/icons-material/Mouse';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import PreviewIcon from '@mui/icons-material/Preview';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import LegalDisclaimer from './LegalDisclaimer';

const CAPABILITIES = [
  {
    icon: <AccountTreeIcon />,
    title: 'Company network graph',
    desc: 'Search any Spanish company and instantly see its directors, officers, and corporate connections in an interactive force graph.',
    color: '#1976d2',
    href: '/app',
  },
  {
    icon: <PersonIcon />,
    title: 'Officer lookup',
    desc: 'Search an officer by name and discover every company they are or were associated with — appointments, resignations, roles. This includes a comprehensive history of all their corporate affiliations, sorted by seniority and recency, with key details like appointment dates, roles, and even current or former political positions highlighted.',
    color: '#f57c00',
    href: '/app',
  },
  {
    icon: <DescriptionIcon />,
    title: 'Due Diligence PDF',
    desc: 'Purchase a comprehensive AI-powered report with sanctions screening, risk scoring, capital history, and red flag analysis. Add financial statements with AI analysis.',
    color: '#f57c00',
    href: '/due-diligence',
  },
  {
    icon: <BarChartIcon />,
    title: 'Analytics dashboard',
    desc: 'Monitor formations, dissolutions, officer changes, and capital trends across Spain — filterable by province and date.',
    color: '#1976d2',
    href: '/dashboard',
  },
];

const USE_CASES = [
  { icon: <SecurityIcon />, label: 'Compliance / KYC', desc: 'Screen counterparties and verify corporate structures before onboarding.' },
  { icon: <TrendingUpIcon />, label: 'Sales / lead research', desc: 'Identify decision-makers and map corporate groups for targeted outreach.' },
  { icon: <NewspaperIcon />, label: 'Journalists / investigators', desc: 'Trace connections between companies and individuals across the registry.' },
  { icon: <GavelIcon />, label: 'Investors / M&A screening', desc: 'Evaluate corporate history, officer track records, and red flags before deals.' },
];

const HOW_TO_STEPS = [
  {
    number: '1',
    icon: <SearchIcon />,
    title: 'Search',
    desc: 'Type a company or officer name in the search bar. Select from the autocomplete suggestions to load the entity and its connections into the graph.',
  },
  {
    number: '2',
    icon: <TouchAppIcon />,
    title: 'Double-click to expand',
    desc: 'Double-click any node in the graph to expand it — for a company, this loads all its officers; for an officer, it loads all their companies.',
  },
  {
    number: '3',
    icon: <MouseIcon />,
    title: 'Right-click for actions',
    desc: 'Right-click any node to open a context menu. You can edit or merge nodes, hide them, delete them, preview the full data, or buy a Due Diligence report.',
  },
  {
    number: '4',
    icon: <PreviewIcon />,
    title: 'Preview company data',
    desc: 'Select "Vista previa de datos" from the right-click menu to see a detailed overview: current officers sorted by seniority, address, capital, corporate events — all before buying a report.',
  },
  {
    number: '5',
    icon: <ZoomInIcon />,
    title: 'Navigate the graph',
    desc: 'Scroll to zoom in/out. Drag the canvas to pan. Drag individual nodes to reposition them. Use the settings panel to adjust node size, label size, and physics.',
  },
  {
    number: '6',
    icon: <DescriptionIcon />,
    title: 'Buy a Due Diligence report',
    desc: 'From the right-click menu or the data preview, purchase a comprehensive PDF with AI analysis, sanctions screening, red flags, officer network, and optional financial statements.',
  },
];

const DIFFERENTIATORS = [
  { icon: <VerifiedIcon />, title: 'Spanish registry focus', desc: 'Purpose-built for BORME data — not a generic international database.' },
  { icon: <HubIcon />, title: 'Relationship graph', desc: 'Visual network exploration, not just record lookup. See connections at a glance.' },
  { icon: <PaymentsIcon />, title: 'Cheap one-off reports', desc: 'EUR 22.50 per Due Diligence report. No subscription, no account required.' },
  { icon: <SpeedIcon />, title: 'Fast exploratory workflow', desc: 'From search to insight in seconds. Type a name, explore the graph, buy a report.' },
];

const FAQ_ITEMS = [
  {
    question: 'Is the data accurate and up-to-date?',
    answer: 'Data is sourced from official Spanish public registries (BORME) and updated daily. The data covers the period from 1 January 2009 to the present, so companies formed or having registry activity before 1 January 2009 may show missing information (precisely, the information filed before 1 January 2009). Since the data is parsed from PDF publications, you should be aware of some caveats — specifically, officers are identified by name, and while we use several techniques to avoid mismatches, always verify critical information with official sources.',
  },
  { 
    question: 'Do I need to pay or create an account?',
    answer: 'The network graph as well as all options available by right-clicking on a node are completely free — no account, no signup. Due Diligence reports are a paid feature available via a one-time purchase per company (EUR 22.50). Spanish financial statements (Cuentas Anuales) are an optional add-on for an additional EUR 17.50 per company. There are no subscriptions or recurring fees — just pay for the reports you need, when you need them.',
  }, 
  {
    question: 'What is a Due Diligence report?',
    answer: 'A comprehensive PDF with AI-powered analysis and sanctions cross-checking, covering corporate structure, full officer history, capital events, red flags, and key changes over time — far more detail than the network graph alone. You can also add official financial statements (Cuentas Anuales) from the Registro Mercantil, including an AI-powered financial analysis with key ratios and trends.',
  },
  {
    question: 'Can I get API access?',
    answer: 'Yes. Please write to app@ncdata.eu with a brief description of your intended use case, so that we can tailor our response to your needs.',
  },
];

const PROOF_ITEMS = [
  'By Nurnberg Consulting SL (Madrid, since 2013)',
  'Based on official BORME publications',
  'Free graph exploration',
  'Reports from EUR 22.50',
];

const SPANISH_RESOURCES = [
  { label: 'Mapa societario de empresas españolas', href: '/es' },
  { label: 'Informes due diligence de empresas', href: '/es/informes-due-diligence-empresas' },
  { label: 'Buscar administradores de empresas', href: '/es/buscar-administradores-empresas' },
  { label: 'Grafo de empresas BORME', href: '/es/borme-grafo-empresas' },
  { label: 'Mapa de relaciones societarias', href: '/es/mapa-relaciones-societarias' },
];

const TOP_LINKS = [
  { label: 'About', href: '/about.html' },
  { label: 'Terms', href: '/terms.html' },
  { label: 'Privacy', href: '/privacy.html' },
  { label: 'API', href: 'https://github.com/anbrme/borme-public-api', external: true },
  { label: 'Spanish company due diligence', href: '/spanish-company-due-diligence' },
  { label: 'Español', href: '/es' },
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
        <title>Mapa Societario | Spanish Company Search &amp; Corporate Relationship Graph</title>
        <meta name="description" content="Due diligence on Spanish companies and directors instantly. Interactive BORME-based corporate relationship graph, officer history lookup, and AI-powered due diligence reports from EUR 22.50." />
        <link rel="canonical" href="https://mapasocietario.es/" />
        <meta property="og:title" content="Mapa Societario | Spanish Company Search & Corporate Relationship Graph" />
        <meta property="og:description" content="Due diligence on Spanish companies and directors instantly. Interactive BORME-based corporate relationship graph, officer history, and AI-powered due diligence reports." />
        <meta property="og:url" content="https://mapasocietario.es/" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Mapa Societario" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Mapa Societario | Spanish Company Search & Corporate Relationship Graph" />
        <meta name="twitter:description" content="Due diligence on Spanish companies and directors instantly. BORME-based corporate graph, officer history, and due diligence reports from EUR 22.50." />
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
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: { xs: 1.25, sm: 2.25 },
            }}
          >
            {TOP_LINKS.map((link) => (
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
              Due diligence on Spanish companies and directors in seconds
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
              Operated by Nurnberg Consulting SL, Madrid, since 2013. Unofficial service based on public BOE/BORME data.
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
                Get a Due Diligence
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<DescriptionIcon />}
                onClick={() => navigate('/spanish-company-due-diligence')}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 4,
                  py: 1.5,
                  fontSize: '1rem',
                  borderRadius: 2,
                  borderColor: 'rgba(255,255,255,0.18)',
                  color: 'text.secondary',
                  '&:hover': {
                    borderColor: 'primary.light',
                    bgcolor: 'rgba(25,118,210,0.08)',
                  },
                }}
              >
                Spanish company due diligence
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<BarChartIcon />}
                onClick={() => navigate('/dashboard')}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 4,
                  py: 1.5,
                  fontSize: '1rem',
                  borderRadius: 2,
                  borderColor: 'rgba(25,118,210,0.5)',
                  color: '#64b5f6',
                  '&:hover': {
                    borderColor: '#1976d2',
                    bgcolor: 'rgba(25,118,210,0.08)',
                  },
                }}
              >
                Open dashboard
              </Button>
            </Box>
            <LegalDisclaimer dense sx={{ mt: 4, maxWidth: 760, mx: 'auto' }} />
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
            Explore corporate relationships, perform due diligence on officers, and generate reports
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
                component="a"
                href={cap.href}
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
                    borderColor: `${cap.color}80`,
                    bgcolor: 'rgba(255,255,255,0.04)',
                    transform: 'translateY(-2px)',
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
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1, letterSpacing: '-0.02em' }}>
              From search to insight in seconds
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4, maxWidth: 560 }}>
              The graph is fully interactive. Here's what you can do:
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
                gap: 2,
              }}
            >
              {HOW_TO_STEPS.map((step) => (
                <Box
                  key={step.number}
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
                    {step.icon}
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
                Try it now
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<DescriptionIcon />}
                onClick={() => navigate('/due-diligence')}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  borderRadius: 2,
                  borderColor: 'rgba(255,167,38,0.5)',
                  color: 'warning.light',
                  '&:hover': { borderColor: '#f57c00', bgcolor: 'rgba(255,167,38,0.08)' },
                }}
              >
                See sample report
              </Button>
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
            <SectionLabel>Spanish resources</SectionLabel>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1.5, letterSpacing: 0 }}>
              Research Spanish companies in Spanish
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, maxWidth: 620, lineHeight: 1.6 }}>
              Spanish-language pages for common corporate registry workflows: finding administrators,
              mapping company relationships, understanding BORME data, and ordering due diligence reports.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
              {SPANISH_RESOURCES.map((resource) => (
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
          <SectionLabel>Who's behind it</SectionLabel>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1, letterSpacing: '-0.02em' }}>
            A real company with real professionals behind it
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, maxWidth: 640, lineHeight: 1.6 }}>
            Mapa Societario is operated by <strong>Nurnberg Consulting SL</strong>, a Madrid-based
            consultancy specialised in corporate intelligence and business research. We've been helping
            clients navigate European corporate registries since 2013.
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
                Corporate intelligence &amp; business research consultancy
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
                    Madrid, Spain
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <EventIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Operating since 2013
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
                Need a full investigation platform? Try NC Data
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.6, mb: 1.25 }}>
              Mapa Societario is our dedicated Spanish product. For professional investigators,
              we also operate <strong>NC Data</strong>, a full-fledged investigation platform
              covering companies in Spain, the United Kingdom, France, Switzerland and Italy. Beyond corporate due diligence, NC Data includes one-of-a-kind,
              cutting-edge tools such as <strong>Document Studio</strong>, which lets users
              fine-tune AI for sophisticated analysis of complex, context-heavy documents, along
              with deeper entity resolution, cross-border linking and advanced investigative
              workflows for demanding use cases.
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
              Visit ncdata.eu &rarr;
            </Link>
          </Box>
        </Section>

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
            &copy; {new Date().getFullYear()} Mapa Societario &middot; A product of{' '}
            <Link
              href="https://nurnbergconsulting.com"
              target="_blank"
              rel="noopener"
              sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              Nurnberg Consulting SL
            </Link>
            {' '}(Madrid, Spain) &middot; Data sourced from BORME (Registro Mercantil)
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem', lineHeight: 1.5, maxWidth: 760, px: 2 }}>
            Based on data from the{' '}
            <Link
              href="https://www.boe.es"
              target="_blank"
              rel="noopener"
              sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              Agencia Estatal Boletín Oficial del Estado
            </Link>
            . This service is unofficial and is not endorsed by the AEBOE.
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
              href="https://ncdata.eu"
              target="_blank"
              rel="noopener"
              variant="caption"
              sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              NC Data (multi-country)
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
            <Link
              href="/terms.html"
              target="_blank"
              rel="noopener"
              variant="caption"
              sx={{ fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              Terms
            </Link>
          </Box>
        </Box>
      </Box>
    </>
  );
}
