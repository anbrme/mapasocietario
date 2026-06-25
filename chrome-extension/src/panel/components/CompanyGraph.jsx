import React, { useMemo, useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { buildGraph } from '../../shared/buildGraph.js';
import { positionCategoryFor } from '../../shared/positionCategories.js';
import { t } from '../i18n.js';

const COMPANY = '#1a5fb4';
const OFFICER = '#2ca02c';

function drawNode(node, ctx, globalScale) {
  const isCo = node.type === 'company';
  const r = isCo ? 6 : 5;
  ctx.beginPath();
  ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
  ctx.fillStyle = isCo ? COMPANY : OFFICER;
  ctx.fill();
  const rawLabel = String(node.label || '');
  const label = isCo && rawLabel.length > 28 ? rawLabel.slice(0, 27) + '…' : rawLabel;
  const fontSize = Math.max(10 / globalScale, 2);
  ctx.font = `${isCo ? 'bold ' : ''}${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineWidth = 3 / globalScale;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.strokeText(label, node.x, node.y + r + 1);
  ctx.fillStyle = '#1f2937';
  ctx.fillText(label, node.x, node.y + r + 1);
}

function drawLink(link, ctx, globalScale) {
  const s = link.source, t = link.target;
  if (typeof s !== 'object' || typeof t !== 'object') return;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(t.x, t.y);
  ctx.strokeStyle = 'rgba(120,140,170,0.5)';
  ctx.lineWidth = 1 / globalScale;
  ctx.stroke();
  const role = positionCategoryFor(link.role) || link.role || '';
  if (role) {
    const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2;
    const fontSize = Math.max(8 / globalScale, 1.5);
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 2.5 / globalScale;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeText(role, mx, my);
    ctx.fillStyle = '#6b7280';
    ctx.fillText(role, mx, my);
  }
}

export default function CompanyGraph({ company, locale = 'en' }) {
  const { nodes, links, hiddenNonBoard } = useMemo(() => buildGraph(company), [company]);
  const graphData = useMemo(() => ({ nodes, links }), [nodes, links]);
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(360);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const noteH = hiddenNonBoard > 0 ? 24 : 0;
  return (
    <div ref={wrapRef} style={{ height: 320, borderTop: '1px solid #eee' }}>
      {hiddenNonBoard > 0 && (
        <p style={{ margin: '4px 8px', fontSize: 12, color: '#888' }}>
          {hiddenNonBoard} {t(locale, 'hiddenRoles')}
        </p>
      )}
      <ForceGraph2D
        graphData={graphData}
        width={width}
        height={320 - noteH}
        nodeLabel="label"
        nodeCanvasObject={drawNode}
        linkCanvasObject={drawLink}
        cooldownTicks={80}
      />
    </div>
  );
}
