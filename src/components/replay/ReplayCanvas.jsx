import React, { useEffect, useRef, useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import { useTheme } from '@mui/material/styles';
import { graphInk } from '../../theme/graphInk';
import { isCorporateName } from '../../utils/legalEntity';
import { IDENTITY_VIEW, zoomAt, panBy } from '../../utils/replay/replayView';

// A plain canvas on purpose: react-force-graph-2d exists to run a simulation,
// and the replay needs fixed positions and frame-exact control of what is
// drawn. Everything is read from a ref inside one rAF loop, so a 60 fps clock
// never re-renders this component.

const FLASH_MS = 600;
const FADE_IN_MS = 200;
const LABEL_AFTER_CHANGE_MS = 2000;
const SUBJECT_RADIUS = 12;
const NODE_RADIUS = 6;
const HOVER_PX = 12;
const FIT_MARGIN = 70;
const MAX_SCALE = 1.4;
const WHEEL_ZOOM_RATE = 0.0015;
const BUTTON_ZOOM_STEP = 1.4;
// A press that moves less than this is a click, not a pan.
const DRAG_THRESHOLD_PX = 3;

const withAlpha = (hex, alpha) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

const drawLabel = (ctx, text, x, y, colors, bold = false) => {
  ctx.font = `${bold ? 600 : 500} 11px "IBM Plex Sans", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineWidth = 3;
  ctx.strokeStyle = colors.labelHalo;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = colors.label;
  ctx.fillText(text, x, y);
};

const nodeColorFor = (counterpart, palette) => {
  if (counterpart.kind === 'company') return palette.node.company;
  return isCorporateName(counterpart.name) ? palette.node.officerCompany : palette.node.officerIndividual;
};

const linkStyle = (st, palette, ink) => {
  if (st.status === 'live') {
    return { color: withAlpha(palette.link.appointment, ink.linkAlpha), dash: st.unknownStart ? [2, 4] : [], width: 1.6 };
  }
  if (st.inferred) return { color: withAlpha(palette.link.unknown, 0.45), dash: [1, 5], width: 1 };
  return { color: withAlpha(palette.link.cessation, 0.35), dash: [5, 5], width: 1 };
};

/**
 * @param {object} props
 * @param {object} props.model
 * @param {Map<string,{x:number,y:number}>} props.positions
 * @param {number} props.radius
 * @param {Map<string,object>} props.state - replayStateAt output
 * @param {boolean} props.showPast
 * @param {boolean} props.labelChanges - label counterparts just after they move
 * @param {React.MutableRefObject<{act: object, at: number}[]>} props.flashesRef
 * @param {string} props.ariaLabel
 * @param {{ zoomIn: string, zoomOut: string, resetView: string }} props.labels
 */
export default function ReplayCanvas({ model, positions, radius, state, showPast, labelChanges, flashesRef, ariaLabel, labels }) {
  const theme = useTheme();
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const propsRef = useRef(null);
  const hoverRef = useRef(null);
  const viewRef = useRef(IDENTITY_VIEW);
  const dragRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  propsRef.current = { model, positions, radius, state, showPast, labelChanges, palette: theme.palette.graph, ink: graphInk(theme.palette.mode), size };

  // A new layout (another subject, or the apoderados toggle) starts fitted.
  useEffect(() => { viewRef.current = IDENTITY_VIEW; }, [positions]);

  const centre = () => ({ x: propsRef.current.size.w / 2, y: propsRef.current.size.h / 2 });
  const zoomBy = factor => { viewRef.current = zoomAt(viewRef.current, factor, centre(), centre()); };

  // Wheel zoom about the cursor. Registered by hand: React's wheel listener is
  // passive, and the page must not scroll while the stage zooms.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return undefined;
    const onWheel = e => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      viewRef.current = zoomAt(viewRef.current, Math.exp(-e.deltaY * WHEEL_ZOOM_RATE), cursor, centre());
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ w: Math.floor(entry.contentRect.width), h: Math.floor(entry.contentRect.height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    const frame = () => {
      draw(canvasRef.current, propsRef.current, flashesRef.current, hoverRef.current, viewRef.current);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [flashesRef]);

  const onPointerDown = e => {
    dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerUp = () => { dragRef.current = null; };

  const onMove = e => {
    const drag = dragRef.current;
    if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (drag.moved || Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        viewRef.current = panBy(viewRef.current, dx, dy);
        dragRef.current = { x: e.clientX, y: e.clientY, moved: true };
        hoverRef.current = null;
        return;
      }
    }
    const { positions: pos, state: st, size: sz, radius: r } = propsRef.current;
    const view = viewRef.current;
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = fitScale(sz, r) * view.k;
    const wx = (e.clientX - rect.left - sz.w / 2 - view.x) / scale;
    const wy = (e.clientY - rect.top - sz.h / 2 - view.y) / scale;
    let best = null;
    let bestD = HOVER_PX / scale;
    pos.forEach((p, id) => {
      const s = st.get(id);
      if (!s || s.status === 'hidden') return;
      const d = Math.hypot(p.x - wx, p.y - wy);
      if (d < bestD) { bestD = d; best = id; }
    });
    hoverRef.current = best;
  };

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return (
    <Box ref={wrapRef} sx={{ position: 'relative', flex: 1, minHeight: 240, bgcolor: 'graph.surface.canvas', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel}
        width={size.w * dpr}
        height={size.h * dpr}
        style={{ width: size.w, height: size.h, display: 'block', cursor: 'grab', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => { hoverRef.current = null; }}
      />
      <Box sx={{
        position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'column',
        bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1,
      }}>
        <Tooltip title={labels.zoomIn} placement="left">
          <IconButton size="small" aria-label={labels.zoomIn} onClick={() => zoomBy(BUTTON_ZOOM_STEP)}><AddIcon fontSize="small" /></IconButton>
        </Tooltip>
        <Tooltip title={labels.zoomOut} placement="left">
          <IconButton size="small" aria-label={labels.zoomOut} onClick={() => zoomBy(1 / BUTTON_ZOOM_STEP)}><RemoveIcon fontSize="small" /></IconButton>
        </Tooltip>
        <Tooltip title={labels.resetView} placement="left">
          <IconButton size="small" aria-label={labels.resetView} onClick={() => { viewRef.current = IDENTITY_VIEW; }}><CenterFocusStrongIcon fontSize="small" /></IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

const fitScale = (size, radius) =>
  Math.min(MAX_SCALE, Math.max(0.1, (Math.min(size.w, size.h) / 2) / (radius + FIT_MARGIN)));

function draw(canvas, p, flashes, hoverId, view) {
  if (!canvas || !p || !p.size.w) return;
  const ctx = canvas.getContext('2d');
  const dpr = canvas.width / p.size.w || 1;
  const now = performance.now();
  const scale = fitScale(p.size, p.radius) * view.k;
  // Screen position of the stage origin (the subject), in CSS pixels.
  const ox = p.size.w / 2 + view.x;
  const oy = p.size.h / 2 + view.y;
  const { palette, ink } = p;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);

  // Recent acts, newest last; expired flashes are pruned in place of a timer.
  const recent = new Map();
  for (let i = flashes.length - 1; i >= 0; i -= 1) {
    if (now - flashes[i].at > LABEL_AFTER_CHANGE_MS) flashes.splice(i, 1);
  }
  flashes.forEach(f => recent.set(f.act.counterpartId, f));

  const byId = new Map(p.model.counterparts.map(c => [c.id, c]));

  // Links under nodes.
  p.state.forEach((st, id) => {
    const pos = p.positions.get(id);
    if (!pos || st.status === 'hidden' || (st.status === 'ceased' && !p.showPast)) return;
    const style = linkStyle(st, palette, ink);
    ctx.setLineDash(style.dash);
    ctx.lineWidth = style.width / scale;
    ctx.strokeStyle = style.color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    const flash = recent.get(id);
    const age = flash ? now - flash.at : Infinity;
    if (flash && age < FLASH_MS && flash.act.kind !== 'closure') {
      const t = 1 - age / FLASH_MS;
      ctx.setLineDash([]);
      ctx.lineWidth = (2 + 3 * t) / scale;
      ctx.strokeStyle = withAlpha(flash.act.kind === 'cessation' ? palette.link.cessation : palette.link.appointment, 0.9 * t);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
  });
  ctx.setLineDash([]);

  // Counterpart nodes.
  p.state.forEach((st, id) => {
    const pos = p.positions.get(id);
    const cp = byId.get(id);
    if (!pos || !cp || st.status === 'hidden' || (st.status === 'ceased' && !p.showPast)) return;
    const flash = recent.get(id);
    const fadeIn = flash && flash.act.kind === 'appointment' ? Math.min(1, (now - flash.at) / FADE_IN_MS) : 1;
    const alpha = (st.status === 'live' ? 1 : 0.35) * fadeIn;
    const color = nodeColorFor(cp, palette);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, 2 * Math.PI);
    ctx.fillStyle = palette.surface.nodeFill;
    ctx.fill();
    ctx.fillStyle = withAlpha(color, ink.nodeTintAlpha);
    ctx.fill();
    ctx.lineWidth = 1.5 / scale;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.globalAlpha = 1;

    const isHovered = hoverId === id;
    if (isHovered || (p.labelChanges && flash)) {
      const roles = isHovered && st.liveRoles.length ? ` · ${st.liveRoles.join(', ')}` : '';
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, dpr * (ox + pos.x * scale), dpr * (oy + pos.y * scale));
      drawLabel(ctx, `${cp.name}${roles}`, 0, NODE_RADIUS * scale + 4, palette.surface, isHovered);
      ctx.restore();
    }
  });

  // The subject, always on top and always labelled.
  const subjectColor = p.model.subject.kind === 'company' ? palette.node.company : palette.node.officerIndividual;
  ctx.beginPath();
  ctx.arc(0, 0, SUBJECT_RADIUS, 0, 2 * Math.PI);
  ctx.fillStyle = palette.surface.nodeFill;
  ctx.fill();
  ctx.fillStyle = withAlpha(subjectColor, ink.nodeTintAlpha);
  ctx.fill();
  ctx.lineWidth = 2.5 / scale;
  ctx.strokeStyle = subjectColor;
  ctx.stroke();
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, dpr * ox, dpr * oy);
  drawLabel(ctx, p.model.subject.name, 0, SUBJECT_RADIUS * scale + 6, palette.surface, true);
  ctx.restore();
}
