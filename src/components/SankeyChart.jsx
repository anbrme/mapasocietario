import React from 'react';
import { Sankey, Tooltip, Layer, Rectangle } from 'recharts';
import { Box, Typography, Paper, CircularProgress } from '@mui/material';

const COLORS = [
  '#2196f3', '#4caf50', '#ff9800', '#f44336', '#9c27b0',
  '#00bcd4', '#795548', '#607d8b', '#e91e63', '#3f51b5',
  '#009688', '#ff5722', '#673ab7', '#8bc34a', '#ffc107',
];

function SankeyNode({ x, y, width, height, index, payload }) {
  return (
    <Layer key={`node-${index}`}>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={COLORS[index % COLORS.length]}
        fillOpacity={0.9}
        rx={3}
      />
      <text
        x={x + width + 8}
        y={y + height / 2}
        textAnchor="start"
        dominantBaseline="central"
        fill="#ccc"
        fontSize={12}
      >
        {payload.name}
      </text>
    </Layer>
  );
}

function SankeyLink({ sourceX, sourceY, sourceControlX, targetX, targetY, targetControlX, linkWidth, index }) {
  return (
    <Layer key={`link-${index}`}>
      <path
        d={`M${sourceX},${sourceY}C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
        fill="none"
        stroke={COLORS[index % COLORS.length]}
        strokeWidth={linkWidth}
        strokeOpacity={0.3}
      />
    </Layer>
  );
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <Paper sx={{ p: 1, border: '1px solid', borderColor: 'divider' }}>
      {data.payload?.name ? (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {data.payload.name}: {data.value?.toLocaleString('es-ES')}
        </Typography>
      ) : (
        <>
          <Typography variant="caption" color="text.secondary">
            {data.source?.name} → {data.target?.name}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {data.value?.toLocaleString('es-ES')}
          </Typography>
        </>
      )}
    </Paper>
  );
}

export default function SankeyChart({ data, title, subtitle, height = 350 }) {
  if (!data) {
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>{title}</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </Paper>
    );
  }

  if (!data.nodes?.length || !data.links?.length) {
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          No hay datos suficientes para este diagrama.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>{title}</Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{subtitle}</Typography>
      )}
      <Box sx={{ width: '100%', overflowX: 'auto' }}>
        <Sankey
          width={700}
          height={height}
          data={data}
          node={<SankeyNode />}
          link={<SankeyLink />}
          nodePadding={30}
          nodeWidth={12}
          margin={{ left: 10, right: 160, top: 10, bottom: 10 }}
        >
          <Tooltip content={<CustomTooltip />} />
        </Sankey>
      </Box>
    </Paper>
  );
}
