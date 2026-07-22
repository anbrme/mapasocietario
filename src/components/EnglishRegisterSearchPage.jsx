import React from 'react';
import {
  Box,
  Button,
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
    title: 'How registry acts reach BORME',
    body: [
      'The Registro Mercantil records company acts. Notices of many of those acts are then published in the BORME (Boletín Oficial del Registro Mercantil), the official commercial-registry gazette distributed through Spain’s BOE publication system.',
      'Mapa Societario structures those daily notices into searchable company histories and relationship graphs. Its coverage reflects what was published in BORME; it is not a mirror of every field or document held by the Commercial Registry.',
    ],
  },
  {
    title: 'What publication history can reveal',
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
      'BORME does not publish every piece of information held by the Commercial Registry. Partial shareholders are generally not visible unless a sole-shareholder declaration or another relevant act is published. Annual accounts, beneficial ownership information, websites, emails and commercial contact details require separate sources.',
      'For material decisions, use the service as a publication-history research layer, verify important findings in the cited BORME notice and obtain certificates or updated documents from the Registro Mercantil when required.',
    ],
  },
];

const sourceComparison = [
  {
    source: 'Registro Mercantil',
    bestFor: 'Authoritative current extracts, certificates and filed documents',
    history: 'No immediately searchable online history; an offline request typically takes 3–5 days',
    access: 'Paid; historical requests typically cost €20–30 or more',
    graph: 'No',
  },
  {
    source: 'BORME',
    bestFor: 'Reading the original official notices published each day',
    history: 'Separate daily gazette editions',
    access: 'Free',
    graph: 'No',
  },
  {
    source: 'Mapa Societario',
    bestFor: 'Exploring published company and officer history across sources',
    history: 'Consolidated BORME publication history since 2009',
    access: 'Free to explore',
    graph: 'Yes',
    featured: true,
  },
];

const cards = [
  {
    icon: <SearchIcon />,
    title: 'History in one place',
    text: 'Bring appointments, resignations, capital events and other published BORME notices into one chronological view.',
  },
  {
    icon: <AccountTreeIcon />,
    title: 'Officers over time',
    text: 'Research administrators, directors, proxies and other published roles, including historical changes.',
  },
  {
    icon: <HubIcon />,
    title: 'A relationship graph',
    text: 'Follow shared officers, sole shareholders and fully owned participations across connected companies.',
  },
];

const limits = [
  'The underlying BORME notices are official publications. Mapa Societario searches and structures those notices; it does not search the live Registro Mercantil and does not issue certificates.',
  'Automated parsing can occasionally miss or misclassify details. Verify important findings in official sources; BORME itself may also contain occasional errors or typographical mistakes.',
  'Public registry data does not replace legal, financial, tax or accounting advice.',
];

const bodyTextSx = {
  color: '#526076',
  lineHeight: 1.75,
};

function ComparisonTable() {
  return (
    <>
      <Box sx={{ display: { xs: 'none', md: 'block' }, overflowX: 'auto' }}>
        <Box
          component="table"
          sx={{
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: 0,
            '& th, & td': {
              borderBottom: '1px solid #e1e7ee',
              px: 2,
              py: 1.6,
              textAlign: 'left',
              verticalAlign: 'top',
            },
            '& th': {
              bgcolor: '#eef3f7',
              color: '#526076',
              fontSize: '0.73rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            },
            '& td': {
              color: '#425066',
              fontSize: '0.86rem',
              lineHeight: 1.55,
            },
            '& th:first-of-type': { borderTopLeftRadius: 10 },
            '& th:last-of-type': { borderTopRightRadius: 10 },
            '& tr:last-of-type td': { borderBottom: 0 },
          }}
        >
          <thead>
            <tr>
              <th>Source</th>
              <th>Best for</th>
              <th>Historical view</th>
              <th>Access</th>
              <th>Graph</th>
            </tr>
          </thead>
          <tbody>
            {sourceComparison.map((row) => (
              <Box component="tr" key={row.source} sx={{ bgcolor: row.featured ? '#eaf8f5' : '#ffffff' }}>
                <td>
                  <Typography component="span" sx={{ color: row.featured ? '#0f766e' : '#172033', fontSize: '0.9rem', fontWeight: 700 }}>
                    {row.source}
                  </Typography>
                </td>
                <td>{row.bestFor}</td>
                <td>{row.history}</td>
                <td>{row.access}</td>
                <td>
                  <Typography component="span" sx={{ color: row.graph === 'Yes' ? '#0f766e' : '#64748b', fontSize: '0.86rem', fontWeight: 700 }}>
                    {row.graph}
                  </Typography>
                </td>
              </Box>
            ))}
          </tbody>
        </Box>
      </Box>

      <Box sx={{ display: { xs: 'grid', md: 'none' }, gap: 1.25 }}>
        {sourceComparison.map((row) => (
          <Box
            key={row.source}
            sx={{
              p: 2,
              border: `1px solid ${row.featured ? '#8dd6cc' : '#dce3ea'}`,
              borderRadius: 2,
              bgcolor: row.featured ? '#eaf8f5' : '#ffffff',
            }}
          >
            <Typography sx={{ color: row.featured ? '#0f766e' : '#172033', fontWeight: 700, mb: 0.75 }}>
              {row.source}
            </Typography>
            <Typography variant="body2" sx={{ ...bodyTextSx, mb: 1 }}>{row.bestFor}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#718096', fontWeight: 700 }}>Access</Typography>
                <Typography variant="body2" sx={{ color: '#334155' }}>{row.access}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#718096', fontWeight: 700 }}>Relationship graph</Typography>
                <Typography variant="body2" sx={{ color: row.graph === 'Yes' ? '#0f766e' : '#334155', fontWeight: row.graph === 'Yes' ? 700 : 400 }}>{row.graph}</Typography>
              </Box>
            </Box>
            <Typography variant="body2" sx={{ ...bodyTextSx, mt: 1 }}>{row.history}</Typography>
          </Box>
        ))}
      </Box>
    </>
  );
}

export default function EnglishRegisterSearchPage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#f4f7fa',
        color: '#172033',
        px: { xs: 2, sm: 3.5 },
        py: { xs: 3, sm: 4 },
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

      <Box sx={{ maxWidth: 1120, mx: 'auto' }}>
        <Box component="header" sx={{ mb: 3 }}>
          <Link href="/" sx={{ color: '#64748b', fontSize: '0.82rem', textDecoration: 'none', '&:hover': { color: '#0f766e', textDecoration: 'underline' } }}>
            Mapa Societario
          </Link>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' }, gap: { xs: 2, md: 4 }, alignItems: 'end', mt: 2 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
                <BusinessIcon sx={{ color: '#0f766e', fontSize: 21 }} />
                <Typography variant="overline" sx={{ color: '#0f766e', fontWeight: 700, letterSpacing: '0.1em', lineHeight: 1.3 }}>
                  Spanish company publication research
                </Typography>
              </Box>
              <Typography
                variant="h3"
                component="h1"
                sx={{
                  color: '#172033',
                  fontWeight: 750,
                  lineHeight: 1.08,
                  letterSpacing: '-0.025em',
                  fontSize: { xs: '2rem', sm: '2.7rem' },
                  maxWidth: 760,
                  mb: 1.25,
                }}
              >
                Spanish company register guide and BORME publication search
              </Typography>
              <Typography variant="body1" sx={{ ...bodyTextSx, maxWidth: 790, fontSize: { xs: '0.98rem', sm: '1.05rem' } }}>
                Explore the daily BORME publications issued after Spanish Commercial Registry acts—not the live Registro Mercantil or certified current registry records.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'row', md: 'column' }, flexWrap: 'wrap', gap: 1 }}>
              <Button
                href="/app?source=register_guide"
                variant="contained"
                startIcon={<SearchIcon />}
                sx={{
                  bgcolor: '#0f766e',
                  color: '#fff',
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: 2,
                  px: 2.25,
                  '&:hover': { bgcolor: '#0b5f59' },
                }}
              >
                Open the relationship graph
              </Button>
              <Button
                href="/spanish-company-due-diligence"
                variant="text"
                startIcon={<DescriptionIcon />}
                sx={{ color: '#526076', textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
              >
                Due diligence reports
              </Button>
            </Box>
          </Box>
        </Box>

        <Box component="main" sx={{ display: 'grid', gap: { xs: 3, sm: 4 } }}>
          <Paper
            component="section"
            elevation={0}
            sx={{
              p: { xs: 2, sm: 2.5 },
              bgcolor: '#ffffff',
              border: '1px solid #dce3ea',
              borderRadius: 3,
              boxShadow: '0 12px 32px rgba(30, 50, 75, 0.07)',
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', gap: 1, alignItems: { sm: 'baseline' }, mb: 2 }}>
              <Box>
                <Typography variant="h5" component="h2" sx={{ color: '#172033', fontWeight: 700, letterSpacing: '-0.01em', mb: 0.4 }}>
                  Which source should you use?
                </Typography>
                <Typography variant="body2" sx={bodyTextSx}>
                  The three services answer different questions. Registry history requires a paid offline request; Mapa Societario makes BORME publication history immediately explorable as a relationship graph.
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: '#0f766e', fontWeight: 700, whiteSpace: 'nowrap' }}>
                Quick comparison
              </Typography>
            </Box>
            <ComparisonTable />
            <Typography variant="body2" sx={{ ...bodyTextSx, mt: 1.75, fontSize: '0.82rem' }}>
              Need the original notice or an official document? Consult the{' '}
              <Link href="https://www.boe.es/diario_borme/" target="_blank" rel="noopener noreferrer" sx={{ color: '#0f766e', fontWeight: 600 }}>
                official BORME editions
              </Link>{' '}
              or the{' '}
              <Link href="https://www.mjusticia.gob.es/es/ciudadania/registros/propiedad-mercantiles/registro-mercantil" target="_blank" rel="noopener noreferrer" sx={{ color: '#0f766e', fontWeight: 600 }}>
                Ministry of Justice registry guidance
              </Link>.
            </Typography>
          </Paper>

          <LegalDisclaimer
            dense
            language="en"
            sx={{
              mt: -1,
              bgcolor: '#eef7f6',
              borderColor: '#b8ddd8',
              '& .MuiTypography-root': { color: '#526076' },
              '& a': { color: '#0f766e' },
              '& .MuiSvgIcon-root': { color: '#0f766e' },
            }}
          />

          <Box component="section">
            <Typography variant="h5" component="h2" sx={{ color: '#172033', fontWeight: 700, mb: 1.75 }}>
              Why researchers start with Mapa Societario
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
              {cards.map((card) => (
                <Paper key={card.title} elevation={0} sx={{ p: 2.5, bgcolor: '#ffffff', border: '1px solid #dce3ea', borderRadius: 2.5 }}>
                  <Box sx={{ color: '#0f766e', mb: 1.25, '& .MuiSvgIcon-root': { fontSize: 25 } }}>{card.icon}</Box>
                  <Typography variant="body1" sx={{ color: '#172033', fontWeight: 700, mb: 0.75 }}>
                    {card.title}
                  </Typography>
                  <Typography variant="body2" sx={bodyTextSx}>
                    {card.text}
                  </Typography>
                </Paper>
              ))}
            </Box>
          </Box>

          <Box component="section" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
            {sections.map((section) => (
              <Paper key={section.title} elevation={0} sx={{ p: { xs: 2.25, sm: 3 }, bgcolor: '#ffffff', border: '1px solid #e1e7ee', borderRadius: 2.5 }}>
                <Typography variant="h6" component="h2" sx={{ color: '#172033', fontWeight: 700, mb: 1.25, letterSpacing: '-0.01em' }}>
                  {section.title}
                </Typography>
                {section.body.map((paragraph) => (
                  <Typography key={paragraph} variant="body2" sx={{ ...bodyTextSx, mb: 1.25, '&:last-child': { mb: 0 } }}>
                    {paragraph}
                  </Typography>
                ))}
              </Paper>
            ))}
          </Box>

          <Paper component="section" elevation={0} sx={{ p: { xs: 2.25, sm: 3 }, bgcolor: '#eaf8f5', border: '1px solid #b8ddd8', borderRadius: 2.5 }}>
            <Typography variant="h5" component="h2" sx={{ color: '#172033', fontWeight: 700, mb: 1.5 }}>
              How to use Mapa Societario
            </Typography>
            <Box component="ol" sx={{ color: '#526076', pl: 3, m: 0, columns: { md: 2 }, columnGap: 6, '& li': { mb: 1.1, pr: 2, lineHeight: 1.65, breakInside: 'avoid' } }}>
              <li>Open the relationship graph and search by company name or officer name.</li>
              <li>Review the company profile, officers, capital events, sole-shareholder declarations and connected companies.</li>
              <li>Expand the graph when a director, proxy or related company needs more context.</li>
              <li>Order a due diligence report when you need a PDF record for compliance, supplier review, KYB, investment screening or an internal file.</li>
            </Box>
          </Paper>

          <Paper elevation={0} sx={{ p: { xs: 2.25, sm: 2.75 }, bgcolor: '#fff9ed', border: '1px solid #f1d69b', borderRadius: 2.5 }}>
            <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
              <WarningAmberIcon sx={{ color: '#a16207', mt: 0.2 }} />
              <Box>
                <Typography variant="body1" sx={{ color: '#713f12', fontWeight: 700, mb: 1 }}>
                  Practical limits
                </Typography>
                <Box component="ul" sx={{ color: '#66583e', pl: 2.5, m: 0, '& li': { mb: 0.75, lineHeight: 1.65 } }}>
                  {limits.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </Box>
              </Box>
            </Box>
          </Paper>

          <Box component="section" sx={{ borderTop: '1px solid #dce3ea', pt: 3, pb: 2 }}>
            <Typography variant="h6" component="h2" sx={{ color: '#172033', fontWeight: 700, mb: 2 }}>
              Related tools and resources
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
              <Button href="/app?source=register_guide" variant="contained" size="small" startIcon={<HubIcon />} sx={{ bgcolor: '#0f766e', textTransform: 'none', borderRadius: 2, fontWeight: 650, '&:hover': { bgcolor: '#0b5f59' } }}>
                Relationship graph
              </Button>
              <Button href="/spanish-company-due-diligence" variant="outlined" size="small" startIcon={<DescriptionIcon />} sx={{ color: '#0f766e', borderColor: '#8ccfc6', textTransform: 'none', borderRadius: 2, fontWeight: 650 }}>
                Due diligence reports
              </Button>
              <Button href="/en/listed-companies" variant="outlined" size="small" startIcon={<VerifiedIcon />} sx={{ color: '#0f766e', borderColor: '#8ccfc6', textTransform: 'none', borderRadius: 2, fontWeight: 650 }}>
                IBEX 35 companies
              </Button>
              <Button href="/es/borme-grafo-empresas/" variant="outlined" size="small" startIcon={<GavelIcon />} sx={{ color: '#0f766e', borderColor: '#8ccfc6', textTransform: 'none', borderRadius: 2, fontWeight: 650 }}>
                BORME graph in Spanish
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
