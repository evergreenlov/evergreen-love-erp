"""
Generador de PDF para cotizaciones — Evergreen Love.
Produce un BytesIO listo para servir como StreamingResponse o adjuntar a email.
"""
import os
import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Image as RLImage,
)
from reportlab.platypus.flowables import KeepTogether

# ── Brand colors ──────────────────────────────────────────────────────────────
GREEN       = colors.HexColor("#5f7830")
GREEN_LIGHT = colors.HexColor("#f0f7e6")
GREEN_MID   = colors.HexColor("#c8e6c9")
BROWN       = colors.HexColor("#7a6840")
CREAM       = colors.HexColor("#faf8f5")
DARK        = colors.HexColor("#2a2014")
GRAY        = colors.HexColor("#666666")
GRAY_LIGHT  = colors.HexColor("#f5f5f5")
WHITE       = colors.white
TERRA       = colors.HexColor("#c0634c")

LOGO_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "img", "logo.jpg")
)
FRONTEND_BASE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..")
)


def _styles():
    base = getSampleStyleSheet()
    def s(name, **kw):
        return ParagraphStyle(name, parent=base["Normal"], **kw)
    return {
        "h1":       s("h1",      fontSize=18, textColor=GREEN,  fontName="Helvetica-Bold",  leading=22),
        "h2":       s("h2",      fontSize=12, textColor=DARK,   fontName="Helvetica-Bold",  leading=16),
        "h3":       s("h3",      fontSize=10, textColor=GREEN,  fontName="Helvetica-Bold",  leading=13, spaceAfter=4),
        "label":    s("label",   fontSize=9,  textColor=GRAY,   fontName="Helvetica",       leading=12),
        "value":    s("value",   fontSize=10, textColor=DARK,   fontName="Helvetica-Bold",  leading=13),
        "body":     s("body",    fontSize=9,  textColor=DARK,   fontName="Helvetica",       leading=13),
        "small":    s("small",   fontSize=8,  textColor=GRAY,   fontName="Helvetica",       leading=11),
        "footer":   s("footer",  fontSize=8,  textColor=GRAY,   fontName="Helvetica",       leading=11, alignment=TA_CENTER),
        "right":    s("right",   fontSize=9,  textColor=DARK,   fontName="Helvetica",       leading=12, alignment=TA_RIGHT),
        "right_b":  s("right_b", fontSize=10, textColor=GREEN,  fontName="Helvetica-Bold",  leading=14, alignment=TA_RIGHT),
        "total_b":  s("total_b", fontSize=12, textColor=GREEN,  fontName="Helvetica-Bold",  leading=16, alignment=TA_RIGHT),
        "center":   s("center",  fontSize=9,  textColor=GRAY,   fontName="Helvetica",       leading=12, alignment=TA_CENTER),
    }


def _hr(color=GREEN_MID, thickness=0.5):
    return HRFlowable(width="100%", thickness=thickness, color=color, spaceAfter=6, spaceBefore=6)


def _section_title(text, st):
    return Paragraph(text, st["h3"])


def _lv(label, value, st):
    """Render a label + value pair as a small 2-col table."""
    return Table(
        [[Paragraph(label, st["label"]), Paragraph(str(value) if value else "—", st["value"])]],
        colWidths=[1.6*inch, None],
        style=TableStyle([
            ("VALIGN", (0,0), (-1,-1), "TOP"),
            ("BOTTOMPADDING", (0,0), (-1,-1), 3),
            ("TOPPADDING",    (0,0), (-1,-1), 1),
        ]),
    )


def generar_pdf_cotizacion(cotizacion: dict, respuestas: list) -> io.BytesIO:
    """
    Genera el PDF de cotización y devuelve un BytesIO.
    cotizacion: dict con todos los campos de la tabla cotizaciones.
    respuestas: list de dicts {etiqueta, tipo, valor, archivo_ruta}.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=0.65*inch, rightMargin=0.65*inch,
        topMargin=0.55*inch,  bottomMargin=0.7*inch,
        title=f"Cotización #{cotizacion['id']}",
        author="Evergreen Love",
    )

    st   = _styles()
    W    = letter[0] - 1.3*inch   # usable width
    elems = []

    # ── HEADER: logo + company + cotización number ────────────────────────────
    logo_cell = ""
    if os.path.exists(LOGO_PATH):
        try:
            logo_cell = RLImage(LOGO_PATH, width=0.9*inch, height=0.9*inch)
        except Exception:
            logo_cell = Paragraph("🌿", st["h1"])
    else:
        logo_cell = Paragraph("🌿", st["h1"])

    company_block = [
        Paragraph("Evergreen Love", ParagraphStyle("co", parent=getSampleStyleSheet()["Normal"],
            fontSize=16, textColor=GREEN, fontName="Helvetica-Bold", leading=20)),
        Paragraph("Artesanías láser personalizadas", st["small"]),
        Paragraph("evergreen-love-erp.onrender.com", st["small"]),
    ]

    cotiz_num = cotizacion.get("id", "")
    fecha_raw = cotizacion.get("fecha_creacion") or cotizacion.get("fecha_actualizado") or ""
    try:
        fecha_fmt = datetime.strptime(fecha_raw[:10], "%Y-%m-%d").strftime("%d de %B de %Y")
    except Exception:
        fecha_fmt = fecha_raw[:10] if fecha_raw else datetime.now().strftime("%d de %B de %Y")

    number_block = [
        Paragraph(f"COTIZACIÓN", ParagraphStyle("cn_lbl", parent=getSampleStyleSheet()["Normal"],
            fontSize=9, textColor=GRAY, fontName="Helvetica", alignment=TA_RIGHT)),
        Paragraph(f"<b>#{cotiz_num}</b>", ParagraphStyle("cn_val", parent=getSampleStyleSheet()["Normal"],
            fontSize=22, textColor=GREEN, fontName="Helvetica-Bold", alignment=TA_RIGHT, leading=26)),
        Paragraph(f"Fecha: {fecha_fmt}", ParagraphStyle("cn_dt", parent=getSampleStyleSheet()["Normal"],
            fontSize=9, textColor=GRAY, fontName="Helvetica", alignment=TA_RIGHT)),
    ]

    hdr_table = Table(
        [[logo_cell, company_block, number_block]],
        colWidths=[1.0*inch, W - 2.2*inch, 2.2*inch],
        style=TableStyle([
            ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
            ("LEFTPADDING",   (1,0), (1,0),   8),
            ("RIGHTPADDING",  (2,0), (2,0),   0),
            ("BOTTOMPADDING", (0,0), (-1,-1), 0),
            ("TOPPADDING",    (0,0), (-1,-1), 0),
        ]),
    )
    elems.append(hdr_table)
    elems.append(Spacer(1, 0.15*inch))
    elems.append(_hr(GREEN, thickness=1.5))
    elems.append(Spacer(1, 0.08*inch))

    # ── CLIENTE + PRODUCTO side by side ──────────────────────────────────────
    nombre_cliente = cotizacion.get("nombre_cliente") or "—"
    email_cliente  = cotizacion.get("email") or "—"
    tel_cliente    = cotizacion.get("telefono") or "—"
    tipo_evento    = cotizacion.get("tipo_evento") or None

    producto_nombre = cotizacion.get("producto_nombre") or cotizacion.get("producto") or None
    descripcion     = cotizacion.get("descripcion") or "—"
    presupuesto     = cotizacion.get("presupuesto_aprox")

    def _cell_block(title, rows):
        block = [Paragraph(title, st["h3"]), Spacer(1, 4)]
        for lbl, val in rows:
            if val:
                block.append(_lv(lbl, val, st))
        return block

    cliente_rows = [
        ("Nombre", nombre_cliente),
        ("Email",  email_cliente),
        ("Teléfono", tel_cliente),
    ]
    if tipo_evento:
        cliente_rows.append(("Tipo de evento", tipo_evento))

    producto_rows = [
        ("Producto", producto_nombre or "Cotización general"),
        ("Descripción", descripcion if descripcion != "—" else None),
    ]
    if presupuesto:
        producto_rows.append(("Presupuesto cliente", f"${float(presupuesto):.2f}"))

    # Personalización: tamaño, material, texto de respuestas
    campos_label = {
        "material": "Material", "tamaño": "Tamaño", "tamano": "Tamaño",
        "texto": "Texto", "color": "Color", "cantidad": "Cantidad",
    }
    for r in respuestas:
        if r.get("tipo") == "archivo":
            continue
        etiq = (r.get("etiqueta") or "").strip()
        val  = (r.get("valor")   or "").strip()
        if etiq and val:
            producto_rows.append((etiq, val))

    left_col  = _cell_block("🧑 Datos del Cliente",   cliente_rows)
    right_col = _cell_block("📦 Detalle del Pedido",  producto_rows)

    info_table = Table(
        [[left_col, right_col]],
        colWidths=[W * 0.44, W * 0.56],
        style=TableStyle([
            ("VALIGN",       (0,0), (-1,-1), "TOP"),
            ("RIGHTPADDING", (0,0), (0,0),   12),
            ("LEFTPADDING",  (1,0), (1,0),   12),
            ("LINEAFTER",    (0,0), (0,0),   0.5, GREEN_MID),
        ]),
    )
    elems.append(info_table)
    elems.append(Spacer(1, 0.12*inch))
    elems.append(_hr())

    # ── DESGLOSE ECONÓMICO ────────────────────────────────────────────────────
    precio_unit  = float(cotizacion.get("precio_estimado") or 0.0)
    cantidad     = int(cotizacion.get("cantidad") or 1)
    subtotal     = precio_unit * cantidad
    ivu_est      = round(subtotal * 0.105, 2)
    ivu_mun      = round(subtotal * 0.01,  2)
    total_calc   = round(subtotal + ivu_est + ivu_mun, 2)

    elems.append(Spacer(1, 0.06*inch))
    elems.append(_section_title("💰 Desglose de Precio Estimado", st))
    elems.append(Spacer(1, 4))

    desglose_data = [
        [Paragraph("Descripción", st["h3"]),
         Paragraph("Cant.", st["h3"]),
         Paragraph("Precio unit.", st["h3"]),
         Paragraph("Subtotal", st["h3"])],
        [Paragraph(producto_nombre or "Producto personalizado", st["body"]),
         Paragraph(str(cantidad), st["body"]),
         Paragraph(f"${precio_unit:.2f}" if precio_unit else "Por definir", st["body"]),
         Paragraph(f"${subtotal:.2f}" if precio_unit else "—", st["body"])],
    ]
    desglose_table = Table(
        desglose_data,
        colWidths=[W * 0.50, W * 0.12, W * 0.19, W * 0.19],
        style=TableStyle([
            ("BACKGROUND",    (0,0), (-1,0),  GREEN_LIGHT),
            ("ROWBACKGROUNDS",(0,1), (-1,-1), [WHITE, GRAY_LIGHT]),
            ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
            ("FONTSIZE",      (0,0), (-1,-1), 9),
            ("GRID",          (0,0), (-1,-1), 0.4, GREEN_MID),
            ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
            ("TOPPADDING",    (0,0), (-1,-1), 6),
            ("BOTTOMPADDING", (0,0), (-1,-1), 6),
            ("LEFTPADDING",   (0,0), (-1,-1), 8),
            ("RIGHTPADDING",  (0,0), (-1,-1), 8),
            ("ALIGN",         (1,0), (-1,-1), "CENTER"),
        ]),
    )
    elems.append(desglose_table)
    elems.append(Spacer(1, 4))

    # Totales block (right-aligned)
    totales_rows = []
    if precio_unit:
        totales_rows += [
            [Paragraph("Subtotal:", st["right"]),   Paragraph(f"${subtotal:.2f}", st["right"])],
            [Paragraph("IVU Estatal (10.5%):", st["right"]), Paragraph(f"${ivu_est:.2f}", st["right"])],
            [Paragraph("IVU Municipal (1%):",  st["right"]), Paragraph(f"${ivu_mun:.2f}", st["right"])],
        ]
    totales_rows.append(
        [Paragraph("TOTAL ESTIMADO:", st["right_b"]),
         Paragraph(f"${total_calc:.2f}" if precio_unit else "Por cotizar", st["total_b"])]
    )

    totales_table = Table(
        totales_rows,
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

    # ── ARCHIVOS ADJUNTOS (si hay) ────────────────────────────────────────────
    archivos = [r for r in respuestas if r.get("tipo") == "archivo" and r.get("archivo_ruta")]
    if archivos:
        elems.append(Spacer(1, 0.06*inch))
        elems.append(_section_title("📎 Archivos de Referencia del Cliente", st))
        for a in archivos:
            etiq = a.get("etiqueta") or "Archivo"
            ruta = a.get("archivo_ruta") or ""
            # Resolve to local path for preview attempt
            ext  = os.path.splitext(ruta)[1].lower()
            local_path = FRONTEND_BASE + ruta if ruta.startswith("/") else ruta
            is_image = ext in {".jpg", ".jpeg", ".png", ".webp"}
            if is_image and os.path.exists(local_path):
                try:
                    elems.append(Paragraph(f"<b>{etiq}:</b>", st["body"]))
                    elems.append(RLImage(local_path, width=2*inch, height=2*inch))
                    elems.append(Spacer(1, 4))
                except Exception:
                    elems.append(Paragraph(f"• {etiq}: {os.path.basename(ruta)}", st["body"]))
            else:
                elems.append(Paragraph(f"• {etiq}: {os.path.basename(ruta)}", st["body"]))
        elems.append(Spacer(1, 0.06*inch))
        elems.append(_hr())

    # ── NOTAS INTERNAS (si las hay y la cotización está aprobada) ─────────────
    notas = (cotizacion.get("notas_internas") or "").strip()
    if notas:
        elems.append(Spacer(1, 0.06*inch))
        elems.append(_section_title("📝 Notas", st))
        elems.append(Paragraph(notas, st["body"]))
        elems.append(Spacer(1, 0.06*inch))
        elems.append(_hr())

    # ── TÉRMINOS Y CONDICIONES ────────────────────────────────────────────────
    elems.append(Spacer(1, 0.08*inch))
    terminos = KeepTogether([
        _section_title("📋 Términos y Condiciones", st),
        Spacer(1, 4),
        Paragraph("• Esta cotización es válida por <b>15 días</b> a partir de la fecha de emisión.", st["body"]),
        Paragraph("• La producción comienza luego de <b>aprobación y pago</b> según acuerdo.", st["body"]),
        Paragraph("• Los precios están sujetos a cambio si las especificaciones del proyecto varían.", st["body"]),
        Paragraph("• El tiempo de entrega se confirma al momento de aprobar la cotización.", st["body"]),
    ])
    elems.append(terminos)

    # ── FOOTER ────────────────────────────────────────────────────────────────
    elems.append(Spacer(1, 0.15*inch))
    elems.append(_hr(GREEN, thickness=1.0))
    elems.append(Spacer(1, 6))
    elems.append(Paragraph(
        "Evergreen Love · Artesanías láser personalizadas · Puerto Rico",
        st["footer"]
    ))
    elems.append(Paragraph(
        f"Generado el {datetime.now().strftime('%d/%m/%Y %H:%M')} · Cotización #{cotizacion.get('id','')}",
        st["footer"]
    ))

    doc.build(elems)
    buf.seek(0)
    return buf
