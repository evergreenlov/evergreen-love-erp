from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
import sqlite3

from database import get_db_connection

router = APIRouter(
    prefix="/api",
    tags=["productos"]
)

# --- MODELOS PYDANTIC ---

class ComponenteSchema(BaseModel):
    material_id: int
    cantidad_usada: float  # área in² o unidades de herrajes
    costo_calculado: float

class ProductoSchema(BaseModel):
    sku: str
    nombre: str
    diseno_id: Optional[int] = None
    ancho: float = 2.0
    alto: float = 2.0
    tiempo_corte: float
    tiempo_grabado: float
    costo_maquina: float
    costo_mano_obra: float
    costo_total: float
    margen_ganancia: float
    precio_sugerido: float
    precio_final: float
    personalizado: int = 0  # 0 = No, 1 = Sí (precio a cotizar)
    shopify_titulo: Optional[str] = None
    shopify_descripcion: Optional[str] = None
    shopify_tags: Optional[str] = None
    shopify_alt_text: Optional[str] = None
    componentes: List[ComponenteSchema]

class ProductoUpdateSchema(BaseModel):
    nombre: str
    sku: str
    precio_final: float
    shopify_descripcion: Optional[str] = None
    personalizado: int = 0
    shopify_titulo: Optional[str] = None
    shopify_tags: Optional[str] = None
    shopify_alt_text: Optional[str] = None
    cliente_id: Optional[int] = None
    b2b_precio: Optional[float] = None
    # Campos de costeo — opcionales para edición desde calculadora
    ancho: Optional[float] = None
    alto: Optional[float] = None
    tiempo_corte: Optional[float] = None
    tiempo_grabado: Optional[float] = None
    costo_maquina: Optional[float] = None
    costo_mano_obra: Optional[float] = None
    costo_total: Optional[float] = None
    margen_ganancia: Optional[float] = None
    precio_sugerido: Optional[float] = None
    componentes: Optional[List[ComponenteSchema]] = None

# --- ENDPOINTS PRODUCTOS ---

@router.get("/productos")
def list_productos():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.*, 
                   (SELECT f.nombre_archivo FROM fotos_asociadas f WHERE f.producto_id = p.id AND f.tipo_foto = 'referencia' ORDER BY f.id DESC LIMIT 1) as foto_nombre,
                   cc.cliente_id, cc.precio_especial as b2b_precio
            FROM productos p 
            LEFT JOIN catalogo_cliente cc ON p.id = cc.producto_id
            ORDER BY p.id DESC
        """)
        rows = cursor.fetchall()
        productos = []
        for row in rows:
            d = dict(row)
            d['foto_ruta'] = f"/fotos_import/{d['foto_nombre']}" if d.get('foto_nombre') else None

            # Traer componentes del producto con detalles del material
            cursor.execute("""
                SELECT cp.id, cp.material_id, cp.cantidad_usada, cp.costo_calculado,
                       m.nombre as material_nombre, m.tipo as material_tipo,
                       m.costo_hoja_unidad, m.tamano_ancho, m.tamano_alto
                FROM componentes_producto cp
                JOIN materiales m ON cp.material_id = m.id
                WHERE cp.producto_id = ?
            """, (d['id'],))
            componentes_rows = cursor.fetchall()
            d['componentes'] = [dict(c) for c in componentes_rows]

            productos.append(d)
        conn.close()
        return {"status": "success", "data": productos}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/productos", status_code=status.HTTP_201_CREATED)
def create_producto(producto: ProductoSchema):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Validar SKU único
        cursor.execute("SELECT id FROM productos WHERE sku = ?", (producto.sku,))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail=f"El SKU '{producto.sku}' ya está registrado. Utilice un SKU único.")
            
        # Inserción en la tabla de productos (esquema en pulgadas)
        cursor.execute("""
            INSERT INTO productos (
                sku, nombre, diseno_id, ancho, alto, tiempo_corte, tiempo_grabado,
                costo_maquina, costo_mano_obra, costo_total, margen_ganancia,
                precio_sugerido, precio_final, personalizado,
                shopify_titulo, shopify_descripcion, shopify_tags, shopify_alt_text
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            producto.sku, producto.nombre, producto.diseno_id,
            producto.ancho, producto.alto,
            producto.tiempo_corte, producto.tiempo_grabado,
            producto.costo_maquina, producto.costo_mano_obra, producto.costo_total, producto.margen_ganancia,
            producto.precio_sugerido, producto.precio_final, producto.personalizado,
            producto.shopify_titulo, producto.shopify_descripcion, producto.shopify_tags, producto.shopify_alt_text
        ))
        
        producto_id = cursor.lastrowid
        
        # Inserción de los componentes desglosados en componentes_producto
        for comp in producto.componentes:
            cursor.execute("""
                INSERT INTO componentes_producto (producto_id, material_id, cantidad_usada, costo_calculado)
                VALUES (?, ?, ?, ?)
            """, (producto_id, comp.material_id, comp.cantidad_usada, comp.costo_calculado))
            
        conn.commit()
        conn.close()
        
        return {"status": "success", "id": producto_id, "message": "Producto y desglose de componentes guardados correctamente"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/productos/{producto_id}")
def delete_producto(producto_id: int):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM productos WHERE id = ?", (producto_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Producto no encontrado")
            
        cursor.execute("DELETE FROM productos WHERE id = ?", (producto_id,))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Producto y componentes asociados eliminados con éxito"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# PUT /api/productos/{producto_id}/descripcion
@router.put("/productos/{producto_id}/descripcion")
def update_producto_descripcion(producto_id: int, payload: dict):
    """Actualiza la descripción/tamaño (shopify_descripcion) de un producto."""
    try:
        descripcion = payload.get("descripcion", "")
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verificar que el producto exista
        cursor.execute("SELECT id FROM productos WHERE id = ?", (producto_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Producto no encontrado")
            
        cursor.execute(
            "UPDATE productos SET shopify_descripcion = ? WHERE id = ?",
            (descripcion, producto_id)
        )
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Descripción/tamaño actualizada correctamente"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# PUT /api/productos/{producto_id}
@router.put("/productos/{producto_id}")
def update_producto(producto_id: int, item: ProductoUpdateSchema):
    """Actualiza todos los detalles de un producto incluyendo costos y componentes."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verificar que el producto exista y traer datos actuales
        cursor.execute("SELECT * FROM productos WHERE id = ?", (producto_id,))
        existing = cursor.fetchone()
        if not existing:
            conn.close()
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        
        existing = dict(existing)

        # Verificar si el SKU nuevo está duplicado por otro producto
        cursor.execute("SELECT id FROM productos WHERE sku = ? AND id != ?", (item.sku, producto_id))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail="El SKU ya está en uso por otro producto")

        # Usar valores actuales si no se envían nuevos (para actualizaciones parciales)
        ancho = item.ancho if item.ancho is not None else existing.get('ancho', 2.0)
        alto = item.alto if item.alto is not None else existing.get('alto', 2.0)
        tiempo_corte = item.tiempo_corte if item.tiempo_corte is not None else existing.get('tiempo_corte', 0.0)
        tiempo_grabado = item.tiempo_grabado if item.tiempo_grabado is not None else existing.get('tiempo_grabado', 0.0)
        costo_maquina = item.costo_maquina if item.costo_maquina is not None else existing.get('costo_maquina', 0.0)
        costo_mano_obra = item.costo_mano_obra if item.costo_mano_obra is not None else existing.get('costo_mano_obra', 0.0)
        costo_total = item.costo_total if item.costo_total is not None else existing.get('costo_total', 0.0)
        margen_ganancia = item.margen_ganancia if item.margen_ganancia is not None else existing.get('margen_ganancia', 0.5)
        precio_sugerido = item.precio_sugerido if item.precio_sugerido is not None else existing.get('precio_sugerido', 0.0)
        shopify_alt_text = item.shopify_alt_text if item.shopify_alt_text is not None else existing.get('shopify_alt_text')
            
        cursor.execute(
            """
            UPDATE productos 
            SET nombre = ?, sku = ?, precio_final = ?, shopify_descripcion = ?,
                personalizado = ?, shopify_titulo = ?, shopify_tags = ?, shopify_alt_text = ?,
                ancho = ?, alto = ?, tiempo_corte = ?, tiempo_grabado = ?,
                costo_maquina = ?, costo_mano_obra = ?, costo_total = ?,
                margen_ganancia = ?, precio_sugerido = ?
            WHERE id = ?
            """,
            (item.nombre, item.sku, item.precio_final, item.shopify_descripcion,
             item.personalizado, item.shopify_titulo, item.shopify_tags, shopify_alt_text,
             ancho, alto, tiempo_corte, tiempo_grabado,
             costo_maquina, costo_mano_obra, costo_total,
             margen_ganancia, precio_sugerido,
             producto_id)
        )
        
        # Si se enviaron nuevos componentes, reemplazar los viejos
        if item.componentes is not None:
            cursor.execute("DELETE FROM componentes_producto WHERE producto_id = ?", (producto_id,))
            for comp in item.componentes:
                cursor.execute("""
                    INSERT INTO componentes_producto (producto_id, material_id, cantidad_usada, costo_calculado)
                    VALUES (?, ?, ?, ?)
                """, (producto_id, comp.material_id, comp.cantidad_usada, comp.costo_calculado))

        # Actualizar asociación B2B en catalogo_cliente
        cursor.execute("DELETE FROM catalogo_cliente WHERE producto_id = ?", (producto_id,))
        if item.cliente_id is not None and item.b2b_precio is not None:
            cursor.execute(
                """
                INSERT INTO catalogo_cliente (cliente_id, producto_id, precio_especial, notas)
                VALUES (?, ?, ?, 'Asociado durante edición.')
                """,
                (item.cliente_id, producto_id, item.b2b_precio)
            )
            
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Producto actualizado correctamente"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
