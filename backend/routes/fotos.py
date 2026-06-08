from fastapi import APIRouter, HTTPException, UploadFile, File, Header, Query, status
from typing import Optional
import sqlite3
import os
import json
import base64
import urllib.request
import urllib.error

from database import get_db_connection
from utils.photo_scanner import scan_and_index_photos, FOTOS_IMPORT_DIR

router = APIRouter(
    prefix="/api",
    tags=["fotos"]
)

# Servir fotos locales desde fotos_import
# Para que el navegador las cargue, FastAPI ya monta la carpeta data/fotos_import/ en main.py (la añadiremos)

# --- ENDPOINTS FOTOS ---

@router.post("/fotos/subir")
async def subir_foto(
    file: UploadFile = File(...),
    orden_id: Optional[int] = Query(None),
    producto_id: Optional[int] = Query(None),
    tipo_foto: str = Query('referencia'),
    x_cloudflare_account_id: Optional[str] = Header(None, alias="X-Cloudflare-Account-Id"),
    x_cloudflare_api_token: Optional[str] = Header(None, alias="X-Cloudflare-Api-Token"),
    x_cloudflare_bucket: Optional[str] = Header(None, alias="X-Cloudflare-Bucket"),
    x_cloudflare_delivery_url: Optional[str] = Header(None, alias="X-Cloudflare-Delivery-Url")
):
    if not orden_id and not producto_id:
        raise HTTPException(status_code=400, detail="Debe proporcionar orden_id o producto_id para asociar la foto.")
        
    if tipo_foto not in ['antes', 'final', 'referencia', 'material']:
        raise HTTPException(status_code=400, detail="Tipo de foto inválido. Debe ser 'antes', 'final', 'referencia' o 'material'.")
        
    try:
        # Generar nombre de archivo
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ['.jpg', '.jpeg', '.png']:
            raise HTTPException(status_code=400, detail="Formato de imagen no soportado. Suba JPG, JPEG o PNG.")
            
        conn = get_db_connection()
        cursor = conn.cursor()
        
        prefix = ""
        if orden_id:
            cursor.execute("SELECT codigo_orden FROM ordenes_produccion WHERE id = ?", (orden_id,))
            row = cursor.fetchone()
            if not row:
                conn.close()
                raise HTTPException(status_code=404, detail="Orden no encontrada")
            prefix = row['codigo_orden']
        elif producto_id:
            cursor.execute("SELECT sku FROM productos WHERE id = ?", (producto_id,))
            row = cursor.fetchone()
            if not row:
                conn.close()
                raise HTTPException(status_code=404, detail="Producto no encontrado")
            prefix = row['sku']
            
        filename = f"{prefix}_{tipo_foto}{ext}"
        filepath = os.path.join(FOTOS_IMPORT_DIR, filename)
        
        # Guardar archivo localmente
        contents = await file.read()
        with open(filepath, "wb") as f:
            f.write(contents)
            
        # Inicializar ruta a guardar en la BD (por defecto la local)
        db_path = filepath
        
        # Subida a Cloudflare R2 si están presentes las credenciales
        if x_cloudflare_account_id and x_cloudflare_api_token and x_cloudflare_bucket:
            try:
                content_type = "application/octet-stream"
                if ext == ".png":
                    content_type = "image/png"
                elif ext in [".jpg", ".jpeg"]:
                    content_type = "image/jpeg"
                
                cf_url = f"https://api.cloudflare.com/client/v4/accounts/{x_cloudflare_account_id}/r2/buckets/{x_cloudflare_bucket}/objects/{filename}"
                
                cf_req = urllib.request.Request(
                    cf_url,
                    data=contents,
                    headers={
                        "Authorization": f"Bearer {x_cloudflare_api_token}",
                        "Content-Type": content_type
                    },
                    method="PUT"
                )
                
                with urllib.request.urlopen(cf_req) as response:
                    if response.status in [200, 201]:
                        if x_cloudflare_delivery_url:
                            base_url = x_cloudflare_delivery_url.strip().rstrip('/')
                            db_path = f"{base_url}/{filename}"
                        else:
                            db_path = f"https://{x_cloudflare_bucket}.r2.cloudflarestorage.com/{filename}"
            except Exception as cf_err:
                print(f"Error al subir a Cloudflare R2: {str(cf_err)}")
                
        # Obtener el producto_id asociado a la orden si aplica
        assoc_product_id = producto_id
        if orden_id and not assoc_product_id:
            cursor.execute("SELECT producto_id FROM ordenes_produccion WHERE id = ?", (orden_id,))
            row_prod = cursor.fetchone()
            if row_prod and row_prod['producto_id']:
                assoc_product_id = row_prod['producto_id']

        # Registrar en la base de datos (evitar duplicar)
        if orden_id:
            cursor.execute("SELECT id FROM fotos_asociadas WHERE orden_id = ? AND tipo_foto = ?", (orden_id, tipo_foto))
            existing = cursor.fetchone()
            if existing:
                cursor.execute("UPDATE fotos_asociadas SET ruta_archivo = ?, nombre_archivo = ?, fecha_registro = datetime('now', 'localtime') WHERE id = ?", (db_path, filename, existing['id']))
            else:
                cursor.execute("INSERT INTO fotos_asociadas (orden_id, producto_id, tipo_foto, ruta_archivo, nombre_archivo) VALUES (?, ?, ?, ?, ?)", (orden_id, assoc_product_id, tipo_foto, db_path, filename))
                
            # Si la foto es 'final', también la asociamos al producto principal
            if assoc_product_id and tipo_foto == 'final':
                cursor.execute("SELECT id FROM fotos_asociadas WHERE producto_id = ? AND tipo_foto = 'final' AND orden_id IS NULL", (assoc_product_id,))
                existing_prod = cursor.fetchone()
                if existing_prod:
                    cursor.execute("UPDATE fotos_asociadas SET ruta_archivo = ?, nombre_archivo = ?, fecha_registro = datetime('now', 'localtime') WHERE id = ?", (db_path, filename, existing_prod['id']))
                else:
                    cursor.execute("INSERT INTO fotos_asociadas (producto_id, tipo_foto, ruta_archivo, nombre_archivo) VALUES (?, ?, ?, ?)", (assoc_product_id, 'final', db_path, filename))
        else:
            cursor.execute("SELECT id FROM fotos_asociadas WHERE producto_id = ? AND tipo_foto = ?", (producto_id, tipo_foto))
            existing = cursor.fetchone()
            if existing:
                cursor.execute("UPDATE fotos_asociadas SET ruta_archivo = ?, nombre_archivo = ?, fecha_registro = datetime('now', 'localtime') WHERE id = ?", (db_path, filename, existing['id']))
            else:
                cursor.execute("INSERT INTO fotos_asociadas (producto_id, tipo_foto, ruta_archivo, nombre_archivo) VALUES (?, ?, ?, ?)", (producto_id, tipo_foto, db_path, filename))
                
        conn.commit()
        conn.close()
        
        return {
            "status": "success",
            "message": f"Foto '{filename}' subida y asociada correctamente.",
            "data": {
                "nombre_archivo": filename,
                "tipo_foto": tipo_foto
            }
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/fotos/escanear")
def trigger_escanear_fotos():
    try:
        res = scan_and_index_photos()
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/fotos/productos/{producto_id}")
def get_fotos_producto(producto_id: int):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM fotos_asociadas WHERE producto_id = ?", (producto_id,))
        rows = cursor.fetchall()
        fotos = [dict(row) for row in rows]
        conn.close()
        return {"status": "success", "data": fotos}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/fotos/ordenes/{orden_id}")
def get_fotos_orden(orden_id: int):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM fotos_asociadas WHERE orden_id = ?", (orden_id,))
        rows = cursor.fetchall()
        fotos = [dict(row) for row in rows]
        conn.close()
        return {"status": "success", "data": fotos}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- ENDPOINT IA (GEMINI API MULTIMODAL) ---

@router.post("/ia/estimar")
async def estimar_costos_por_ia(
    file: UploadFile = File(...),
    gemini_key: Optional[str] = Header(None, alias="X-Gemini-Key")
):
    """
    Recibe la foto de un producto terminado, la envía a la API de Gemini 1.5 Flash,
    y detecta materiales, herrajes y tiempos estimados para costeo automático.
    """
    if not gemini_key:
        raise HTTPException(
            status_code=400, 
            detail="Se requiere la API Key de Gemini. Por favor, ingrésala en la configuración de la app."
        )
        
    # Validar formato de imagen
    if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        raise HTTPException(status_code=400, detail="Formato de imagen no soportado. Suba JPG, JPEG o PNG.")
        
    try:
        # 1. Leer imagen y codificar en Base64
        contents = await file.read()
        base64_image = base64.b64encode(contents).decode('utf-8')
        mime_type = "image/png" if file.filename.lower().endswith('.png') else "image/jpeg"
        
        # 2. Configurar la petición a la API de Gemini
        prompt = (
            "Analiza esta foto de un producto terminado de corte y grabado láser. Determina de forma profesional:\n"
            "1. El material base más probable (ej: Basswood, Walnut Finished, Walnut Unfinished, Baltic Birch, Acrílico Transparente, etc.).\n"
            "2. Qué herrajes o componentes extras detectas (ej: anilla de llavero, borla, chip nfc, empaque kraft, imán, pegamento, pintura, o ninguno).\n"
            "3. La densidad de grabado (baja, media o alta) y estimación del tiempo láser sugerido en minutos (tiempo de corte y tiempo de grabado).\n\n"
            "Responde ÚNICAMENTE con un objeto JSON estructurado con la siguiente forma exacta, sin bloques markdown de código ```json ni texto extra:\n"
            "{\n"
            '  "material_base": "nombre del material",\n'
            '  "herrajes_detectados": ["herraje1", "herraje2"],\n'
            '  "densidad_grabado": "baja/media/alta",\n'
            '  "tiempo_grabado_sugerido_minutos": 2.5,\n'
            '  "tiempo_corte_sugerido_minutos": 1.5,\n'
            '  "explicacion": "breve explicación de los elementos reconocidos"\n'
            "}"
        )
        
        req_data = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": base64_image
                        }
                    }
                ]
            }],
            "generationConfig": {
                "responseMimeType": "application/json"
            }
        }
        
        # Lista de combinaciones (versión de API y modelo) para máxima compatibilidad
        endpoints_to_try = [
            ("v1beta", "gemini-1.5-flash-latest"),
            ("v1beta", "gemini-1.5-flash"),
            ("v1", "gemini-1.5-flash"),
            ("v1beta", "gemini-2.5-flash"),
            ("v1beta", "gemini-2.0-flash"),
            ("v1beta", "gemini-3.5-flash"),
            ("v1", "gemini-1.5-flash-latest")
        ]
        
        last_error_code = 500
        last_error_msg = "No se pudo conectar a ningún modelo de Gemini."
        
        for api_version, model_name in endpoints_to_try:
            url = f"https://generativelanguage.googleapis.com/{api_version}/models/{model_name}:generateContent?key={gemini_key}"
            
            # Realizar llamada HTTP nativa
            req = urllib.request.Request(
                url,
                data=json.dumps(req_data).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            
            try:
                with urllib.request.urlopen(req) as response:
                    res_body = response.read().decode('utf-8')
                    res_json = json.loads(res_body)
                    
                    candidates = res_json.get("candidates", [])
                    if not candidates:
                        continue
                        
                    text_response = candidates[0]["content"]["parts"][0]["text"].strip()
                    parsed_ia = json.loads(text_response)
                    return {
                        "status": "success",
                        "data": parsed_ia
                    }
            except urllib.error.HTTPError as he:
                last_error_code = he.code
                last_error_msg = he.read().decode('utf-8')
                
                # Si el error es 404 (modelo no disponible) o 400 (Bad Request de un modelo específico),
                # continuamos buscando otras combinaciones en la lista.
                if he.code in [400, 404]:
                    print(f"Error {he.code} en {api_version}/{model_name}: {last_error_msg[:150]}...")
                    continue
                else:
                    # Si es otro error crítico (ej: 403 por clave de API inválida), fallamos inmediatamente.
                    raise HTTPException(status_code=he.code, detail=f"API de Gemini falló: {last_error_msg}")
            except Exception as e:
                last_error_code = 500
                last_error_msg = str(e)
                continue
                
        # Si ninguna combinación funcionó
        raise HTTPException(
            status_code=last_error_code, 
            detail=f"API de Gemini falló en todas las versiones (último error: {last_error_msg})"
        )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en el análisis de IA: {str(e)}")
