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
import SearchIcon from '@mui/icons-material/Search';
import DescriptionIcon from '@mui/icons-material/Description';
import VerifiedIcon from '@mui/icons-material/Verified';
import HubIcon from '@mui/icons-material/Hub';
import GavelIcon from '@mui/icons-material/Gavel';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import SecurityIcon from '@mui/icons-material/Security';
import { Helmet } from 'react-helmet-async';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import LegalDisclaimer from './LegalDisclaimer';

const SITE_URL = 'https://mapasocietario.es';

const SpanishPageShell = ({ children }) => (
  <Box
    sx={{
      minHeight: '100vh',
      bgcolor: '#0a0e1a',
      color: 'text.primary',
      px: { xs: 2.25, sm: 4 },
      py: { xs: 4, sm: 6 },
    }}
  >
    <Box sx={{ maxWidth: 920, mx: 'auto' }}>{children}</Box>
  </Box>
);

const pages = {
  home: {
    path: '/es',
    title: 'Mapa Societario de Empresas Españolas | Mapa Societario',
    description:
      'Busca empresas y administradores en España. Visualiza relaciones societarias basadas en BORME y genera informes due diligence desde EUR 22.50.',
    h1: 'Mapa societario de empresas españolas',
    eyebrow: 'BORME, administradores y relaciones societarias',
    intro:
      'Explora empresas, administradores, cargos y conexiones societarias en España con un grafo interactivo basado en publicaciones oficiales del BORME.',
    icon: <AccountTreeIcon />,
    chips: ['Grafo gratuito', 'Socios únicos', 'Sanciones BOE', 'Cargos políticos Congreso'],
    sections: [
      {
        title: 'Qué puedes investigar',
        body: [
          'Mapa Societario permite buscar una sociedad española y ver sus administradores, cargos, socios únicos y participaciones íntegramente poseídas por otras sociedades. También puedes buscar por persona para descubrir en qué sociedades aparece como administrador, consejero, apoderado u otro cargo mercantil.',
          'La herramienta está pensada para compliance, KYC, periodistas, analistas, abogados, inversores y equipos comerciales que necesitan entender rápido quién está detrás de una sociedad o cómo se conecta un grupo empresarial.',
        ],
      },
      {
        title: 'Por qué es útil',
        body: [
          'El BORME contiene información pública esencial, pero no siempre es cómodo para una investigación rápida. Convertimos esas publicaciones en un índice consultable y en un grafo que permite seguir relaciones entre sociedades y personas.',
          'Puedes usar el grafo gratis y pedir un informe due diligence cuando necesites un PDF con análisis más profundo, historial societario, señales de riesgo, comprobación de sanciones en el BOE y controles adicionales. Además, el grafo cruza administradores con diputados que tienen o tuvieron cargo político en el Congreso de los Diputados, marcándolos con una insignia amarilla.',
        ],
      },
    ],
    cards: [
      { icon: <SearchIcon />, title: 'Buscar empresas', text: 'Encuentra sociedades españolas por nombre y abre su red de administradores.' },
      { icon: <HubIcon />, title: 'Explorar conexiones', text: 'Expande nodos para descubrir sociedades relacionadas, cargos compartidos, socios únicos, participaciones al 100% y coincidencias con diputados.' },
      { icon: <DescriptionIcon />, title: 'Pedir informes', text: 'Genera informes due diligence en PDF para empresas concretas.' },
    ],
  },
  'informes-due-diligence-empresas': {
    path: '/es/informes-due-diligence-empresas',
    title: 'Informes Due Diligence de Empresas Españolas | Mapa Societario',
    description:
      'Informes due diligence para empresas españolas con estructura societaria, historial de administradores, eventos BORME, señales de riesgo y PDF profesional.',
    h1: 'Informes due diligence de empresas españolas',
    eyebrow: 'PDF mercantil con análisis y contexto',
    intro:
      'Compra un informe due diligence para una sociedad española cuando necesites documentar una revisión de contraparte, proveedor, cliente, inversión o adquisición.',
    icon: <DescriptionIcon />,
    chips: ['PDF profesional', 'Socios únicos', 'Sanciones BOE', 'Cargos políticos Congreso'],
    sections: [
      {
        title: 'Qué incluye el informe',
        body: [
          'El informe reúne información mercantil estructurada: administradores actuales e históricos, socios únicos, participaciones íntegramente poseídas, cambios publicados, eventos de capital, relaciones societarias, señales de riesgo y un resumen preparado para revisión interna.',
          'También puede incorporar análisis apoyado por IA, comprobación de sanciones publicadas en el BOE, cruce con diputados que tienen o tuvieron cargo político en el Congreso de los Diputados y controles adicionales, manteniendo siempre la trazabilidad hacia las fuentes públicas disponibles.',
        ],
      },
      {
        title: 'Cuándo usarlo',
        body: [
          'Es especialmente útil antes de contratar proveedores, aprobar clientes, estudiar inversiones, revisar sociedades vinculadas o preparar documentación de KYC y compliance.',
          'El grafo gratuito te ayuda a explorar primero. Cuando encuentres una empresa relevante, puedes pasar a un informe con más contexto y formato documental.',
        ],
      },
    ],
    cards: [
      { icon: <SecurityIcon />, title: 'Compliance y KYC', text: 'Documenta la revisión de una contraparte con estructura societaria, sanciones BOE y posibles cargos políticos en el Congreso.' },
      { icon: <GavelIcon />, title: 'Revisión mercantil', text: 'Consulta cargos, ceses, nombramientos y eventos relevantes.' },
      { icon: <VerifiedIcon />, title: 'Sin suscripción', text: 'Pago único por informe, sin crear una cuenta para explorar el grafo.' },
    ],
  },
  'buscar-administradores-empresas': {
    path: '/es/buscar-administradores-empresas',
    title: 'Buscar Administradores de Empresas en España | Mapa Societario',
    description:
      'Busca administradores, consejeros y cargos mercantiles en empresas españolas. Explora sociedades vinculadas y relaciones publicadas en BORME.',
    h1: 'Buscar administradores de empresas en España',
    eyebrow: 'Búsqueda por persona y cargo mercantil',
    intro:
      'Localiza en qué empresas aparece una persona y explora sus cargos, nombramientos, ceses y sociedades relacionadas a partir de datos publicados en el BORME.',
    icon: <SearchIcon />,
    chips: ['Administradores', 'Consejeros', 'Diputados identificados', 'Sociedades vinculadas'],
    sections: [
      {
        title: 'Cómo funciona la búsqueda',
        body: [
          'Puedes cambiar el buscador a modo persona y escribir el nombre de un administrador, consejero o apoderado. La herramienta muestra sociedades asociadas, permite expandir la red para seguir conexiones e identifica con una insignia amarilla a quienes tienen o tuvieron un cargo político en el Congreso de los Diputados.',
          'Como el BORME no siempre proporciona identificadores personales únicos, la coincidencia de nombres debe interpretarse con cautela, especialmente en nombres frecuentes.',
        ],
      },
      {
        title: 'Preguntas que ayuda a responder',
        body: [
          'Qué sociedades administra una persona, dónde ha tenido cargos, si varias empresas comparten administradores, si un directivo aparece conectado con redes empresariales más amplias o si coincide con un diputado o exdiputado del Congreso.',
          'Para investigaciones sensibles, conviene validar la información con fuentes oficiales y documentación mercantil adicional.',
        ],
      },
    ],
    cards: [
      { icon: <AccountTreeIcon />, title: 'Ver red de cargos', text: 'Pasa de una persona a sus sociedades y de cada sociedad a otros administradores.' },
      { icon: <NewspaperIcon />, title: 'Investigación periodística', text: 'Sigue conexiones públicas entre personas, empresas y cargos políticos identificados.' },
      { icon: <VerifiedIcon />, title: 'Datos oficiales', text: 'Información derivada de publicaciones oficiales del BORME.' },
    ],
  },
  'borme-grafo-empresas': {
    path: '/es/borme-grafo-empresas',
    title: 'Grafo de Empresas BORME | Relaciones Societarias en España',
    description:
      'Explora un grafo de empresas basado en BORME para descubrir administradores, cargos, sociedades relacionadas y conexiones mercantiles en España.',
    h1: 'Grafo de empresas basado en BORME',
    eyebrow: 'Visualización de relaciones mercantiles',
    intro:
      'Convierte publicaciones del Registro Mercantil en una red visual para explorar empresas, administradores y relaciones societarias con más rapidez que una búsqueda documental tradicional.',
    icon: <HubIcon />,
    chips: ['BORME', 'Grafo interactivo', 'Socios únicos', 'Participaciones 100%'],
    sections: [
      {
        title: 'Del boletín al grafo',
        body: [
          'El BORME publica actos mercantiles como nombramientos, ceses, cambios de capital, fusiones, declaraciones de socio único y participaciones íntegramente poseídas. Mapa Societario estructura esa información para hacerla navegable.',
          'El resultado es un grafo donde las sociedades y personas son nodos, y los cargos o relaciones societarias actúan como enlaces que permiten explorar la red.',
        ],
      },
      {
        title: 'Ventaja práctica',
        body: [
          'En lugar de revisar documentos uno por uno, puedes empezar por una empresa o una persona, expandir la red y detectar vínculos que no serían evidentes en una búsqueda lineal.',
          'Esto acelera análisis preliminares de riesgo, investigación corporativa, reporting periodístico y preparación de due diligence.',
        ],
      },
    ],
    cards: [
      { icon: <AccountTreeIcon />, title: 'Nodos y enlaces', text: 'Empresas, personas, cargos, socios únicos y participaciones al 100% en una red visual.' },
      { icon: <SearchIcon />, title: 'Búsqueda rápida', text: 'Autocomplete para encontrar sociedades y oficiales con menos fricción.' },
      { icon: <DescriptionIcon />, title: 'De exploración a informe', text: 'Pasa del grafo gratuito a un informe PDF cuando necesites documentación.' },
    ],
  },
  'mapa-relaciones-societarias': {
    path: '/es/mapa-relaciones-societarias',
    title: 'Mapa de Relaciones Societarias en España | Mapa Societario',
    description:
      'Mapa de relaciones societarias para investigar conexiones entre empresas, administradores y cargos mercantiles en España con datos del BORME.',
    h1: 'Mapa de relaciones societarias en España',
    eyebrow: 'Conexiones entre empresas y administradores',
    intro:
      'Investiga relaciones entre sociedades españolas, cargos mercantiles y personas vinculadas para entender estructuras corporativas, grupos y posibles conexiones de riesgo.',
    icon: <AccountTreeIcon />,
    chips: ['Relaciones societarias', 'Socios únicos', 'Participaciones 100%', 'Diputados Congreso'],
    sections: [
      {
        title: 'Qué revela un mapa societario',
        body: [
          'Un mapa societario ayuda a ver administradores comunes, empresas vinculadas, socios únicos, participaciones íntegramente poseídas, cambios en órganos de administración y conexiones que pueden ser relevantes para una revisión de riesgo o una investigación corporativa. También destaca con una insignia amarilla a administradores que tienen o tuvieron cargo político en el Congreso de los Diputados.',
          'La visualización es especialmente útil cuando una estructura contiene varias sociedades o cuando una persona aparece en diferentes compañías a lo largo del tiempo.',
        ],
      },
      {
        title: 'Usuarios habituales',
        body: [
          'Equipos de cumplimiento, abogados, consultores, periodistas, analistas de ventas B2B e inversores pueden usar el mapa para orientar una investigación y decidir qué documentación revisar después.',
          'El objetivo no es sustituir a fuentes oficiales, sino hacer la exploración inicial mucho más rápida y clara.',
        ],
      },
    ],
    cards: [
      { icon: <SecurityIcon />, title: 'Riesgo y cumplimiento', text: 'Detecta conexiones societarias relevantes, sanciones BOE y posibles cargos políticos en el Congreso antes de tomar decisiones.' },
      { icon: <NewspaperIcon />, title: 'Contexto investigador', text: 'Construye hipótesis a partir de relaciones públicas registradas.' },
      { icon: <GavelIcon />, title: 'Apoyo legal', text: 'Orienta revisiones mercantiles con una vista clara de la red.' },
    ],
  },
};

const pageList = Object.values(pages);

function SeoHead({ page }) {
  const canonical = `${SITE_URL}${page.path}`;
  return (
    <Helmet htmlAttributes={{ lang: 'es' }}>
      <title>{page.title}</title>
      <meta name="description" content={page.description} />
      <link rel="canonical" href={canonical} />
      <link rel="alternate" hrefLang="es" href={canonical} />
      <link rel="alternate" hrefLang="en" href={`${SITE_URL}/`} />
      <link rel="alternate" hrefLang="x-default" href={`${SITE_URL}/`} />
      <meta property="og:locale" content="es_ES" />
      <meta property="og:title" content={page.title} />
      <meta property="og:description" content={page.description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content="article" />
      <meta name="twitter:title" content={page.title} />
      <meta name="twitter:description" content={page.description} />
    </Helmet>
  );
}

export function SpanishSeoHome() {
  return <SpanishSeoPage pageKey="home" />;
}

export default function SpanishSeoPage({ pageKey: explicitPageKey }) {
  const params = useParams();
  const navigate = useNavigate();
  const pageKey = explicitPageKey || params.slug;
  const page = pages[pageKey];

  if (!page) {
    return <Navigate to="/es" replace />;
  }

  return (
    <SpanishPageShell>
      <SeoHead page={page} />
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
            {page.icon}
          </Box>
          <Typography variant="overline" sx={{ color: 'primary.light', fontWeight: 700, letterSpacing: '0.12em', lineHeight: 1.3 }}>
            {page.eyebrow}
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
            maxWidth: 780,
            mb: 2,
          }}
        >
          {page.h1}
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 720, lineHeight: 1.7, mb: 3 }}>
          {page.intro}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 4 }}>
          {page.chips.map((chip) => (
            <Chip key={chip} label={chip} size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.18)' }} />
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button variant="contained" startIcon={<SearchIcon />} onClick={() => navigate('/app')} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
            Buscar en el grafo
          </Button>
          <Button variant="outlined" startIcon={<DescriptionIcon />} onClick={() => navigate('/due-diligence')} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: 'warning.light', borderColor: 'rgba(255,167,38,0.45)' }}>
            Ver informes
          </Button>
        </Box>
        <LegalDisclaimer dense language="es" sx={{ mt: 4 }} />
      </Box>

      <Box component="main" sx={{ display: 'grid', gap: { xs: 3, sm: 4 } }}>
        {page.sections.map((section) => (
          <Box component="section" key={section.title}>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 750, mb: 1.5, letterSpacing: 0 }}>
              {section.title}
            </Typography>
            {section.body.map((paragraph) => (
              <Typography key={paragraph} variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.75, mb: 1.5, maxWidth: 760 }}>
                {paragraph}
              </Typography>
            ))}
          </Box>
        ))}

        <Box component="section" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
          {page.cards.map((card) => (
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

        <Box component="section" sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', pt: 4 }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 750, mb: 2 }}>
            Más recursos en español
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
            {pageList.map((item) => (
              <Button
                key={item.path}
                href={item.path}
                variant={item.path === page.path ? 'contained' : 'outlined'}
                size="small"
                sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 650 }}
              >
                {item.h1}
              </Button>
            ))}
          </Box>
        </Box>
      </Box>
    </SpanishPageShell>
  );
}
