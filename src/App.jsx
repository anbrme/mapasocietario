import React from 'react';
import { Box } from '@mui/material';
import { Helmet } from 'react-helmet-async';
import SpanishCompanyNetworkGraph from './components/SpanishCompanyNetworkGraph';

export default function App() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Helmet>
        <title>Search | Mapa Societario</title>
        <meta name="description" content="Search Spanish companies and officers. Explore corporate relationships in an interactive network graph based on official BORME data." />
        <link rel="canonical" href="https://mapasocietario.es/app" />
      </Helmet>
      <SpanishCompanyNetworkGraph
        visible={true}
        embedded={true}
      />
    </Box>
  );
}
