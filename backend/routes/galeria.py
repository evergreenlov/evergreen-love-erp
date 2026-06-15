"""
Galería de imágenes por producto.
Endpoints admin: GET/POST/PUT/DELETE /api/productos/{id}/galeria
Endpoint público: GET /api/productos/{id}/galeria/publico
"""
import os
import time
import shutil
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from database import get_db_connection
from auth import get_current_admin

router = APIRouter(prefix="/api", tags=["galeria"])

GALERIA_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "producto_galeria")
)
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_IMAGENES = 10


def _galeria_path(filename: str) -> str:
    return os.path.join(GALERIA_DIR, filename)


# ── Público ──────────────────────────────────────────────────────────────────

@router.get("/productos/{producto_id}/galeria/publico")
def get_galeria_publico(producto_id: int):
    """Devuelve las imágenes activas de la galería ordenadas para el catálogo público."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, ruta_imagen, es_principal, orden, alt_text, tipo
            FROM producto_imagenes
            WHERE producto_id = ?
            ORDER BY es_principal DESC, orden ASC, id ASC
        """, (producto_id,))
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return {"status": "success", "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Admin: listar ─────────────────────────────────────────────────────────────

@router.get("/productos/{producto_id}/galeria")
def get_galeria(producto_id: int, current_user: dict = Depends(get_current_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, ruta_imagen, es_principal, orden, alt_text, tipo, fecha_creacion
            FROM producto_imagenes
            WHERE producto_id = ?
            ORDER BY es_principal DESC, orden ASC, id ASC
        """, (producto_id,))
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return {"status": "success", "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Admin: subir imagen ───────────────────────────────────────────────────────

@router.post("/productos/{producto_id}/galeria", status_code=201)
async def upload_galeria(
    producto_id: int,
    file: UploadFile = File(...),
    es_principal: int = Form(0),
    alt_text: Optional[str] = Form(None),
    tipo: str = Form("producto"),
    current_user: dict = Depends(get_current_admin),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"Tipo de archivo no permitido: {ext}")

    os.makedirs(GALERIA_DIR, exist_ok=True)

    conn = get_db_connection()
    cursor = conn.cursor()

    # Verificar límite de imágenes
    cursor.execute("SELECT COUNT(*) as n FROM producto_imagenes WHERE producto_id = ?", (producto_id,))
    if cursor.fetchone()["n"] >= MAX_IMAGENES:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Máximo {MAX_IMAGENES} imágenes por producto.")

    # Si se marca como principal, quitar principal a las demás
    if es_principal:
        cursor.execute(
            "UPDATE producto_imagenes SET es_principal = 0 WHERE producto_id = ?",
            (producto_id,)
        )

    # Nombre único de archivo
    timestamp = int(time.time() * 1000)
    filename = f"prod{producto_id}_{timestamp}{ext}"
    filepath = _galeria_path(filename)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    ruta = f"/producto_galeria/{filename}"

    # Orden = max actual + 1
    cursor.execute(
        "SELECT COALESCE(MAX(orden), -1) + 1 as next_orden FROM producto_imagenes WHERE producto_id = ?",
        (producto_id,)
    )
    next_orden = cursor.fetchone()["next_orden"]

    cursor.execute("""
        INSERT INTO producto_imagenes (producto_id, ruta_imagen, es_principal, orden, alt_text, tipo)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (producto_id, ruta, int(bool(es_principal)), next_orden, alt_text, tipo))
    conn.commit()
    imagen_id = cursor.lastrowid
    conn.close()

    return {
        "status": "success",
        "data": {
            "id": imagen_id,
            "ruta_imagen": ruta,
            "es_principal": int(bool(es_principal)),
            "orden": next_orden,
            "alt_text": alt_text,
            "tipo": tipo,
        }
    }


# ── Admin: actualizar metadatos ───────────────────────────────────────────────

@router.put("/productos/{producto_id}/galeria/{imagen_id}")
def update_galeria(
    producto_id: int,
    imagen_id: int,
    payload: dict,
    current_user: dict = Depends(get_current_admin),
):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id FROM producto_imagenes WHERE id = ? AND producto_id = ?",
        (imagen_id, producto_id)
    )
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Imagen no encontrada.")

    # Si se marca como principal, quitar a las demás primero
    if payload.get("es_principal"):
        cursor.execute(
            "UPDATE producto_imagenes SET es_principal = 0 WHERE producto_id = ?",
            (producto_id,)
        )

    fields = []
    values = []
    for key in ("es_principal", "orden", "alt_text", "tipo"):
        if key in payload:
            fields.append(f"{key} = ?")
            values.append(payload[key])

    if fields:
        values.append(imagen_id)
        cursor.execute(f"UPDATE producto_imagenes SET {', '.join(fields)} WHERE id = ?", values)
        conn.commit()

    conn.close()
    return {"status": "success"}


# ── Admin: eliminar imagen ────────────────────────────────────────────────────

@router.delete("/productos/{producto_id}/galeria/{imagen_id}")
def delete_galeria(
    producto_id: int,
    imagen_id: int,
    current_user: dict = Depends(get_current_admin),
):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT ruta_imagen FROM producto_imagenes WHERE id = ? AND producto_id = ?",
        (imagen_id, producto_id)
    )
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Imagen no encontrada.")

    ruta = row["ruta_imagen"]
    cursor.execute("DELETE FROM producto_imagenes WHERE id = ?", (imagen_id,))
    conn.commit()
    conn.close()

    # Borrar archivo físico si existe
    if ruta.startswith("/producto_galeria/"):
        filename = ruta.split("/producto_galeria/")[-1]
        filepath = _galeria_path(filename)
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except OSError:
                pass

    return {"status": "success"}
