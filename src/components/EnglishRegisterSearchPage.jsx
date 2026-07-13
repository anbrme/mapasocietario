import React from 'react';
import {
  Box,
  Button,
  Chip,
  Link,
  Paper,
  TextField,
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
const CANONICAL = `${SITE_URL}/spanish-company-register-search/`;

const sections = [
  {
    title: 'Official BORME publications, structured for research',
    body: [
      'Mapa Societario is an independent company-information database built from official BORME publications issued through Spain’s BOE publication system. It structures daily corporate notices into searchable company histories and relationship graphs.',
      'Use it to find a Spanish company, review current and historical officers, follow appointments and resignations, inspect capital changes and sole-shareholder declarations, and understand connections that would otherwise require reading many separate publications.',
    ],
  },
  {
    title: 'What the database can reveal',
    body: [
      'BORME—the Boletín Oficial del Registro Mercantil—is the official gazette where Spanish Commercial Registry acts are published. These include company formations, officer appointments and removals, capital increases or reductions, mergers, demergers, dissolutions, registered-office changes and sole-shareholder declarations.',
      'Mapa Societario consolidates those chronological publications under each company and officer, preserving history and turning individual notices into a navigable network of companies, people, roles and corporate events.',
    ],
  },
  {
    title: 'How this differs from the Registro Mercantil',
    body: [
      'The Registro Mercantil is the authoritative source for current certificates and official registry documents. Mapa Societario is not the Registro Mercantil and does not issue certified documents.',
      'Its purpose is different: it makes official-source publication history easier to search and analyze. It can show changes over time, current and former officers, sole-shareholder declarations, fully owned participations and cross-company relationships in one consolidated view.',
    ],
  },
  {
    title: 'What the database does not replace',
    body: [
      'BORME does not publish every piece of commercial intelligence a buyer, supplier, investor or compliance team may want. Partial shareholders are generally not visible unless a sole-shareholder declaration or another relevant act is published. Annual accounts, beneficial ownership information, websites, emails and commercial contact details require separate sources.',
      'For material decisions, use the database as an official-source research layer, then verify current information in the relevant BORME publication and obtain certificates or updated documents from the Registro Mercantil when required.',
    ],
  },
];

const cards = [
  {
    icon: <SearchIcon />,
    title: 'Company history',
    text: 'Bring appointments, resignations, capital events and other BORME notices together in one timeline.',
  },
  {
    icon: <AccountTreeIcon />,
    title: 'Officers over time',
    text: 'Search administrators, directors, proxies and other published roles, including historical changes.',
  },
  {
    icon: <DescriptionIcon />,
    title: 'Corporate relationships',
    text: 'Follow shared officers, sole shareholders and fully owned participations across connected companies.',
  },
];

const limits = [
  'The underlying BORME publications are official sources. Mapa Societario is an independent service that structures and analyzes them; it is not the Registro Mercantil and does not issue certificates.',
  'Automated parsing can occasionally miss or misclassify details; verify important findings in official sources (Bear in mind that the BORME itself may have typos or occasional errors).',
  'Public registry data does not replace legal, financial, tax, or accounting advice.',
];

export default function EnglishRegisterSearchPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = React.useState('');

  const submitSearch = (event) => {
    event.preventDefault();
    const query = searchTerm.trim();
    navigate(query ? `/app?search=${encodeURIComponent(query)}` : '/app');
  };

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
        <title>Spanish Company Database &amp; BORME Search | Mapa Societario</title>
        <meta
          name="description"
          content="Search Spanish companies, officers and corporate history in an independent database built from official BORME publications. Explore changes and relationships over time."
        />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:locale" content="en_US" />
        <meta property="og:title" content="Spanish Company Database & BORME Search | Mapa Societario" />
        <meta
          property="og:description"
          content="Search official-source BORME company history, current and former officers, sole-shareholder declarations and corporate relationships."
        />
        <meta property="og:url" content={CANONICAL} />
        <meta property="og:type" content="article" />
        <meta name="twitter:title" content="Spanish Company Database & BORME Search | Mapa Societario" />
        <meta
          name="twitter:description"
          content="An independent company database built from official BORME publications, with history and relationship graphs."
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
                bgcolor: 'rgba(20,184,166,0.12)',
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
              Official-source BORME database
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
            Search Spanish companies, officers and BORME history
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 760, lineHeight: 1.7, mb: 3 }}>
            Explore an independent database built from official Spanish BORME publications. See company history, current and former officers, sole-shareholder declarations and corporate relationships in one searchable graph.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 4 }}>
            {['Official BORME sources', 'Company history', 'Officers over time', 'Sole shareholders'].map((chip) => (
              <Chip key={chip} label={chip} size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.18)' }} />
            ))}
          </Box>
          <Paper component="form" onSubmit={submitSearch} elevation={0} sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.25, p: 1.25, mb: 2, maxWidth: 720, bgcolor: 'rgba(255,255,255,0.035)', border: '1px solid rgba(45,212,191,0.24)', borderRadius: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="Spanish company name"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              inputProps={{ 'aria-label': 'Spanish company name' }}
            />
            <Button type="submit" variant="contained" startIcon={<SearchIcon />} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, whiteSpace: 'nowrap' }}>
              Search BORME data
            </Button>
          </Paper>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
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
