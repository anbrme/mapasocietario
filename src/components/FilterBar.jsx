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
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import { useFilters } from '../contexts/FilterProvider';

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
