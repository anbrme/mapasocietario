import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "/Users/alessandronurnberg/mapasocietario/Mapa-Societario-VC-Deck-August-2026.pptx";
const BUILD = "/Users/alessandronurnberg/mapasocietario/tmp/vc-deck";
const RENDER = `${BUILD}/rendered`;
const ASSETS = `${BUILD}/assets`;

const W = 1280;
const H = 720;
const C = {
  canvas: "#FFFFFF",
  ink: "#0B1220",
  muted: "#5E6878",
  faint: "#8B95A5",
  panel: "#F1F3F5",
  panel2: "#E8ECEF",
  rule: "#C8CFD8",
  accent: "#14B8A6",
  accentDark: "#0F766E",
  accentPale: "#D9F5F0",
  blue: "#3D8DFF",
  orange: "#F59E0B",
  dark: "#0A0E1A",
  white: "#FFFFFF",
};

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function box(slide, x, y, w, h, fill = C.panel, line = "none", radius = false, name = "box") {
  return slide.shapes.add({
    geometry: radius ? "roundRect" : "rect",
    name,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: line === "none" ? { style: "solid", fill: "none", width: 0 } : { style: "solid", fill: line, width: 1 },
    ...(radius ? { borderRadius: "rounded-xl" } : {}),
  });
}

function txt(slide, text, x, y, w, h, opts = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name: opts.name || "text",
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    fontSize: opts.size ?? 20,
    color: opts.color ?? C.ink,
    bold: opts.bold ?? false,
    italic: opts.italic ?? false,
    alignment: opts.align ?? "left",
    verticalAlignment: opts.valign ?? "top",
  };
  return shape;
}

function kicker(slide, text, y = 38) {
  txt(slide, text.toUpperCase(), 48, y, 780, 26, { size: 16, bold: true, color: C.accentDark, name: "kicker" });
}

function title(slide, text, opts = {}) {
  txt(slide, text, 48, opts.y ?? 70, opts.w ?? 1184, opts.h ?? 78, {
    size: opts.size ?? 48,
    bold: true,
    color: opts.color ?? C.ink,
    name: "slide-title",
  });
}

function footer(slide, page, dark = false) {
  const color = dark ? "#A7B0BE" : C.faint;
  txt(slide, "CONFIDENTIAL · MAPA SOCIETARIO", 48, 680, 400, 18, { size: 12, bold: true, color, name: "footer-brand" });
  txt(slide, String(page).padStart(2, "0"), 1178, 680, 54, 18, { size: 12, bold: true, color, align: "right", name: "footer-page" });
}

function notes(slide, talkTrack, sources = []) {
  const sourceLines = sources.length ? sources.map((s) => `- ${s}`).join("\n") : "- No external claims; narrative framing only.";
  slide.speakerNotes.textFrame.setText(`${talkTrack}\n\n[Sources]\n${sourceLines}`);
  slide.speakerNotes.setVisible(true);
}

function rule(slide, x, y, w, color = C.rule, thickness = 2) {
  return box(slide, x, y, w, thickness, color, "none", false, "rule");
}

function statBlock(slide, x, y, w, value, label, detail, accent = C.accent) {
  box(slide, x, y, w, 278, C.panel, "none", true, "metric-panel");
  box(slide, x, y, 8, 278, accent, "none", false, "metric-accent");
  txt(slide, value, x + 30, y + 40, w - 52, 76, { size: 52, bold: true, color: C.ink, name: "metric-value" });
  txt(slide, label, x + 30, y + 128, w - 52, 58, { size: 24, bold: true, color: C.ink, name: "metric-label" });
  txt(slide, detail, x + 30, y + 204, w - 52, 52, { size: 17, color: C.muted, name: "metric-detail" });
}

async function addImage(slide, path, x, y, w, h, alt, fit = "cover") {
  const bytes = new Uint8Array(await fs.readFile(path));
  return slide.images.add({
    blob: bytes,
    contentType: "image/png",
    alt,
    fit,
    geometry: "roundRect",
    borderRadius: "rounded-xl",
    position: { left: x, top: y, width: w, height: h },
  });
}

const deck = Presentation.create({ slideSize: { width: W, height: H } });

// 1 — cover: Codex Grid slide-01 hierarchy (kicker / dominant title / lower subtitle)
{
  const s = deck.slides.add();
  s.background.fill = C.canvas;
  txt(s, "MAPA SOCIETARIO · PRE-SEED · AUGUST 2026", 42, 42, 760, 32, { size: 18, bold: true, color: C.accentDark });
  txt(s, "The relationship\nintelligence layer\nfor Spain", 42, 170, 1030, 292, { size: 76, bold: true, color: C.ink, name: "cover-title" });
  rule(s, 42, 486, 118, C.accent, 6);
  txt(s, "Turning fragmented public filings into searchable corporate networks, continuous monitoring and decision-ready due diligence.", 42, 520, 760, 92, { size: 26, color: C.muted, name: "cover-subtitle" });
  txt(s, "mapasocietario.es", 1028, 650, 210, 26, { size: 16, bold: true, color: C.ink, align: "right" });
  notes(s, "Open with the category, not the feature. Mapa Societario is a relationship-intelligence product built on Spain's corporate-publication stream.", [
    "https://mapasocietario.es/?guide=1",
  ]);
}

// 2 — problem
{
  const s = deck.slides.add();
  s.background.fill = C.canvas;
  kicker(s, "The problem");
  title(s, "Corporate facts are public. Relationships are hidden.");
  txt(s, "A company name is not a company history.", 48, 188, 490, 134, { size: 44, bold: true, color: C.ink });
  txt(s, "Professionals still reconstruct the network manually—across filings, dates, role changes and name variants—before they can make a decision.", 48, 350, 492, 144, { size: 24, color: C.muted });
  const rows = [
    ["Records arrive as documents", "The authoritative source is optimized for publication, not connected investigation."],
    ["Time changes the answer", "Appointments, resignations, mergers and renamings turn a current snapshot into an incomplete story."],
    ["Risk lives in the network", "Shared officers and related entities matter, but ordinary company reports keep them peripheral."],
  ];
  rows.forEach((r, i) => {
    const y = 180 + i * 146;
    rule(s, 616, y, 616, i === 0 ? C.accent : C.rule, i === 0 ? 5 : 2);
    txt(s, r[0], 616, y + 18, 270, 58, { size: 25, bold: true });
    txt(s, r[1], 904, y + 18, 328, 84, { size: 18, color: C.muted });
  });
  footer(s, 2);
  notes(s, "The problem is not lack of data. It is the cost of reconstructing context: identity, time, status and relationships. This is why a graph-first workflow creates differentiated value.", [
    "https://www.boe.es/diario_borme/ayuda.php?lang=en",
    "https://mapasocietario.es/about.html",
  ]);
}

// 3 — product: Codex Grid slide-08 split hierarchy with a real media field
{
  const s = deck.slides.add();
  s.background.fill = C.canvas;
  kicker(s, "The product");
  title(s, "A corporate network you can explore in seconds");
  txt(s, "Search", 48, 196, 220, 34, { size: 25, bold: true, color: C.accentDark });
  txt(s, "Find a company or officer through normalized, fuzzy entity search.", 48, 238, 470, 72, { size: 20, color: C.muted });
  txt(s, "Explore", 48, 332, 220, 34, { size: 25, bold: true, color: C.accentDark });
  txt(s, "Expand current and historic roles, shared officers, related companies and corporate events.", 48, 374, 470, 92, { size: 20, color: C.muted });
  txt(s, "Act", 48, 486, 220, 34, { size: 25, bold: true, color: C.accentDark });
  txt(s, "Save the investigation, monitor changes, or generate a sourced due diligence report.", 48, 528, 470, 88, { size: 20, color: C.muted });
  box(s, 572, 174, 660, 422, C.dark, C.rule, true, "product-frame");
  await addImage(s, `${ASSETS}/product-graph.png`, 584, 186, 636, 398, "Live Mapa Societario relationship graph for Banco Santander with market context", "cover");
  footer(s, 3);
  notes(s, "Demonstrate the workflow in one sentence: search a name, expand the network, then preserve or monetize the result. The screenshot is a live capture of Banco Santander on 14 August 2026.", [
    "https://mapasocietario.es/app",
    "Live product screenshot captured 14 August 2026; stored in the deck build assets.",
  ]);
}

// 4 — why now
{
  const s = deck.slides.add();
  s.background.fill = C.canvas;
  kicker(s, "Why now");
  title(s, "Three forces make the timing right");
  txt(s, "3.31m", 48, 190, 430, 100, { size: 78, bold: true, color: C.accentDark });
  txt(s, "economically active enterprises in Spain", 48, 302, 430, 76, { size: 28, bold: true });
  txt(s, "Each onboarding, supplier review, investment and investigation begins with an identity question.", 48, 404, 430, 110, { size: 22, color: C.muted });
  rule(s, 532, 178, 2, C.rule, 442);
  const forces = [
    ["The source is machine-readable", "Spain's electronic BORME has been official and authentic since 2009, creating a long public history to structure."],
    ["The compliance bar is rising", "The EU's AML package tightens due diligence and beneficial-ownership requirements across a harmonized rulebook."],
    ["AI makes evidence usable", "Entity resolution, graph traversal and cited report generation can now become one professional workflow."],
  ];
  forces.forEach((f, i) => {
    const y = 176 + i * 150;
    txt(s, `0${i + 1}`, 584, y, 52, 34, { size: 18, bold: true, color: C.accentDark });
    txt(s, f[0], 650, y - 2, 570, 42, { size: 27, bold: true });
    txt(s, f[1], 650, y + 50, 570, 76, { size: 18, color: C.muted });
  });
  footer(s, 4);
  notes(s, "Use the market count as the object base, not as revenue TAM. The core timing argument is the convergence of official digital history, stricter diligence expectations and usable AI workflows.", [
    "https://www.ine.es/dyngs/Prensa/en/DIRCE2025.htm",
    "https://www.boe.es/diario_borme/ayuda.php?lang=en",
    "https://www.consilium.europa.eu/en/press/press-releases/2024/05/30/anti-money-laundering-council-adopts-package-of-rules/",
  ]);
}

// 5 — data moat: Codex Grid slide-19 metric hierarchy
{
  const s = deck.slides.add();
  s.background.fill = C.canvas;
  kicker(s, "The data asset");
  title(s, "The hard foundation is already substantial");
  txt(s, "Daily ingestion, parsing, normalization and graph construction turn public documents into a proprietary research layer.", 48, 144, 1120, 58, { size: 22, color: C.muted });
  statBlock(s, 48, 248, 360, "3.15m", "companies", "Tracked across names, mergers, spin-offs and registry transfers.", C.accent);
  statBlock(s, 460, 248, 360, "9.56m", "corporate events", "Structured from official BORME publication records.", C.blue);
  statBlock(s, 872, 248, 360, "6.48m", "officer changes", "Appointments and resignations preserved with time and status.", C.orange);
  txt(s, "Coverage since 2009 · 1.73m company formations · refreshed on business days", 48, 612, 1120, 36, { size: 18, bold: true, color: C.ink });
  footer(s, 5);
  notes(s, "These are asset-scale metrics, not vanity metrics. The defensibility comes from continuously improving resolution and temporal context on top of the public source.", [
    "Repository src/components/LandingPage.jsx; fallback refreshed from /bormes/stats/overview on 13 August 2026.",
    "https://mapasocietario.es/?guide=1",
  ]);
}

// 6 — product loop
{
  const s = deck.slides.add();
  s.background.fill = C.canvas;
  kicker(s, "The growth loop");
  title(s, "Free discovery creates paid moments");
  txt(s, "The graph earns trust first. Monetization begins when a professional needs persistence, monitoring, documentation or integration.", 48, 146, 1110, 56, { size: 22, color: C.muted });
  // connectors first
  rule(s, 130, 355, 920, C.rule, 4);
  const steps = [
    ["01", "Discover", "Free search and graph", "SEO, direct links, Chrome and API entry points"],
    ["02", "Investigate", "Expand and annotate", "Follow people, companies, roles and events"],
    ["03", "Retain", "Monitor changes", "Return when BORME or IOSCO produces a signal"],
    ["04", "Monetize", "Report, Pro or API", "Charge when evidence becomes a workflow or deliverable"],
  ];
  steps.forEach((st, i) => {
    const x = 48 + i * 300;
    box(s, x + 92, 334, 44, 44, i === 3 ? C.accent : C.ink, "none", true, "step-node");
    txt(s, st[0], x + 92, 343, 44, 24, { size: 15, bold: true, color: C.white, align: "center" });
    txt(s, st[1], x, 226, 240, 42, { size: 28, bold: true });
    txt(s, st[2], x, 282, 240, 34, { size: 20, bold: true, color: C.accentDark });
    txt(s, st[3], x, 410, 240, 92, { size: 18, color: C.muted });
  });
  box(s, 48, 548, 1184, 70, C.accentPale, "none", false, "loop-callout");
  txt(s, "Investment thesis", 70, 568, 180, 30, { size: 18, bold: true, color: C.accentDark });
  txt(s, "Convert a proven free research surface into a recurring professional system of record.", 254, 564, 930, 38, { size: 24, bold: true });
  footer(s, 6);
  notes(s, "This is the business architecture. Free access is the acquisition mechanism; retention and revenue come from monitoring, collaboration, reports and integration.", [
    "Repository docs/market-adoption-playbook.md",
    "Repository src/components/landingCopy.jsx and src/components/DueDiligencePage.jsx",
  ]);
}

// 7 — early traction: Codex Grid slide-20 chart + interpretation rail
{
  const s = deck.slides.add();
  s.background.fill = C.canvas;
  kicker(s, "Early proof");
  title(s, "Commercial signals are already emerging");
  txt(s, "Four-week property baseline, 16 July–12 August 2026. Raw user counts; not a strict funnel.", 48, 144, 760, 32, { size: 17, color: C.muted });
  s.charts.add("bar", {
    position: { left: 48, top: 206, width: 650, height: 390 },
    categories: ["Property users", "Graph selections", "Node explorers"],
    series: [{ name: "Users", values: [513, 69, 41], fill: C.accent }],
    hasLegend: false,
    barOptions: { direction: "bar", grouping: "clustered", gapWidth: 72 },
    dataLabels: { showValue: true, position: "outEnd", textStyle: { fill: C.ink, fontSize: 18, bold: true } },
    chartFill: C.canvas,
    chartLine: { style: "solid", width: 0, fill: C.canvas },
    plotAreaFill: { type: "none" },
    plotAreaLine: { style: "solid", width: 0, fill: C.canvas },
    xAxis: { visible: false, majorGridlines: null, line: { style: "solid", width: 0, fill: C.canvas } },
    yAxis: { visible: true, textStyle: { fill: C.ink, fontSize: 17 }, line: { style: "solid", width: 0, fill: C.canvas }, majorGridlines: null },
  });
  box(s, 752, 202, 480, 184, C.dark, "none", true, "paid-proof");
  txt(s, "2", 786, 228, 150, 76, { size: 66, bold: true, color: C.accent });
  txt(s, "due diligence reports sold", 786, 314, 390, 42, { size: 25, bold: true, color: C.white });
  txt(s, "Willingness to pay is real. Repeatability is the next proof point.", 752, 416, 470, 72, { size: 24, bold: true, color: C.ink });
  box(s, 752, 506, 480, 104, C.accentPale, "none", true, "strategic-signal");
  txt(s, "Major Spanish news agency · active discussion", 778, 526, 420, 30, { size: 19, bold: true, color: C.accentDark });
  txt(s, "Exploring potential applications with the team.", 778, 566, 420, 28, { size: 17, color: C.ink });
  footer(s, 7);
  notes(s, "Be explicit about the stage. The four-week analytics show genuine product exploration; the two sold reports show willingness to pay. A major Spanish news agency is in an active discussion about potential applications, not a partnership or committed pilot. The round is designed to make conversion repeatable.", [
    "Repository docs/market-adoption-playbook.md (513 users; 69 graph-selection users; 41 node-click users).",
    "Founder-reported on 14 August 2026: two due diligence reports sold.",
    "Founder-reported on 14 August 2026: ongoing discussion with a major Spanish news agency about potential applications; no agreement claimed.",
  ]);
}

// 8 — business model
{
  const s = deck.slides.add();
  s.background.fill = C.canvas;
  kicker(s, "Business model");
  title(s, "One data asset, three revenue layers");
  txt(s, "The live one-off product proves value today. Recurring workflow and data products expand contract size without changing the underlying asset.", 48, 144, 1120, 58, { size: 22, color: C.muted });
  const cols = [
    ["LIVE", "Self-serve reports", "€22.50", "per due diligence report", ["Free first report acquisition", "+€17.50 annual accounts", "Volume pricing already designed"]],
    ["NEXT", "Pro workspace", "€99–299", "per team / month · planned", ["Shared investigations", "Monitoring and audit trail", "Exportable client deliverables"]],
    ["SCALE", "API & enterprise", "Annual", "usage or contract pricing · planned", ["Embedded company intelligence", "Bulk monitoring and screening", "Data partnerships and SLAs"]],
  ];
  cols.forEach((c, i) => {
    const x = 48 + i * 402;
    if (i > 0) rule(s, x - 22, 226, 2, C.rule, 380);
    txt(s, c[0], x, 230, 120, 26, { size: 15, bold: true, color: i === 0 ? C.accentDark : C.faint });
    txt(s, c[1], x, 270, 340, 44, { size: 29, bold: true });
    txt(s, c[2], x, 342, 340, 64, { size: 50, bold: true, color: i === 0 ? C.accentDark : C.ink });
    txt(s, c[3], x, 410, 340, 36, { size: 17, color: C.muted });
    c[4].forEach((b, j) => {
      box(s, x, 482 + j * 44, 10, 10, C.accent, "none", true, "bullet");
      txt(s, b, x + 24, 474 + j * 44, 320, 30, { size: 18, color: C.ink });
    });
  });
  footer(s, 8);
  notes(s, "Separate current product from roadmap. Reports are live; Pro and enterprise layers are the monetization plan the round funds. The free graph remains the top-of-funnel advantage.", [
    "https://mapasocietario.es/pricing",
    "Repository docs/due-diligence-pricing-proposal.md",
    "Repository src/components/PricingPage.jsx",
  ]);
}

// 9 — competitive positioning
{
  const s = deck.slides.add();
  s.background.fill = C.canvas;
  kicker(s, "Competitive position");
  title(s, "Connect the records before selling the report");
  txt(s, "Mapa Societario does not replace authoritative documents or credit bureaus. It owns the relationship-research step that comes before them.", 48, 144, 1120, 58, { size: 22, color: C.muted });
  const x0 = 48, y0 = 230;
  const widths = [270, 360, 500];
  const headers = ["Route", "Primary job", "What remains unresolved"];
  let x = x0;
  headers.forEach((h, i) => { txt(s, h, x + 12, y0, widths[i] - 24, 34, { size: 17, bold: true, color: C.faint }); x += widths[i]; });
  rule(s, x0, y0 + 46, 1130, C.ink, 3);
  const rows = [
    ["Commercial Registry", "Authoritative current documents", "Manual synthesis across documents and relationships"],
    ["Report aggregators", "Company, financial and credit reports", "Company-centric output; network exploration is secondary"],
    ["Generic graph tools", "Visualize data already supplied", "No Spanish corporate data asset or daily filing pipeline"],
    ["Mapa Societario", "Search, connect, monitor and document", "Graph-first workflow; escalate to official evidence when needed"],
  ];
  rows.forEach((r, ri) => {
    const y = y0 + 62 + ri * 88;
    if (ri === 3) box(s, x0, y - 12, 1130, 76, C.accentPale, "none", false, "highlight-row");
    let cx = x0;
    r.forEach((v, ci) => {
      txt(s, v, cx + 12, y, widths[ci] - 24, 52, { size: ci === 0 ? 20 : 18, bold: ci === 0, color: ri === 3 && ci === 0 ? C.accentDark : C.ink });
      cx += widths[ci];
    });
    if (ri < rows.length - 1) rule(s, x0, y + 64, 1130, C.rule, 1);
  });
  txt(s, "Wedge", 48, 632, 100, 26, { size: 16, bold: true, color: C.accentDark });
  txt(s, "Faster relationship discovery → better-qualified document purchases and professional workflows.", 142, 626, 1010, 38, { size: 22, bold: true });
  footer(s, 9);
  notes(s, "Position against jobs, not feature checklists. The registry is authoritative; aggregators are strong at reports and credit data. Mapa's differentiated job is relationship discovery and continuity.", [
    "https://sede.registradores.org/site/home?lang=es_ES",
    "https://www.infoempresa.com/es-es/es/informe-de-empresa",
    "https://www.einforma.com/informacion-empresas/informes-empresas",
  ]);
}

// 10 — market expansion
{
  const s = deck.slides.add();
  s.background.fill = C.canvas;
  kicker(s, "Market expansion");
  title(s, "Spain is the wedge into Europe");
  txt(s, "34m", 48, 190, 430, 100, { size: 78, bold: true, color: C.accentDark });
  txt(s, "SMEs in the EU in 2025", 48, 302, 430, 54, { size: 28, bold: true });
  txt(s, "Corporate identity and relationship diligence is a repeatable problem across fragmented national registries.", 48, 388, 430, 106, { size: 22, color: C.muted });
  rule(s, 552, 200, 2, C.rule, 400);
  // vertical timeline connector first
  rule(s, 624, 244, 4, C.rule, 292);
  const stages = [
    ["Spain", "Deepest public graph and professional workflow", "Mapa Societario"],
    ["Five-country base", "Reuse NC Data coverage in UK, France, Switzerland and Italy", "Existing operating knowledge"],
    ["Cross-border layer", "Resolve entities across jurisdictions and sell one graph/API", "Venture-scale expansion"],
  ];
  stages.forEach((st, i) => {
    const y = 208 + i * 150;
    box(s, 604, y + 30, 44, 44, i === 0 ? C.accent : C.ink, "none", true, "timeline-node");
    txt(s, String(i + 1), 604, y + 40, 44, 22, { size: 15, bold: true, color: C.white, align: "center" });
    txt(s, st[0], 686, y, 480, 40, { size: 29, bold: true });
    txt(s, st[1], 686, y + 48, 500, 54, { size: 19, color: C.muted });
    txt(s, st[2], 686, y + 106, 500, 28, { size: 16, bold: true, color: C.accentDark });
  });
  footer(s, 10);
  notes(s, "Spain is the focused wedge, not the ceiling. NC Data gives the team practical multi-country experience; the venture outcome is a cross-border relationship layer and API.", [
    "https://single-market-economy.ec.europa.eu/smes/sme-strategy-and-sme-friendly-business-conditions/sme-performance-review_en",
    "https://mapasocietario.es/about.html",
  ]);
}

// 11 — team and velocity
{
  const s = deck.slides.add();
  s.background.fill = C.canvas;
  kicker(s, "Execution");
  title(s, "Founder velocity is already visible");
  txt(s, "Built inside an operating corporate-intelligence firm—not as a prototype detached from the work.", 48, 144, 1120, 50, { size: 22, color: C.muted });
  box(s, 48, 224, 544, 310, C.dark, "none", true, "operator-panel");
  txt(s, "Nurnberg Consulting SL", 80, 258, 470, 46, { size: 30, bold: true, color: C.white });
  txt(s, "Madrid · operating since 2013", 80, 320, 470, 34, { size: 20, bold: true, color: C.accent });
  txt(s, "Corporate intelligence, business research and multi-jurisdiction investigation experience provide the domain context behind the product.", 80, 382, 450, 110, { size: 20, color: "#C4CBD5" });
  txt(s, "Round-funded focus", 652, 224, 500, 40, { size: 28, bold: true });
  const hires = [
    ["Data / ML", "Entity resolution, quality systems and cross-border graph"],
    ["Product engineering", "Pro workspace, collaboration, reporting and scale"],
    ["Professional GTM", "Design partners, conversion, channels and enterprise sales"],
  ];
  hires.forEach((h, i) => {
    const y = 294 + i * 98;
    txt(s, `0${i + 1}`, 652, y, 44, 30, { size: 17, bold: true, color: C.accentDark });
    txt(s, h[0], 712, y - 2, 210, 34, { size: 23, bold: true });
    txt(s, h[1], 922, y - 2, 290, 58, { size: 17, color: C.muted });
  });
  box(s, 48, 574, 1184, 66, C.panel, "none", false, "velocity-strip");
  txt(s, "738 commits", 78, 592, 200, 28, { size: 20, bold: true });
  txt(s, "40k source lines", 354, 592, 220, 28, { size: 20, bold: true });
  txt(s, "45 test files", 650, 592, 190, 28, { size: 20, bold: true });
  txt(s, "Web · Android · Chrome · Public API", 912, 592, 286, 28, { size: 19, bold: true, color: C.accentDark, align: "right" });
  footer(s, 11);
  notes(s, "The team slide is intentionally honest: the product has been founder-led. The investable opportunity is converting proven velocity and domain expertise into a focused multidisciplinary team.", [
    "https://mapasocietario.es/about.html",
    "Repository snapshot on 14 August 2026: git history, source-line count and test-file count.",
    "Repository chrome-extension/README.md and package structure.",
  ]);
}

// 12 — ask
{
  const s = deck.slides.add();
  s.background.fill = C.dark;
  txt(s, "THE ROUND", 48, 42, 300, 28, { size: 16, bold: true, color: C.accent });
  title(s, "€750k to prove repeatable revenue", { color: C.white, y: 78, w: 1120 });
  txt(s, "18 months of focused execution", 48, 150, 520, 40, { size: 24, color: "#B8C0CC" });
  txt(s, "€750k", 48, 226, 420, 100, { size: 78, bold: true, color: C.accent });
  txt(s, "recommended pre-seed raise", 48, 334, 420, 38, { size: 24, bold: true, color: C.white });
  txt(s, "Use of funds", 48, 416, 420, 34, { size: 20, bold: true, color: C.white });
  const allocations = [
    ["Data & engineering", 0.40, C.accent],
    ["Product & AI", 0.25, C.blue],
    ["Go-to-market", 0.20, C.orange],
    ["Infra, legal & security", 0.15, "#8892A2"],
  ];
  let bx = 48;
  allocations.forEach((a) => {
    const bw = 470 * a[1];
    box(s, bx, 468, bw, 24, a[2], "none", false, "allocation-bar");
    bx += bw;
  });
  allocations.forEach((a, i) => {
    const y = 514 + i * 30;
    box(s, 48, y + 4, 12, 12, a[2], "none", false, "allocation-key");
    txt(s, `${Math.round(a[1] * 100)}%  ${a[0]}`, 72, y, 360, 24, { size: 16, color: "#C8CFD8" });
  });
  rule(s, 574, 220, 2, "#303846", 420);
  txt(s, "18-month proof points", 628, 220, 540, 40, { size: 28, bold: true, color: C.white });
  const milestones = [
    ["Pro workspace live", "Collaboration, monitoring and export become a recurring product."],
    ["100 paying organizations", "Professional design partners convert into repeatable accounts."],
    ["€25k MRR", "A €300k run-rate validates the next institutional round."],
    ["5 API / enterprise partners", "Prove that the data asset embeds beyond the web app."],
  ];
  milestones.forEach((m, i) => {
    const y = 288 + i * 82;
    txt(s, `0${i + 1}`, 628, y, 40, 28, { size: 16, bold: true, color: C.accent });
    txt(s, m[0], 684, y - 2, 470, 32, { size: 22, bold: true, color: C.white });
    txt(s, m[1], 684, y + 32, 480, 44, { size: 16, color: "#AEB7C4" });
  });
  txt(s, "mapasocietario.es  ·  mapasocietario@ncdata.eu", 628, 630, 540, 28, { size: 18, bold: true, color: C.accent });
  footer(s, 12, true);
  notes(s, "Close on a specific round and a falsifiable plan. The amount, allocation and milestones are recommendations for investor discussion, not historical commitments. Adjust once the founder confirms current burn, hiring geography and desired dilution.", [
    "Funding plan is a recommended scenario prepared 14 August 2026; no external claim.",
  ]);
}

// 13 — strategic investor appendix for news-agency / media owners
{
  const s = deck.slides.add();
  s.background.fill = C.canvas;
  kicker(s, "Strategic investor appendix");
  title(s, "The graph can become a reporting advantage");
  txt(s, "For a media owner, the value is not only financial. Mapa Societario can become proprietary research infrastructure and a differentiated data product.", 48, 144, 1120, 58, { size: 22, color: C.muted });
  const uses = [
    ["Faster story development", "Move from a company or person to connected entities, role histories and source documents before competitors assemble the same context."],
    ["Evidence-led newsroom workflow", "Give journalists a shared, reproducible investigation path with notes, saved graphs, monitoring and cited outputs."],
    ["New commercial products", "Create corporate-network alerts, sector intelligence, data licensing or premium research products on top of the same asset."],
  ];
  uses.forEach((u, i) => {
    const x = 48 + i * 402;
    txt(s, `0${i + 1}`, x, 242, 50, 28, { size: 17, bold: true, color: C.accentDark });
    txt(s, u[0], x, 292, 342, 68, { size: 28, bold: true });
    rule(s, x, 378, 86, i === 1 ? C.blue : C.accent, 5);
    txt(s, u[1], x, 412, 342, 150, { size: 19, color: C.muted });
  });
  box(s, 48, 590, 1184, 58, C.dark, "none", false, "strategic-callout");
  txt(s, "Current signal", 70, 607, 160, 26, { size: 17, bold: true, color: C.accent });
  txt(s, "A major Spanish news agency is discussing potential applications with the team.", 228, 602, 960, 34, { size: 22, bold: true, color: C.white });
  footer(s, 13);
  notes(s, "Use this appendix only with a news-agency owner or another strategic media investor. The purpose is to make the strategic upside concrete without implying exclusivity, partnership, pilot status or a commercial commitment.", [
    "Founder-reported on 14 August 2026: ongoing discussion with a major Spanish news agency about potential applications; no agreement claimed.",
    "Repository product capabilities: graph exploration, annotations, saved workspaces, monitoring and due diligence reports.",
  ]);
}

await fs.mkdir(RENDER, { recursive: true });
for (const [i, slide] of deck.slides.items.entries()) {
  const stem = `slide-${String(i + 1).padStart(2, "0")}`;
  await writeBlob(`${RENDER}/${stem}.png`, await deck.export({ slide, format: "png", scale: 1 }));
  await fs.writeFile(`${RENDER}/${stem}.layout.json`, await (await slide.export({ format: "layout" })).text());
}
await writeBlob(`${BUILD}/deck-montage.webp`, await deck.export({ format: "webp", montage: true, scale: 1 }));
const pptx = await PresentationFile.exportPptx(deck);
await pptx.save(OUT);
console.log(OUT);
