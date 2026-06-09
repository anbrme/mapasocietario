import React from 'react';
import { Box, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import SpanishCompanyNetworkGraph from './components/SpanishCompanyNetworkGraph';

export default function App() {
  const navigate = useNavigate();

  // /empresa pages and the landing demo link here as /app?search=<company>.
  // Read once on mount; the graph auto-searches via initialCompanyName.
  const initialSearch = React.useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('search') || '').trim() || undefined;
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Helmet>
        <title>Search | Mapa Societario</title>
        <meta name="description" content="Search Spanish companies and officers. Explore corporate relationships in an interactive network graph based on official BORME data." />
        <link rel="canonical" href="https://mapasocietario.es/app" />
      </Helmet>

      {/* Slim home breadcrumb. Gives a way back to the homepage (the back gesture
          is also wired in the native app) and lowers the search inputs off the
          very top edge. */}
      <Box
        component="nav"
        aria-label="breadcrumb"
        sx={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.5,
          py: 1,
          pt: 'calc(8px + env(safe-area-inset-top))',
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box
          role="link"
          tabIndex={0}
          onClick={() => navigate('/')}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate('/'); }}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            cursor: 'pointer',
            color: 'primary.light',
            fontWeight: 600,
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          <ArrowBackIcon sx={{ fontSize: 18 }} />
          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1 }}>
            Mapa Societario
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: 'text.disabled', lineHeight: 1 }}>
          ›
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1 }}>
          Buscar
        </Typography>
      </Box>

      <SpanishCompanyNetworkGraph
        visible={true}
        embedded={true}
        initialCompanyName={initialSearch}
      />
    </Box>
  );
}
