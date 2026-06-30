import { useEffect, useRef } from 'react';

/**
 * HeroNetwork — an ambient, living corporate-relationship graph for the hero.
 *
 * This is the page's signature element: the product *is* a network of Spanish
 * companies and the officers who run them, so the hero shows that network
 * breathing rather than a static screenshot. Design choices that are true to
 * the registry domain (not decoration):
 *   - two node shapes encode a real distinction — companies (rounded squares)
 *     vs. people/officers (circles);
 *   - labels render in IBM Plex Mono, the same "registry data artifact" texture
 *     used for NIF / capital / hoja codes elsewhere on the page;
 *   - people are labelled by ROLE (Consejero, Secretario…), never with invented
 *     directorships — accuracy over flourish;
 *   - the hub carries a real, public CIF in mono.
 *
 * Motion is deliberately calm: a slow elliptical drift plus one faint pulse
 * travelling an edge to read as "live". Honors prefers-reduced-motion (renders
 * a single settled frame) and pauses when scrolled out of view.
 *
 * Self-contained canvas — no graph dependency, cheap to run.
 */

const TEAL = '#14b8a6';
const TEAL_LIGHT = '#2dd4bf';
const SURFACE = '#0d1220';

// Normalized layout (0..1) inside a padded region. Inditex group is public and
// uncontroversial; company↔company edges assert only "connected", and people
// are generic roles, so nothing here is a specific claim that could be wrong.
const NODES = [
  { id: 'inditex', label: 'INDITEX, S.A.', sub: 'A-15075062', type: 'company', x: 0.50, y: 0.44, hub: true },
  { id: 'ponte',   label: 'PONTEGADEA, S.L.',  type: 'company', x: 0.19, y: 0.26 },
  { id: 'zara',    label: 'ZARA ESPAÑA, S.A.', type: 'company', x: 0.82, y: 0.30 },
  { id: 'tempe',   label: 'TEMPE, S.A.',       type: 'company', x: 0.80, y: 0.74 },
  { id: 'p1',      label: 'Consejero',          type: 'person',  x: 0.33, y: 0.70 },
  { id: 'p2',      label: 'Secretario',         type: 'person',  x: 0.52, y: 0.80 },
  { id: 'p3',      label: 'Administrador',       type: 'person',  x: 0.13, y: 0.54 },
];

const EDGES = [
  { a: 'inditex', b: 'ponte', flow: true },
  { a: 'inditex', b: 'zara' },
  { a: 'inditex', b: 'tempe' },
  { a: 'inditex', b: 'p1' },
  { a: 'inditex', b: 'p2' },
  { a: 'ponte',   b: 'p3' },
];

export default function HeroNetwork({ ariaLabel = 'Corporate relationship network' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let running = false;
    let start = null;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!running) draw(performance.now()); // keep a crisp frame when paused
    };

    // Padded mapping from normalized coords to pixels (room for labels).
    const px = (n, t) => {
      const padX = width * 0.10;
      const padY = height * 0.14;
      const amp = reduceMotion ? 0 : Math.min(width, height) * 0.018;
      const phase = (n.x + n.y) * 11.3;
      const dx = amp * Math.sin(t * 0.00026 + phase);
      const dy = amp * Math.cos(t * 0.00021 + phase * 1.3);
      return {
        x: padX + n.x * (width - padX * 2) + dx,
        y: padY + n.y * (height - padY * 2) + dy,
      };
    };

    const roundRect = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    const draw = (now) => {
      if (start == null) start = now;
      const t = now - start;
      ctx.clearRect(0, 0, width, height);

      const pos = {};
      for (const n of NODES) pos[n.id] = px(n, t);

      // Edges — thin teal lines.
      ctx.lineWidth = 1;
      for (const e of EDGES) {
        const a = pos[e.a];
        const b = pos[e.b];
        ctx.strokeStyle = 'rgba(45,212,191,0.20)';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        // One edge carries a faint travelling pulse — the "live" signal.
        if (e.flow && !reduceMotion) {
          const p = (t * 0.00009) % 1;
          const fx = a.x + (b.x - a.x) * p;
          const fy = a.y + (b.y - a.y) * p;
          const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 7);
          g.addColorStop(0, 'rgba(45,212,191,0.9)');
          g.addColorStop(1, 'rgba(45,212,191,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(fx, fy, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Nodes + labels.
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (const n of NODES) {
        const { x, y } = pos[n.id];

        ctx.save();
        if (n.hub) {
          ctx.shadowColor = 'rgba(45,212,191,0.55)';
          ctx.shadowBlur = 18;
        }
        ctx.fillStyle = SURFACE;
        ctx.strokeStyle = n.hub ? TEAL_LIGHT : 'rgba(45,212,191,0.55)';
        ctx.lineWidth = n.hub ? 2 : 1.25;

        if (n.type === 'company') {
          const w = n.hub ? 16 : 12;
          roundRect(x - w, y - w * 0.7, w * 2, w * 1.4, 4);
          ctx.fill();
          ctx.stroke();
        } else {
          const r = 7;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();

        const labelY = y + (n.type === 'company' ? (n.hub ? 18 : 14) : 12);
        if (n.type === 'company') {
          ctx.fillStyle = n.hub ? 'rgba(236,240,243,0.95)' : 'rgba(214,222,228,0.78)';
          ctx.font = `600 ${n.hub ? 13 : 11.5}px "IBM Plex Mono", monospace`;
          ctx.fillText(n.label, x, labelY);
          if (n.sub) {
            ctx.fillStyle = 'rgba(45,212,191,0.7)';
            ctx.font = '500 10px "IBM Plex Mono", monospace';
            ctx.fillText(n.sub, x, labelY + 16);
          }
        } else {
          ctx.fillStyle = 'rgba(150,162,172,0.8)';
          ctx.font = '500 10.5px "IBM Plex Mono", monospace';
          ctx.fillText(n.label, x, labelY);
        }
      }

      if (running) raf = requestAnimationFrame(draw);
    };

    const startLoop = () => {
      if (running || reduceMotion) return;
      running = true;
      raf = requestAnimationFrame(draw);
    };
    const stopLoop = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
    };

    // Pause when off-screen for performance.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) startLoop();
        else stopLoop();
      },
      { threshold: 0.05 },
    );

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Draw once fonts are ready so mono labels are crisp from the first frame.
    const kick = () => {
      resize();
      io.observe(canvas);
    };
    if (document.fonts?.ready) document.fonts.ready.then(kick);
    else kick();

    return () => {
      stopLoop();
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={ariaLabel}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}
