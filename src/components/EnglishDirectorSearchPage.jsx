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
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import { Helmet } from 'react-helmet-async';
import LegalDisclaimer from './LegalDisclaimer';

const SITE_URL = 'https://mapasocietario.es';
const PATH = '/company-director-search/';

const COLORS = {
  page: '#151b2a',
  surface: '#1d2637',
  border: '#344258',
  text: '#f1f5f9',
  body: '#b9c3d2',
  muted: '#8f9caf',
  teal: '#5ed0c2',
  tealStrong: '#22a99a',
};

const sections = [
  {
    title: 'Search a director across Spanish companies',
    body: [
      'Enter a director, administrator, board member or proxy and choose a person result. Mapa Societario brings together the Spanish companies where that name appears in published BORME records.',
      'From the first result, expand the graph to follow appointments, resignations, shared directors and connected companies instead of reviewing each company separately.',
    ],
  },
  {
    title: 'What the results can show',
    body: [
      'Results can reveal current and former roles, the companies connected to the same officer, role changes over time and wider corporate networks. Company profiles also surface registered addresses, share capital and recent BORME filing history when available.',
      'This is useful for preliminary KYB, supplier checks, conflict research, investigative reporting and mapping the business interests associated with a person.',
    ],
  },
  {
    title: 'Important identity limitation',
    body: [
      'BORME publications do not consistently provide a unique personal identifier for every officer. Two people with the same or similar name may therefore appear together, while spelling variants can split one person across several results.',
      'Treat name matches as research leads. Verify identity, current authority and material findings against the original notice and current documents from the relevant Commercial Registry.',
    ],
  },
];

export default function EnglishDirectorSearchPage() {
  const canonical = `${SITE_URL}${PATH}`;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: COLORS.page, color: COLORS.text, px: { xs: 2, sm: 3.5 }, py: { xs: 3, sm: 4 } }}>
      <Helmet htmlAttributes={{ lang: 'en' }}>
        <title>Spanish Company Director Search | Mapa Societario</title>
        <meta
          name="description"
          content="Search Spanish company directors, administrators and officers. Find their companies, appointments, resignations and relationships from BORME records."
        />
        <link rel="canonical" href={canonical} />
        <meta property="og:locale" content="en_GB" />
        <meta property="og:title" content="Spanish Company Director Search | Mapa Societario" />
        <meta property="og:description" content="Find a director or officer across Spanish companies and explore appointments, resignations and corporate relationships from BORME records." />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="article" />
        <meta name="twitter:title" content="Spanish Company Director Search | Mapa Societario" />
        <meta name="twitter:description" content="Search Spanish company directors and explore their published corporate relationships." />
      </Helmet>

      <Box sx={{ maxWidth: 980, mx: 'auto' }}>
        <Box component="header" sx={{ mb: { xs: 4, sm: 5 } }}>
          <Link href="/" sx={{ color: COLORS.muted, fontSize: '0.82rem', textDecoration: 'none', '&:hover': { color: COLORS.teal, textDecoration: 'underline' } }}>
            Mapa Societario
          </Link>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 3, mb: 1.25 }}>
            <PersonSearchIcon sx={{ color: COLORS.teal, fontSize: 23 }} />
            <Typography variant="overline" sx={{ color: COLORS.teal, fontWeight: 700, letterSpacing: '0.1em' }}>
              Search people and corporate roles
            </Typography>
          </Box>
          <Typography component="h1" variant="h3" sx={{ color: COLORS.text, fontWeight: 700, lineHeight: 1.08, letterSpacing: '-0.025em', fontSize: { xs: '2rem', sm: '2.7rem' }, maxWidth: 760, mb: 1.5 }}>
            Search Spanish company directors and officers
          </Typography>
          <Typography variant="body1" sx={{ color: COLORS.body, lineHeight: 1.75, maxWidth: 780, fontSize: { xs: '0.98rem', sm: '1.05rem' }, mb: 2.5 }}>
            Find the Spanish companies linked to a director, administrator, board member or proxy, then explore appointments, resignations and shared corporate relationships published in BORME.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
            {['Directors', 'Administrators', 'Board members', 'Company relationships'].map((label) => (
              <Chip key={label} label={label} size="small" variant="outlined" sx={{ color: COLORS.body, borderColor: COLORS.border }} />
            ))}
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
            <Button href="/app/?lang=en&type=officer&source=director_search" variant="contained" startIcon={<PersonSearchIcon />} sx={{ bgcolor: COLORS.tealStrong, color: '#fff', textTransform: 'none', fontWeight: 700, borderRadius: 2, px: 2.5, '&:hover': { bgcolor: '#168f83' } }}>
              Search a director
            </Button>
            <Button href="/spanish-company-register-search/" variant="outlined" startIcon={<BusinessIcon />} sx={{ color: COLORS.teal, borderColor: COLORS.border, textTransform: 'none', fontWeight: 650, borderRadius: 2 }}>
              Search companies
            </Button>
          </Box>
          <LegalDisclaimer dense language="en" sx={{ mt: 3.5 }} />
        </Box>

        <Box component="main" sx={{ display: 'grid', gap: 2 }}>
          {sections.map((section) => (
            <Paper key={section.title} component="section" elevation={0} sx={{ p: { xs: 2.25, sm: 3 }, bgcolor: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 2.5 }}>
              <Typography component="h2" variant="h5" sx={{ color: COLORS.text, fontWeight: 650, mb: 1.25 }}>
                {section.title}
              </Typography>
              {section.body.map((paragraph) => (
                <Typography key={paragraph} variant="body2" sx={{ color: COLORS.body, lineHeight: 1.75, mb: 1.2, '&:last-child': { mb: 0 } }}>
                  {paragraph}
                </Typography>
              ))}
            </Paper>
          ))}

          <Paper component="section" elevation={0} sx={{ p: { xs: 2.25, sm: 3 }, bgcolor: '#173c3a', border: '1px solid #2e736c', borderRadius: 2.5 }}>
            <Typography component="h2" variant="h5" sx={{ color: COLORS.text, fontWeight: 650, mb: 1 }}>
              Start with a name, then document the company
            </Typography>
            <Typography variant="body2" sx={{ color: COLORS.body, lineHeight: 1.75, mb: 2 }}>
              The relationship graph is free to explore. When a company needs a documented review, move from the graph to a due diligence report with registry history and risk context.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
              <Button href="/app/?lang=en&type=officer&source=director_search_bottom" variant="contained" startIcon={<AccountTreeIcon />} sx={{ bgcolor: COLORS.tealStrong, color: '#fff', textTransform: 'none', fontWeight: 700, borderRadius: 2, '&:hover': { bgcolor: '#168f83' } }}>
                Open officer search
              </Button>
              <Button href="/spanish-company-due-diligence/" variant="outlined" startIcon={<DescriptionIcon />} sx={{ color: COLORS.teal, borderColor: '#2e736c', textTransform: 'none', fontWeight: 650, borderRadius: 2 }}>
                Due diligence reports
              </Button>
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
