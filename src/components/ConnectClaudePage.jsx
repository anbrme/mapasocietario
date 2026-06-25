import React, { useState } from 'react';
import { Box, Typography, Link, Paper, Button, Chip } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import SearchIcon from '@mui/icons-material/Search';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import HubIcon from '@mui/icons-material/Hub';
import { Helmet } from 'react-helmet-async';
import { siteNav } from '../utils/siteNav';

const SITE_URL = 'https://mapasocietario.es';
const MCP_URL = 'https://mcp.mapasocietario.es/mcp';

// Icons paired by index with COPY.examples.
const EXAMPLE_ICONS = [<SearchIcon />, <BusinessCenterIcon />, <PersonSearchIcon />, <HubIcon />];

const COPY = {
  en: {
    meta: {
      title: 'Get Spanish Company Data in Claude | Mapa Societario',
      description:
        'Connect Mapa Societario to Claude as a custom MCP connector and query the Spanish company registry (BORME) in plain language: search companies and officers, read profiles, and map corporate relationships. Free, no account.',
      ogDescription:
        'Add the Mapa Societario connector to Claude and ask about Spanish companies, officers and corporate relationships in plain language. Free, no login.',
    },
    back: 'Back to Mapa Societario',
    eyebrow: 'Claude connector',
    title: 'Get Spanish Company Data in Claude',
    subtitle:
      'Mapa Societario is available as a connector for Claude. Add it once, then ask about Spanish companies, officers and corporate relationships in plain language — answers come from official BORME (Registro Mercantil) data, each with a link to cite.',
    urlLabel: 'Connector URL',
    copy: 'Copy',
    copied: 'Copied',
    noAuth: 'No login, no API key, free to use.',
    stepsHeading: 'Add it in three steps',
    steps: [
      'In Claude, open Settings → Connectors and choose “Add custom connector”.',
      'Paste the connector URL above and save.',
      'Start a chat and ask about a Spanish company — Claude will use the connector and ask permission the first time.',
    ],
    examplesHeading: 'What you can ask',
    examples: [
      { tool: 'Search companies', prompt: 'Find the Spanish company “Acme Soluciones SL”.' },
      { tool: 'Company profile', prompt: 'Who are the current directors of CaixaBank, and is it dissolved?' },
      { tool: 'Find an officer', prompt: 'Which Spanish companies is the director “María López García” linked to?' },
      { tool: 'Relationships', prompt: 'Is there any connection between Company A and Company B in Spain?' },
    ],
    scopeHeading: 'What it does — and doesn’t — cover',
    canHeading: 'It answers',
    can: [
      'Company search by name (typo-tolerant) with status and registry links',
      'Company profiles: status, incorporation, current and former officers',
      'Sole-shareholder ownership and capital/address where on record',
      'Corporate relationships: shared officers, owns / owned-by',
    ],
    cantHeading: 'Keep in mind',
    cant: [
      'Unofficial — derived from BORME publications, not an official certificate.',
      'Ownership reflects only sole-shareholder (socio único) filings; BORME has no full cap-table.',
      'No cross-company time-range queries (e.g. “all companies that moved in March”).',
      'Every result links to mapasocietario.es/empresa — cite that, and the official BORME, for critical use.',
    ],
    tryFree: 'Prefer the web app? Search a company →',
  },
  es: {
    meta: {
      title: 'Usa el Registro Mercantil español en Claude | Mapa Societario',
      description:
        'Conecta Mapa Societario a Claude como conector MCP y consulta el registro de empresas español (BORME) en lenguaje natural: busca empresas y administradores, consulta perfiles y mapea relaciones societarias. Gratis, sin cuenta.',
      ogDescription:
        'Añade el conector de Mapa Societario a Claude y pregunta sobre empresas, administradores y relaciones societarias en lenguaje natural. Gratis, sin registro.',
    },
    back: 'Volver a Mapa Societario',
    eyebrow: 'Conector de Claude',
    title: 'Consulta datos de empresas españolas dentro de Claude',
    subtitle:
      'Mapa Societario está disponible como conector para Claude. Añádelo una vez y pregunta sobre empresas, administradores y relaciones societarias en lenguaje natural — las respuestas proceden de datos oficiales del BORME (Registro Mercantil), cada una con un enlace para citar.',
    urlLabel: 'URL del conector',
    copy: 'Copiar',
    copied: 'Copiado',
    noAuth: 'Sin registro, sin clave de API, uso gratuito.',
    stepsHeading: 'Añádelo en tres pasos',
    steps: [
      'En Claude, abre Ajustes → Conectores y elige «Añadir conector personalizado».',
      'Pega la URL del conector de arriba y guarda.',
      'Inicia un chat y pregunta por una empresa española — Claude usará el conector y pedirá permiso la primera vez.',
    ],
    examplesHeading: 'Qué puedes preguntar',
    examples: [
      { tool: 'Buscar empresas', prompt: 'Busca la empresa española «Acme Soluciones SL».' },
      { tool: 'Perfil de empresa', prompt: '¿Quiénes son los administradores actuales de CaixaBank? ¿Está disuelta?' },
      { tool: 'Buscar administrador', prompt: '¿A qué empresas españolas está vinculada la administradora «María López García»?' },
      { tool: 'Relaciones', prompt: '¿Existe alguna relación entre la Empresa A y la Empresa B en España?' },
    ],
    scopeHeading: 'Qué cubre — y qué no',
    canHeading: 'Responde a',
    can: [
      'Búsqueda de empresas por nombre (tolera erratas) con estado y enlaces al registro',
      'Perfiles de empresa: estado, constitución, administradores actuales y anteriores',
      'Propiedad de socio único y capital/domicilio cuando constan',
      'Relaciones societarias: administradores compartidos, participa / participada por',
    ],
    cantHeading: 'Ten en cuenta',
    cant: [
      'No oficial — procede de publicaciones del BORME, no es una certificación oficial.',
      'La propiedad refleja solo declaraciones de socio único; el BORME no tiene el capital social completo.',
      'No admite consultas por rango de fechas entre empresas (p. ej. «todas las empresas que se trasladaron en marzo»).',
      'Cada resultado enlaza a mapasocietario.es/empresa — cítalo, y el BORME oficial, para usos críticos.',
    ],
    tryFree: '¿Prefieres la app web? Busca una empresa →',
  },
};

export default function ConnectClaudePage({ lang = 'en' }) {
  const copy = COPY[lang] || COPY.en;
  const nav = siteNav(lang);
  const canonical = lang === 'es' ? `${SITE_URL}/es/conectar-claude` : `${SITE_URL}/connect-claude`;
  const altUrl = lang === 'es' ? `${SITE_URL}/connect-claude` : `${SITE_URL}/es/conectar-claude`;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(MCP_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the URL is shown for manual copy */
    }
  };

  return (
    <>
      <Helmet>
        <html lang={lang} />
        <title>{copy.meta.title}</title>
        <meta name="description" content={copy.meta.description} />
        <link rel="canonical" href={canonical} />
        <link rel="alternate" hrefLang={lang === 'es' ? 'en' : 'es'} href={altUrl} />
        <link rel="alternate" hrefLang={lang} href={canonical} />
        <meta property="og:title" content={copy.meta.title} />
        <meta property="og:description" content={copy.meta.ogDescription} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Mapa Societario" />
      </Helmet>

      <Box sx={{ minHeight: '100vh', bgcolor: '#0a0e1a', color: 'text.primary' }}>
        <Box sx={{ maxWidth: 880, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: { xs: 4, sm: 6 } }}>
          {/* Back */}
          <Link
            href={nav.home}
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', fontSize: '0.85rem', textDecoration: 'none', mb: 4, '&:hover': { color: 'primary.light' } }}
          >
            <ArrowBackIcon sx={{ fontSize: '1rem' }} /> {copy.back}
          </Link>

          {/* Hero */}
          <Typography variant="overline" sx={{ display: 'block', color: 'primary.light', fontWeight: 700, letterSpacing: '0.12em', fontSize: '0.68rem', mb: 1 }}>
            {copy.eyebrow}
          </Typography>
          <Typography variant="h3" component="h1" sx={{ fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.15, mb: 2, fontSize: { xs: '1.9rem', sm: '2.5rem' } }}>
            {copy.title}
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: { xs: '1rem', sm: '1.1rem' }, lineHeight: 1.6, mb: 4 }}>
            {copy.subtitle}
          </Typography>

          {/* Connector URL + copy */}
          <Paper elevation={0} sx={{ bgcolor: '#121828', border: '1px solid', borderColor: 'rgba(255,255,255,0.08)', borderRadius: 2, p: { xs: 2, sm: 2.5 }, mb: 4 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              {copy.urlLabel}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1, flexWrap: 'wrap' }}>
              <Box component="code" sx={{ flex: 1, minWidth: 240, fontFamily: 'monospace', fontSize: { xs: '0.9rem', sm: '1rem' }, color: 'primary.light', wordBreak: 'break-all' }}>
                {MCP_URL}
              </Box>
              <Button
                onClick={handleCopy}
                variant="contained"
                size="small"
                startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
                color={copied ? 'success' : 'primary'}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                {copied ? copy.copied : copy.copy}
              </Button>
            </Box>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1.5 }}>
              {copy.noAuth}
            </Typography>
          </Paper>

          {/* Steps */}
          <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 2 }}>
            {copy.stepsHeading}
          </Typography>
          <Box component="ol" sx={{ pl: 0, listStyle: 'none', m: 0, mb: 4, counterReset: 'step' }}>
            {copy.steps.map((step, i) => (
              <Box component="li" key={i} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-start' }}>
                <Box sx={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', bgcolor: 'primary.main', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                  {i + 1}
                </Box>
                <Typography sx={{ color: 'text.primary', lineHeight: 1.6, pt: 0.3 }}>{step}</Typography>
              </Box>
            ))}
          </Box>

          {/* Examples */}
          <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 2 }}>
            {copy.examplesHeading}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 4 }}>
            {copy.examples.map((ex, i) => (
              <Paper key={i} elevation={0} sx={{ bgcolor: '#121828', border: '1px solid', borderColor: 'rgba(255,255,255,0.08)', borderRadius: 2, p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'primary.light' }}>
                  {React.cloneElement(EXAMPLE_ICONS[i], { sx: { fontSize: '1.15rem' } })}
                  <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {ex.tool}
                  </Typography>
                </Box>
                <Typography sx={{ color: 'text.primary', fontSize: '0.95rem', lineHeight: 1.5, fontStyle: 'italic' }}>
                  “{ex.prompt}”
                </Typography>
              </Paper>
            ))}
          </Box>

          {/* Scope */}
          <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 2 }}>
            {copy.scopeHeading}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 5 }}>
            <Paper elevation={0} sx={{ bgcolor: 'rgba(46,125,50,0.08)', border: '1px solid', borderColor: 'rgba(102,187,106,0.25)', borderRadius: 2, p: 2.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'success.light', mb: 1 }}>
                {copy.canHeading}
              </Typography>
              <Box component="ul" sx={{ pl: 2.2, m: 0 }}>
                {copy.can.map((item, i) => (
                  <Typography component="li" key={i} sx={{ color: 'text.secondary', fontSize: '0.9rem', lineHeight: 1.55, mb: 0.7 }}>{item}</Typography>
                ))}
              </Box>
            </Paper>
            <Paper elevation={0} sx={{ bgcolor: 'rgba(237,108,2,0.07)', border: '1px solid', borderColor: 'rgba(255,167,38,0.22)', borderRadius: 2, p: 2.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'warning.light', mb: 1 }}>
                {copy.cantHeading}
              </Typography>
              <Box component="ul" sx={{ pl: 2.2, m: 0 }}>
                {copy.cant.map((item, i) => (
                  <Typography component="li" key={i} sx={{ color: 'text.secondary', fontSize: '0.9rem', lineHeight: 1.55, mb: 0.7 }}>{item}</Typography>
                ))}
              </Box>
            </Paper>
          </Box>

          {/* Back to app */}
          <Link href={lang === 'es' ? '/app?lang=es' : '/app'} sx={{ display: 'inline-flex', alignItems: 'center', color: 'primary.light', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
            {copy.tryFree}
          </Link>
        </Box>
      </Box>
    </>
  );
}
