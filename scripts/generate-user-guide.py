#!/usr/bin/env python3
"""Generate the two-page English/Spanish Mapa Societario quick guide."""

from pathlib import Path

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "mapa-societario-user-guide-en-es.pdf"
PUBLIC = ROOT / "public" / "mapa-societario-user-guide-en-es.pdf"

PAGE_W, PAGE_H = A4
MARGIN = 36
INK = colors.HexColor("#0B1324")
MUTED = colors.HexColor("#58677D")
TEAL = colors.HexColor("#0E8178")
TEAL_LIGHT = colors.HexColor("#E5F6F3")
BLUE = colors.HexColor("#2E6BE6")
BLUE_LIGHT = colors.HexColor("#EAF1FF")
AMBER = colors.HexColor("#F59E0B")
AMBER_LIGHT = colors.HexColor("#FFF5DF")
VIOLET = colors.HexColor("#7C4DFF")
VIOLET_LIGHT = colors.HexColor("#F1ECFF")
RED = colors.HexColor("#E85353")
RED_LIGHT = colors.HexColor("#FFF0F0")
LINE = colors.HexColor("#CCD6E3")
WHITE = colors.white


COPY = {
    "en": {
        "tag": "ENGLISH | 1/2",
        "title": "Quick user guide",
        "subtitle": "Search, map and document Spanish corporate relationships",
        "updated": "Updated 12 September 2026",
        "workflow": "START HERE: THE 5-MINUTE WORKFLOW",
        "steps": [
            ("SEARCH", "Open the homepage or a company profile. Enter a company, former name or person and choose a suggestion."),
            ("EXPLORE", "Desktop: double-click a node. Mobile: tap it, then choose Expand relationships. Search again to add another entity."),
            ("ANALYZE", "Use filters, Shared connections and Pathfinder. Open a company profile or officer timeline to verify the underlying facts."),
            ("SAVE OR ACT", "Annotate the graph, create a situation report, save a snapshot, monitor visible companies or order due diligence."),
        ],
        "desktop": "DESKTOP GRAPH",
        "desktop_items": [
            ("Double-click", "Expand a company or officer."),
            ("Right-click", "Open node actions: preview, timeline, note, edit, merge, hide or delete."),
            ("Top bar", "Search, filter, highlight shared connections, open Pathfinder, reports and graph tools."),
        ],
        "mobile": "MOBILE GRAPH",
        "mobile_items": [
            ("Tap a node", "Open its action sheet, then expand relationships, preview data or open the full profile."),
            ("Move", "Pinch to zoom, drag the canvas and use the floating recenter button."),
            ("Keep it simple", "Filters use a separate sheet. Open full application adds the advanced controls."),
        ],
        "toolbox": "BUILD AN INVESTIGATION",
        "tools": [
            ("MONITOR", "Watch up to 25 visible companies in one named list. Confirm once by email; reopen the network to review new BORME events."),
            ("ANNOTATE", "Add notes and colour flags. Merge only clear duplicates. Your edits are hypotheses, not official registry facts."),
            ("SAVE", "Local autosave stays in this browser. Export/import JSON for a portable graph with nodes, links, notes, filters and layout."),
        ],
        "outputs": "CHOOSE THE RIGHT OUTPUT",
        "output_cards": [
            ("SITUATION REPORT", "FREE | 1+ companies", "A working document from the current graph: summary, annotations, corrections, officers and shared links. Copy for Word or download HTML."),
            ("DUE DILIGENCE PDF", "1 company | FIRST REPORT FREE", "Registry history, sanctions/PEP, adverse media and sourced analysis. The free first report excludes financial statements."),
            ("AI INVESTIGATION", "UP TO 10 SELECTED ENTITIES", "Select companies or people on the graph, then investigate the selection with the current network as context."),
        ],
        "warning_title": "BEFORE YOU SHARE",
        "warning": "Situation reports and exported graph snapshots include your summary and node notes. Review them first. The notes are your annotations, not BORME or Registro Mercantil data.",
        "care_title": "USE WITH CARE",
        "care": "Mapa Societario is unofficial and automatically parsed. BORME assigns no unique identifier to officers, so common names can collide. Verify critical facts with BORME or the Registro Mercantil.",
        "open": "OPEN THE WORKSPACE",
        "footer": "Free graph | No account required",
    },
    "es": {
        "tag": "ESPAÑOL | 2/2",
        "title": "Guía rápida de usuario",
        "subtitle": "Busca, conecta y documenta relaciones societarias españolas",
        "updated": "Actualizada el 12 de septiembre de 2026",
        "workflow": "EMPIEZA AQUÍ: FLUJO DE 5 MINUTOS",
        "steps": [
            ("BUSCA", "Abre la portada o una ficha. Escribe una empresa, un nombre anterior o una persona y elige una sugerencia."),
            ("EXPLORA", "Escritorio: doble clic en el nodo. Móvil: tócalo y pulsa Expandir relaciones. Busca de nuevo para añadir otra entidad."),
            ("ANALIZA", "Usa filtros, Conexiones compartidas y Pathfinder. Abre la ficha o la línea temporal para verificar los datos de base."),
            ("GUARDA O ACTÚA", "Anota el grafo, crea un informe de situación, guarda una instantánea, monitoriza empresas o pide due diligence."),
        ],
        "desktop": "GRAFO EN ESCRITORIO",
        "desktop_items": [
            ("Doble clic", "Amplía una empresa o un administrador."),
            ("Clic derecho", "Abre acciones: vista previa, línea temporal, nota, edición, fusión, ocultar o eliminar."),
            ("Barra superior", "Busca, filtra, resalta conexiones, abre Pathfinder, informes y herramientas del grafo."),
        ],
        "mobile": "GRAFO EN MÓVIL",
        "mobile_items": [
            ("Toca un nodo", "Abre su panel; después amplía relaciones, consulta datos o abre la ficha completa."),
            ("Muévete", "Pellizca para ampliar, arrastra el lienzo y usa el botón flotante para recentrar."),
            ("Mantenlo simple", "Los filtros tienen su panel. Abrir aplicación completa añade los controles avanzados."),
        ],
        "toolbox": "CONSTRUYE UNA INVESTIGACIÓN",
        "tools": [
            ("MONITORIZA", "Vigila hasta 25 empresas visibles en una lista. Confirma una vez por email y vuelve a la red para revisar nuevos actos BORME."),
            ("ANOTA", "Añade notas y marcas de color. Fusiona solo duplicados claros. Tus cambios son hipótesis, no datos registrales oficiales."),
            ("GUARDA", "El autoguardado local queda en este navegador. Exporta/importa JSON para conservar nodos, enlaces, notas, filtros y disposición."),
        ],
        "outputs": "ELIGE EL RESULTADO ADECUADO",
        "output_cards": [
            ("INFORME DE SITUACIÓN", "GRATIS | 1+ empresas", "Documento de trabajo del grafo actual: resumen, anotaciones, correcciones, cargos y conexiones. Copia para Word o descarga HTML."),
            ("PDF DUE DILIGENCE", "1 empresa | PRIMER INFORME GRATIS", "Historial registral, sanciones/PEP, prensa adversa y análisis con fuentes. El primer informe gratis excluye las cuentas anuales."),
            ("INVESTIGACIÓN POR IA", "HASTA 10 ENTIDADES", "Selecciona empresas o personas en el grafo e investiga la selección con la red actual como contexto."),
        ],
        "warning_title": "ANTES DE COMPARTIR",
        "warning": "Los informes de situación y las instantáneas del grafo incluyen tu resumen y las notas de los nodos. Revísalos antes. Son tus anotaciones, no datos del BORME ni del Registro Mercantil.",
        "care_title": "ÚSALO CON CRITERIO",
        "care": "Mapa Societario no es oficial y se genera mediante extracción automática. El BORME no asigna un identificador único a los cargos: los nombres comunes pueden coincidir. Verifica los datos críticos con el BORME o el Registro Mercantil.",
        "open": "ABRIR EL ESPACIO DE TRABAJO",
        "footer": "Grafo gratuito | Sin cuenta",
    },
}


def wrap(text, font, size, width):
    words = text.split()
    lines, current = [], ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if current and stringWidth(candidate, font, size) > width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def text(c, value, x, y, width, size=8.2, color=MUTED, bold=False, leading=None, max_lines=None):
    font = "Helvetica-Bold" if bold else "Helvetica"
    leading = leading or size * 1.28
    lines = wrap(value, font, size, width)
    if max_lines is not None:
        lines = lines[:max_lines]
    c.setFont(font, size)
    c.setFillColor(color)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def section_title(c, value, y):
    c.setFillColor(TEAL)
    c.setFont("Helvetica-Bold", 8.8)
    c.drawString(MARGIN, y, value)
    c.setStrokeColor(TEAL)
    c.setLineWidth(0.5)
    c.line(MARGIN, y - 5, PAGE_W - MARGIN, y - 5)


def rounded_card(c, x, y, width, height, fill=WHITE, stroke=LINE):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.7)
    c.roundRect(x, y, width, height, 8, fill=1, stroke=1)


def numbered_steps(c, items, top):
    gap = 8
    width = (PAGE_W - 2 * MARGIN - 3 * gap) / 4
    height = 88
    for i, (title, body) in enumerate(items):
        x = MARGIN + i * (width + gap)
        y = top - height
        rounded_card(c, x, y, width, height)
        c.setFillColor(TEAL if i < 3 else AMBER)
        c.circle(x + 17, top - 18, 10, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 8.7)
        c.drawCentredString(x + 17, top - 21, str(i + 1))
        c.drawString(x + 32, top - 21, title)
        text(c, body, x + 10, top - 39, width - 20, 7.3, MUTED, leading=9.2, max_lines=5)


def instruction_panel(c, x, y, width, height, title, items, fill):
    rounded_card(c, x, y, width, height, fill)
    c.setFillColor(TEAL)
    c.setFont("Helvetica-Bold", 9.2)
    c.drawString(x + 12, y + height - 18, title)
    cursor = y + height - 37
    for label, body in items:
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 7.2)
        c.drawString(x + 12, cursor, label)
        cursor = text(c, body, x + 96, cursor, width - 108, 6.8, MUTED, leading=8.1, max_lines=2) - 7


def three_cards(c, items, top, height, fills):
    gap = 8
    width = (PAGE_W - 2 * MARGIN - 2 * gap) / 3
    for i, item in enumerate(items):
        x = MARGIN + i * (width + gap)
        y = top - height
        rounded_card(c, x, y, width, height, fills[i])
        c.setFillColor([BLUE, TEAL, VIOLET][i])
        c.roundRect(x + 9, top - 27, 4, 18, 2, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 8.4)
        c.drawString(x + 19, top - 20, item[0])
        text(c, item[1], x + 10, top - 40, width - 20, 7.2, MUTED, leading=8.8, max_lines=5)


def output_cards(c, items, top):
    gap = 8
    width = (PAGE_W - 2 * MARGIN - 2 * gap) / 3
    height = 94
    for i, (title, meta, body) in enumerate(items):
        x = MARGIN + i * (width + gap)
        y = top - height
        rounded_card(c, x, y, width, height)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 8.2)
        c.drawString(x + 10, top - 18, title)
        c.setFillColor(TEAL if i != 1 else AMBER)
        meta_bottom = text(c, meta, x + 10, top - 33, width - 20, 6.4,
                           TEAL if i != 1 else AMBER, bold=True, leading=7.4, max_lines=2)
        body_y = min(top - 49, meta_bottom - 5)
        text(c, body, x + 10, body_y, width - 20, 6.7, MUTED, leading=7.9, max_lines=5)


def draw_qr(c, url, x, y, size=38):
    widget = qr.QrCodeWidget(url)
    bounds = widget.getBounds()
    drawing = Drawing(size, size, transform=[size / (bounds[2] - bounds[0]), 0, 0, size / (bounds[3] - bounds[1]), 0, 0])
    drawing.add(widget)
    renderPDF.draw(drawing, c, x, y)


def draw_page(c, lang):
    d = COPY[lang]
    c.setFillColor(INK)
    c.rect(0, PAGE_H - 92, PAGE_W, 92, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#5ED6C8"))
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(MARGIN, PAGE_H - 25, "MAPA SOCIETARIO")
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 23)
    c.drawString(MARGIN, PAGE_H - 51, d["title"])
    c.setFont("Helvetica", 9.5)
    c.setFillColor(colors.HexColor("#D5DEEC"))
    c.drawString(MARGIN, PAGE_H - 70, d["subtitle"])
    c.setFillColor(colors.HexColor("#18365F"))
    c.roundRect(PAGE_W - 120, PAGE_H - 36, 84, 21, 11, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawCentredString(PAGE_W - 78, PAGE_H - 29, d["tag"])
    c.setFillColor(colors.HexColor("#AAB7CA"))
    c.setFont("Helvetica", 6.8)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 64, d["updated"])

    section_title(c, d["workflow"], PAGE_H - 112)
    numbered_steps(c, d["steps"], PAGE_H - 126)

    section_title(c, "GRAPH CONTROLS" if lang == "en" else "CONTROLES DEL GRAFO", PAGE_H - 231)
    panel_gap = 10
    panel_w = (PAGE_W - 2 * MARGIN - panel_gap) / 2
    instruction_panel(c, MARGIN, PAGE_H - 366, panel_w, 119, d["desktop"], d["desktop_items"], BLUE_LIGHT)
    instruction_panel(c, MARGIN + panel_w + panel_gap, PAGE_H - 366, panel_w, 119, d["mobile"], d["mobile_items"], TEAL_LIGHT)

    section_title(c, d["toolbox"], PAGE_H - 386)
    three_cards(c, d["tools"], PAGE_H - 401, 102, [BLUE_LIGHT, TEAL_LIGHT, VIOLET_LIGHT])

    section_title(c, d["outputs"], PAGE_H - 522)
    output_cards(c, d["output_cards"], PAGE_H - 537)

    warning_y = PAGE_H - 708
    rounded_card(c, MARGIN, warning_y, PAGE_W - 2 * MARGIN, 61, AMBER_LIGHT, colors.HexColor("#F0C35B"))
    c.setFillColor(colors.HexColor("#8A5800"))
    c.setFont("Helvetica-Bold", 8.2)
    c.drawString(MARGIN + 11, warning_y + 44, d["warning_title"])
    text(c, d["warning"], MARGIN + 11, warning_y + 29, PAGE_W - 2 * MARGIN - 22, 7.2, colors.HexColor("#6B4A13"), leading=8.8, max_lines=3)

    care_y = PAGE_H - 770
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 7.2)
    c.drawString(MARGIN, care_y + 35, d["care_title"])
    text(c, d["care"], MARGIN, care_y + 22, PAGE_W - 2 * MARGIN - 52, 6.7, MUTED, leading=8.0, max_lines=3)
    draw_qr(c, "https://mapasocietario.es/app/", PAGE_W - MARGIN - 38, care_y + 1)

    c.setFillColor(INK)
    c.rect(0, 0, PAGE_W, 48, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#5ED6C8"))
    c.setFont("Helvetica-Bold", 6.8)
    c.drawString(MARGIN, 31, d["open"])
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 10.5)
    c.drawString(MARGIN, 15, "mapasocietario.es/app")
    c.linkURL("https://mapasocietario.es/app/", (MARGIN, 10, 180, 30), relative=0)
    c.setFillColor(colors.HexColor("#AAB7CA"))
    c.setFont("Helvetica", 6.8)
    c.drawRightString(PAGE_W - MARGIN, 22, d["footer"])
    c.drawRightString(PAGE_W - MARGIN, 11, f"Mapa Societario user guide | {d['tag'].split('|')[-1].strip()}")


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
    c.setTitle("Mapa Societario - Quick user guide / Guía rápida")
    c.setAuthor("Mapa Societario")
    c.setSubject("Search, explore, annotate, monitor and report Spanish corporate relationships")
    for language in ("en", "es"):
        draw_page(c, language)
        c.showPage()
    c.save()
    PUBLIC.write_bytes(OUTPUT.read_bytes())
    print(OUTPUT)
    print(PUBLIC)


if __name__ == "__main__":
    main()
