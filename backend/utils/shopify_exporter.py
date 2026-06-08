import csv
import io
import re
import os
import sqlite3
from database import get_db_connection

def slugify(text: str) -> str:
    """
    Convierte un texto a formato handle/slug apto para URLs y Shopify.
    """
    text = text.lower()
    # Eliminar caracteres no alfanuméricos
    text = re.sub(r'[^\w\s-]', '', text)
    # Reemplazar espacios y guiones bajos por un solo guión
    text = re.sub(r'[\s_-]+', '-', text)
    return text.strip('-')

def generate_shopify_csv() -> str:
    """
    Obtiene todos los productos registrados en la base de datos local
    y genera un archivo CSV formateado según los requisitos oficiales de Shopify.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Consultar productos y ver si tienen foto final asociada (tomando la más reciente)
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
    
    output = io.StringIO()
    # Usar el escritor CSV nativo
    writer = csv.writer(output, delimiter=',', quotechar='"', quoting=csv.QUOTE_MINIMAL)
    
    # Columnas del estándar Shopify CSV
    headers = [
        'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Product Category', 'Type', 'Tags', 'Published',
        'Option1 Name', 'Option1 Value', 'Variant SKU', 'Variant Grams', 'Variant Inventory Tracker',
        'Variant Inventory Qty', 'Variant Variant Inventory Policy', 'Variant Fulfillment Service',
        'Variant Price', 'Variant Compare At Price', 'Variant Requires Shipping', 'Variant Taxable',
        'Variant Barcode', 'Image Src', 'Image Position', 'Image Alt Text', 'Gift Card',
        'SEO Title', 'SEO Description', 'Cost per item'
    ]
    writer.writerow(headers)
    
    for p in productos:
        handle = slugify(p['nombre'])
        title = p['shopify_titulo'] if p['shopify_titulo'] else p['nombre']
        
        # Generar cuerpo HTML si es nulo
        if p['shopify_descripcion']:
            body = p['shopify_descripcion']
        else:
            body = (
                f"<p>Hermoso producto <strong>{p['nombre']}</strong> elaborado artesanalmente en nuestro taller láser <strong>Evergreen Love</strong>. "
                f"Cada pieza es cortada y grabada con tecnología de precisión sobre materiales sostenibles seleccionados.</p>"
                f"<p>Ideal para regalos personalizados, decoración del hogar y uso diario.</p>"
            )
            
        tags = p['shopify_tags'] if p['shopify_tags'] else f"láser, artesanal, madera, evergreen-love, {p['nombre'].lower()}"
        
        sku = p['sku']
        price = f"{p['precio_final']:.2f}"
        cost = f"{p['costo_total']:.2f}"
        
        # Imagen asociada en el servidor local o remota en Cloudflare R2
        img_src = ""
        if p['foto_ruta']:
            if p['foto_ruta'].startswith(('http://', 'https://')):
                img_src = p['foto_ruta']
            elif p['foto_nombre']:
                img_src = f"/fotos_import/{p['foto_nombre']}"
            
        img_alt = p['shopify_alt_text'] if p['shopify_alt_text'] else f"Foto de {p['nombre']}"
        
        row = [
            handle,                   # Handle
            title,                    # Title
            body,                     # Body (HTML)
            'Evergreen Love',         # Vendor
            'Arts & Entertainment > Hobbies & Creative Arts > Crafts & Hobbies > Laser Cut & Engraved', # Product Category
            'Grabado Láser',          # Type
            tags,                     # Tags
            'TRUE',                   # Published
            'Title',                  # Option1 Name
            'Default Title',          # Option1 Value
            sku,                      # Variant SKU
            '50',                     # Variant Grams
            'shopify',                # Variant Inventory Tracker
            '10',                     # Variant Variant Inventory Qty
            'deny',                   # Variant Variant Inventory Policy
            'manual',                 # Variant Fulfillment Service
            price,                    # Variant Price
            '',                       # Variant Compare At Price
            'TRUE',                   # Variant Requires Shipping
            'TRUE',                   # Variant Taxable
            '',                       # Variant Barcode
            img_src,                  # Image Src
            '1' if img_src else '',   # Image Position
            img_alt,                  # Image Alt Text
            'FALSE',                  # Gift Card
            title,                    # SEO Title
            p['shopify_descripcion'] or f"Producto artesanal grabado láser {p['nombre']}", # SEO Description
            cost                      # Cost per item
        ]
        writer.writerow(row)
        
    return output.getvalue()
