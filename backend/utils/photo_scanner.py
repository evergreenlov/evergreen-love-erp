import os
import re
import sqlite3
from database import get_db_connection

# Carpetas del proyecto
_data_dir = os.environ.get("DATA_DIR") or os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
FOTOS_IMPORT_DIR = os.path.join(_data_dir, "fotos_import")

def scan_and_index_photos():
    """
    Escanea la carpeta data/fotos_import/, analiza los nombres de archivo
    y los asocia automáticamente a Productos (por SKU) u Órdenes (por Código de Orden).
    Ejemplos de nombres:
      - SKU-GAR-LLAV-01_final.jpg -> Asociado a Producto con SKU 'SKU-GAR-LLAV-01', tipo 'final'
      - EVL-1001_antes.png -> Asociado a Orden 'EVL-1001', tipo 'antes'
      - SKU-CSJ-ORN-02_referencia.jpg -> Asociado a Producto, tipo 'referencia'
    """
    os.makedirs(FOTOS_IMPORT_DIR, exist_ok=True)
    files = [f for f in os.listdir(FOTOS_IMPORT_DIR) if os.path.isfile(os.path.join(FOTOS_IMPORT_DIR, f)) and not f.startswith('.')]
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    indexed_count = 0
    associations = []
    
    # Expresiones regulares para extraer SKU y Códigos de Orden
    sku_pattern = re.compile(r'(SKU-[A-Z0-9-]+)', re.IGNORECASE)
    orden_pattern = re.compile(r'(EVL-[0-9]+)', re.IGNORECASE)
    
    # Posibles tipos de fotos
    tipos_validos = ['antes', 'final', 'referencia', 'material']
    
    for filename in files:
        filepath = os.path.join(FOTOS_IMPORT_DIR, filename)
        
        # Determinar tipo de foto
        tipo_foto = 'referencia' # por defecto
        for t in tipos_validos:
            if t in filename.lower():
                tipo_foto = t
                break
                
        # 1. Intentar asociar a Orden (ej: EVL-1001)
        orden_match = orden_pattern.search(filename)
        if orden_match:
            codigo_orden = orden_match.group(1).upper()
            cursor.execute("SELECT id FROM ordenes_produccion WHERE codigo_orden = ?", (codigo_orden,))
            row = cursor.fetchone()
            if row:
                orden_id = row['id']
                # Verificar si ya está asociada
                cursor.execute("""
                    SELECT id FROM fotos_asociadas 
                    WHERE orden_id = ? AND nombre_archivo = ?
                """, (orden_id, filename))
                if not cursor.fetchone():
                    cursor.execute("""
                        INSERT INTO fotos_asociadas (orden_id, tipo_foto, ruta_archivo, nombre_archivo)
                        VALUES (?, ?, ?, ?)
                    """, (orden_id, tipo_foto, filepath, filename))
                    indexed_count += 1
                    associations.append(f"Foto '{filename}' asociada a la Orden '{codigo_orden}' como tipo '{tipo_foto}'.")
                continue
                
        # 2. Intentar asociar a Producto (ej: SKU-GAR-LLAV-01)
        sku_match = sku_pattern.search(filename)
        if sku_match:
            sku = sku_match.group(1).upper()
            cursor.execute("SELECT id FROM productos WHERE sku = ?", (sku,))
            row = cursor.fetchone()
            if row:
                producto_id = row['id']
                # Verificar si ya está asociada
                cursor.execute("""
                    SELECT id FROM fotos_asociadas 
                    WHERE producto_id = ? AND nombre_archivo = ?
                """, (producto_id, filename))
                if not cursor.fetchone():
                    cursor.execute("""
                        INSERT INTO fotos_asociadas (producto_id, tipo_foto, ruta_archivo, nombre_archivo)
                        VALUES (?, ?, ?, ?)
                    """, (producto_id, tipo_foto, filepath, filename))
                    indexed_count += 1
                    associations.append(f"Foto '{filename}' asociada al Producto '{sku}' como tipo '{tipo_foto}'.")
                continue
                
    conn.commit()
    conn.close()
    
    return {
        "status": "success",
        "scanned_files_count": len(files),
        "new_indexed_count": indexed_count,
        "associations": associations
    }
