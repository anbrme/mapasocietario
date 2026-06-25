import React, { useMemo, useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { buildGraph } from '../../shared/buildGraph.js';

const ACTIVE = '#2ca02c';
const CEASED = '#bbbbbb';

export default function CompanyGraph({ company }) {
  const graphData = useMemo(() => buildGraph(company), [company]);
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
      <ForceGraph2D
        graphData={graphData}
        width={width}
        height={320}
        nodeLabel="label"
        nodeColor={(n) => (n.type === 'company' ? '#1a5fb4' : '#444')}
        nodeRelSize={5}
        linkColor={(l) => (l.status === 'active' ? ACTIVE : CEASED)}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        cooldownTicks={80}
      />
    </div>
  );
}
