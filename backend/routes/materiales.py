from fastapi import APIRouter, HTTPException, UploadFile, File, status, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
import sqlite3
import csv
import io
import os
import urllib.request

from database import get_db_connection
from auth import get_current_admin

# Cloudflare R2 config — mismas variables de entorno que usa el catálogo
_R2_ACCOUNT_ID   = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
_R2_API_TOKEN    = os.environ.get("CLOUDFLARE_API_TOKEN", "")
_R2_BUCKET       = os.environ.get("CLOUDFLARE_BUCKET", "")
_R2_DELIVERY_URL = os.environ.get("CLOUDFLARE_DELIVERY_URL", "").rstrip("/")

def _upload_to_r2(filename: str, content: bytes, ext: str) -> Optional[str]:
    """Sube un archivo a Cloudflare R2 y devuelve la URL pública, o None si falla."""
    if not (_R2_ACCOUNT_ID and _R2_API_TOKEN and _R2_BUCKET):
        return None
    content_type = "image/png" if ext == ".png" else "image/jpeg"
    cf_url = (
        f"https://api.cloudflare.com/client/v4/accounts/{_R2_ACCOUNT_ID}"
        f"/r2/buckets/{_R2_BUCKET}/objects/{filename}"
    )
    req = urllib.request.Request(
        cf_url,
        data=content,
        headers={"Authorization": f"Bearer {_R2_API_TOKEN}", "Content-Type": content_type},
        method="PUT",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            if resp.status in (200, 201):
                if _R2_DELIVERY_URL:
                    return f"{_R2_DELIVERY_URL}/{filename}"
                return f"https://{_R2_BUCKET}.r2.cloudflarestorage.com/{filename}"
    except Exception as e:
        print(f"[MATERIALES] Error subiendo a R2: {e}")
    return None

router = APIRouter(
    prefix="/api",
    tags=["materiales"]
)

# --- MODELOS PYDANTIC ---

class MaterialSchema(BaseModel):
    nombre: str
    tipo: str  # madera, acrilico, corcho, resina, herrajes, empaques
    espesor: float
    tamano_ancho: float
    tamano_alto: float
    cantidad: int
    cantidad_minima_alerta: int = 2
    costo_hoja_unidad: float
    ivu: float = 11.5          # porcentaje IVU pagado (Puerto Rico: 11.5% estatal, 10.5%, 7%, 0%...)
    proveedor: Optional[str] = None
    fecha_compra: Optional[str] = None
    lote: Optional[str] = None
    enlace_compra: Optional[str] = None
    foto_url: Optional[str] = None


def _add_ivu_computed(mat: dict) -> dict:
    """Añade campos calculados con IVU al diccionario de un material."""
    ivu_pct = mat.get("ivu", 11.5) or 11.5
    factor = 1 + ivu_pct / 100
    costo = mat.get("costo_hoja_unidad", 0) or 0
    cantidad = mat.get("cantidad", 0) or 0
    area = (mat.get("tamano_ancho", 0) or 0) * (mat.get("tamano_alto", 0) or 0)
    mat["costo_hoja_unidad_con_ivu"] = round(costo * factor, 4)
    mat["costo_total_lote"]          = round(costo * cantidad, 2)
    mat["costo_total_lote_con_ivu"]  = round(costo * cantidad * factor, 2)
    mat["costo_in2_con_ivu"]         = round((costo / area) * factor, 6) if area > 0 else 0
    return mat

class RetazoSchema(BaseModel):
    material_id: int
    tamano_ancho: float
    tamano_alto: float
    cantidad: int
    ubicacion: Optional[str] = None

# --- ENDPOINTS MATERIALES ---

@router.get("/materiales")
def list_materiales(current_user: dict = Depends(get_current_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM materiales ORDER BY id DESC")
        rows = cursor.fetchall()
        materiales = [_add_ivu_computed(dict(row)) for row in rows]
        conn.close()
        return {"status": "success", "data": materiales}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/materiales", status_code=status.HTTP_201_CREATED)
def create_material(material: MaterialSchema, current_user: dict = Depends(get_current_admin)):
    # Validar tipo de material
    tipos_validos = ['madera', 'acrilico', 'corcho', 'resina', 'herrajes', 'empaques', 'imanes', 'pegamentos', 'pinturas', 'otros']
    if material.tipo not in tipos_validos:
        raise HTTPException(
            status_code=400, 
            detail=f"Tipo de material inválido. Debe ser uno de: {', '.join(tipos_validos)}"
        )
        
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO materiales (nombre, tipo, espesor, tamano_ancho, tamano_alto, cantidad, cantidad_minima_alerta, costo_hoja_unidad, ivu, proveedor, fecha_compra, lote, enlace_compra, foto_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            material.nombre, material.tipo, material.espesor, material.tamano_ancho, material.tamano_alto,
            material.cantidad, material.cantidad_minima_alerta, material.costo_hoja_unidad, material.ivu,
            material.proveedor, material.fecha_compra, material.lote, material.enlace_compra, material.foto_url
        ))
        conn.commit()
        material_id = cursor.lastrowid
        conn.close()
        return {"status": "success", "id": material_id, "message": "Material registrado con éxito"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/materiales/{material_id}")
def update_material(material_id: int, material: MaterialSchema, current_user: dict = Depends(get_current_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verificar si existe
        cursor.execute("SELECT id FROM materiales WHERE id = ?", (material_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Material no encontrado")
            
        cursor.execute("""
            UPDATE materiales
            SET nombre = ?, tipo = ?, espesor = ?, tamano_ancho = ?, tamano_alto = ?, cantidad = ?,
                cantidad_minima_alerta = ?, costo_hoja_unidad = ?, ivu = ?,
                proveedor = ?, fecha_compra = ?, lote = ?, enlace_compra = ?, foto_url = COALESCE(?, foto_url)
            WHERE id = ?
        """, (
            material.nombre, material.tipo, material.espesor, material.tamano_ancho, material.tamano_alto,
            material.cantidad, material.cantidad_minima_alerta, material.costo_hoja_unidad, material.ivu,
            material.proveedor, material.fecha_compra, material.lote, material.enlace_compra, material.foto_url, material_id
        ))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Material actualizado con éxito"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/materiales/{material_id}")
def delete_material(material_id: int, current_user: dict = Depends(get_current_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verificar si existe
        cursor.execute("SELECT id FROM materiales WHERE id = ?", (material_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Material no encontrado")
            
        cursor.execute("DELETE FROM materiales WHERE id = ?", (material_id,))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Material eliminado con éxito"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/materiales/{material_id}/foto")
async def upload_material_photo(material_id: int, file: UploadFile = File(...), current_user: dict = Depends(get_current_admin)):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ('.jpg', '.jpeg', '.png'):
        raise HTTPException(status_code=400, detail="Formato no soportado. Usa JPG o PNG.")

    content = await file.read()

    # Guardar copia local en el mismo DATA_DIR que usa database.py
    from database import DB_DIR
    fotos_dir = os.path.join(DB_DIR, "fotos_import")
    os.makedirs(fotos_dir, exist_ok=True)
    filename = f"material_{material_id}{ext}"
    filepath = os.path.join(fotos_dir, filename)
    with open(filepath, "wb") as f:
        f.write(content)

    # Intentar subir a Cloudflare R2 para almacenamiento persistente
    foto_url = _upload_to_r2(filename, content, ext)
    if foto_url:
        print(f"[MATERIALES] Foto subida a R2: {foto_url}")
    else:
        # Sin R2 configurado: usar ruta local (solo funciona en desarrollo)
        foto_url = f"/fotos_import/{filename}"
        print(f"[MATERIALES] R2 no configurado, foto guardada localmente: {foto_url}")

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM materiales WHERE id = ?", (material_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Material no encontrado")
        cursor.execute("UPDATE materiales SET foto_url = ? WHERE id = ?", (foto_url, material_id))
        conn.commit()
    finally:
        conn.close()

    return {"status": "success", "foto_url": foto_url}

# --- ENDPOINTS IMPORTACIÓN MASIVA ---

@router.post("/materiales/importar")
async def import_materiales_csv(file: UploadFile = File(...), current_user: dict = Depends(get_current_admin)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="El archivo debe ser de formato CSV")
        
    try:
        contents = await file.read()
        # Decodificar el archivo de texto
        decoded = contents.decode('utf-8-sig') # utf-8-sig maneja el BOM de Excel
        csv_reader = csv.DictReader(io.StringIO(decoded))
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        imported_count = 0
        errors = []
        
        tipos_validos = ['madera', 'acrilico', 'corcho', 'resina', 'herrajes', 'empaques', 'imanes', 'pegamentos', 'pinturas', 'otros']
        
        for idx, row in enumerate(csv_reader):
            # Obtener datos y validar
            nombre = row.get('nombre', '').strip()
            tipo = row.get('tipo', '').strip().lower()
            
            if not nombre or not tipo:
                errors.append(f"Fila {idx+1}: Nombre y Tipo son campos obligatorios.")
                continue
                
            if tipo not in tipos_validos:
                errors.append(f"Fila {idx+1}: Tipo '{tipo}' inválido. Debe ser uno de {tipos_validos}")
                continue
                
            try:
                espesor = float(row.get('espesor', 0.0) or 0.0)
                tamano_ancho = float(row.get('tamano_ancho', 0.0) or 0.0)
                tamano_alto = float(row.get('tamano_alto', 0.0) or 0.0)
                cantidad = float(row.get('cantidad', 0.0) or 0.0)
                cantidad_minima = float(row.get('cantidad_minima_alerta', 2.0) or 2.0)
                costo = float(row.get('costo_hoja_unidad', 0.0) or 0.0)
                proveedor = row.get('proveedor', '').strip() or None
                fecha_compra = row.get('fecha_compra', '').strip() or None
                lote = row.get('lote', '').strip() or None
                
                cursor.execute("""
                    INSERT INTO materiales (nombre, tipo, espesor, tamano_ancho, tamano_alto, cantidad, cantidad_minima_alerta, costo_hoja_unidad, proveedor, fecha_compra, lote)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (nombre, tipo, espesor, tamano_ancho, tamano_alto, cantidad, cantidad_minima, costo, proveedor, fecha_compra, lote))
                imported_count += 1
                
            except ValueError as ve:
                errors.append(f"Fila {idx+1}: Error de formato numérico en columnas: {str(ve)}")
                continue
                
        conn.commit()
        conn.close()
        
        return {
            "status": "success",
            "imported_count": imported_count,
            "errors": errors,
            "message": f"Se importaron {imported_count} materiales con éxito. {len(errors)} filas fallaron."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar el archivo CSV: {str(e)}")

# --- ENDPOINTS RETAZOS ---

@router.get("/retazos")
def list_retazos(current_user: dict = Depends(get_current_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Traer los retazos y unir con el nombre de su material base
        cursor.execute("""
            SELECT r.*, m.nombre as material_nombre, m.tipo as material_tipo
            FROM retazos r
            LEFT JOIN materiales m ON r.material_id = m.id
            ORDER BY r.id DESC
        """)
        rows = cursor.fetchall()
        retazos = [dict(row) for row in rows]
        conn.close()
        return {"status": "success", "data": retazos}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/retazos", status_code=status.HTTP_201_CREATED)
def create_retazo(retazo: RetazoSchema, current_user: dict = Depends(get_current_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Validar si el material existe
        cursor.execute("SELECT id FROM materiales WHERE id = ?", (retazo.material_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail="El material_id especificado no existe")
            
        cursor.execute("""
            INSERT INTO retazos (material_id, tamano_ancho, tamano_alto, cantidad, ubicacion)
            VALUES (?, ?, ?, ?, ?)
        """, (retazo.material_id, retazo.tamano_ancho, retazo.tamano_alto, retazo.cantidad, retazo.ubicacion))
        conn.commit()
        retazo_id = cursor.lastrowid
        conn.close()
        return {"status": "success", "id": retazo_id, "message": "Retazo registrado con éxito"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/retazos/{retazo_id}")
def update_retazo(retazo_id: int, retazo: RetazoSchema, current_user: dict = Depends(get_current_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verificar si existe el retazo
        cursor.execute("SELECT id FROM retazos WHERE id = ?", (retazo_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Retazo no encontrado")
            
        cursor.execute("""
            UPDATE retazos
            SET material_id = ?, tamano_ancho = ?, tamano_alto = ?, cantidad = ?, ubicacion = ?
            WHERE id = ?
        """, (retazo.material_id, retazo.tamano_ancho, retazo.tamano_alto, retazo.cantidad, retazo.ubicacion, retazo_id))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Retazo actualizado con éxito"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/retazos/{retazo_id}")
def delete_retazo(retazo_id: int, current_user: dict = Depends(get_current_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verificar si existe
        cursor.execute("SELECT id FROM retazos WHERE id = ?", (retazo_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Retazo no encontrado")
            
        cursor.execute("DELETE FROM retazos WHERE id = ?", (retazo_id,))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Retazo eliminado con éxito"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
