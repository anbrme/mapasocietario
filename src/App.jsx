import React, { useState } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import SpanishCompanyNetworkGraph from './components/SpanishCompanyNetworkGraph';

const EXAMPLE_QUERIES = [
  'Inditex',
  'Banco Santander',
  'Repsol',
  'Telefonica',
  'Iberdrola',
];

export default function App() {
  const [selectedCompany, setSelectedCompany] = useState(null);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 3,
          py: 1.5,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'linear-gradient(180deg, rgba(25,118,210,0.08) 0%, transparent 100%)',
          flexShrink: 0,
        }}
      >
        <AccountTreeIcon sx={{ color: '#1976d2', fontSize: 28 }} />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2, fontSize: '1.1rem' }}>
            MapaSocietario
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
            Mapa de relaciones societarias de empresas espanolas
          </Typography>
        </Box>
      </Box>

      {/* Main content */}
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {!selectedCompany ? (
          /* Empty state with example queries */
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 3,
            }}
          >
            <AccountTreeIcon sx={{ fontSize: 64, color: 'rgba(25,118,210,0.3)' }} />
            <Typography variant="h5" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              Explora relaciones societarias
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
              Selecciona una empresa para empezar
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
              {EXAMPLE_QUERIES.map(name => (
                <Chip
                  key={name}
                  label={name}
                  onClick={() => setSelectedCompany(name)}
                  sx={{
                    fontSize: '0.9rem',
                    py: 2.5,
                    px: 1,
                    cursor: 'pointer',
                    border: '1px solid rgba(25,118,210,0.3)',
                    '&:hover': {
                      backgroundColor: 'rgba(25,118,210,0.15)',
                      borderColor: '#1976d2',
                    },
                  }}
                  variant="outlined"
                />
              ))}
            </Box>
          </Box>
        ) : (
          <SpanishCompanyNetworkGraph
            visible={true}
            embedded={true}
            initialCompanyName={selectedCompany}
          />
        )}
      </Box>
    </Box>
  );
}
