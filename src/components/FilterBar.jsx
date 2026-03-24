import React from 'react';
import {
  Box,
  Autocomplete,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  IconButton,
  Tooltip,
  Button,
  ButtonGroup,
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import { useFilters } from '../contexts/FilterProvider';

function datePresets() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const q = Math.floor(now.getMonth() / 3);
  const qStart = String(q * 3 + 1).padStart(2, '0');
  return [
    { label: `${y}`, from: `${y}-01-01`, to: '' },
    { label: `${y - 1}`, from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
    { label: '12m', from: `${y - 1}-${m}-01`, to: '' },
    { label: `T${q + 1}`, from: `${y}-${qStart}-01`, to: '' },
    { label: '5a', from: `${y - 5}-01-01`, to: '' },
  ];
}

export default function FilterBar() {
  const {
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    interval, setInterval,
    provinces, setProvinces,
    companyTypes, setCompanyTypes,
    filterOptions,
    hasActiveFilters,
    clearAll,
  } = useFilters();

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        mb: 2,
        flexWrap: 'wrap',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      {/* Date range */}
      <TextField
        type="date"
        size="small"
        label="Desde"
        value={dateFrom}
        onChange={(e) => setDateFrom(e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={{ width: 145, '& input': { fontSize: '0.8rem' } }}
      />
      <TextField
        type="date"
        size="small"
        label="Hasta"
        value={dateTo}
        onChange={(e) => setDateTo(e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={{ width: 145, '& input': { fontSize: '0.8rem' } }}
      />

      {/* Date range presets */}
      <ButtonGroup size="small" variant="outlined" sx={{ '& .MuiButton-root': { fontSize: '0.65rem', px: 1, py: 0.5, minWidth: 0 } }}>
        {datePresets().map((p) => (
          <Button
            key={p.label}
            onClick={() => { setDateFrom(p.from); setDateTo(p.to); }}
            variant={dateFrom === p.from && dateTo === p.to ? 'contained' : 'outlined'}
          >
            {p.label}
          </Button>
        ))}
      </ButtonGroup>

      {/* Province multi-select */}
      <Autocomplete
        multiple
        size="small"
        options={filterOptions.provinces || []}
        value={provinces}
        onChange={(_, v) => setProvinces(v)}
        renderInput={(params) => (
          <TextField {...params} label="Provincias" placeholder="Todas" />
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              {...getTagProps({ index })}
              key={option}
              label={option}
              size="small"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          ))
        }
        sx={{ minWidth: 200, maxWidth: 350 }}
        limitTags={2}
      />

      {/* Company type multi-select */}
      <Autocomplete
        multiple
        size="small"
        options={filterOptions.company_types || []}
        value={companyTypes}
        onChange={(_, v) => setCompanyTypes(v)}
        renderInput={(params) => (
          <TextField {...params} label="Tipo sociedad" placeholder="Todos" />
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              {...getTagProps({ index })}
              key={option}
              label={option}
              size="small"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          ))
        }
        sx={{ minWidth: 140, maxWidth: 250 }}
        limitTags={2}
      />

      {/* Interval toggle */}
      <ToggleButtonGroup
        value={interval}
        exclusive
        onChange={(_, v) => v && setInterval(v)}
        size="small"
      >
        <ToggleButton value="month" sx={{ px: 1.5, fontSize: '0.7rem' }}>Mes</ToggleButton>
        <ToggleButton value="quarter" sx={{ px: 1.5, fontSize: '0.7rem' }}>Trim</ToggleButton>
        <ToggleButton value="year" sx={{ px: 1.5, fontSize: '0.7rem' }}>Año</ToggleButton>
      </ToggleButtonGroup>

      {/* Clear all */}
      {hasActiveFilters && (
        <Tooltip title="Limpiar filtros">
          <IconButton size="small" onClick={clearAll} sx={{ color: 'warning.main' }}>
            <ClearIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
