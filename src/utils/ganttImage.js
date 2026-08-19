import { getPositionColor } from './officerTimeline';

/**
 * Renders the officer Gantt to a PNG for pasting into a report.
 *
 * Drawn to a canvas from the same spans the on-screen chart uses, rather than
 * screenshotting the DOM. The chart is pure geometry we already compute, so
 * re-drawing it costs less than a DOM-capture dependency and removes the whole
 * class of html2canvas failures — missing webfonts, unsupported clip-paths,
 * emotion styles that never made it into the cloned tree. It also lets the
 * export be deterministic and unit-testable: `layoutGanttImage` is pure, and
 * only `drawGantt` touches a canvas.
 *
 * The export is ALWAYS light-themed. It lands in a Word document or a slide,
 * not in the app, so it must read on white paper whatever theme the user is in.
 */

export const GANTT_IMAGE = {
  width: 980,
  padding: 24,
  labelWidth: 210,
  rowHeight: 34,
  barHeight: 16,
  headerHeight: 54,
  axisHeight: 26,
  legendHeight: 22,
  legendPerRow: 4,
  sourceHeight: 22,
  minYearLabelGap: 34,
  arrowWidth: 7,
  markerRadius: 6,
  minBarWidth: 3,
  scale: 2,
};

const INK = {
  background: '#ffffff',
  title: '#111827',
  subtitle: '#6b7280',
  label: '#111827',
  sublabel: '#6b7280',
  axis: '#9ca3af',
  gridline: '#e5e7eb',
  today: '#d97706',
  source: '#9ca3af',
};

const FONT_STACK = '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

/**
 * Year gridlines thinned so two labels never collide. A 60-year record would
 * otherwise stack 60 four-digit labels into an unreadable smear; dropping
 * labels is honest, overlapping them is not.
 */
const thinGridlines = (gridlines, minGap) => {
  const kept = [];
  gridlines.forEach((line) => {
    const last = kept[kept.length - 1];
    if (!last || line.x - last.x >= minGap) kept.push(line);
  });
  return kept;
};

/**
 * Pure layout pass: turns a chart ({ rows, scale, roles } from
 * `buildOfficerChart`) into absolute pixel geometry. No canvas, no DOM.
 */
export const layoutGanttImage = (chart, { title = '', subtitle = '', source = '' } = {}) => {
  const rows = chart?.rows || [];
  const scale = chart?.scale;
  if (!rows.length || !scale) return null;

  const {
    width, padding, labelWidth, rowHeight, barHeight, headerHeight,
    axisHeight, legendHeight, legendPerRow, sourceHeight, minYearLabelGap,
    markerRadius, minBarWidth,
  } = GANTT_IMAGE;

  const plotX = padding + labelWidth;
  const plotWidth = width - plotX - padding;
  const plotRight = plotX + plotWidth;
  const plotTop = padding + headerHeight + axisHeight;
  const toX = (pct) => plotX + (pct / 100) * plotWidth;

  const legend = (chart.roles || []).map((role) => ({ label: role, color: getPositionColor(role) }));
  const legendLines = Math.max(1, Math.ceil(legend.length / legendPerRow));

  const height = plotTop
    + rows.length * rowHeight
    + legendLines * legendHeight
    + sourceHeight
    + padding;

  const todayX = toX(scale.todayPct);

  const gridlines = thinGridlines(
    scale.years.map(({ year, pct }) => ({ label: String(year), x: toX(pct) })),
    minYearLabelGap,
  );

  const laidOutRows = rows.map((row, index) => {
    const y = plotTop + index * rowHeight;
    const barY = y + (rowHeight - barHeight) / 2;

    const bars = row.spans.map((span) => {
      if (span.unknownStart) {
        const centre = toX(scale.toPercent(span.endDate) ?? 0);
        const x = Math.max(plotX, Math.min(centre - markerRadius, plotRight - markerRadius * 2));
        return {
          x, y: barY, width: markerRadius * 2, height: barHeight,
          color: row.color, isActive: false, unknownStart: true,
        };
      }
      const startX = toX(scale.toPercent(span.startDate) ?? 0);
      const endX = span.endDate ? toX(scale.toPercent(span.endDate) ?? 0) : todayX;
      const x = Math.max(plotX, Math.min(startX, plotRight - minBarWidth));
      const barWidth = Math.max(minBarWidth, Math.min(endX, plotRight) - x);
      return {
        x, y: barY, width: barWidth, height: barHeight,
        color: row.color, isActive: !!span.isActive, unknownStart: false,
      };
    });

    return { label: row.company, sublabel: row.role, color: row.color, y, bars };
  });

  return {
    width,
    height,
    plotX,
    plotWidth,
    plotTop,
    plotBottom: plotTop + rows.length * rowHeight,
    todayX,
    gridlines,
    rows: laidOutRows,
    legend,
    legendLines,
    title,
    subtitle,
    source,
  };
};

// ─── Canvas drawing ──────────────────────────────────────────────────────────

/** Trim a string with an ellipsis so it fits `maxWidth` at the current font. */
const fitText = (ctx, text, maxWidth) => {
  const value = String(text ?? '');
  if (ctx.measureText(value).width <= maxWidth) return value;
  let trimmed = value;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
};

const roundedRect = (ctx, x, y, width, height, radius) => {
  const r = Math.min(radius, height / 2, width / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

/** An open-ended term ends in an arrowhead, matching the on-screen chart. */
const drawActiveBar = (ctx, bar, arrowWidth) => {
  const tip = bar.x + bar.width;
  const shoulder = Math.max(bar.x, tip - arrowWidth);
  ctx.beginPath();
  ctx.moveTo(bar.x, bar.y);
  ctx.lineTo(shoulder, bar.y);
  ctx.lineTo(tip, bar.y + bar.height / 2);
  ctx.lineTo(shoulder, bar.y + bar.height);
  ctx.lineTo(bar.x, bar.y + bar.height);
  ctx.closePath();
  ctx.fill();
};

export const drawGantt = (ctx, layout) => {
  const {
    padding, labelWidth, rowHeight, legendHeight, legendPerRow,
    arrowWidth, markerRadius, axisHeight,
  } = GANTT_IMAGE;

  ctx.fillStyle = INK.background;
  ctx.fillRect(0, 0, layout.width, layout.height);

  // Header
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK.title;
  ctx.font = `700 17px ${FONT_STACK}`;
  ctx.fillText(fitText(ctx, layout.title, layout.width - padding * 2), padding, padding + 18);
  if (layout.subtitle) {
    ctx.fillStyle = INK.subtitle;
    ctx.font = `400 12px ${FONT_STACK}`;
    ctx.fillText(fitText(ctx, layout.subtitle, layout.width - padding * 2), padding, padding + 36);
  }

  // Year gridlines and their labels
  ctx.font = `400 11px ${FONT_STACK}`;
  layout.gridlines.forEach((line) => {
    ctx.strokeStyle = INK.gridline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(line.x + 0.5, layout.plotTop - axisHeight + 12);
    ctx.lineTo(line.x + 0.5, layout.plotBottom);
    ctx.stroke();
    ctx.fillStyle = INK.axis;
    ctx.fillText(line.label, line.x + 3, layout.plotTop - axisHeight + 8);
  });

  // Today marker
  ctx.save();
  ctx.strokeStyle = INK.today;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(layout.todayX, layout.plotTop - axisHeight + 12);
  ctx.lineTo(layout.todayX, layout.plotBottom);
  ctx.stroke();
  ctx.restore();

  // Rows
  layout.rows.forEach((row) => {
    ctx.fillStyle = INK.label;
    ctx.font = `600 11px ${FONT_STACK}`;
    ctx.fillText(fitText(ctx, row.label, labelWidth - 10), padding, row.y + rowHeight / 2 - 1);
    ctx.fillStyle = INK.sublabel;
    ctx.font = `400 10px ${FONT_STACK}`;
    ctx.fillText(fitText(ctx, row.sublabel, labelWidth - 10), padding, row.y + rowHeight / 2 + 11);

    row.bars.forEach((bar) => {
      ctx.fillStyle = bar.color;
      ctx.globalAlpha = bar.isActive ? 1 : 0.65;
      if (bar.unknownStart) {
        ctx.beginPath();
        ctx.arc(bar.x + markerRadius, bar.y + bar.height / 2, markerRadius, 0, Math.PI * 2);
        ctx.fill();
      } else if (bar.isActive) {
        drawActiveBar(ctx, bar, arrowWidth);
      } else {
        roundedRect(ctx, bar.x, bar.y, bar.width, bar.height, 3);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  });

  // Legend
  const legendTop = layout.plotBottom + 18;
  const legendColumnWidth = (layout.width - padding * 2) / legendPerRow;
  ctx.font = `400 10px ${FONT_STACK}`;
  layout.legend.forEach((entry, index) => {
    const column = index % legendPerRow;
    const line = Math.floor(index / legendPerRow);
    const x = padding + column * legendColumnWidth;
    const y = legendTop + line * legendHeight;
    ctx.fillStyle = entry.color;
    roundedRect(ctx, x, y - 8, 10, 10, 2);
    ctx.fill();
    ctx.fillStyle = INK.subtitle;
    ctx.fillText(fitText(ctx, entry.label, legendColumnWidth - 20), x + 15, y);
  });

  // Source line — an exported chart has to stay attributable once it is out of
  // the app and inside somebody's report.
  if (layout.source) {
    ctx.fillStyle = INK.source;
    ctx.font = `400 10px ${FONT_STACK}`;
    ctx.fillText(layout.source, padding, layout.height - padding / 2);
  }
};

/**
 * Render a chart to an offscreen canvas at 2× for a crisp paste. Browser only —
 * returns null where there is no document (SSR, prerender, unit tests).
 */
export const renderGanttCanvas = (chart, options = {}) => {
  const layout = layoutGanttImage(chart, options);
  if (!layout || typeof document === 'undefined') return null;

  const ratio = options.scale || GANTT_IMAGE.scale;
  const canvas = document.createElement('canvas');
  canvas.width = layout.width * ratio;
  canvas.height = layout.height * ratio;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(ratio, ratio);
  drawGantt(ctx, layout);
  return canvas;
};

export const canvasToPngBlob = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas produced no PNG blob'))),
      'image/png',
    );
  });

export const isImageClipboardSupported = () =>
  typeof navigator !== 'undefined'
  && !!navigator.clipboard?.write
  && typeof ClipboardItem !== 'undefined';

/**
 * Write a PNG to the clipboard. Takes a PROMISE of a blob, not a blob: Safari
 * only honours a clipboard write whose ClipboardItem was constructed
 * synchronously inside the user gesture, so the await has to happen inside the
 * item, not before it.
 */
export const copyPngToClipboard = (blobPromise) => {
  if (!isImageClipboardSupported()) {
    return Promise.reject(new Error('Image clipboard not supported in this browser'));
  }
  return navigator.clipboard.write([
    new ClipboardItem({ 'image/png': blobPromise }),
  ]);
};

/** Download fallback for browsers that cannot put an image on the clipboard. */
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
