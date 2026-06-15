from fastapi import APIRouter, HTTPException, UploadFile, File, Header, Query, status, Depends
from typing import Optional
import sqlite3
import os
import json
import base64
import urllib.request
import urllib.error

from database import get_db_connection
from utils.photo_scanner import scan_and_index_photos, FOTOS_IMPORT_DIR
from auth import get_current_admin

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
    x_cloudflare_delivery_url: Optional[str] = Header(None, alias="X-Cloudflare-Delivery-Url"),
    current_user: dict = Depends(get_current_admin)
):
    if not orden_id and not producto_id:
        raise HTTPException(status_code=400, detail="Debe proporcionar orden_id o producto_id para asociar la foto.")
        
    TIPOS_VALIDOS = ['antes', 'final', 'referencia', 'material', 'frontal', 'lateral', 'detalle', 'empaque', 'transparente']
    if tipo_foto not in TIPOS_VALIDOS:
        raise HTTPException(status_code=400, detail=f"Tipo de foto inválido. Debe ser uno de: {', '.join(TIPOS_VALIDOS)}.")
        
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
def trigger_escanear_fotos(current_user: dict = Depends(get_current_admin)):
    try:
        res = scan_and_index_photos()
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Fotos con fondo removido (rembg)
if os.path.exists("/Volumes/MYRIAM SEAG/evergreen-love"):
    CATALOGO_TRANSPARENTE_DIR = "/Volumes/MYRIAM SEAG/evergreen-love/data/catalogo_transparente"
    REMBG_MODELS_DIR = "/Volumes/MYRIAM SEAG/rembg_models"
else:
    CATALOGO_TRANSPARENTE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "catalogo_transparente"))
    REMBG_MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "rembg_models"))

@router.post("/fotos/productos/{producto_id}/remover-fondo")
def remover_fondo_producto(
    producto_id: int,
    current_user: dict = Depends(get_current_admin)
):
    # Configurar ruta de modelos ANTES de importar rembg
    os.environ["U2NET_HOME"] = REMBG_MODELS_DIR
    os.makedirs(CATALOGO_TRANSPARENTE_DIR, exist_ok=True)
    os.makedirs(REMBG_MODELS_DIR, exist_ok=True)

    conn = get_db_connection()
    cursor = conn.cursor()

    # Buscar SKU del producto
    cursor.execute("SELECT id, sku FROM productos WHERE id = ?", (producto_id,))
    prod = cursor.fetchone()
    if not prod:
        conn.close()
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    sku = prod["sku"]

    # Buscar foto más reciente del producto en fotos_asociadas
    cursor.execute("""
        SELECT ruta_archivo, nombre_archivo FROM fotos_asociadas
        WHERE producto_id = ?
        ORDER BY id DESC LIMIT 1
    """, (producto_id,))
    foto_row = cursor.fetchone()
    if not foto_row or not foto_row["nombre_archivo"]:
        conn.close()
        raise HTTPException(status_code=404, detail="El producto no tiene foto asociada")

    foto_path = os.path.join(FOTOS_IMPORT_DIR, foto_row["nombre_archivo"])
    if not os.path.exists(foto_path):
        conn.close()
        raise HTTPException(status_code=404, detail=f"Archivo de foto no encontrado en disco: {foto_path}")

    # Nombre del PNG resultante — sobrescribe si ya existe
    sku_safe = sku.replace("/", "_").replace("\\", "_")
    output_filename = f"{sku_safe}_transparente.png"
    output_path = os.path.join(CATALOGO_TRANSPARENTE_DIR, output_filename)

    # Procesar con rembg (importar aquí para respetar U2NET_HOME)
    try:
        from PIL import Image
        try:
            import rembg
        except ImportError:
            conn.close()
            raise HTTPException(
                status_code=501, 
                detail="La eliminación de fondo no está disponible en el servidor (rembg no instalado). Ejecútelo localmente."
            )
        with open(foto_path, "rb") as f:
            input_bytes = f.read()
        output_bytes = rembg.remove(input_bytes)
        with open(output_path, "wb") as f:
            f.write(output_bytes)
    except HTTPException as he:
        raise he
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Error al procesar imagen con rembg: {str(e)}")

    # Actualizar fotos_asociadas: agregar/actualizar entrada con la versión transparente
    ruta_db = f"/catalogo_transparente/{output_filename}"
    cursor.execute("""
        SELECT id FROM fotos_asociadas
        WHERE producto_id = ? AND tipo_foto = 'transparente'
    """, (producto_id,))
    existing = cursor.fetchone()
    if existing:
        cursor.execute("""
            UPDATE fotos_asociadas
            SET ruta_archivo = ?, nombre_archivo = ?, fecha_registro = datetime('now','localtime')
            WHERE id = ?
        """, (ruta_db, output_filename, existing["id"]))
    else:
        cursor.execute("""
            INSERT INTO fotos_asociadas (producto_id, tipo_foto, ruta_archivo, nombre_archivo)
            VALUES (?, 'transparente', ?, ?)
        """, (producto_id, ruta_db, output_filename))

    conn.commit()
    conn.close()

    return {
        "status": "success",
        "mensaje": f"Fondo removido correctamente para {sku}",
        "foto_ruta": ruta_db,
        "archivo": output_filename
    }

_TIPO_ORDER = {'transparente': 0, 'frontal': 1, 'lateral': 2, 'detalle': 3, 'empaque': 4, 'referencia': 5}

@router.get("/fotos/productos/{producto_id}")
def get_fotos_producto(producto_id: int, current_user: dict = Depends(get_current_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM fotos_asociadas WHERE producto_id = ? ORDER BY id DESC", (producto_id,))
        rows = cursor.fetchall()
        fotos = []
        for row in rows:
            f = dict(row)
            nombre = f.get('nombre_archivo') or ''
            tipo   = f.get('tipo_foto') or ''
            if tipo == 'transparente':
                f['ruta_publica'] = f'/catalogo_transparente/{nombre}' if nombre else None
            else:
                f['ruta_publica'] = f'/fotos_import/{nombre}' if nombre else None
            fotos.append(f)
        fotos.sort(key=lambda x: _TIPO_ORDER.get(x.get('tipo_foto', ''), 6))
        conn.close()
        return {"status": "success", "data": fotos}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/fotos/{foto_id}")
def delete_foto(foto_id: int, current_user: dict = Depends(get_current_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM fotos_asociadas WHERE id = ?", (foto_id,))
        foto = cursor.fetchone()
        if not foto:
            conn.close()
            raise HTTPException(status_code=404, detail="Foto no encontrada")
        foto = dict(foto)
        nombre = foto.get('nombre_archivo') or ''
        tipo   = foto.get('tipo_foto') or ''
        if nombre:
            if tipo == 'transparente':
                filepath = os.path.join(CATALOGO_TRANSPARENTE_DIR, nombre)
            else:
                filepath = os.path.join(FOTOS_IMPORT_DIR, nombre)
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                except Exception:
                    pass
        cursor.execute("DELETE FROM fotos_asociadas WHERE id = ?", (foto_id,))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Foto eliminada correctamente"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/fotos/ordenes/{orden_id}")
def get_fotos_orden(orden_id: int, current_user: dict = Depends(get_current_admin)):
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

@router.get("/ia/test")
async def test_gemini(
    gemini_key: Optional[str] = Header(None, alias="X-Gemini-Key"),
    current_user: dict = Depends(get_current_admin)
):
    """Prueba de conectividad con Gemini. Envía 'Hola' y confirma respuesta."""
    modelo_activo = "gemini-2.0-flash (v1beta)"
    api_key_configurada = bool(gemini_key)

    if not api_key_configurada:
        return {
            "status": "sin_key",
            "modelo_activo": modelo_activo,
            "api_key_configurada": False,
            "mensaje": "No se proporcionó X-Gemini-Key en el header."
        }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}"
    payload = {"contents": [{"parts": [{"text": "Responde solo con la palabra: Hola"}]}]}
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req) as response:
            res_json = json.loads(response.read().decode('utf-8'))
            texto = res_json.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
            return {
                "status": "ok",
                "modelo_activo": modelo_activo,
                "api_key_configurada": True,
                "respuesta_gemini": texto
            }
    except urllib.error.HTTPError as he:
        error_body = ""
        try:
            error_body = he.read().decode('utf-8')
        except Exception:
            pass
        return {
            "status": "error",
            "modelo_activo": modelo_activo,
            "api_key_configurada": True,
            "http_code": he.code,
            "detalle": error_body[:500]
        }
    except Exception as e:
        return {
            "status": "error",
            "modelo_activo": modelo_activo,
            "api_key_configurada": True,
            "detalle": str(e)
        }


@router.post("/ia/estimar")
async def estimar_costos_por_ia(
    file: UploadFile = File(...),
    gemini_key: Optional[str] = Header(None, alias="X-Gemini-Key"),
    current_user: dict = Depends(get_current_admin)
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
        
        # responseMimeType solo es soportado en v1beta con modelos >= 1.5.
        # Para máxima compatibilidad, se construye el payload SIN ese campo:
        # el prompt ya instruye al modelo a devolver JSON puro.
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
            }]
        }

        # Orden de preferencia: modelos más recientes y estables primero.
        # gemini-3.5-flash no existe — eliminado para evitar 404 innecesarios.
        endpoints_to_try = [
            ("v1beta", "gemini-2.0-flash"),
            ("v1beta", "gemini-1.5-flash-latest"),
            ("v1beta", "gemini-1.5-flash"),
            ("v1", "gemini-1.5-flash-latest"),
            ("v1", "gemini-1.5-flash"),
        ]

        last_error_code = 500
        last_error_msg = "No se pudo conectar a ningún modelo de Gemini."
        last_model_tried = ""

        for api_version, model_name in endpoints_to_try:
            url = f"https://generativelanguage.googleapis.com/{api_version}/models/{model_name}:generateContent?key={gemini_key}"
            last_model_tried = f"{api_version}/{model_name}"
            print(f"[IA] Intentando modelo: {last_model_tried}")

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
                    print(f"[IA] Respuesta OK de {last_model_tried}")

                    candidates = res_json.get("candidates", [])
                    if not candidates:
                        print(f"[IA] Sin candidatos en {last_model_tried}, probando siguiente.")
                        continue

                    text_response = candidates[0]["content"]["parts"][0]["text"].strip()
                    # Limpiar posible bloque markdown que el modelo añada a pesar del prompt
                    if text_response.startswith("```"):
                        text_response = text_response.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

                    parsed_ia = json.loads(text_response)
                    print(f"[IA] JSON parseado correctamente desde {last_model_tried}")
                    return {"status": "success", "modelo": last_model_tried, "data": parsed_ia}

            except urllib.error.HTTPError as he:
                last_error_code = he.code
                try:
                    last_error_msg = he.read().decode('utf-8')
                except Exception:
                    last_error_msg = str(he)
                print(f"[IA] Error HTTP {he.code} en {last_model_tried}: {last_error_msg[:300]}")
                if he.code in [400, 404]:
                    continue
                # 403 = API key inválida — no tiene sentido seguir intentando
                raise HTTPException(status_code=he.code, detail=f"Gemini rechazó la solicitud ({he.code}): {last_error_msg[:500]}")
            except json.JSONDecodeError as je:
                last_error_msg = f"Respuesta no es JSON válido: {je}"
                print(f"[IA] {last_error_msg}")
                continue
            except Exception as e:
                last_error_code = 500
                last_error_msg = str(e)
                print(f"[IA] Excepción en {last_model_tried}: {last_error_msg}")
                continue

        raise HTTPException(
            status_code=last_error_code,
            detail=f"No se pudo analizar la imagen con IA (último modelo probado: {last_model_tried}, error: {last_error_msg[:400]})"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"No se pudo analizar la imagen con IA: {str(e)}")
