import React, { useId, useState } from 'react';
import { Badge, Button, Chip, CircularProgress, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// Keep document actions together while the graph owns their scope and handlers.
export default function GraphReportMenu({
  label, dueDiligenceLabel, dueDiligenceTooltip, freeReportBadge,
  situationReportLabel, situationReportTooltip, subjectCount, preparing,
  canGenerateDueDiligence, canGenerateSituationReport, onDueDiligence, onSituationReport,
}) {
  const [anchor, setAnchor] = useState(null);
  const id = useId();
  const open = Boolean(anchor);
  const select = handler => {
    setAnchor(null);
    handler();
  };

  return (
    <>
      <Button
        id={`${id}-button`}
        aria-controls={open ? `${id}-menu` : undefined}
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : undefined}
        // The graph's one primary action: nothing else in its chrome is filled.
        variant="contained"
        disableElevation
        size="small"
        startIcon={<DescriptionIcon />}
        endIcon={<ExpandMoreIcon />}
        onClick={event => setAnchor(event.currentTarget)}
        sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
      >
        {label}
      </Button>
      <Menu
        id={`${id}-menu`}
        anchorEl={anchor}
        open={open}
        onClose={() => setAnchor(null)}
        MenuListProps={{ 'aria-labelledby': `${id}-button` }}
      >
        {canGenerateDueDiligence && (
          <Tooltip title={dueDiligenceTooltip} placement="left">
            <MenuItem onClick={() => select(onDueDiligence)}>
              <ListItemIcon><DescriptionIcon fontSize="small" /></ListItemIcon>
              <ListItemText>{dueDiligenceLabel}</ListItemText>
              {freeReportBadge && <Chip label={freeReportBadge} size="small" color="primary" sx={{ ml: 2 }} />}
            </MenuItem>
          </Tooltip>
        )}
        {canGenerateSituationReport && (
          <Tooltip title={situationReportTooltip} placement="left">
            <MenuItem disabled={preparing} onClick={() => select(onSituationReport)}>
              <ListItemIcon>
                {preparing ? <CircularProgress size={18} /> : <AccountTreeIcon fontSize="small" />}
              </ListItemIcon>
              <ListItemText>{situationReportLabel}</ListItemText>
              <Badge badgeContent={subjectCount} color="primary" sx={{ ml: 3, mr: 1 }} />
            </MenuItem>
          </Tooltip>
        )}
      </Menu>
    </>
  );
}
