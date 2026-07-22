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
    title: 'What this search is—and is not',
    body: [
      'Mapa Societario searches a structured index of acts published in the daily BORME editions. Those publications report acts that Spain’s provincial Commercial Registries have recorded, such as incorporations, appointments, resignations, capital changes and dissolutions.',
      'This is not a direct search of the live Registro Mercantil, a company’s registry sheet, or the Registro Mercantil Central. Mapa Societario does not issue certificates or current authoritative registry extracts. Use the relevant official registry when you need those documents.',
    ],
  },
  {
    title: 'How Spanish company-register acts reach BORME',
    body: [
      'The Registro Mercantil records company acts. Notices of many of those acts are then published in the BORME (Boletín Oficial del Registro Mercantil), the official commercial-registry gazette distributed through Spain’s BOE publication system.',
      'Mapa Societario structures those daily notices into searchable company histories and relationship graphs. Its coverage therefore reflects what was published in BORME; it is not a mirror of every field or document held by the Commercial Registry.',
    ],
  },
  {
    title: 'What the BORME publication search can reveal',
    body: [
      'Published acts can include company formations, officer appointments and removals, capital increases or reductions, mergers, demergers, dissolutions, registered-office changes and sole-shareholder declarations.',
      'Mapa Societario consolidates those chronological notices under each company and officer, preserving published history and turning individual notices into a navigable network of companies, people, roles and corporate events.',
    ],
  },
  {
    title: 'When to use the Registro Mercantil instead',
    body: [
      'Use the relevant Registro Mercantil when you need a certified document, an authoritative current extract, filed annual accounts or information that may be held on the registry sheet but was not published in BORME.',
      'Use Mapa Societario to research published changes over time, find current and former officers inferred from those publications, inspect sole-shareholder declarations and explore cross-company relationships in one consolidated view.',
    ],
  },
  {
    title: 'What the service does not replace',
    body: [
      'BORME does not publish every piece of information held by the Commercial Registry or every fact a buyer, supplier, investor or compliance team may want. Partial shareholders are generally not visible unless a sole-shareholder declaration or another relevant act is published. Annual accounts, beneficial ownership information, websites, emails and commercial contact details require separate sources.',
      'For material decisions, use the service as a publication-history research layer, verify important findings in the cited BORME notice and obtain certificates or updated documents from the Registro Mercantil when required.',
    ],
  },
];

const sourceComparison = [
  {
    source: 'Registro Mercantil',
    provides: 'Authoritative current extracts, certificates and filed documents. Official documents are paid and accessed company by company.',
    relationship: 'Not searched directly by Mapa Societario; it does not provide a cross-company relationship graph.',
  },
  {
    source: 'BORME',
    provides: 'Free daily official gazette notices of acts recorded by Spain’s Commercial Registries.',
    relationship: 'The source publications indexed by Mapa Societario, normally read as separate daily notices.',
  },
  {
    source: 'Mapa Societario',
    provides: 'Free exploration of consolidated BORME publication history since 2009, with company and officer relationship graphs.',
    relationship: 'Independent historical-research tool; not a live registry or certificate service.',
  },
];

const cards = [
  {
    icon: <SearchIcon />,
    title: 'Published company history',
    text: 'Bring appointments, resignations, capital events and other published BORME notices together in one timeline.',
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
  'The underlying BORME notices are official publications. Mapa Societario searches and structures those notices; it does not search the live Registro Mercantil and does not issue certificates.',
  'Automated parsing can occasionally miss or misclassify details; verify important findings in official sources (Bear in mind that the BORME itself may have typos or occasional errors).',
  'Public registry data does not replace legal, financial, tax, or accounting advice.',
];

export default function EnglishRegisterSearchPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = React.useState('');

  const submitSearch = (event) => {
    event.preventDefault();
    const query = searchTerm.trim();
    navigate(query ? `/app?search=${encodeURIComponent(query)}&source=register_guide` : '/app?source=register_guide');
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
        <title>Spanish Company Register Guide &amp; BORME Search | Mapa Societario</title>
        <meta
          name="description"
          content="Understand Spain's company register and search daily BORME publications by company or officer. This is not a live Registro Mercantil or certificate search."
        />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:locale" content="en_US" />
        <meta property="og:title" content="Spanish Company Register Guide & BORME Search | Mapa Societario" />
        <meta
          property="og:description"
          content="Search daily BORME publications and learn when to use the official Registro Mercantil for live records, extracts and certificates."
        />
        <meta property="og:url" content={CANONICAL} />
        <meta property="og:type" content="article" />
        <meta name="twitter:title" content="Spanish Company Register Guide & BORME Search | Mapa Societario" />
        <meta
          name="twitter:description"
          content="Independent search of daily BORME publications—not a direct search of the live Spanish Commercial Registry."
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
              Spanish company register publication research
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
            Spanish company register guide and BORME publication search
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 760, lineHeight: 1.7, mb: 3 }}>
            Search the daily BORME publications issued after Spanish Commercial Registry acts. Mapa Societario does not search the live Registro Mercantil or provide certified current registry records.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 4 }}>
            {['Free to explore', 'BORME history since 2009', 'Relationship graph', 'Official-source notices'].map((chip) => (
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
              Search BORME publications
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

          <Box component="section">
            <Typography variant="h5" component="h2" sx={{ fontWeight: 750, mb: 1.5, letterSpacing: 0 }}>
              Registro Mercantil, BORME and Mapa Societario compared
            </Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <Box
                component="table"
                sx={{
                  width: '100%',
                  maxWidth: 900,
                  borderCollapse: 'collapse',
                  '& th, & td': { border: '1px solid rgba(255,255,255,0.12)', p: 1.5, textAlign: 'left', verticalAlign: 'top' },
                  '& th': { color: 'text.primary', fontWeight: 750, bgcolor: 'rgba(255,255,255,0.04)' },
                  '& td': { color: 'text.secondary', lineHeight: 1.6 },
                }}
              >
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>What it provides</th>
                    <th>Relationship to this search</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceComparison.map((row) => (
                    <tr key={row.source}>
                      <td><strong>{row.source}</strong></td>
                      <td>{row.provides}</td>
                      <td>{row.relationship}</td>
                    </tr>
                  ))}
                </tbody>
              </Box>
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, mt: 1.5, maxWidth: 780 }}>
              Consult the{' '}
              <Link href="https://www.boe.es/diario_borme/" target="_blank" rel="noopener noreferrer">
                official BORME editions
              </Link>{' '}
              or the{' '}
              <Link href="https://www.mjusticia.gob.es/es/ciudadania/registros/propiedad-mercantiles/registro-mercantil" target="_blank" rel="noopener noreferrer">
                Ministry of Justice registry guidance
              </Link>{' '}
              when you need the original publication or official registry services.
            </Typography>
          </Box>

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
