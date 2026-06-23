import React, { useState, useEffect } from 'react';
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
import { useFilters, TODAY } from '../contexts/FilterProvider';

function datePresets() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const q = Math.floor(now.getMonth() / 3);
  const qStart = String(q * 3 + 1).padStart(2, '0');
  return [
    { label: `${y}`, from: `${y}-01-01`, to: TODAY },
    { label: `${y - 1}`, from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
    { label: '12m', from: `${y - 1}-${m}-01`, to: TODAY },
    { label: `T${q + 1}`, from: `${y}-${qStart}-01`, to: TODAY },
    { label: '5a', from: `${y - 5}-01-01`, to: TODAY },
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

  // Local (uncommitted) values for the date inputs. A native <input type="date">
  // fires onChange on every edit of the year segment, so binding the fetch
  // directly to it would refetch for absurd partial years (0002, 0020, …).
  // We hold the in-progress value here and only commit to the filter context
  // (which triggers the fetch) on blur / Enter, with a sane range guard.
  const [localFrom, setLocalFrom] = useState(dateFrom);
  const [localTo, setLocalTo] = useState(dateTo);

  // Re-sync when the committed value changes elsewhere (presets, clear all).
  useEffect(() => { setLocalFrom(dateFrom); }, [dateFrom]);
  useEffect(() => { setLocalTo(dateTo); }, [dateTo]);

  const MIN_DATE = '2009-01-01';
  const MAX_DATE = `${new Date().getFullYear() + 1}-12-31`;
  // ISO date strings compare correctly as plain strings.
  const isCommittable = (v) => v === '' || (v >= MIN_DATE && v <= MAX_DATE);

  const commitFrom = () => {
    if (localFrom !== dateFrom && isCommittable(localFrom)) setDateFrom(localFrom);
    else setLocalFrom(dateFrom); // revert an invalid / partial entry
  };
  const commitTo = () => {
    if (localTo !== dateTo && isCommittable(localTo)) setDateTo(localTo);
    else setLocalTo(dateTo);
  };
  const commitOnEnter = (e) => { if (e.key === 'Enter') e.target.blur(); };

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
        value={localFrom}
        onChange={(e) => setLocalFrom(e.target.value)}
        onBlur={commitFrom}
        onKeyDown={commitOnEnter}
        InputLabelProps={{ shrink: true }}
        inputProps={{ min: MIN_DATE, max: MAX_DATE }}
        sx={{ width: 145, '& input': { fontSize: '0.8rem' } }}
      />
      <TextField
        type="date"
        size="small"
        label="Hasta"
        value={localTo}
        onChange={(e) => setLocalTo(e.target.value)}
        onBlur={commitTo}
        onKeyDown={commitOnEnter}
        InputLabelProps={{ shrink: true }}
        inputProps={{ min: MIN_DATE, max: MAX_DATE }}
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
