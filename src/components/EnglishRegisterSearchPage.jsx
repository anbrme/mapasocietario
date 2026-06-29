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
import BusinessIcon from '@mui/icons-material/Business';
import DescriptionIcon from '@mui/icons-material/Description';
import GavelIcon from '@mui/icons-material/Gavel';
import HubIcon from '@mui/icons-material/Hub';
import SearchIcon from '@mui/icons-material/Search';
import VerifiedIcon from '@mui/icons-material/Verified';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import LegalDisclaimer from './LegalDisclaimer';

const SITE_URL = 'https://mapasocietario.es';
const CANONICAL = `${SITE_URL}/spanish-company-register-search`;

const sections = [
  {
    title: 'Search Spanish companies from BORME data',
    body: [
      'Mapa Societario lets you search Spanish companies and directors, then explore their corporate relationships in an interactive graph. The underlying registry intelligence is built from BORME publications, the official gazette where Spanish Commercial Registry acts are published.',
      'Use it when you need a practical company search in Spain: find a company, see current and historical officers, follow appointments and resignations, review capital events, and understand who is connected to whom before deciding whether a full due diligence report is needed.',
    ],
  },
  {
    title: 'What is BORME?',
    body: [
      'BORME stands for Boletín Oficial del Registro Mercantil. It is the official Spanish commercial registry gazette. It publishes corporate acts such as company formations, officer appointments and removals, capital increases or reductions, mergers, demergers, dissolutions, registered-office changes, sole-shareholder declarations, and other registry events.',
      'BORME is not a simple company directory. It is a chronological public record. Mapa Societario structures those publications so a company search can become a graph of companies, officers, roles, and corporate events.',
    ],
  },
  {
    title: 'What you can check',
    body: [
      'A Spanish company register search can show whether a company is active, who appears as an administrator or officer, how its registered office and capital have changed, whether it has declared a sole shareholder, whether it fully owns another company, and how often its representation structure changes.',
      'The relationship graph is free to use. When you need a documented file, the paid report adds a PDF summary, risk indicators, officer history, NIF, relationship context, and checks based on public BOE/BORME sources.',
    ],
  },
  {
    title: 'What the register does not show',
    body: [
      'BORME does not publish every piece of commercial intelligence a buyer, supplier, investor, or compliance team may want. Partial shareholders are not visible, as only sole shareholders are disclosed. Annual accounts, beneficial ownership information, websites, emails, and commercial contact details require separate sources.',
      'For critical decisions, use BORME-based intelligence as a starting point, then verify current information with the official Commercial Registry (Registro Mercantil), annual accounts, company-provided documents, and other appropriate sources.',
    ],
  },
];

const cards = [
  {
    icon: <SearchIcon />,
    title: 'Company search Spain',
    text: 'Start with a Spanish company name and open its relationship graph from official registry publications.',
  },
  {
    icon: <AccountTreeIcon />,
    title: 'Directors and officers',
    text: 'Search administrators, directors, proxies, and other registered roles to see company links over time.',
  },
  {
    icon: <DescriptionIcon />,
    title: 'Due diligence reports',
    text: 'Turn a registry search into a PDF report when you need a documented review for internal files.',
  },
];

const limits = [
  'BORME is an official publication source, but Mapa Societario is a private, independent service. It is not an official government service nor is it endorsed by any government entity.',
  'Automated parsing can occasionally miss or misclassify details; verify important findings in official sources (Bear in mind that the BORME itself may have typos or occasional errors).',
  'Public registry data does not replace legal, financial, tax, or accounting advice.',
];

export default function EnglishRegisterSearchPage() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#0a0e1a',
        color: 'text.primary',
        px: { xs: 2.25, sm: 4 },
        py: { xs: 4, sm: 6 },
      }}
    >
      <Helmet htmlAttributes={{ lang: 'en' }}>
        <title>Spanish Company Register Search | BORME Company Search Spain</title>
        <meta
          name="description"
          content="Search Spanish companies and directors using BORME registry data. Understand what the Spanish company register shows, what it omits, and when to order a due diligence report."
        />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:locale" content="en_US" />
        <meta property="og:title" content="Spanish Company Register Search | Mapa Societario" />
        <meta
          property="og:description"
          content="Search companies in Spain, explore BORME registry events, directors, capital changes, and corporate relationships in a graph."
        />
        <meta property="og:url" content={CANONICAL} />
        <meta property="og:type" content="article" />
        <meta name="twitter:title" content="Spanish Company Register Search | Mapa Societario" />
        <meta
          name="twitter:description"
          content="A practical guide to searching Spanish companies through BORME data and relationship graphs."
        />
      </Helmet>

      <Box sx={{ maxWidth: 940, mx: 'auto' }}>
        <Box component="header" sx={{ mb: { xs: 4, sm: 6 } }}>
          <Link href="/" sx={{ color: 'text.secondary', fontSize: '0.85rem', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
            Mapa Societario
          </Link>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 4, mb: 2 }}>
            <Box
              sx={{
                width: 54,
                height: 54,
                borderRadius: 2,
                bgcolor: 'rgba(25,118,210,0.12)',
                color: 'primary.light',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                '& .MuiSvgIcon-root': { fontSize: 30 },
              }}
            >
              <BusinessIcon />
            </Box>
            <Typography variant="overline" sx={{ color: 'primary.light', fontWeight: 700, letterSpacing: '0.12em', lineHeight: 1.3 }}>
              Spanish registry guide
            </Typography>
          </Box>
          <Typography
            variant="h3"
            component="h1"
            sx={{
              fontWeight: 800,
              lineHeight: 1.12,
              letterSpacing: 0,
              fontSize: { xs: '2rem', sm: '2.8rem' },
              maxWidth: 820,
              mb: 2,
            }}
          >
            Spanish company register search, explained
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 760, lineHeight: 1.7, mb: 3 }}>
            Search Spanish companies and directors, understand BORME registry publications, and move from a company lookup to a relationship graph or due diligence report when the registry record needs context.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 4 }}>
            {['Spanish company search', 'BORME', 'Company register Spain', 'Directors and officers'].map((chip) => (
              <Chip key={chip} label={chip} size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.18)' }} />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button variant="contained" startIcon={<SearchIcon />} onClick={() => navigate('/app')} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
              Search a Spanish company
            </Button>
            <Button variant="outlined" startIcon={<DescriptionIcon />} onClick={() => navigate('/spanish-company-due-diligence')} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: 'warning.light', borderColor: 'rgba(255,167,38,0.45)' }}>
              See due diligence reports
            </Button>
          </Box>
          <LegalDisclaimer dense language="en" sx={{ mt: 4 }} />
        </Box>

        <Box component="main" sx={{ display: 'grid', gap: { xs: 3, sm: 4 } }}>
          {sections.map((section) => (
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

          <Box component="section" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
            {cards.map((card) => (
              <Paper key={card.title} elevation={0} sx={{ p: 2.5, bgcolor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
                <Box sx={{ color: 'primary.light', mb: 1, '& .MuiSvgIcon-root': { fontSize: 24 } }}>{card.icon}</Box>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.75 }}>
                  {card.title}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                  {card.text}
                </Typography>
              </Paper>
            ))}
          </Box>

          <Box component="section">
            <Typography variant="h5" component="h2" sx={{ fontWeight: 750, mb: 1.5, letterSpacing: 0 }}>
              How to use Mapa Societario
            </Typography>
            <Box component="ol" sx={{ color: 'text.secondary', pl: 3, m: 0, '& li': { mb: 1.1, lineHeight: 1.65 } }}>
              <li>Open the relationship graph and search by company name or officer name.</li>
              <li>Review the company profile, officers, capital events, sole-shareholder declarations, and connected companies.</li>
              <li>Expand the graph when a director, proxy, or related company needs more context.</li>
              <li>Order a due diligence report only when you need a PDF record for compliance, supplier review, KYB, investment screening, or an internal file.</li>
            </Box>
          </Box>

          <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, bgcolor: 'rgba(255,167,38,0.06)', border: '1px solid rgba(255,167,38,0.22)', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
              <WarningAmberIcon sx={{ color: 'warning.light', mt: 0.2 }} />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 750, mb: 1 }}>
                  Practical limits
                </Typography>
                <Box component="ul" sx={{ color: 'text.secondary', pl: 2.5, m: 0, '& li': { mb: 0.75, lineHeight: 1.6 } }}>
                  {limits.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </Box>
              </Box>
            </Box>
          </Paper>

          <Box component="section" sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', pt: 4 }}>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 750, mb: 2 }}>
              Related tools and resources
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
              <Button href="/app" variant="contained" size="small" startIcon={<HubIcon />} sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 650 }}>
                Relationship graph
              </Button>
              <Button href="/spanish-company-due-diligence" variant="outlined" size="small" startIcon={<DescriptionIcon />} sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 650 }}>
                Due diligence reports
              </Button>
              <Button href="/en/listed-companies" variant="outlined" size="small" startIcon={<VerifiedIcon />} sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 650 }}>
                IBEX 35 companies
              </Button>
              <Button href="/es/borme-grafo-empresas/" variant="outlined" size="small" startIcon={<GavelIcon />} sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 650 }}>
                BORME graph in Spanish
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
