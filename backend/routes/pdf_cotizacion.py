"""
Generadores de PDF para cotizaciones — Evergreen Love.

generar_pdf_cotizacion()  → PDF cliente: transparencia comercial, sin costos internos.
generar_hoja_interna()    → PDF admin: desglose completo de costos, solo uso interno.
"""
import os
import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Image as RLImage,
)
from reportlab.platypus.flowables import KeepTogether

# ── Brand colors ──────────────────────────────────────────────────────────────
GREEN       = colors.HexColor("#5f7830")
GREEN_LIGHT = colors.HexColor("#f0f7e6")
GREEN_MID   = colors.HexColor("#c8e6c9")
CREAM       = colors.HexColor("#faf8f5")
DARK        = colors.HexColor("#2a2014")
GRAY        = colors.HexColor("#666666")
GRAY_LIGHT  = colors.HexColor("#f5f5f5")
WHITE       = colors.white
TERRA       = colors.HexColor("#c0634c")
RED_LIGHT   = colors.HexColor("#fff5f5")
BROWN       = colors.HexColor("#7a6840")
BROWN_LIGHT = colors.HexColor("#f7f3ee")

LOGO_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "img", "logo.jpg")
)
FRONTEND_BASE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..")
)


# ── Shared style factory ──────────────────────────────────────────────────────

def _make_styles(accent=GREEN, accent_light=GREEN_LIGHT):
    base = getSampleStyleSheet()
    def s(name, **kw):
        return ParagraphStyle(name, parent=base["Normal"], **kw)
    return {
        "h1":      s("h1",     fontSize=18, textColor=accent, fontName="Helvetica-Bold", leading=22),
        "h2":      s("h2",     fontSize=12, textColor=DARK,   fontName="Helvetica-Bold", leading=16),
        "h3":      s("h3",     fontSize=10, textColor=accent, fontName="Helvetica-Bold", leading=13, spaceAfter=3),
        "label":   s("label",  fontSize=9,  textColor=GRAY,   fontName="Helvetica",      leading=12),
        "value":   s("value",  fontSize=10, textColor=DARK,   fontName="Helvetica-Bold", leading=13),
        "body":    s("body",   fontSize=9,  textColor=DARK,   fontName="Helvetica",      leading=13),
        "small":   s("small",  fontSize=8,  textColor=GRAY,   fontName="Helvetica",      leading=11),
        "footer":  s("footer", fontSize=8,  textColor=GRAY,   fontName="Helvetica",      leading=11, alignment=TA_CENTER),
        "right":   s("right",  fontSize=9,  textColor=DARK,   fontName="Helvetica",      leading=12, alignment=TA_RIGHT),
        "right_b": s("right_b",fontSize=10, textColor=accent, fontName="Helvetica-Bold", leading=14, alignment=TA_RIGHT),
        "total_b": s("total_b",fontSize=12, textColor=accent, fontName="Helvetica-Bold", leading=16, alignment=TA_RIGHT),
        "center":  s("center", fontSize=9,  textColor=GRAY,   fontName="Helvetica",      leading=12, alignment=TA_CENTER),
        "warn":    s("warn",   fontSize=9,  textColor=TERRA,  fontName="Helvetica-Bold", leading=12, alignment=TA_CENTER),
    }


def _hr(color=GREEN_MID, thickness=0.5):
    return HRFlowable(width="100%", thickness=thickness, color=color, spaceAfter=6, spaceBefore=4)


def _logo_or_emoji(emoji="🌿"):
    if os.path.exists(LOGO_PATH):
        try:
            return RLImage(LOGO_PATH, width=0.9*inch, height=0.9*inch)
        except Exception:
            pass
    st = _make_styles()
    return Paragraph(emoji, st["h1"])


def _header_table(cotizacion: dict, W: float, label: str, accent=GREEN):
    """Returns the 3-column header: logo | company | cotizacion number."""
    base = getSampleStyleSheet()
    def s(**kw):
        return ParagraphStyle("_", parent=base["Normal"], **kw)

    fecha_raw = cotizacion.get("fecha_creacion") or cotizacion.get("fecha_actualizado") or ""
    try:
        fecha_fmt = datetime.strptime(fecha_raw[:10], "%Y-%m-%d").strftime("%d/%m/%Y")
    except Exception:
        fecha_fmt = datetime.now().strftime("%d/%m/%Y")

    company = [
        Paragraph("Evergreen Love",
                  s(fontSize=15, textColor=accent, fontName="Helvetica-Bold", leading=19)),
        Paragraph("Artesanías láser personalizadas",
                  s(fontSize=8, textColor=GRAY, fontName="Helvetica", leading=11)),
    ]
    number_col = [
        Paragraph(label,
                  s(fontSize=8, textColor=GRAY, fontName="Helvetica", alignment=TA_RIGHT)),
        Paragraph(f"<b>#{cotizacion.get('id', '')}</b>",
                  s(fontSize=20, textColor=accent, fontName="Helvetica-Bold",
                    alignment=TA_RIGHT, leading=24)),
        Paragraph(f"Fecha: {fecha_fmt}",
                  s(fontSize=8, textColor=GRAY, fontName="Helvetica", alignment=TA_RIGHT)),
    ]
    return Table(
        [[_logo_or_emoji(), company, number_col]],
        colWidths=[0.95*inch, W - 2.15*inch, 2.15*inch],
        style=TableStyle([
            ("VALIGN",       (0,0), (-1,-1), "MIDDLE"),
            ("LEFTPADDING",  (1,0), (1,0),   8),
            ("RIGHTPADDING", (2,0), (2,0),   0),
            ("BOTTOMPADDING",(0,0), (-1,-1), 0),
            ("TOPPADDING",   (0,0), (-1,-1), 0),
        ]),
    )


def _lv_pair(label, value, st):
    """Single label+value row inside an info block."""
    return Table(
        [[Paragraph(label, st["label"]), Paragraph(str(value) if value else "—", st["value"])]],
        colWidths=[1.55*inch, None],
        style=TableStyle([
            ("VALIGN",        (0,0), (-1,-1), "TOP"),
            ("BOTTOMPADDING", (0,0), (-1,-1), 2),
            ("TOPPADDING",    (0,0), (-1,-1), 1),
        ]),
    )


def _fmt(val, prefix="$"):
    if val is None:
        return "—"
    try:
        return f"{prefix}{float(val):.2f}"
    except Exception:
        return "—"


def _fmt_min(val):
    if not val:
        return "—"
    try:
        m = float(val)
        if m == 0:
            return "—"
        return f"{m:.1f} min"
    except Exception:
        return "—"


# ══════════════════════════════════════════════════════════════════════════════
# PDF CLIENTE — transparencia comercial, sin costos internos
# ══════════════════════════════════════════════════════════════════════════════

def generar_pdf_cotizacion(cotizacion: dict, respuestas: list) -> io.BytesIO:
    """
    PDF para el cliente.
    Muestra: producto, personalización, precio base, subtotal, IVU, total, términos.
    NO muestra: costos de materiales, costo láser, margen ni mano de obra.
    """
    buf = io.BytesIO()
    W   = letter[0] - 1.3*inch
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        leftMargin=0.65*inch, rightMargin=0.65*inch,
        topMargin=0.55*inch, bottomMargin=0.7*inch,
        title=f"Cotización #{cotizacion.get('id','')}",
        author="Evergreen Love",
    )
    st    = _make_styles()
    elems = []

    # ── Header ────────────────────────────────────────────────────────────────
    elems.append(_header_table(cotizacion, W, "COTIZACIÓN"))
    elems.append(Spacer(1, 0.12*inch))
    elems.append(_hr(GREEN, 1.5))
    elems.append(Spacer(1, 0.08*inch))

    # ── Cliente ───────────────────────────────────────────────────────────────
    nombre    = cotizacion.get("nombre_cliente") or "—"
    email     = cotizacion.get("email")          or "—"
    telefono  = cotizacion.get("telefono")       or None
    tipo_ev   = cotizacion.get("tipo_evento")    or None

    cliente_items = [
        Paragraph("🧑 Datos del Cliente", st["h3"]),
        Spacer(1, 3),
        _lv_pair("Nombre:", nombre, st),
        _lv_pair("Email:", email, st),
    ]
    if telefono:
        cliente_items.append(_lv_pair("Teléfono:", telefono, st))
    if tipo_ev:
        cliente_items.append(_lv_pair("Tipo de evento:", tipo_ev, st))

    # ── Producto + personalización ────────────────────────────────────────────
    prod_nombre = cotizacion.get("producto_nombre") or "Cotización general"
    descripcion = (cotizacion.get("descripcion") or "").strip()

    # Clasificar respuestas en campos visuales vs otros
    CAMPOS_VISUALES = {"material", "tamaño", "tamano", "tama", "size", "texto", "text",
                       "color", "cantidad", "tipo de evento", "evento"}

    def _es_visual(etiqueta):
        return any(k in etiqueta.lower() for k in CAMPOS_VISUALES)

    resp_cliente = [r for r in respuestas
                    if r.get("tipo") != "archivo"
                    and (r.get("valor") or "").strip()]

    prod_items = [
        Paragraph("📦 Detalle del Pedido", st["h3"]),
        Spacer(1, 3),
        _lv_pair("Producto:", prod_nombre, st),
    ]
    for r in resp_cliente:
        prod_items.append(_lv_pair(r["etiqueta"] + ":", r["valor"], st))

    if descripcion:
        prod_items.append(Spacer(1, 3))
        prod_items.append(Paragraph("Notas del cliente:", st["label"]))
        prod_items.append(Paragraph(descripcion[:300], st["body"]))

    info_table = Table(
        [[cliente_items, prod_items]],
        colWidths=[W * 0.43, W * 0.57],
        style=TableStyle([
            ("VALIGN",      (0,0), (-1,-1), "TOP"),
            ("RIGHTPADDING",(0,0), (0,0),   12),
            ("LEFTPADDING", (1,0), (1,0),   12),
            ("LINEAFTER",   (0,0), (0,0),   0.5, GREEN_MID),
        ]),
    )
    elems.append(info_table)
    elems.append(Spacer(1, 0.1*inch))
    elems.append(_hr())

    # ── Desglose económico ────────────────────────────────────────────────────
    cantidad    = int(cotizacion.get("cantidad") or 1)
    precio_base = float(cotizacion.get("precio_estimado") or 0.0)

    # Detectar material premium y tamaño de respuestas para mostrarlo en línea
    material_val = next((r["valor"] for r in respuestas
                         if "material" in r.get("etiqueta","").lower()), None)
    tamano_val   = next((r["valor"] for r in respuestas
                         if any(k in r.get("etiqueta","").lower()
                                for k in ["tamaño","tamano","tama","size"])), None)

    elems.append(Spacer(1, 0.06*inch))
    elems.append(Paragraph("💰 Desglose de Precio", st["h3"]))
    elems.append(Spacer(1, 4))

    # Tabla de líneas de precio
    head_style = ParagraphStyle("th", parent=getSampleStyleSheet()["Normal"],
                                fontSize=9, fontName="Helvetica-Bold", textColor=DARK)
    desglose_rows = [[
        Paragraph("Descripción",   head_style),
        Paragraph("Cant.",         head_style),
        Paragraph("Precio unit.",  head_style),
        Paragraph("Subtotal",      head_style),
    ]]

    # Línea principal del producto
    subtotal_prod = precio_base * cantidad
    desglose_rows.append([
        Paragraph(prod_nombre + (f" — {tamano_val}" if tamano_val else ""), st["body"]),
        Paragraph(str(cantidad), st["body"]),
        Paragraph(_fmt(precio_base) if precio_base else "Por confirmar", st["body"]),
        Paragraph(_fmt(subtotal_prod) if precio_base else "—", st["body"]),
    ])

    # Línea material premium si aplica (costo adicional de campos)
    costo_adicional_total = sum(
        float(r.get("costo_adicional") or 0) for r in respuestas
        if r.get("tipo") != "archivo"
    )
    if costo_adicional_total > 0:
        desglose_rows.append([
            Paragraph(f"Material premium ({material_val or 'seleccionado'})", st["body"]),
            Paragraph(str(cantidad), st["body"]),
            Paragraph(_fmt(costo_adicional_total), st["body"]),
            Paragraph(_fmt(costo_adicional_total * cantidad), st["body"]),
        ])
        subtotal_prod += costo_adicional_total * cantidad

    # Descuento por volumen (si hay precio wholesale y cantidad califica)
    desc_volumen = None
    if precio_base > 0 and cantidad >= 12:
        precio_w12 = float(cotizacion.get("precio_wholesale_12") or 0)
        precio_w24 = float(cotizacion.get("precio_wholesale_24") or 0)
        precio_w50 = float(cotizacion.get("precio_wholesale_50") or 0)
        precio_vol = None
        if cantidad >= 50 and precio_w50 > 0:
            precio_vol = precio_w50
        elif cantidad >= 24 and precio_w24 > 0:
            precio_vol = precio_w24
        elif cantidad >= 12 and precio_w12 > 0:
            precio_vol = precio_w12
        if precio_vol and precio_vol < precio_base:
            ahorro_unit = precio_base - precio_vol
            ahorro_total = ahorro_unit * cantidad
            desc_volumen = ahorro_total
            subtotal_prod = precio_vol * cantidad
            # Agregar nota de descuento
            pct = round((ahorro_unit / precio_base) * 100)
            desglose_rows.append([
                Paragraph(f"🎉 Descuento por volumen ({cantidad} uds, -{pct}%)", st["body"]),
                Paragraph("", st["body"]),
                Paragraph(f"-{_fmt(ahorro_unit)}/ud", st["body"]),
                Paragraph(f"-{_fmt(ahorro_total)}", st["body"]),
            ])

    desglose_table = Table(
        desglose_rows,
        colWidths=[W * 0.50, W * 0.12, W * 0.19, W * 0.19],
        style=TableStyle([
            ("BACKGROUND",     (0,0), (-1,0),  GREEN_LIGHT),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, GRAY_LIGHT]),
            ("FONTNAME",       (0,0), (-1,0),  "Helvetica-Bold"),
            ("FONTSIZE",       (0,0), (-1,-1), 9),
            ("GRID",           (0,0), (-1,-1), 0.4, GREEN_MID),
            ("VALIGN",         (0,0), (-1,-1), "MIDDLE"),
            ("TOPPADDING",     (0,0), (-1,-1), 6),
            ("BOTTOMPADDING",  (0,0), (-1,-1), 6),
            ("LEFTPADDING",    (0,0), (-1,-1), 8),
            ("RIGHTPADDING",   (0,0), (-1,-1), 8),
            ("ALIGN",          (1,0), (-1,-1), "CENTER"),
        ]),
    )
    elems.append(desglose_table)
    elems.append(Spacer(1, 4))

    # Totales
    ivu_est  = round(subtotal_prod * 0.105, 2) if precio_base else 0
    ivu_mun  = round(subtotal_prod * 0.01,  2) if precio_base else 0
    total    = round(subtotal_prod + ivu_est + ivu_mun, 2) if precio_base else 0

    tot_rows = []
    if precio_base:
        tot_rows += [
            [Paragraph("Subtotal:", st["right"]),
             Paragraph(_fmt(subtotal_prod), st["right"])],
            [Paragraph("IVU Estatal (10.5%):", st["right"]),
             Paragraph(_fmt(ivu_est), st["right"])],
            [Paragraph("IVU Municipal (1%):", st["right"]),
             Paragraph(_fmt(ivu_mun), st["right"])],
        ]
    tot_rows.append([
        Paragraph("TOTAL ESTIMADO:", st["right_b"]),
        Paragraph(_fmt(total) if precio_base else "Por cotizar", st["total_b"]),
    ])

    totales_table = Table(
        tot_rows,
        colWidths=[W * 0.68, W * 0.32],
        style=TableStyle([
            ("ALIGN",         (0,0), (-1,-1), "RIGHT"),
            ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
            ("TOPPADDING",    (0,0), (-1,-1), 3),
            ("BOTTOMPADDING", (0,0), (-1,-1), 3),
            ("LINEABOVE",     (0,-1), (-1,-1), 1.0, GREEN),
        ]),
    )
    elems.append(totales_table)
    elems.append(Spacer(1, 0.1*inch))
    elems.append(_hr())

    # ── Archivos adjuntos del cliente ─────────────────────────────────────────
    archivos = [r for r in respuestas if r.get("tipo") == "archivo" and r.get("archivo_ruta")]
    if archivos:
        elems.append(Spacer(1, 0.06*inch))
        elems.append(Paragraph("📎 Archivos de Referencia", st["h3"]))
        for a in archivos:
            etiq  = a.get("etiqueta") or "Archivo"
            ruta  = a.get("archivo_ruta") or ""
            ext   = os.path.splitext(ruta)[1].lower()
            local = FRONTEND_BASE + ruta if ruta.startswith("/") else ruta
            if ext in {".jpg",".jpeg",".png",".webp"} and os.path.exists(local):
                try:
                    elems.append(Paragraph(f"<b>{etiq}:</b>", st["body"]))
                    elems.append(RLImage(local, width=1.8*inch, height=1.8*inch))
                    elems.append(Spacer(1, 4))
                    continue
                except Exception:
                    pass
            elems.append(Paragraph(f"• {etiq}: {os.path.basename(ruta)}", st["body"]))
        elems.append(Spacer(1, 0.06*inch))
        elems.append(_hr())

    # ── Notas del negocio (si las hay) ───────────────────────────────────────
    notas = (cotizacion.get("notas_internas") or "").strip()
    if notas:
        elems.append(Spacer(1, 0.06*inch))
        elems.append(Paragraph("📝 Notas", st["h3"]))
        elems.append(Paragraph(notas, st["body"]))
        elems.append(Spacer(1, 0.06*inch))
        elems.append(_hr())

    # ── Términos y condiciones ────────────────────────────────────────────────
    elems.append(Spacer(1, 0.08*inch))
    elems.append(KeepTogether([
        Paragraph("📋 Términos y Condiciones", st["h3"]),
        Spacer(1, 4),
        Paragraph("• Esta cotización es válida por <b>15 días</b> a partir de la fecha de emisión.", st["body"]),
        Paragraph("• La producción comienza luego de <b>aprobación y pago</b> según acuerdo.", st["body"]),
        Paragraph("• Los precios están sujetos a cambio si las especificaciones del proyecto varían.", st["body"]),
        Paragraph("• El tiempo de entrega se confirma al momento de aprobar la cotización.", st["body"]),
        Paragraph("• Pagos aceptados: ACH, ATH Móvil, Cheque, Tarjeta de crédito/débito.", st["body"]),
    ]))

    # ── Footer ────────────────────────────────────────────────────────────────
    elems.append(Spacer(1, 0.15*inch))
    elems.append(_hr(GREEN, 1.0))
    elems.append(Spacer(1, 5))
    elems.append(Paragraph("Evergreen Love · Artesanías láser personalizadas · Puerto Rico",
                            st["footer"]))
    elems.append(Paragraph(
        f"Generado el {datetime.now().strftime('%d/%m/%Y %H:%M')} · Cotización #{cotizacion.get('id','')}",
        st["footer"]
    ))

    doc.build(elems)
    buf.seek(0)
    return buf


# ══════════════════════════════════════════════════════════════════════════════
# HOJA INTERNA DE COSTOS — solo admin, nunca se envía al cliente
# ══════════════════════════════════════════════════════════════════════════════

def generar_hoja_interna(cotizacion: dict, respuestas: list,
                          producto, componentes: list,
                          tarifa_laser: float, tarifa_labor: float) -> io.BytesIO:
    """
    PDF interno de costos. Solo para uso del equipo Evergreen Love.
    Incluye costos de materiales, máquina, mano de obra, margen y ganancia.
    """
    ACCENT      = TERRA
    ACCENT_LT   = RED_LIGHT
    BROWN_MID   = colors.HexColor("#d4c9b8")

    buf = io.BytesIO()
    W   = letter[0] - 1.3*inch
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        leftMargin=0.65*inch, rightMargin=0.65*inch,
        topMargin=0.55*inch, bottomMargin=0.7*inch,
        title=f"Hoja Interna #{cotizacion.get('id','')}",
        author="Evergreen Love — INTERNO",
    )
    st    = _make_styles(accent=TERRA, accent_light=RED_LIGHT)
    elems = []

    # ── Header con sello CONFIDENCIAL ────────────────────────────────────────
    elems.append(_header_table(cotizacion, W, "HOJA DE COSTOS INTERNA", accent=TERRA))
    elems.append(Spacer(1, 6))

    # Sello de confidencialidad
    conf_table = Table(
        [[Paragraph("⚠ USO INTERNO — NO COMPARTIR CON EL CLIENTE", st["warn"])]],
        colWidths=[W],
        style=TableStyle([
            ("BACKGROUND",    (0,0), (-1,-1), RED_LIGHT),
            ("BOX",           (0,0), (-1,-1), 1.0, TERRA),
            ("TOPPADDING",    (0,0), (-1,-1), 6),
            ("BOTTOMPADDING", (0,0), (-1,-1), 6),
            ("ALIGN",         (0,0), (-1,-1), "CENTER"),
        ]),
    )
    elems.append(conf_table)
    elems.append(Spacer(1, 0.08*inch))
    elems.append(_hr(TERRA, 1.5))
    elems.append(Spacer(1, 0.06*inch))

    # ── Datos de la cotización ────────────────────────────────────────────────
    nombre_cliente = cotizacion.get("nombre_cliente") or "—"
    email_cliente  = cotizacion.get("email")          or "—"
    prod_nombre    = cotizacion.get("producto_nombre") or producto.get("nombre","—") if producto else "—"
    tipo_ev        = cotizacion.get("tipo_evento")     or None
    cantidad       = int(cotizacion.get("cantidad") or 1)

    col_a = [
        Paragraph("📋 Cotización", st["h3"]),
        Spacer(1, 3),
        _lv_pair("Cliente:", nombre_cliente, st),
        _lv_pair("Email:", email_cliente, st),
        _lv_pair("Producto:", prod_nombre, st),
    ]
    if tipo_ev:
        col_a.append(_lv_pair("Evento:", tipo_ev, st))

    col_b = [Paragraph("🎨 Personalización del Cliente", st["h3"]), Spacer(1, 3)]
    for r in respuestas:
        if r.get("tipo") != "archivo" and (r.get("valor") or "").strip():
            col_b.append(_lv_pair(r["etiqueta"] + ":", r["valor"], st))
    if len(col_b) == 2:
        col_b.append(Paragraph("Sin campos de personalización", st["body"]))

    top_table = Table(
        [[col_a, col_b]],
        colWidths=[W * 0.45, W * 0.55],
        style=TableStyle([
            ("VALIGN",      (0,0), (-1,-1), "TOP"),
            ("RIGHTPADDING",(0,0), (0,0),   12),
            ("LEFTPADDING", (1,0), (1,0),   12),
            ("LINEAFTER",   (0,0), (0,0),   0.5, BROWN_MID),
        ]),
    )
    elems.append(top_table)
    elems.append(Spacer(1, 0.1*inch))
    elems.append(_hr(BROWN_MID))

    # ── Desglose de costos de producción ─────────────────────────────────────
    elems.append(Spacer(1, 0.06*inch))
    elems.append(Paragraph("🔧 Costos de Producción (por unidad)", st["h3"]))
    elems.append(Spacer(1, 4))

    p = producto or {}

    # Componentes de material
    costo_materiales = sum(float(c.get("costo_calculado") or 0) for c in componentes)
    # Si no hay componentes, usar el campo genérico del producto
    if not costo_materiales and p:
        costo_materiales = float(p.get("costo_total",0)) - float(p.get("costo_maquina",0)) - float(p.get("costo_mano_obra",0))
        costo_materiales = max(costo_materiales, 0)

    t_corte    = float(p.get("tiempo_corte",    0) or 0)
    t_grabado  = float(p.get("tiempo_grabado",  0) or 0)
    t_pintura  = float(p.get("tiempo_pintura",  0) or 0)
    t_ensamble = float(p.get("tiempo_ensamblaje",0)or 0)
    t_pegado   = float(p.get("tiempo_pegado",   0) or 0)
    costo_peg  = float(p.get("costo_pegamento", 0) or 0)
    costo_herr = float(p.get("costo_herrajes_extras",0) or 0)
    costo_emp  = float(p.get("costo_empaque",   0) or 0)
    costo_resina= float(p.get("costo_resina_por_ml",0) or 0) * float(p.get("cantidad_resina_ml",0) or 0)

    t_laser_total = t_corte + t_grabado
    costo_maquina = float(p.get("costo_maquina", 0) or 0)
    if not costo_maquina and t_laser_total:
        costo_maquina = round(t_laser_total / 60.0 * tarifa_laser, 4)

    t_labor_total = t_pintura + t_ensamble + t_pegado
    costo_labor = float(p.get("costo_mano_obra", 0) or 0)
    if not costo_labor and t_labor_total:
        costo_labor = round(t_labor_total / 60.0 * tarifa_labor, 4)

    costos_accesorios = costo_peg + costo_herr + costo_emp + costo_resina

    costo_unit = (costo_materiales + costo_maquina + costo_labor + costos_accesorios
                  or float(p.get("costo_total", 0) or 0))

    hdr_b = ParagraphStyle("hb", parent=getSampleStyleSheet()["Normal"],
                            fontSize=9, fontName="Helvetica-Bold",
                            textColor=DARK, leading=12)

    costos_data = [
        [Paragraph("Categoría", hdr_b),
         Paragraph("Detalle", hdr_b),
         Paragraph("Costo unit.", hdr_b)],
    ]

    def _row(cat, det, val):
        return [Paragraph(cat, st["body"]), Paragraph(det, st["body"]),
                Paragraph(_fmt(val) if val else "—", st["body"])]

    costos_data.append(_row(
        "Materiales",
        f"{len(componentes)} componente(s)" if componentes else "Material base",
        costo_materiales,
    ))
    if t_corte or t_grabado:
        costos_data.append(_row(
            "Máquina / Láser",
            f"Corte: {_fmt_min(t_corte)} | Grabado: {_fmt_min(t_grabado)} "
            f"(tarifa ${tarifa_laser:.2f}/h)",
            costo_maquina,
        ))
    if t_pintura:
        costos_data.append(_row("Pintura/Acabado", _fmt_min(t_pintura), None))
    if t_ensamble:
        costos_data.append(_row("Ensamblaje", _fmt_min(t_ensamble), None))
    if t_pegado or costo_peg:
        costos_data.append(_row("Pegado", _fmt_min(t_pegado), costo_peg or None))
    if costo_herr:
        costos_data.append(_row("Herrajes/Extras", "accesorios", costo_herr))
    if costo_resina:
        costos_data.append(_row("Resina", f"{p.get('cantidad_resina_ml',0)} ml", costo_resina))
    if costo_emp:
        costos_data.append(_row("Empaque", "caja/bolsa", costo_emp))
    if t_labor_total and costo_labor:
        costos_data.append(_row(
            "Mano de obra",
            f"{_fmt_min(t_labor_total)} total (tarifa ${tarifa_labor:.2f}/h)",
            costo_labor,
        ))

    costos_table = Table(
        costos_data,
        colWidths=[W * 0.25, W * 0.55, W * 0.20],
        style=TableStyle([
            ("BACKGROUND",     (0,0), (-1,0),  BROWN_LIGHT),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, GRAY_LIGHT]),
            ("FONTSIZE",       (0,0), (-1,-1), 9),
            ("GRID",           (0,0), (-1,-1), 0.4, BROWN_MID),
            ("VALIGN",         (0,0), (-1,-1), "MIDDLE"),
            ("TOPPADDING",     (0,0), (-1,-1), 6),
            ("BOTTOMPADDING",  (0,0), (-1,-1), 6),
            ("LEFTPADDING",    (0,0), (-1,-1), 8),
            ("RIGHTPADDING",   (0,0), (-1,-1), 8),
        ]),
    )
    elems.append(costos_table)
    elems.append(Spacer(1, 4))

    # ── Resumen financiero ────────────────────────────────────────────────────
    costo_total_unit   = costo_unit
    costo_total_pedido = costo_unit * cantidad

    precio_est    = float(cotizacion.get("precio_estimado") or p.get("precio_final", 0) or 0)
    precio_sug    = float(p.get("precio_sugerido", 0) or 0)
    precio_final  = float(p.get("precio_final", 0)    or 0)
    margen_pct    = float(cotizacion.get("margen_estimado") or p.get("margen_ganancia", 0) or 0)
    ganancia_unit = precio_est - costo_total_unit if precio_est else (
                    precio_final - costo_total_unit if precio_final else 0)
    ganancia_pedido = ganancia_unit * cantidad

    fin_rows = [
        [Paragraph("Costo producción (unit.):", st["right"]),
         Paragraph(_fmt(costo_total_unit), st["right_b"])],
        [Paragraph(f"Costo producción ({cantidad} uds):", st["right"]),
         Paragraph(_fmt(costo_total_pedido), st["right_b"])],
    ]
    if precio_sug:
        fin_rows.append([
            Paragraph("Precio sugerido (unit.):", st["right"]),
            Paragraph(_fmt(precio_sug), st["right"]),
        ])
    if precio_final:
        fin_rows.append([
            Paragraph("Precio final catálogo (unit.):", st["right"]),
            Paragraph(_fmt(precio_final), st["right"]),
        ])
    if precio_est:
        fin_rows.append([
            Paragraph("Precio cotizado (unit.):", st["right"]),
            Paragraph(_fmt(precio_est), st["right"]),
        ])
    if margen_pct:
        pct_display = f"{margen_pct*100:.1f}%" if margen_pct < 1.5 else f"{margen_pct:.1f}%"
        fin_rows.append([
            Paragraph("Margen configurado:", st["right"]),
            Paragraph(pct_display, st["right"]),
        ])
    if ganancia_unit and precio_est:
        fin_rows.append([
            Paragraph("Ganancia estimada (unit.):", st["right"]),
            Paragraph(_fmt(ganancia_unit), st["right_b"]),
        ])
        fin_rows.append([
            Paragraph(f"Ganancia estimada ({cantidad} uds):", st["right"]),
            Paragraph(_fmt(ganancia_pedido), st["total_b"]),
        ])

    if fin_rows:
        fin_table = Table(
            fin_rows,
            colWidths=[W * 0.65, W * 0.35],
            style=TableStyle([
                ("ALIGN",        (0,0), (-1,-1), "RIGHT"),
                ("VALIGN",       (0,0), (-1,-1), "MIDDLE"),
                ("TOPPADDING",   (0,0), (-1,-1), 3),
                ("BOTTOMPADDING",(0,0), (-1,-1), 3),
                ("LINEABOVE",    (0,-1), (-1,-1), 1.0, TERRA),
                ("BACKGROUND",   (0,-1), (-1,-1), RED_LIGHT),
            ]),
        )
        elems.append(fin_table)

    elems.append(Spacer(1, 0.1*inch))
    elems.append(_hr(BROWN_MID))

    # ── Notas de estimación ───────────────────────────────────────────────────
    notas_est = (cotizacion.get("notas_estimacion") or "").strip()
    notas_int = (cotizacion.get("notas_internas")   or "").strip()
    if notas_est or notas_int:
        elems.append(Spacer(1, 0.06*inch))
        elems.append(Paragraph("📝 Notas Internas", st["h3"]))
        if notas_est:
            elems.append(Paragraph(f"<b>Estimación:</b> {notas_est}", st["body"]))
        if notas_int:
            elems.append(Paragraph(f"<b>Generales:</b> {notas_int}", st["body"]))

    # ── Footer confidencial ───────────────────────────────────────────────────
    elems.append(Spacer(1, 0.15*inch))
    elems.append(_hr(TERRA, 1.0))
    elems.append(Spacer(1, 5))
    elems.append(Paragraph(
        "DOCUMENTO CONFIDENCIAL · Evergreen Love · Solo uso interno del equipo",
        st["footer"]
    ))
    elems.append(Paragraph(
        f"Generado el {datetime.now().strftime('%d/%m/%Y %H:%M')} · "
        f"Hoja de Costos Interna #{cotizacion.get('id','')}",
        st["footer"]
    ))

    doc.build(elems)
    buf.seek(0)
    return buf
