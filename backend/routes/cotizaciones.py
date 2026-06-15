from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import sqlite3
import os
import json
import re
import time
import smtplib
import datetime as _dt_mod
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

from database import get_db_connection
from auth import get_current_admin


class EstimacionSchema(BaseModel):
    costo_estimado: float
    precio_estimado: float
    margen_estimado: float
    notas_estimacion: Optional[str] = None


class CotizacionEditSchema(BaseModel):
    nombre_cliente: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    descripcion: Optional[str] = None
    presupuesto_aprox: Optional[float] = None
    estado: Optional[str] = None
    notas_internas: Optional[str] = None
    costo_estimado: Optional[float] = None
    precio_estimado: Optional[float] = None
    margen_estimado: Optional[float] = None
    notas_estimacion: Optional[str] = None


router = APIRouter(prefix="/api", tags=["cotizaciones"])

COTIZACIONES_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "cotizaciones")
)
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf"}
MAX_FILES = 5


def _safe_filename(cotizacion_id: int, original: str) -> str:
    ext = os.path.splitext(original)[1].lower()
    import re, time
    base = re.sub(r"[^a-zA-Z0-9_-]", "_", os.path.splitext(original)[0])[:40]
    ts = int(time.time() * 1000) % 100000
    return f"cotiz{cotizacion_id}_{base}_{ts}{ext}"


# ── PÚBLICO ────────────────────────────────────────────────────────────────

COTIZ_PERSONAL_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "personalizacion_archivos")
)
COTIZ_PERSONAL_ALLOWED = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".svg"}


@router.post("/cotizaciones")
async def crear_cotizacion(
    nombre_cliente: str = Form(...),
    email: str = Form(...),
    telefono: Optional[str] = Form(None),
    producto_id: Optional[int] = Form(None),
    descripcion: Optional[str] = Form(""),
    presupuesto_aprox: Optional[float] = Form(None),
    fuente: str = Form("publico"),
    cliente_b2b_id: Optional[int] = Form(None),
    tipo_evento: Optional[str] = Form(None),
    archivos: List[UploadFile] = File(default=[]),
):
    descripcion = (descripcion or "").strip()

    if len(archivos) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Máximo {MAX_FILES} archivos por cotización.")

    for f in archivos:
        if f.filename:
            ext = os.path.splitext(f.filename)[1].lower()
            if ext not in ALLOWED_EXTENSIONS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Archivo '{f.filename}' no permitido. Solo jpg, jpeg, png, pdf."
                )

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO cotizaciones
                (producto_id, nombre_cliente, email, telefono, descripcion,
                 presupuesto_aprox, fuente, cliente_b2b_id, tipo_evento)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (producto_id, nombre_cliente, email, telefono, descripcion,
               presupuesto_aprox, fuente, cliente_b2b_id, tipo_evento or None))
        cotizacion_id = cursor.lastrowid

        os.makedirs(COTIZACIONES_DIR, exist_ok=True)
        for f in archivos:
            if not f.filename:
                continue
            ext = os.path.splitext(f.filename)[1].lower()
            if ext not in ALLOWED_EXTENSIONS:
                continue
            contenido = await f.read()
            if not contenido:
                continue
            nombre = _safe_filename(cotizacion_id, f.filename)
            with open(os.path.join(COTIZACIONES_DIR, nombre), "wb") as out:
                out.write(contenido)
            cursor.execute("""
                INSERT INTO cotizacion_imagenes (cotizacion_id, nombre_archivo)
                VALUES (?, ?)
            """, (cotizacion_id, nombre))

        conn.commit()
        return {"status": "success", "id": cotizacion_id,
                "message": "Cotización recibida correctamente. Te contactaremos pronto."}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ── ADMIN ──────────────────────────────────────────────────────────────────

@router.get("/cotizaciones")
def listar_cotizaciones(
    estado: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_admin),
):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if estado:
            cursor.execute("""
                SELECT c.*, p.nombre as producto_nombre, p.sku as producto_sku
                FROM cotizaciones c
                LEFT JOIN productos p ON p.id = c.producto_id
                WHERE c.estado = ?
                ORDER BY c.fecha_creacion DESC
            """, (estado,))
        else:
            cursor.execute("""
                SELECT c.*, p.nombre as producto_nombre, p.sku as producto_sku
                FROM cotizaciones c
                LEFT JOIN productos p ON p.id = c.producto_id
                ORDER BY c.fecha_creacion DESC
            """)
        rows = cursor.fetchall()

        # Contar imágenes por cotización
        result = []
        for row in rows:
            d = dict(row)
            cursor.execute("SELECT COUNT(*) FROM cotizacion_imagenes WHERE cotizacion_id = ?", (d["id"],))
            d["total_imagenes"] = cursor.fetchone()[0]
            result.append(d)

        # Totales por estado para tarjetas
        cursor.execute("""
            SELECT estado, COUNT(*) as total FROM cotizaciones GROUP BY estado
        """)
        totales = {r["estado"]: r["total"] for r in cursor.fetchall()}

        return {"status": "success", "data": result, "totales": totales}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.get("/cotizaciones/{cotizacion_id}")
def detalle_cotizacion(
    cotizacion_id: int,
    current_user: dict = Depends(get_current_admin),
):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT c.*, p.nombre as producto_nombre, p.sku as producto_sku
            FROM cotizaciones c
            LEFT JOIN productos p ON p.id = c.producto_id
            WHERE c.id = ?
        """, (cotizacion_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Cotización no encontrada")
        d = dict(row)

        cursor.execute("""
            SELECT id, nombre_archivo, fecha_subida FROM cotizacion_imagenes
            WHERE cotizacion_id = ? ORDER BY id
        """, (cotizacion_id,))
        imagenes = []
        for img in cursor.fetchall():
            i = dict(img)
            nombre = i["nombre_archivo"]
            ext = os.path.splitext(nombre)[1].lower()
            i["ruta_publica"] = f"/cotizaciones_imgs/{nombre}"
            i["es_pdf"] = ext == ".pdf"
            imagenes.append(i)
        d["imagenes"] = imagenes

        return {"status": "success", "data": d}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.put("/cotizaciones/{cotizacion_id}/estimacion")
@router.put("/cotizaciones/{cotizacion_id}/estimacion/")
def guardar_estimacion(
    cotizacion_id: int,
    estimacion: EstimacionSchema,
    current_user: dict = Depends(get_current_admin),
):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, estado FROM cotizaciones WHERE id = ?", (cotizacion_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Cotización no encontrada")
        # Avanzar estado automáticamente si aún no fue revisada
        nuevo_estado = row["estado"]
        if nuevo_estado in ("nueva", "en_revision"):
            nuevo_estado = "cotizada"
        cursor.execute("""
            UPDATE cotizaciones
            SET costo_estimado = ?, precio_estimado = ?, margen_estimado = ?,
                notas_estimacion = ?, estado = ?,
                fecha_actualizado = datetime('now','localtime')
            WHERE id = ?
        """, (
            estimacion.costo_estimado, estimacion.precio_estimado,
            estimacion.margen_estimado, estimacion.notas_estimacion,
            nuevo_estado, cotizacion_id,
        ))
        conn.commit()
        return {"status": "success", "message": "Estimación guardada", "estado": nuevo_estado}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.put("/cotizaciones/{cotizacion_id}")
def editar_cotizacion(
    cotizacion_id: int,
    payload: CotizacionEditSchema,
    current_user: dict = Depends(get_current_admin),
):
    estados_validos = {
        "nueva", "en_revision", "cotizada", "aprobada", "rechazada",
        "borrador", "enviada", "convertida_produccion", "facturada",
    }
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM cotizaciones WHERE id = ?", (cotizacion_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Cotización no encontrada")

        if payload.estado is not None and payload.estado not in estados_validos:
            raise HTTPException(status_code=400, detail=f"Estado inválido: {payload.estado}")

        fields, values = [], []
        for col in ("nombre_cliente", "email", "telefono", "descripcion",
                    "presupuesto_aprox", "estado", "notas_internas",
                    "costo_estimado", "precio_estimado", "margen_estimado",
                    "notas_estimacion"):
            val = getattr(payload, col)
            if val is not None:
                fields.append(f"{col} = ?")
                values.append(val)

        if not fields:
            return {"status": "success", "message": "Sin cambios"}

        fields.append("fecha_actualizado = datetime('now','localtime')")
        values.append(cotizacion_id)
        cursor.execute(f"UPDATE cotizaciones SET {', '.join(fields)} WHERE id = ?", values)
        conn.commit()
        return {"status": "success", "message": "Cotización actualizada"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.put("/cotizaciones/{cotizacion_id}/estado")
def actualizar_estado(
    cotizacion_id: int,
    payload: dict,
    current_user: dict = Depends(get_current_admin),
):
    estados_validos = {
        "nueva", "en_revision", "cotizada", "aprobada", "rechazada",
        "borrador", "enviada", "convertida_produccion", "facturada",
    }
    nuevo_estado = payload.get("estado", "")
    if nuevo_estado not in estados_validos:
        raise HTTPException(status_code=400, detail=f"Estado inválido: '{nuevo_estado}'")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM cotizaciones WHERE id = ?", (cotizacion_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Cotización no encontrada")
        cursor.execute("""
            UPDATE cotizaciones
            SET estado = ?, fecha_actualizado = datetime('now','localtime')
            WHERE id = ?
        """, (nuevo_estado, cotizacion_id))
        conn.commit()
        return {"status": "success", "message": f"Estado actualizado a '{nuevo_estado}'"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


def _crear_orden_desde_cotizacion(cursor, c: dict) -> dict:
    """
    Lógica interna compartida por /convertir y /crear-produccion-y-factura.
    Recibe cursor y dict de la cotización. Devuelve {orden_id, codigo_orden}.
    El caller hace commit.
    """
    cotizacion_id = c["id"]
    ts = int(time.time()) % 100000
    codigo_orden = f"COT-{cotizacion_id}-{ts}"

    partes = [f"[COTIZACIÓN #{cotizacion_id}]", f"Cliente: {c['nombre_cliente']}"]
    if c.get("email"):    partes.append(f"Email: {c['email']}")
    if c.get("telefono"): partes.append(f"Tel: {c['telefono']}")
    if c.get("descripcion"): partes.append(f"Proyecto: {c['descripcion'][:200]}")
    cliente_str = " | ".join(partes)

    notas_parts = []
    if c.get("descripcion"):    notas_parts.append(f"Descripción: {c['descripcion']}")
    if c.get("notas_internas"): notas_parts.append(f"Notas internas: {c['notas_internas']}")
    notas_str = "\n\n".join(notas_parts) if notas_parts else None

    cursor.execute("""
        INSERT INTO ordenes_produccion
            (codigo_orden, cliente, producto_id, cantidad, estado, cotizacion_id, notas)
        VALUES (?, ?, ?, 1, 'En diseño', ?, ?)
    """, (codigo_orden, cliente_str, c.get("producto_id"), cotizacion_id, notas_str))
    orden_id = cursor.lastrowid

    cursor.execute("""
        UPDATE cotizaciones
        SET orden_produccion_id = ?, fecha_actualizado = datetime('now','localtime')
        WHERE id = ?
    """, (orden_id, cotizacion_id))

    # Copiar respuestas de personalización
    cursor.execute("""
        SELECT campo_id, etiqueta, tipo, valor, archivo_ruta
        FROM cotizacion_personalizacion_respuestas WHERE cotizacion_id = ?
    """, (cotizacion_id,))
    for r in cursor.fetchall():
        cursor.execute("""
            INSERT INTO pedido_personalizacion_respuestas
                (orden_id, campo_id, etiqueta, tipo, valor, archivo_ruta)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (orden_id, r["campo_id"], r["etiqueta"], r["tipo"], r["valor"], r["archivo_ruta"]))

    return {"orden_id": orden_id, "codigo_orden": codigo_orden}


def _crear_factura_desde_cotizacion(cursor, c: dict, orden_id: Optional[int] = None) -> dict:
    """
    Lógica interna compartida.  Devuelve {factura_id, numero_factura}.
    """
    import datetime as _dt
    cotizacion_id = c["id"]

    # Número de factura automático
    anio = _dt.datetime.now().strftime("%Y")
    cursor.execute(
        "SELECT numero_factura FROM facturas WHERE numero_factura LIKE ? ORDER BY numero_factura DESC LIMIT 1",
        (f"EV-{anio}-%",)
    )
    last = cursor.fetchone()
    try:    seq = int(last["numero_factura"].split("-")[-1]) + 1 if last else 1
    except: seq = 1
    numero = f"EV-{anio}-{seq:04d}"

    precio = float(c.get("precio_estimado") or 0.0)
    subtotal = precio
    ivu_est  = round(subtotal * 0.105, 2)
    ivu_mun  = round(subtotal * 0.01,  2)
    total    = round(subtotal + ivu_est + ivu_mun, 2)

    notas_fac = f"[Cotización #{cotizacion_id}]"
    if c.get("descripcion"):
        notas_fac += f"\n{c['descripcion'][:300]}"

    cursor.execute("""
        INSERT INTO facturas
            (numero_factura, cliente_id, cliente_nombre_manual,
             fecha_emision, subtotal, ivu_estatal, ivu_municipal, total,
             notas, estado, orden_produccion_id, codigo_orden, cotizacion_id)
        VALUES (?, NULL, ?, date('now','localtime'), ?, ?, ?, ?, ?, 'Pendiente', ?, ?, ?)
    """, (
        numero,
        c["nombre_cliente"],
        subtotal, ivu_est, ivu_mun, total,
        notas_fac,
        orden_id, None, cotizacion_id,
    ))
    factura_id = cursor.lastrowid
    return {"factura_id": factura_id, "numero_factura": numero}


@router.post("/cotizaciones/{cotizacion_id}/convertir")
def convertir_a_produccion(
    cotizacion_id: int,
    current_user: dict = Depends(get_current_admin),
):
    """Convierte una cotización aprobada en una orden de producción."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM cotizaciones WHERE id = ?", (cotizacion_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Cotización no encontrada")
        c = dict(row)

        if c["estado"] not in ("aprobada",):
            raise HTTPException(
                status_code=400,
                detail=f"Solo se pueden convertir cotizaciones aprobadas. Estado actual: '{c['estado']}'"
            )

        if c.get("orden_produccion_id"):
            cursor.execute(
                "SELECT codigo_orden FROM ordenes_produccion WHERE id = ?",
                (c["orden_produccion_id"],)
            )
            existing = cursor.fetchone()
            codigo = existing["codigo_orden"] if existing else ""
            raise HTTPException(status_code=409, detail=f"Esta cotización ya fue convertida. Orden: {codigo}")

        result = _crear_orden_desde_cotizacion(cursor, c)

        cursor.execute("""
            UPDATE cotizaciones SET estado = 'convertida_produccion',
            fecha_actualizado = datetime('now','localtime') WHERE id = ?
        """, (cotizacion_id,))

        conn.commit()
        return {
            "status": "success",
            "codigo_orden": result["codigo_orden"],
            "orden_id": result["orden_id"],
            "message": f"Cotización #{cotizacion_id} convertida a orden {result['codigo_orden']}"
        }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.post("/cotizaciones/{cotizacion_id}/crear-factura")
def crear_factura_desde_cotizacion(
    cotizacion_id: int,
    current_user: dict = Depends(get_current_admin),
):
    """Crea una factura directamente desde una cotización aprobada o convertida."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM cotizaciones WHERE id = ?", (cotizacion_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Cotización no encontrada")
        c = dict(row)

        if c["estado"] not in ("aprobada", "convertida_produccion"):
            raise HTTPException(
                status_code=400,
                detail=f"Solo se puede facturar una cotización aprobada o ya convertida a producción. Estado: '{c['estado']}'"
            )

        # Comprobar si ya tiene factura vinculada
        cursor.execute("SELECT id, numero_factura FROM facturas WHERE cotizacion_id = ?", (cotizacion_id,))
        existing_fac = cursor.fetchone()
        if existing_fac:
            raise HTTPException(
                status_code=409,
                detail=f"Esta cotización ya tiene una factura: {existing_fac['numero_factura']}"
            )

        result = _crear_factura_desde_cotizacion(cursor, c, c.get("orden_produccion_id"))

        cursor.execute("""
            UPDATE cotizaciones SET estado = 'facturada',
            fecha_actualizado = datetime('now','localtime') WHERE id = ?
        """, (cotizacion_id,))

        conn.commit()
        return {
            "status": "success",
            "factura_id": result["factura_id"],
            "numero_factura": result["numero_factura"],
            "message": f"Factura {result['numero_factura']} creada desde Cotización #{cotizacion_id}"
        }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.post("/cotizaciones/{cotizacion_id}/crear-produccion-y-factura")
def crear_produccion_y_factura(
    cotizacion_id: int,
    current_user: dict = Depends(get_current_admin),
):
    """Crea orden de producción y factura en una sola operación atómica."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM cotizaciones WHERE id = ?", (cotizacion_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Cotización no encontrada")
        c = dict(row)

        if c["estado"] not in ("aprobada",):
            raise HTTPException(
                status_code=400,
                detail=f"Solo se pueden procesar cotizaciones aprobadas. Estado: '{c['estado']}'"
            )
        if c.get("orden_produccion_id"):
            raise HTTPException(status_code=409, detail="Esta cotización ya tiene una orden de producción.")

        cursor.execute("SELECT id FROM facturas WHERE cotizacion_id = ?", (cotizacion_id,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="Esta cotización ya tiene una factura.")

        orden_result  = _crear_orden_desde_cotizacion(cursor, c)
        factura_result = _crear_factura_desde_cotizacion(cursor, c, orden_result["orden_id"])

        # Vincular factura con orden de producción
        cursor.execute(
            "UPDATE ordenes_produccion SET factura_id = ? WHERE id = ?",
            (factura_result["factura_id"], orden_result["orden_id"])
        )
        cursor.execute(
            "UPDATE facturas SET orden_produccion_id = ?, codigo_orden = ? WHERE id = ?",
            (orden_result["orden_id"], orden_result["codigo_orden"], factura_result["factura_id"])
        )

        cursor.execute("""
            UPDATE cotizaciones SET estado = 'facturada',
            fecha_actualizado = datetime('now','localtime') WHERE id = ?
        """, (cotizacion_id,))

        conn.commit()
        return {
            "status": "success",
            "orden_id": orden_result["orden_id"],
            "codigo_orden": orden_result["codigo_orden"],
            "factura_id": factura_result["factura_id"],
            "numero_factura": factura_result["numero_factura"],
            "message": f"Cotización #{cotizacion_id} → Orden {orden_result['codigo_orden']} + Factura {factura_result['numero_factura']}"
        }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.get("/cotizaciones/{cotizacion_id}/imagenes")
def listar_imagenes_cotizacion(
    cotizacion_id: int,
    current_user: dict = Depends(get_current_admin),
):
    """Devuelve las imágenes de una cotización — usado por el modal de Producción."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT id, nombre_archivo, fecha_subida FROM cotizacion_imagenes WHERE cotizacion_id = ? ORDER BY id",
            (cotizacion_id,)
        )
        imagenes = []
        for img in cursor.fetchall():
            i = dict(img)
            nombre = i["nombre_archivo"]
            ext = os.path.splitext(nombre)[1].lower()
            i["ruta_publica"] = f"/cotizaciones_imgs/{nombre}"
            i["es_pdf"] = ext == ".pdf"
            imagenes.append(i)
        return {"status": "success", "data": imagenes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.post("/cotizaciones/{cotizacion_id}/personalizacion/respuestas")
async def guardar_respuestas_cotizacion(
    cotizacion_id: int,
    respuestas_json: str = Form(...),
    archivos: List[UploadFile] = File(default=[]),
):
    """Guarda respuestas de campos de personalización para una cotización (público, sin auth)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM cotizaciones WHERE id = ?", (cotizacion_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Cotización no encontrada")

        try:
            respuestas = json.loads(respuestas_json)
        except Exception:
            raise HTTPException(status_code=400, detail="respuestas_json inválido")

        # Mapear archivos por nombre de campo (archivo_{campo_id})
        archivos_map = {}
        for f in archivos:
            if f.filename:
                archivos_map[f.field_name] = f

        # Borrar respuestas anteriores (por si el cliente reenvía)
        cursor.execute(
            "DELETE FROM cotizacion_personalizacion_respuestas WHERE cotizacion_id = ?",
            (cotizacion_id,)
        )

        os.makedirs(COTIZ_PERSONAL_DIR, exist_ok=True)

        for r in respuestas:
            campo_id = r.get("campo_id")
            etiqueta = r.get("etiqueta", "")
            tipo = r.get("tipo", "texto")
            valor = r.get("valor", "")
            archivo_ruta = None

            if tipo == "archivo":
                key = f"archivo_{campo_id}"
                upload = archivos_map.get(key)
                if upload and upload.filename:
                    ext = os.path.splitext(upload.filename)[1].lower()
                    if ext in COTIZ_PERSONAL_ALLOWED:
                        base = re.sub(r"[^a-zA-Z0-9_-]", "_", os.path.splitext(upload.filename)[0])[:30]
                        ts = int(time.time() * 1000) % 100000
                        fname = f"cotiz{cotizacion_id}_campo{campo_id}_{base}_{ts}{ext}"
                        fpath = os.path.join(COTIZ_PERSONAL_DIR, fname)
                        contenido = await upload.read()
                        with open(fpath, "wb") as out:
                            out.write(contenido)
                        archivo_ruta = f"/personalizacion_archivos/{fname}"

            cursor.execute("""
                INSERT INTO cotizacion_personalizacion_respuestas
                    (cotizacion_id, campo_id, etiqueta, tipo, valor, archivo_ruta)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (cotizacion_id, campo_id, etiqueta, tipo, valor or None, archivo_ruta))

        conn.commit()
        return {"status": "success", "message": "Respuestas guardadas"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.get("/cotizaciones/{cotizacion_id}/personalizacion")
def get_personalizacion_cotizacion(
    cotizacion_id: int,
    current_user: dict = Depends(get_current_admin),
):
    """Devuelve las respuestas de personalización de una cotización."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT id, campo_id, etiqueta, tipo, valor, archivo_ruta
            FROM cotizacion_personalizacion_respuestas
            WHERE cotizacion_id = ?
            ORDER BY id
        """, (cotizacion_id,))
        rows = [dict(r) for r in cursor.fetchall()]
        return {"status": "success", "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.delete("/cotizaciones/{cotizacion_id}")
def eliminar_cotizacion(
    cotizacion_id: int,
    current_user: dict = Depends(get_current_admin),
):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, orden_produccion_id FROM cotizaciones WHERE id = ?", (cotizacion_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Cotización no encontrada")
        if row["orden_produccion_id"]:
            raise HTTPException(
                status_code=409,
                detail="No se puede borrar una cotización ya enviada a producción."
            )

        # Borrar archivos físicos de imágenes
        cursor.execute(
            "SELECT nombre_archivo FROM cotizacion_imagenes WHERE cotizacion_id = ?",
            (cotizacion_id,)
        )
        for img in cursor.fetchall():
            ruta = os.path.join(COTIZACIONES_DIR, img["nombre_archivo"])
            try:
                if os.path.exists(ruta):
                    os.remove(ruta)
            except Exception:
                pass

        cursor.execute("DELETE FROM cotizacion_imagenes WHERE cotizacion_id = ?", (cotizacion_id,))
        cursor.execute("DELETE FROM cotizaciones WHERE id = ?", (cotizacion_id,))
        conn.commit()
        return {"status": "success", "message": f"Cotización #{cotizacion_id} eliminada"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.put("/cotizaciones/{cotizacion_id}/notas")
def actualizar_notas(
    cotizacion_id: int,
    payload: dict,
    current_user: dict = Depends(get_current_admin),
):
    notas = payload.get("notas_internas", "")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM cotizaciones WHERE id = ?", (cotizacion_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Cotización no encontrada")
        cursor.execute("""
            UPDATE cotizaciones
            SET notas_internas = ?, fecha_actualizado = datetime('now','localtime')
            WHERE id = ?
        """, (notas, cotizacion_id))
        conn.commit()
        return {"status": "success", "message": "Notas internas actualizadas"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ── Helpers compartidos para PDF / email ──────────────────────────────────────

def _fetch_cotizacion_y_respuestas(cotizacion_id: int):
    """Devuelve (cotizacion_dict, respuestas_list) o lanza HTTPException."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT c.*, p.nombre as producto_nombre
            FROM cotizaciones c
            LEFT JOIN productos p ON p.id = c.producto_id
            WHERE c.id = ?
        """, (cotizacion_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Cotización no encontrada")
        cotizacion = dict(row)

        cursor.execute("""
            SELECT etiqueta, tipo, valor, archivo_ruta
            FROM cotizacion_personalizacion_respuestas
            WHERE cotizacion_id = ?
            ORDER BY id
        """, (cotizacion_id,))
        respuestas = [dict(r) for r in cursor.fetchall()]

        return cotizacion, respuestas
    finally:
        conn.close()


# ── GET /cotizaciones/{id}/pdf ────────────────────────────────────────────────

@router.get("/cotizaciones/{cotizacion_id}/pdf")
def descargar_pdf_cotizacion(
    cotizacion_id: int,
    current_user: dict = Depends(get_current_admin),
):
    """Genera y descarga el PDF de cotización."""
    from routes.pdf_cotizacion import generar_pdf_cotizacion

    cotizacion, respuestas = _fetch_cotizacion_y_respuestas(cotizacion_id)
    pdf_buf = generar_pdf_cotizacion(cotizacion, respuestas)

    filename = f"cotizacion-{cotizacion_id}.pdf"
    return StreamingResponse(
        pdf_buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── GET /cotizaciones/{id}/pdf-interno ───────────────────────────────────────

@router.get("/cotizaciones/{cotizacion_id}/pdf-interno")
def descargar_pdf_interno(
    cotizacion_id: int,
    current_user: dict = Depends(get_current_admin),
):
    """Genera la Hoja de Costos Interna. Solo admins. Nunca enviada al cliente."""
    from routes.pdf_cotizacion import generar_hoja_interna

    cotizacion, respuestas = _fetch_cotizacion_y_respuestas(cotizacion_id)

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Producto completo con todos sus costos
        producto = None
        componentes = []
        if cotizacion.get("producto_id"):
            cursor.execute("SELECT * FROM productos WHERE id = ?", (cotizacion["producto_id"],))
            row = cursor.fetchone()
            if row:
                producto = dict(row)
            cursor.execute("""
                SELECT cp.cantidad_usada, cp.costo_calculado,
                       m.nombre as material_nombre, m.tipo as material_tipo
                FROM componentes_producto cp
                LEFT JOIN materiales m ON m.id = cp.material_id
                WHERE cp.producto_id = ?
            """, (cotizacion["producto_id"],))
            componentes = [dict(r) for r in cursor.fetchall()]

        # Tarifas de configuración
        cursor.execute("SELECT tarifa_hora_laser, tarifa_hora_labor FROM configuracion LIMIT 1")
        cfg = cursor.fetchone()
        tarifa_laser = float(cfg["tarifa_hora_laser"]) if cfg else 15.0
        tarifa_labor = float(cfg["tarifa_hora_labor"]) if cfg else 12.0
    finally:
        conn.close()

    pdf_buf = generar_hoja_interna(
        cotizacion, respuestas,
        producto, componentes,
        tarifa_laser, tarifa_labor,
    )

    filename = f"costos-internos-{cotizacion_id}.pdf"
    return StreamingResponse(
        pdf_buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── POST /cotizaciones/{id}/enviar-email ──────────────────────────────────────

@router.post("/cotizaciones/{cotizacion_id}/enviar-email")
def enviar_email_cotizacion(
    cotizacion_id: int,
    current_user: dict = Depends(get_current_admin),
):
    """Envía la cotización en PDF al email del cliente."""
    from routes.pdf_cotizacion import generar_pdf_cotizacion

    cotizacion, respuestas = _fetch_cotizacion_y_respuestas(cotizacion_id)

    email_destino = (cotizacion.get("email") or "").strip()
    if not email_destino or "@" not in email_destino:
        raise HTTPException(
            status_code=400,
            detail="Esta cotización no tiene un email de cliente válido. "
                   "Edita la cotización y agrega el email antes de enviar."
        )

    smtp_host = os.environ.get("SMTP_HOST", "").strip()
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER", "").strip()
    smtp_pass = os.environ.get("SMTP_PASSWORD", "").strip()
    smtp_from = os.environ.get("SMTP_FROM", smtp_user).strip()

    if not smtp_host or not smtp_user or not smtp_pass:
        raise HTTPException(
            status_code=503,
            detail="El servidor de email no está configurado. "
                   "Define SMTP_HOST, SMTP_USER y SMTP_PASSWORD en las variables de entorno."
        )

    pdf_buf   = generar_pdf_cotizacion(cotizacion, respuestas)
    pdf_bytes = pdf_buf.read()

    nombre_cliente = cotizacion.get("nombre_cliente") or "Cliente"
    cotiz_id       = cotizacion.get("id")
    precio_est     = cotizacion.get("precio_estimado")
    producto_n     = cotizacion.get("producto_nombre") or "producto personalizado"

    total_str = ""
    if precio_est:
        total = round(float(precio_est) * 1.115, 2)
        total_str = f"${total:.2f}"

    body_html = f"""
    <html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;">
        <div style="background:#5f7830;padding:20px 28px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:20px;">🌿 Evergreen Love</h1>
            <p style="color:#d4e6b5;margin:4px 0 0;font-size:13px;">Artesanías láser personalizadas</p>
        </div>
        <div style="background:#faf8f5;padding:28px;border:1px solid #e8e0d5;border-top:none;">
            <p style="font-size:15px;">Hola <strong>{nombre_cliente}</strong>,</p>
            <p>Adjuntamos la cotización <strong>#{cotiz_id}</strong> para tu <strong>{producto_n}</strong>.</p>
            {"<p style='font-size:18px;color:#5f7830;font-weight:bold;'>Total estimado: " + total_str + "</p>" if total_str else ""}
            <p>Una vez apruebes la cotización, comenzamos con tu proyecto.</p>
            <hr style="border:none;border-top:1px solid #e8e0d5;margin:20px 0;">
            <p style="font-size:12px;color:#888;">
                Esta cotización es válida por <strong>15 días</strong>.<br>
                La producción comienza luego de aprobación y pago según acuerdo.
            </p>
        </div>
        <div style="background:#f0f7e6;padding:14px 28px;text-align:center;border-radius:0 0 8px 8px;border:1px solid #e8e0d5;border-top:none;">
            <p style="margin:0;font-size:12px;color:#5f7830;">Evergreen Love · Puerto Rico · Con amor y precisión láser 🌿</p>
        </div>
    </body></html>
    """

    msg = MIMEMultipart("mixed")
    msg["Subject"] = f"Cotización #{cotiz_id} — Evergreen Love"
    msg["From"]    = smtp_from
    msg["To"]      = email_destino
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    att = MIMEBase("application", "pdf")
    att.set_payload(pdf_bytes)
    encoders.encode_base64(att)
    att.add_header("Content-Disposition", f'attachment; filename="cotizacion-{cotiz_id}.pdf"')
    msg.attach(att)

    try:
        if smtp_port == 465:
            import ssl
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(smtp_host, smtp_port, context=ctx) as srv:
                srv.login(smtp_user, smtp_pass)
                srv.sendmail(smtp_from, [email_destino], msg.as_bytes())
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as srv:
                srv.ehlo()
                srv.starttls()
                srv.login(smtp_user, smtp_pass)
                srv.sendmail(smtp_from, [email_destino], msg.as_bytes())
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(
            status_code=502,
            detail="Error de autenticación SMTP. Verifica SMTP_USER y SMTP_PASSWORD."
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error al enviar email: {str(e)}")

    return {
        "status": "success",
        "message": f"Cotización #{cotiz_id} enviada a {email_destino}",
        "email": email_destino,
    }
