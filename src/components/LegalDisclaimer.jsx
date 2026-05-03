import React from 'react';
import { Alert, Link, Typography } from '@mui/material';

const BOE_URL = 'https://www.boe.es';
const BORME_URL = 'https://www.boe.es/diario_borme/';
const BOE_REUSE_URL = 'https://www.boe.es/informacion/aviso_legal/index.php#reutilizacion';

export default function LegalDisclaimer({ dense = false, language = 'en', sx = {} }) {
  const isSpanish = language === 'es';

  return (
    <Alert
      severity="info"
      variant="outlined"
      sx={{
        textAlign: 'left',
        bgcolor: 'rgba(25,118,210,0.04)',
        borderColor: 'rgba(25,118,210,0.24)',
        '& .MuiAlert-message': { width: '100%' },
        ...sx,
      }}
    >
      {isSpanish ? (
        <Typography variant={dense ? 'caption' : 'body2'} sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
          <strong>Información no oficial.</strong> Basado en datos de la{' '}
          <Link href={BOE_URL} target="_blank" rel="noopener" sx={{ color: 'primary.light' }}>
            Agencia Estatal Boletín Oficial del Estado
          </Link>
          , reutilizados conforme a sus{' '}
          <Link href={BOE_REUSE_URL} target="_blank" rel="noopener" sx={{ color: 'primary.light' }}>
            condiciones de reutilización
          </Link>
          . Mapa Societario transforma, combina y analiza publicaciones del BOE/BORME mediante procesos
          automatizados; no tiene carácter oficial ni está avalado por la AEBOE. La información se ofrece
          "tal cual" y puede contener errores, omisiones o retrasos. Para cualquier decisión relevante,
          consulta siempre la edición oficial del{' '}
          <Link href={BORME_URL} target="_blank" rel="noopener" sx={{ color: 'primary.light' }}>
            BORME
          </Link>
          {' '}y, cuando proceda, solicita la certificación o documentación actualizada directamente al Registro Mercantil.
        </Typography>
      ) : (
        <Typography variant={dense ? 'caption' : 'body2'} sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
          <strong>Unofficial information.</strong> Based on data from the{' '}
          <Link href={BOE_URL} target="_blank" rel="noopener" sx={{ color: 'primary.light' }}>
            Agencia Estatal Boletín Oficial del Estado
          </Link>
          , reused under its{' '}
          <Link href={BOE_REUSE_URL} target="_blank" rel="noopener" sx={{ color: 'primary.light' }}>
            reuse conditions
          </Link>
          . Mapa Societario transforms, combines, and analyzes BOE/BORME publications through automated
          processes; it is not official and is not endorsed by the AEBOE. The information is provided
          "as is" and may contain errors, omissions, or delays. For any material decision, always verify
          the official{' '}
          <Link href={BORME_URL} target="_blank" rel="noopener" sx={{ color: 'primary.light' }}>
            BORME
          </Link>
          {' '}edition and, where appropriate, obtain current certificates or documents directly from the Registro Mercantil.
        </Typography>
      )}
    </Alert>
  );
}

