from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status, Depends
from pydantic import BaseModel
from typing import Optional, List
import sqlite3
import os
import shutil

from database import get_db_connection
from auth import get_current_admin

router = APIRouter(
    prefix="/api",
    tags=["disenos"]
)

# Carpeta para almacenar archivos de diseño subidos
ADJUNTOS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "adjuntos"))

# --- MODELOS PYDANTIC ---

class LaserSettingSchema(BaseModel):
    material_tipo: str  # madera, acrilico, corcho, resina, etc.
    espesor: float  # en pulgadas
    velocidad_corte: Optional[float] = None
    potencia_corte: Optional[float] = None
    pasadas_corte: Optional[int] = 1
    velocidad_grabado: Optional[float] = None
    potencia_grabado: Optional[float] = None
    pasadas_grabado: Optional[int] = 1
    tipo_trabajo: str = "ambos"  # corte, grabado, ambos
    notas: Optional[str] = None

# --- ENDPOINTS DISEÑOS ---

@router.get("/disenos")
def list_disenos(current_user: dict = Depends(get_current_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM disenos ORDER BY id DESC")
        rows = cursor.fetchall()
        disenos = [dict(row) for row in rows]
        conn.close()
        return {"status": "success", "data": disenos}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/disenos", status_code=status.HTTP_201_CREATED)
async def create_diseno(
    nombre: str = Form(...),
    categoria: str = Form(...),
    file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_admin)
):
    # Validar categorías
    categorias_validas = ['garitas', 'casitas Viejo San Juan', 'llaveros NFC', 'ornamentos', 'shadow box', 'portadas de libreta', 'productos personalizados']
    if categoria not in categorias_validas:
        raise HTTPException(
            status_code=400, 
            detail=f"Categoría inválida. Debe ser una de: {', '.join(categorias_validas)}"
        )
        
    filename = None
    if file:
        os.makedirs(ADJUNTOS_DIR, exist_ok=True)
        filename = f"{nombre.replace(' ', '_').lower()}_{file.filename}"
        filepath = os.path.join(ADJUNTOS_DIR, filename)
        try:
            with open(filepath, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"No se pudo guardar el archivo físico: {str(e)}")

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO disenos (nombre, categoria, archivo_diseno)
            VALUES (?, ?, ?)
        """, (nombre, categoria, filename))
        conn.commit()
        diseno_id = cursor.lastrowid
        conn.close()
        return {"status": "success", "id": diseno_id, "message": f"Diseño '{nombre}' creado correctamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/disenos/{diseno_id}")
def delete_diseno(diseno_id: int, current_user: dict = Depends(get_current_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Obtener archivo antes de borrar
        cursor.execute("SELECT archivo_diseno FROM disenos WHERE id = ?", (diseno_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail="Diseño no encontrado")
            
        archivo = row['archivo_diseno']
        
        # Eliminar archivo físico
        if archivo:
            filepath = os.path.join(ADJUNTOS_DIR, archivo)
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                except Exception:
                    pass
                    
        cursor.execute("DELETE FROM disenos WHERE id = ?", (diseno_id,))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Diseño eliminado con éxito"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- ENDPOINTS SETTINGS LÁSER (VINCULADOS A DISEÑO) ---

@router.get("/disenos/{diseno_id}/settings")
def get_laser_settings(diseno_id: int, current_user: dict = Depends(get_current_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Validar si existe el diseño
        cursor.execute("SELECT id FROM disenos WHERE id = ?", (diseno_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Diseño no encontrado")
            
        cursor.execute("""
            SELECT * FROM laser_settings 
            WHERE diseno_id = ? 
            ORDER BY material_tipo, espesor
        """, (diseno_id,))
        rows = cursor.fetchall()
        settings = [dict(row) for row in rows]
        conn.close()
        return {"status": "success", "data": settings}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/disenos/{diseno_id}/settings", status_code=status.HTTP_201_CREATED)
def create_laser_setting(diseno_id: int, setting: LaserSettingSchema, current_user: dict = Depends(get_current_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Validar si existe el diseño
        cursor.execute("SELECT id FROM disenos WHERE id = ?", (diseno_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Diseño no encontrado")
            
        cursor.execute("""
            INSERT INTO laser_settings (
                diseno_id, material_tipo, espesor, velocidad_corte, potencia_corte, pasadas_corte,
                velocidad_grabado, potencia_grabado, pasadas_grabado, tipo_trabajo, notas
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            diseno_id, setting.material_tipo, setting.espesor, setting.velocidad_corte, setting.potencia_corte,
            setting.pasadas_corte, setting.velocidad_grabado, setting.potencia_grabado, setting.pasadas_grabado,
            setting.tipo_trabajo, setting.notas
        ))
        
        setting_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return {"status": "success", "id": setting_id, "message": "Ajuste láser guardado con éxito"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/settings/{setting_id}")
def delete_laser_setting(setting_id: int, current_user: dict = Depends(get_current_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM laser_settings WHERE id = ?", (setting_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Ajuste láser no encontrado")
            
        cursor.execute("DELETE FROM laser_settings WHERE id = ?", (setting_id,))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Parámetro láser eliminado con éxito"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
