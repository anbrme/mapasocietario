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

const COLORS = {
  page: '#151b2a',
  surface: '#1d2637',
  surfaceRaised: '#222d40',
  surfaceSoft: '#263348',
  border: '#344258',
  borderSoft: '#2b374b',
  text: '#f1f5f9',
  body: '#b9c3d2',
  muted: '#8f9caf',
  teal: '#5ed0c2',
  tealStrong: '#22a99a',
  tealSurface: '#173c3a',
  tealBorder: '#2e736c',
};

const COPY = {
  en: {
    path: '/spanish-company-register-search/',
    alternatePath: '/es/busqueda-registro-mercantil/',
    alternateLabel: 'ES',
    title: 'Spanish Company Register Guide & BORME Search | Mapa Societario',
    description: "Compare the Spanish Commercial Registry, BORME and Mapa Societario, then explore daily BORME publication history by company or officer.",
    ogDescription: 'Compare the Spanish Commercial Registry, BORME and Mapa Societario for current documents, publication history, cost and relationship research.',
    twitterDescription: 'Compare the Registro Mercantil, BORME and Mapa Societario—then explore historical BORME publications in a relationship graph.',
    eyebrow: 'Spanish company publication research',
    h1: 'Spanish company register guide and BORME publication search',
    intro: 'Explore the daily BORME publications issued after Spanish Commercial Registry acts—not the live Registro Mercantil or certified current registry records.',
    graphCta: 'Open the relationship graph',
    reportsCta: 'Due diligence reports',
    comparisonTitle: 'Which source should you use?',
    comparisonIntro: 'The three services answer different questions. Registry history requires a paid offline request; Mapa Societario makes BORME publication history immediately explorable as a relationship graph.',
    quickComparison: 'Quick comparison',
    tableLabels: {
      source: 'Source',
      bestFor: 'Best for',
      history: 'Historical view',
      access: 'Access',
      graph: 'Graph',
    },
    comparison: [
      {
        source: 'Mapa Societario',
        bestFor: 'Exploring published company and officer history in one place',
        history: 'Consolidated BORME publication history since 2009',
        access: 'Free to explore',
        graph: 'Yes',
        featured: true,
      },
      {
        source: 'BORME',
        bestFor: 'Reading the original official notices published each day',
        history: 'Separate daily gazette editions',
        access: 'Free',
        graph: 'No',
      },
      {
        source: 'Registro Mercantil',
        bestFor: 'Authoritative current extracts, certificates and filed documents',
        history: 'No immediately searchable online history; an offline request typically takes 3–5 days',
        access: 'Paid; historical requests typically cost €20–30 or more',
        graph: 'No',
      },
    ],
    sourcePrompt: 'Need the original notice or an official document? Consult the',
    bormeLink: 'official BORME editions',
    ministryConnector: 'or the',
    ministryLink: 'Ministry of Justice registry guidance',
    reasonsTitle: 'Why researchers start with Mapa Societario',
    cards: [
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
    ],
    sections: [
      {
        title: 'What this search is—and is not',
        body: [
          'Mapa Societario searches a structured index of acts published in the daily BORME editions. Those publications report acts that Spain’s provincial Commercial Registries have recorded, such as incorporations, appointments, resignations, capital changes and dissolutions.',
          'This is not a direct search of the live Registro Mercantil, a company’s registry sheet or the Registro Mercantil Central. Mapa Societario does not issue certificates or current authoritative registry extracts. Use the relevant official registry when you need those documents.',
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
    ],
    howTitle: 'How to use Mapa Societario',
    howSteps: [
      'Open the relationship graph and search by company name or officer name.',
      'Review the company profile, officers, capital events, sole-shareholder declarations and connected companies.',
      'Expand the graph when a director, proxy or related company needs more context.',
      'Order a due diligence report when you need a PDF record for compliance, supplier review, KYB, investment screening or an internal file.',
    ],
    limitsTitle: 'Practical limits',
    limits: [
      'The underlying BORME notices are official publications. Mapa Societario searches and structures those notices; it does not search the live Registro Mercantil and does not issue certificates.',
      'Automated parsing can occasionally miss or misclassify details. Verify important findings in official sources; BORME itself may also contain occasional errors or typographical mistakes.',
      'Public registry data does not replace legal, financial, tax or accounting advice.',
    ],
    relatedTitle: 'Related tools and resources',
    related: {
      graph: 'Relationship graph',
      reports: 'Due diligence reports',
      listed: 'IBEX 35 companies',
      borme: 'BORME graph in Spanish',
    },
    graphHref: '/app?source=register_guide',
    reportsHref: '/spanish-company-due-diligence',
    listedHref: '/en/listed-companies',
  },
  es: {
    path: '/es/busqueda-registro-mercantil/',
    alternatePath: '/spanish-company-register-search/',
    alternateLabel: 'EN',
    title: 'Registro Mercantil, BORME y Mapa Societario | Comparativa',
    description: 'Compara el Registro Mercantil, el BORME y Mapa Societario por historial, coste y grafo, y explora publicaciones mercantiles desde 2009.',
    ogDescription: 'Qué fuente usar para documentos actuales, publicaciones históricas y relaciones societarias: Registro Mercantil, BORME o Mapa Societario.',
    twitterDescription: 'Compara Registro Mercantil, BORME y Mapa Societario y explora el historial publicado en un grafo de relaciones.',
    eyebrow: 'Investigación de publicaciones mercantiles',
    h1: 'Registro Mercantil, BORME y Mapa Societario: qué fuente usar',
    intro: 'Explora las publicaciones diarias del BORME posteriores a actos del Registro Mercantil; no es una consulta directa del Registro ni ofrece certificaciones registrales actuales.',
    graphCta: 'Abrir el grafo de relaciones',
    reportsCta: 'Informes due diligence',
    comparisonTitle: '¿Qué fuente debes utilizar?',
    comparisonIntro: 'Las tres fuentes responden a necesidades distintas. El historial del Registro exige una solicitud offline de pago; Mapa Societario permite explorar inmediatamente el historial publicado en BORME como un grafo de relaciones.',
    quickComparison: 'Comparativa rápida',
    tableLabels: {
      source: 'Fuente',
      bestFor: 'Mejor para',
      history: 'Visión histórica',
      access: 'Acceso',
      graph: 'Grafo',
    },
    comparison: [
      {
        source: 'Mapa Societario',
        bestFor: 'Explorar en un solo lugar el historial publicado de empresas y administradores',
        history: 'Historial consolidado de publicaciones BORME desde 2009',
        access: 'Exploración gratuita',
        graph: 'Sí',
        featured: true,
      },
      {
        source: 'BORME',
        bestFor: 'Leer los anuncios oficiales originales publicados cada día',
        history: 'Ediciones diarias separadas',
        access: 'Gratis',
        graph: 'No',
      },
      {
        source: 'Registro Mercantil',
        bestFor: 'Notas, certificaciones y documentos oficiales actuales',
        history: 'No ofrece un historial consultable en línea de forma inmediata; una solicitud offline suele tardar 3–5 días',
        access: 'De pago; las solicitudes históricas suelen costar 20–30 € o más',
        graph: 'No',
      },
    ],
    sourcePrompt: '¿Necesitas el anuncio original o un documento oficial? Consulta las',
    bormeLink: 'ediciones oficiales del BORME',
    ministryConnector: 'o la',
    ministryLink: 'información del Ministerio de Justicia sobre el Registro Mercantil',
    reasonsTitle: 'Por qué empezar con Mapa Societario',
    cards: [
      {
        icon: <SearchIcon />,
        title: 'Historial en un solo lugar',
        text: 'Reúne nombramientos, ceses, eventos de capital y otras publicaciones BORME en una vista cronológica.',
      },
      {
        icon: <AccountTreeIcon />,
        title: 'Administradores a lo largo del tiempo',
        text: 'Investiga administradores, consejeros, apoderados y otros cargos publicados, incluidos sus cambios históricos.',
      },
      {
        icon: <HubIcon />,
        title: 'Un grafo de relaciones',
        text: 'Sigue administradores compartidos, socios únicos y participaciones íntegramente poseídas entre empresas conectadas.',
      },
    ],
    sections: [
      {
        title: 'Qué busca esta herramienta y qué no',
        body: [
          'Mapa Societario busca en un índice estructurado de actos publicados en las ediciones diarias del BORME. Esas publicaciones recogen actos inscritos por los Registros Mercantiles provinciales, como constituciones, nombramientos, ceses, cambios de capital y disoluciones.',
          'No es una consulta directa del Registro Mercantil en vivo, de la hoja registral de una sociedad ni del Registro Mercantil Central. Mapa Societario no emite certificaciones ni notas registrales actuales con valor oficial. Utiliza el registro correspondiente cuando necesites esos documentos.',
        ],
      },
      {
        title: 'Cómo llegan los actos registrales al BORME',
        body: [
          'El Registro Mercantil inscribe los actos societarios. Muchos de esos actos se publican después en el BORME (Boletín Oficial del Registro Mercantil), el boletín oficial mercantil distribuido a través del sistema de publicación del BOE.',
          'Mapa Societario estructura esos anuncios diarios como historiales de empresas y grafos de relaciones. Su cobertura refleja lo publicado en BORME; no reproduce todos los campos ni documentos conservados por el Registro Mercantil.',
        ],
      },
      {
        title: 'Qué puede revelar el historial publicado',
        body: [
          'Los actos publicados pueden incluir constituciones, nombramientos y ceses, ampliaciones o reducciones de capital, fusiones, escisiones, disoluciones, cambios de domicilio y declaraciones de socio único.',
          'Mapa Societario consolida esos anuncios cronológicos por empresa y administrador, conserva el historial publicado y convierte anuncios individuales en una red navegable de sociedades, personas, cargos y eventos corporativos.',
        ],
      },
      {
        title: 'Cuándo utilizar el Registro Mercantil',
        body: [
          'Utiliza el Registro Mercantil correspondiente cuando necesites una certificación, una nota actual con valor oficial, cuentas depositadas o información que pueda constar en la hoja registral pero no se haya publicado en BORME.',
          'Utiliza Mapa Societario para investigar cambios publicados a lo largo del tiempo, localizar administradores actuales y anteriores inferidos de esas publicaciones, revisar declaraciones de socio único y explorar relaciones entre empresas en una sola vista.',
        ],
      },
      {
        title: 'Qué no sustituye el servicio',
        body: [
          'El BORME no publica toda la información conservada por el Registro Mercantil. Los socios parciales normalmente no son visibles salvo que se publique una declaración de socio único u otro acto relevante. Las cuentas anuales, la titularidad real, las páginas web, los correos y los datos de contacto comercial requieren fuentes adicionales.',
          'Para decisiones relevantes, usa el servicio como una capa de investigación del historial publicado, verifica los hallazgos importantes en el anuncio BORME citado y solicita certificaciones o documentos actualizados al Registro Mercantil cuando corresponda.',
        ],
      },
    ],
    howTitle: 'Cómo utilizar Mapa Societario',
    howSteps: [
      'Abre el grafo de relaciones y busca por nombre de empresa o de administrador.',
      'Revisa la ficha de la empresa, sus cargos, eventos de capital, declaraciones de socio único y sociedades conectadas.',
      'Amplía el grafo cuando un administrador, apoderado o empresa relacionada necesite más contexto.',
      'Solicita un informe due diligence cuando necesites un PDF para compliance, revisión de proveedores, KYB, análisis de inversión o archivo interno.',
    ],
    limitsTitle: 'Límites prácticos',
    limits: [
      'Los anuncios BORME subyacentes son publicaciones oficiales. Mapa Societario busca y estructura esos anuncios; no consulta directamente el Registro Mercantil en vivo ni emite certificaciones.',
      'El análisis automatizado puede omitir o clasificar incorrectamente algún dato. Verifica los hallazgos importantes en las fuentes oficiales; el propio BORME también puede contener errores o erratas ocasionales.',
      'Los datos registrales públicos no sustituyen el asesoramiento jurídico, financiero, fiscal o contable.',
    ],
    relatedTitle: 'Herramientas y recursos relacionados',
    related: {
      graph: 'Grafo de relaciones',
      reports: 'Informes due diligence',
      listed: 'Empresas del IBEX 35',
      borme: 'Grafo de empresas BORME',
    },
    graphHref: '/app?lang=es&source=register_guide',
    reportsHref: '/due-diligence?lang=es',
    listedHref: '/empresas-cotizadas',
  },
};

const bodyTextSx = {
  color: COLORS.body,
  lineHeight: 1.75,
};

function ComparisonTable({ copy }) {
  const yesLabel = copy.comparison[0].graph;

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
              borderBottom: `1px solid ${COLORS.border}`,
              px: 2,
              py: 1.6,
              textAlign: 'left',
              verticalAlign: 'top',
            },
            '& th': {
              bgcolor: COLORS.surfaceSoft,
              color: COLORS.body,
              fontSize: '0.73rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            },
            '& td': {
              color: COLORS.body,
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
              <th>{copy.tableLabels.source}</th>
              <th>{copy.tableLabels.bestFor}</th>
              <th>{copy.tableLabels.history}</th>
              <th>{copy.tableLabels.access}</th>
              <th>{copy.tableLabels.graph}</th>
            </tr>
          </thead>
          <tbody>
            {copy.comparison.map((row) => (
              <Box component="tr" key={row.source} sx={{ bgcolor: row.featured ? COLORS.tealSurface : COLORS.surface }}>
                <td>
                  <Typography component="span" sx={{ color: row.featured ? COLORS.teal : COLORS.text, fontSize: '0.9rem', fontWeight: 700 }}>
                    {row.source}
                  </Typography>
                </td>
                <td>{row.bestFor}</td>
                <td>{row.history}</td>
                <td>{row.access}</td>
                <td>
                  <Typography component="span" sx={{ color: row.graph === yesLabel ? COLORS.teal : COLORS.muted, fontSize: '0.86rem', fontWeight: 700 }}>
                    {row.graph}
                  </Typography>
                </td>
              </Box>
            ))}
          </tbody>
        </Box>
      </Box>

      <Box sx={{ display: { xs: 'grid', md: 'none' }, gap: 1.25 }}>
        {copy.comparison.map((row) => (
          <Box
            key={row.source}
            sx={{
              p: 2,
              border: `1px solid ${row.featured ? COLORS.tealBorder : COLORS.border}`,
              borderRadius: 2,
              bgcolor: row.featured ? COLORS.tealSurface : COLORS.surfaceRaised,
            }}
          >
            <Typography sx={{ color: row.featured ? COLORS.teal : COLORS.text, fontWeight: 700, mb: 0.75 }}>
              {row.source}
            </Typography>
            <Typography variant="body2" sx={{ ...bodyTextSx, mb: 1 }}>{row.bestFor}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <Box>
                <Typography variant="caption" sx={{ color: COLORS.muted, fontWeight: 700 }}>{copy.tableLabels.access}</Typography>
                <Typography variant="body2" sx={{ color: COLORS.body }}>{row.access}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: COLORS.muted, fontWeight: 700 }}>{copy.tableLabels.graph}</Typography>
                <Typography variant="body2" sx={{ color: row.graph === yesLabel ? COLORS.teal : COLORS.body, fontWeight: row.graph === yesLabel ? 700 : 400 }}>{row.graph}</Typography>
              </Box>
            </Box>
            <Typography variant="body2" sx={{ ...bodyTextSx, mt: 1 }}>{row.history}</Typography>
          </Box>
        ))}
      </Box>
    </>
  );
}

export default function EnglishRegisterSearchPage({ language = 'en' }) {
  const lang = language === 'es' ? 'es' : 'en';
  const copy = COPY[lang];
  const canonical = `${SITE_URL}${copy.path}`;
  const alternate = `${SITE_URL}${copy.alternatePath}`;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: COLORS.page,
        color: COLORS.text,
        px: { xs: 2, sm: 3.5 },
        py: { xs: 3, sm: 4 },
      }}
    >
      <Helmet htmlAttributes={{ lang }}>
        <title>{copy.title}</title>
        <meta name="description" content={copy.description} />
        <link rel="canonical" href={canonical} />
        <link rel="alternate" hrefLang="en" href={`${SITE_URL}${COPY.en.path}`} />
        <link rel="alternate" hrefLang="es" href={`${SITE_URL}${COPY.es.path}`} />
        <link rel="alternate" hrefLang="x-default" href={`${SITE_URL}${COPY.en.path}`} />
        <meta property="og:locale" content={lang === 'es' ? 'es_ES' : 'en_US'} />
        <meta property="og:title" content={copy.title} />
        <meta property="og:description" content={copy.ogDescription} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="article" />
        <meta name="twitter:title" content={copy.title} />
        <meta name="twitter:description" content={copy.twitterDescription} />
      </Helmet>

      <Box sx={{ maxWidth: 1120, mx: 'auto' }}>
        <Box component="header" sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link href={lang === 'es' ? '/es' : '/'} sx={{ color: COLORS.muted, fontSize: '0.82rem', textDecoration: 'none', '&:hover': { color: COLORS.teal, textDecoration: 'underline' } }}>
              Mapa Societario
            </Link>
            <Link href={alternate} hrefLang={lang === 'es' ? 'en' : 'es'} sx={{ color: COLORS.body, fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none', border: `1px solid ${COLORS.border}`, borderRadius: 1.5, px: 1.2, py: 0.45, '&:hover': { color: COLORS.teal, borderColor: COLORS.tealBorder } }}>
              {copy.alternateLabel}
            </Link>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' }, gap: { xs: 2, md: 4 }, alignItems: 'end', mt: 2 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
                <BusinessIcon sx={{ color: COLORS.teal, fontSize: 21 }} />
                <Typography variant="overline" sx={{ color: COLORS.teal, fontWeight: 700, letterSpacing: '0.1em', lineHeight: 1.3 }}>
                  {copy.eyebrow}
                </Typography>
              </Box>
              <Typography
                variant="h3"
                component="h1"
                sx={{
                  color: COLORS.text,
                  fontWeight: 700,
                  lineHeight: 1.08,
                  letterSpacing: '-0.025em',
                  fontSize: { xs: '2rem', sm: '2.7rem' },
                  maxWidth: 790,
                  mb: 1.25,
                }}
              >
                {copy.h1}
              </Typography>
              <Typography variant="body1" sx={{ ...bodyTextSx, maxWidth: 810, fontSize: { xs: '0.98rem', sm: '1.05rem' } }}>
                {copy.intro}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'row', md: 'column' }, flexWrap: 'wrap', gap: 1 }}>
              <Button
                href={copy.graphHref}
                variant="contained"
                startIcon={<SearchIcon />}
                sx={{
                  bgcolor: COLORS.tealStrong,
                  color: '#ffffff',
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: 2,
                  px: 2.25,
                  '&:hover': { bgcolor: '#168f83' },
                }}
              >
                {copy.graphCta}
              </Button>
              <Button
                href={copy.reportsHref}
                variant="text"
                startIcon={<DescriptionIcon />}
                sx={{ color: COLORS.body, textTransform: 'none', fontWeight: 600, borderRadius: 2, '&:hover': { color: COLORS.text, bgcolor: 'rgba(255,255,255,0.04)' } }}
              >
                {copy.reportsCta}
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
              bgcolor: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 3,
              boxShadow: '0 14px 34px rgba(0, 0, 0, 0.16)',
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', gap: 1, alignItems: { sm: 'baseline' }, mb: 2 }}>
              <Box>
                <Typography variant="h5" component="h2" sx={{ color: COLORS.text, fontWeight: 650, letterSpacing: '-0.01em', mb: 0.4 }}>
                  {copy.comparisonTitle}
                </Typography>
                <Typography variant="body2" sx={bodyTextSx}>
                  {copy.comparisonIntro}
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: COLORS.teal, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {copy.quickComparison}
              </Typography>
            </Box>
            <ComparisonTable copy={copy} />
            <Typography variant="body2" sx={{ ...bodyTextSx, mt: 1.75, fontSize: '0.82rem' }}>
              {copy.sourcePrompt}{' '}
              <Link href="https://www.boe.es/diario_borme/" target="_blank" rel="noopener noreferrer" sx={{ color: COLORS.teal, fontWeight: 600 }}>
                {copy.bormeLink}
              </Link>{' '}
              {copy.ministryConnector}{' '}
              <Link href="https://www.mjusticia.gob.es/es/ciudadania/registros/propiedad-mercantiles/registro-mercantil" target="_blank" rel="noopener noreferrer" sx={{ color: COLORS.teal, fontWeight: 600 }}>
                {copy.ministryLink}
              </Link>.
            </Typography>
          </Paper>

          <LegalDisclaimer
            dense
            language={lang}
            sx={{
              mt: -1,
              bgcolor: '#1a3338',
              borderColor: COLORS.tealBorder,
              '& .MuiTypography-root': { color: COLORS.body },
              '& a': { color: COLORS.teal },
              '& .MuiSvgIcon-root': { color: COLORS.teal },
            }}
          />

          <Box component="section">
            <Typography variant="h5" component="h2" sx={{ color: COLORS.text, fontWeight: 650, mb: 1.75 }}>
              {copy.reasonsTitle}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
              {copy.cards.map((card) => (
                <Paper key={card.title} elevation={0} sx={{ p: 2.5, bgcolor: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 2.5 }}>
                  <Box sx={{ color: COLORS.teal, mb: 1.25, '& .MuiSvgIcon-root': { fontSize: 25 } }}>{card.icon}</Box>
                  <Typography variant="body1" sx={{ color: COLORS.text, fontWeight: 650, mb: 0.75 }}>
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
            {copy.sections.map((section) => (
              <Paper key={section.title} elevation={0} sx={{ p: { xs: 2.25, sm: 3 }, bgcolor: COLORS.surface, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 2.5 }}>
                <Typography variant="h6" component="h2" sx={{ color: COLORS.text, fontWeight: 650, mb: 1.25, letterSpacing: '-0.01em' }}>
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

          <Paper component="section" elevation={0} sx={{ p: { xs: 2.25, sm: 3 }, bgcolor: COLORS.tealSurface, border: `1px solid ${COLORS.tealBorder}`, borderRadius: 2.5 }}>
            <Typography variant="h5" component="h2" sx={{ color: COLORS.text, fontWeight: 650, mb: 1.5 }}>
              {copy.howTitle}
            </Typography>
            <Box component="ol" sx={{ color: COLORS.body, pl: 3, m: 0, columns: { md: 2 }, columnGap: 6, '& li': { mb: 1.1, pr: 2, lineHeight: 1.65, breakInside: 'avoid' } }}>
              {copy.howSteps.map((step) => <li key={step}>{step}</li>)}
            </Box>
          </Paper>

          <Paper elevation={0} sx={{ p: { xs: 2.25, sm: 2.75 }, bgcolor: '#332b1f', border: '1px solid #6d5931', borderRadius: 2.5 }}>
            <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
              <WarningAmberIcon sx={{ color: '#e5b95f', mt: 0.2 }} />
              <Box>
                <Typography variant="body1" sx={{ color: '#f1d79f', fontWeight: 650, mb: 1 }}>
                  {copy.limitsTitle}
                </Typography>
                <Box component="ul" sx={{ color: '#d4c5a8', pl: 2.5, m: 0, '& li': { mb: 0.75, lineHeight: 1.65 } }}>
                  {copy.limits.map((item) => <li key={item}>{item}</li>)}
                </Box>
              </Box>
            </Box>
          </Paper>

          <Box component="section" sx={{ borderTop: `1px solid ${COLORS.border}`, pt: 3, pb: 2 }}>
            <Typography variant="h6" component="h2" sx={{ color: COLORS.text, fontWeight: 650, mb: 2 }}>
              {copy.relatedTitle}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
              <Button href={copy.graphHref} variant="contained" size="small" startIcon={<HubIcon />} sx={{ bgcolor: COLORS.tealStrong, textTransform: 'none', borderRadius: 2, fontWeight: 650, '&:hover': { bgcolor: '#168f83' } }}>
                {copy.related.graph}
              </Button>
              <Button href={copy.reportsHref} variant="outlined" size="small" startIcon={<DescriptionIcon />} sx={{ color: COLORS.teal, borderColor: COLORS.tealBorder, textTransform: 'none', borderRadius: 2, fontWeight: 650 }}>
                {copy.related.reports}
              </Button>
              <Button href={copy.listedHref} variant="outlined" size="small" startIcon={<VerifiedIcon />} sx={{ color: COLORS.teal, borderColor: COLORS.tealBorder, textTransform: 'none', borderRadius: 2, fontWeight: 650 }}>
                {copy.related.listed}
              </Button>
              <Button href="/es/borme-grafo-empresas/" variant="outlined" size="small" startIcon={<GavelIcon />} sx={{ color: COLORS.teal, borderColor: COLORS.tealBorder, textTransform: 'none', borderRadius: 2, fontWeight: 650 }}>
                {copy.related.borme}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
