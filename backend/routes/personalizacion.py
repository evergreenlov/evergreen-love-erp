"""
Endpoints de personalización de pedidos:
- POST /api/personalizacion/upload-archivo   — sube un archivo adjunto del cliente
- POST /api/personalizacion/respuestas       — guarda respuestas de personalización en una orden (B2B/público)
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from pydantic import BaseModel
from typing import Optional, List
import os, time, json

from database import get_db_connection
from auth import get_current_admin, get_current_b2b

router = APIRouter(
    prefix="/api",
    tags=["personalizacion"]
)

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "personalizacion_archivos"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

EXTENSIONES_PERMITIDAS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".svg"}
MAX_MB = 10


@router.post("/personalizacion/upload-archivo")
async def upload_archivo_personalizacion(
    file: UploadFile = File(...),
    orden_id: int = Form(...),
    campo_id: Optional[int] = Form(None),
    etiqueta: str = Form("Archivo"),
):
    """
    Sube un archivo adjunto del cliente para una orden (sin auth para facilitar flujo B2B/público).
    Devuelve la ruta relativa para almacenar en pedido_personalizacion_respuestas.
    """
    ext = os.path.splitext(file.filename or "")[-1].lower()
    if ext not in EXTENSIONES_PERMITIDAS:
        raise HTTPException(status_code=400, detail=f"Extensión no permitida. Usa: {', '.join(EXTENSIONES_PERMITIDAS)}")

    contents = await file.read()
    if len(contents) > MAX_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Archivo demasiado grande (máx {MAX_MB} MB).")

    ts = int(time.time() * 1000)
    safe_name = f"ord{orden_id}_campo{campo_id or 0}_{ts}{ext}"
    dest = os.path.join(UPLOAD_DIR, safe_name)
    with open(dest, "wb") as f:
        f.write(contents)

    ruta_relativa = f"/personalizacion_archivos/{safe_name}"

    # Guardar respuesta inmediatamente en la tabla
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id FROM ordenes_produccion WHERE id = ?", (orden_id,)
    )
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    cursor.execute("""
        INSERT INTO pedido_personalizacion_respuestas (orden_id, campo_id, etiqueta, tipo, valor, archivo_ruta)
        VALUES (?, ?, ?, 'archivo', ?, ?)
    """, (orden_id, campo_id, etiqueta, safe_name, ruta_relativa))
    conn.commit()
    conn.close()

    return {"status": "success", "archivo_ruta": ruta_relativa, "nombre": safe_name}


class RespuestaItemSchema(BaseModel):
    campo_id: Optional[int] = None
    etiqueta: str
    tipo: str
    valor: Optional[str] = None
    archivo_ruta: Optional[str] = None


class GuardarRespuestasSchema(BaseModel):
    orden_id: int
    respuestas: List[RespuestaItemSchema]


@router.post("/personalizacion/respuestas")
def guardar_respuestas(payload: GuardarRespuestasSchema):
    """
    Guarda (o reemplaza) las respuestas de personalización de una orden.
    Sin auth — se llama desde el flujo de pedido B2B o público justo después de crear la orden.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM ordenes_produccion WHERE id = ?", (payload.orden_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    # Eliminar respuestas previas de texto (no archivos) para esta orden
    cursor.execute(
        "DELETE FROM pedido_personalizacion_respuestas WHERE orden_id = ? AND tipo != 'archivo'",
        (payload.orden_id,)
    )

    for r in payload.respuestas:
        if r.tipo == "archivo":
            continue  # los archivos ya se guardan en el endpoint de upload
        cursor.execute("""
            INSERT INTO pedido_personalizacion_respuestas (orden_id, campo_id, etiqueta, tipo, valor, archivo_ruta)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (payload.orden_id, r.campo_id, r.etiqueta, r.tipo, r.valor, r.archivo_ruta))

    conn.commit()
    conn.close()
    return {"status": "success"}
