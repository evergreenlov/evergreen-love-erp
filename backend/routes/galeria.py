"""
Galería de imágenes por producto.
Endpoints admin: GET/POST/PUT/DELETE /api/productos/{id}/galeria
Endpoint público: GET /api/productos/{id}/galeria/publico
"""
import os
import time
from datetime import datetime
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
    conn = None
    try:
        print(f"[GALERIA] abrir conexión — get_galeria_publico producto_id={producto_id}")
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, ruta_imagen, es_principal, orden, alt_text, tipo
            FROM producto_imagenes
            WHERE producto_id = ?
            ORDER BY es_principal DESC, orden ASC, id ASC
        """, (producto_id,))
        rows = [dict(r) for r in cursor.fetchall()]
        return {"status": "success", "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            print(f"[GALERIA] cerrar conexión — get_galeria_publico producto_id={producto_id}")
            conn.close()


# ── Admin: listar ─────────────────────────────────────────────────────────────

@router.get("/productos/{producto_id}/galeria")
def get_galeria(producto_id: int, current_user: dict = Depends(get_current_admin)):
    conn = None
    try:
        print(f"[GALERIA] abrir conexión — get_galeria producto_id={producto_id}")
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, ruta_imagen, es_principal, orden, alt_text, tipo, fecha_creacion
            FROM producto_imagenes
            WHERE producto_id = ?
            ORDER BY es_principal DESC, orden ASC, id ASC
        """, (producto_id,))
        rows = [dict(r) for r in cursor.fetchall()]
        return {"status": "success", "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            print(f"[GALERIA] cerrar conexión — get_galeria producto_id={producto_id}")
            conn.close()


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

    # ── Paso 1: leer el archivo en memoria ANTES de abrir la conexión SQLite.
    #    Esto evita mantener un write-lock abierto durante el await de I/O.
    content = await file.read()

    # ── Paso 2: guardar archivo físico ANTES de abrir la BD.
    timestamp = int(time.time() * 1000)
    filename = f"prod{producto_id}_{timestamp}{ext}"
    filepath = _galeria_path(filename)
    ruta = f"/producto_galeria/{filename}"

    try:
        with open(filepath, "wb") as f:
            f.write(content)
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar archivo: {e}")

    # ── Paso 3: abrir conexión SQLite solo para las queries, con try/finally garantizado.
    conn = None
    try:
        print(f"[GALERIA] abrir conexión — upload_galeria producto_id={producto_id} archivo={filename}")
        conn = get_db_connection()
        cursor = conn.cursor()

        # Verificar límite de imágenes
        cursor.execute(
            "SELECT COUNT(*) as n FROM producto_imagenes WHERE producto_id = ?",
            (producto_id,)
        )
        if cursor.fetchone()["n"] >= MAX_IMAGENES:
            raise HTTPException(status_code=400, detail=f"Máximo {MAX_IMAGENES} imágenes por producto.")

        # Si se marca como principal, quitar principal a las demás
        if es_principal:
            cursor.execute(
                "UPDATE producto_imagenes SET es_principal = 0 WHERE producto_id = ?",
                (producto_id,)
            )

        # Orden = max actual + 1
        cursor.execute(
            "SELECT COALESCE(MAX(orden), -1) + 1 as next_orden FROM producto_imagenes WHERE producto_id = ?",
            (producto_id,)
        )
        next_orden = cursor.fetchone()["next_orden"]

        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            INSERT INTO producto_imagenes (producto_id, ruta_imagen, es_principal, orden, alt_text, tipo, fecha_creacion)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (producto_id, ruta, int(bool(es_principal)), next_orden, alt_text, tipo, now))

        print(f"[GALERIA] commit — upload_galeria imagen_id pendiente producto_id={producto_id}")
        conn.commit()
        imagen_id = cursor.lastrowid

    except HTTPException:
        # Si la BD rechaza (límite, etc.), borrar el archivo físico para no dejar basura
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except OSError:
                pass
        raise
    except Exception as e:
        # Error inesperado de BD — borrar el archivo físico
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except OSError:
                pass
        raise HTTPException(status_code=500, detail=f"Error al insertar en BD: {e}")
    finally:
        if conn:
            print(f"[GALERIA] cerrar conexión — upload_galeria producto_id={producto_id}")
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
    conn = None
    try:
        print(f"[GALERIA] abrir conexión — update_galeria imagen_id={imagen_id}")
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM producto_imagenes WHERE id = ? AND producto_id = ?",
            (imagen_id, producto_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Imagen no encontrada.")

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
            cursor.execute(
                f"UPDATE producto_imagenes SET {', '.join(fields)} WHERE id = ?", values
            )
            print(f"[GALERIA] commit — update_galeria imagen_id={imagen_id}")
            conn.commit()

        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            print(f"[GALERIA] cerrar conexión — update_galeria imagen_id={imagen_id}")
            conn.close()


# ── Admin: eliminar imagen ────────────────────────────────────────────────────

@router.delete("/productos/{producto_id}/galeria/{imagen_id}")
def delete_galeria(
    producto_id: int,
    imagen_id: int,
    current_user: dict = Depends(get_current_admin),
):
    conn = None
    ruta = None
    try:
        print(f"[GALERIA] abrir conexión — delete_galeria imagen_id={imagen_id}")
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT ruta_imagen FROM producto_imagenes WHERE id = ? AND producto_id = ?",
            (imagen_id, producto_id)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Imagen no encontrada.")

        ruta = row["ruta_imagen"]
        cursor.execute("DELETE FROM producto_imagenes WHERE id = ?", (imagen_id,))
        print(f"[GALERIA] commit — delete_galeria imagen_id={imagen_id}")
        conn.commit()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            print(f"[GALERIA] cerrar conexión — delete_galeria imagen_id={imagen_id}")
            conn.close()

    # Borrar archivo físico DESPUÉS de cerrar la conexión
    if ruta and ruta.startswith("/producto_galeria/"):
        filename = ruta.split("/producto_galeria/")[-1]
        filepath = _galeria_path(filename)
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except OSError:
                pass

    return {"status": "success"}
