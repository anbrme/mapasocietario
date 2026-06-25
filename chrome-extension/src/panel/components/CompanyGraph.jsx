import React, { useMemo, useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { buildGraph } from '../../shared/buildGraph.js';
import { t } from '../i18n.js';

const COMPANY_COLOR = '#1a5fb4';
const ACTIVE = '#2ca02c';
const CEASED = '#bbbbbb';

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
        height={320}
        nodeLabel="label"
        nodeColor={(n) => {
          if (n.type === 'company') return COMPANY_COLOR;
          return n.status === 'active' ? ACTIVE : CEASED;
        }}
        nodeRelSize={5}
        linkColor={(l) => (l.status === 'active' ? ACTIVE : CEASED)}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        cooldownTicks={80}
      />
    </div>
  );
}
