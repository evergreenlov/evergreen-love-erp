from fastapi import APIRouter, HTTPException, Response, Depends
import urllib.request
import urllib.error
import json
import datetime
from database import get_db_connection
from utils.shopify_exporter import generate_shopify_csv
from auth import get_current_admin

router = APIRouter(
    prefix="/api",
    tags=["shopify"]
)

@router.get("/shopify/exportar")
def exportar_shopify_csv(current_user: dict = Depends(get_current_admin)):
    """
    Genera y sirve el archivo CSV compatible con Shopify para todos los productos.
    """
    try:
        csv_content = generate_shopify_csv()
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=productos_evergreen_shopify.csv"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar exportación de Shopify: {str(e)}")

@router.post("/shopify/publicar_web")
def publicar_catalogo_web(current_user: dict = Depends(get_current_admin)):
    """
    Publica el catálogo local (productos SQLite y fotos R2) en el endpoint
    público de Cloudflare R2 mediante el Worker.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.*, f.ruta_archivo as foto_ruta, f.nombre_archivo as foto_nombre
            FROM productos p
            LEFT JOIN (
                SELECT producto_id, ruta_archivo, nombre_archivo, MAX(id) as max_id
                FROM fotos_asociadas
                WHERE tipo_foto = 'final'
                GROUP BY producto_id
            ) f ON p.id = f.producto_id
            ORDER BY p.id DESC
        """)
        productos = cursor.fetchall()
        conn.close()
        
        products_list = []
        for p in productos:
            tags_str = p['shopify_tags'] or ""
            tags = [t.strip() for t in tags_str.split(',') if t.strip()]
            category = "Grabado Láser"
            # Intentar buscar una categoría que no sea genérica
            for t in tags:
                if t.lower() not in ['láser', 'artesanal', 'evergreen', 'evergreen-love', 'madera', 'acrilico']:
                    category = t.capitalize()
                    break
            
            price = p['precio_final']
            price_label = f"${price:.2f} unidad"
            
            photo = ""
            if p['foto_ruta']:
                if p['foto_ruta'].startswith(('http://', 'https://')):
                    photo = p['foto_ruta']
                    
            products_list.append({
                "id": p['sku'],
                "name": p['nombre'],
                "category": category,
                "price": price,
                "bulkQty": 12,
                "bulkPrice": round(price * 0.9, 2), # 10% de descuento por defecto en docena
                "priceLabel": price_label,
                "size": "",
                "color": "",
                "wood": "",
                "changes": "",
                "imagePos": "50% 50%",
                "photo": photo
            })
            
        payload = {
            "publishedAt": datetime.datetime.now().isoformat() + "Z",
            "business": {
                "name": "Evergreen Love",
                "owner": "Myriam Nieves",
                "phone": "(787) 960-1431",
                "email": "evergreenlov@gmail.com",
                "logo": "./assets/evergreen-love-logo.jpg"
            },
            "products": products_list
        }
        
        # Enviar petición POST al Worker de Cloudflare
        cf_url = "https://evergreen-love-foto-api.mncedres.workers.dev/catalog"
        req = urllib.request.Request(
            cf_url,
            data=json.dumps(payload).encode('utf-8'),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        
        with urllib.request.urlopen(req) as response:
            if response.status in [200, 201]:
                return {"status": "success", "message": "Catálogo publicado en la nube correctamente."}
            else:
                raise HTTPException(status_code=500, detail="Error de respuesta del servidor de Cloudflare.")
                
    except urllib.error.HTTPError as he:
        err_msg = he.read().decode('utf-8')
        raise HTTPException(status_code=he.code, detail=f"Error en Cloudflare: {err_msg}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al publicar el catálogo: {str(e)}")
