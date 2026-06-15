from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional, List
import sqlite3

from database import get_db_connection
from auth import get_current_admin

router = APIRouter(
    prefix="/api",
    tags=["productos"]
)

# --- MODELOS PYDANTIC ---

class ComponenteSchema(BaseModel):
    material_id: int
    cantidad_usada: float  # área in² o unidades de herrajes
    costo_calculado: float

class ConfiguracionSchema(BaseModel):
    tarifa_hora_laser: float
    tarifa_hora_labor: float

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
    personalizado: int = 0
    shopify_titulo: Optional[str] = None
    shopify_descripcion: Optional[str] = None
    shopify_tags: Optional[str] = None
    shopify_alt_text: Optional[str] = None
    componentes: List[ComponenteSchema]
    # Precios Wholesale
    precio_wholesale_12: Optional[float] = None
    precio_wholesale_24: Optional[float] = None
    precio_wholesale_50: Optional[float] = None
    # Motor de Costeo Inteligente
    tipo_producto: Optional[str] = None
    capas: Optional[int] = 1
    complejidad: Optional[str] = "simple"
    tiempo_pintura: Optional[float] = 0.0
    tiempo_ensamblaje: Optional[float] = 0.0
    # Resina
    usa_resina: Optional[int] = 0
    cantidad_resina_ml: Optional[float] = 0.0
    costo_resina_por_ml: Optional[float] = 0.0
    tiempo_resina_activo_min: Optional[float] = 0.0
    tiempo_resina_curado_min: Optional[float] = 0.0
    # Modo 3D / Multicapa
    modo_producto: Optional[str] = "plano"
    num_piezas: Optional[int] = 1
    tiempo_pegado: Optional[float] = 0.0
    tiempo_secado_ref: Optional[float] = 0.0
    costo_pegamento: Optional[float] = 0.0
    costo_herrajes_extras: Optional[float] = 0.0
    costo_empaque: Optional[float] = 0.0
    porcentaje_merma: Optional[float] = 0.0

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
    # Precios Wholesale
    precio_wholesale_12: Optional[float] = None
    precio_wholesale_24: Optional[float] = None
    precio_wholesale_50: Optional[float] = None
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
    # Motor de Costeo Inteligente
    tipo_producto: Optional[str] = None
    capas: Optional[int] = None
    complejidad: Optional[str] = None
    tiempo_pintura: Optional[float] = None
    tiempo_ensamblaje: Optional[float] = None
    # Resina
    usa_resina: Optional[int] = None
    cantidad_resina_ml: Optional[float] = None
    costo_resina_por_ml: Optional[float] = None
    tiempo_resina_activo_min: Optional[float] = None
    tiempo_resina_curado_min: Optional[float] = None
    # Modo 3D / Multicapa
    modo_producto: Optional[str] = None
    num_piezas: Optional[int] = None
    tiempo_pegado: Optional[float] = None
    tiempo_secado_ref: Optional[float] = None
    costo_pegamento: Optional[float] = None
    costo_herrajes_extras: Optional[float] = None
    costo_empaque: Optional[float] = None
    porcentaje_merma: Optional[float] = None

# --- ENDPOINTS CONFIGURACIÓN GLOBAL ---

@router.get("/configuracion")
def get_configuracion(current_user: dict = Depends(get_current_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM configuracion WHERE id = 1")
        row = cursor.fetchone()
        conn.close()
        if row:
            return {"status": "success", "data": dict(row)}
        return {"status": "success", "data": {"tarifa_hora_laser": 15.0, "tarifa_hora_labor": 18.0}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/configuracion")
def update_configuracion(cfg: ConfiguracionSchema, current_user: dict = Depends(get_current_admin)):
    if cfg.tarifa_hora_laser <= 0 or cfg.tarifa_hora_labor <= 0:
        raise HTTPException(status_code=400, detail="Las tarifas deben ser mayores a 0")
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO configuracion (id, tarifa_hora_laser, tarifa_hora_labor)
            VALUES (1, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                tarifa_hora_laser = excluded.tarifa_hora_laser,
                tarifa_hora_labor  = excluded.tarifa_hora_labor
        """, (cfg.tarifa_hora_laser, cfg.tarifa_hora_labor))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Tarifas actualizadas correctamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- ENDPOINTS PRODUCTOS ---

def _build_fotos(cursor, producto_id):
    """Devuelve rutas de fotos en el orden de galería: transparente, frontal, lateral, detalle, empaque, referencia."""
    cursor.execute("""
        SELECT tipo_foto, nombre_archivo FROM fotos_asociadas
        WHERE producto_id = ?
        ORDER BY CASE tipo_foto
            WHEN 'transparente' THEN 0
            WHEN 'frontal'      THEN 1
            WHEN 'lateral'      THEN 2
            WHEN 'detalle'      THEN 3
            WHEN 'empaque'      THEN 4
            ELSE 5 END, id DESC
    """, (producto_id,))
    fotos = []
    for fr in cursor.fetchall():
        nombre = fr['nombre_archivo']
        if not nombre:
            continue
        ruta = f"/catalogo_transparente/{nombre}" if fr['tipo_foto'] == 'transparente' else f"/fotos_import/{nombre}"
        if ruta not in fotos:
            fotos.append(ruta)
    return fotos

@router.get("/productos/publico")
def list_productos_publico():
    """Devuelve solo campos públicos para el portal B2B. Sin costos internos."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.id, p.sku, p.nombre, p.precio_final, p.personalizado,
                   p.shopify_titulo, p.shopify_descripcion, p.shopify_tags,
                   p.ancho, p.alto,
                   (SELECT f.nombre_archivo FROM fotos_asociadas f
                    WHERE f.producto_id = p.id AND f.tipo_foto = 'referencia'
                    ORDER BY f.id DESC LIMIT 1) as foto_nombre
            FROM productos p
            ORDER BY p.id DESC
        """)
        rows = cursor.fetchall()
        productos = []
        for row in rows:
            d = dict(row)
            fotos = _build_fotos(cursor, d['id'])
            d['fotos'] = fotos
            d['foto_ruta'] = fotos[0] if fotos else (
                f"/fotos_import/{d['foto_nombre']}" if d.get('foto_nombre') else None
            )
            productos.append(d)
        conn.close()
        return {"status": "success", "data": productos}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/productos")
def list_productos(current_user: dict = Depends(get_current_admin)):
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
            fotos = _build_fotos(cursor, d['id'])
            d['fotos'] = fotos
            d['foto_ruta'] = fotos[0] if fotos else (
                f"/fotos_import/{d['foto_nombre']}" if d.get('foto_nombre') else None
            )

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
def create_producto(producto: ProductoSchema, current_user: dict = Depends(get_current_admin)):
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
                shopify_titulo, shopify_descripcion, shopify_tags, shopify_alt_text,
                precio_wholesale_12, precio_wholesale_24, precio_wholesale_50,
                tipo_producto, capas, complejidad, tiempo_pintura, tiempo_ensamblaje,
                usa_resina, cantidad_resina_ml, costo_resina_por_ml,
                tiempo_resina_activo_min, tiempo_resina_curado_min,
                modo_producto, num_piezas, tiempo_pegado, tiempo_secado_ref,
                costo_pegamento, costo_herrajes_extras, costo_empaque, porcentaje_merma
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            producto.sku, producto.nombre, producto.diseno_id,
            producto.ancho, producto.alto,
            producto.tiempo_corte, producto.tiempo_grabado,
            producto.costo_maquina, producto.costo_mano_obra, producto.costo_total, producto.margen_ganancia,
            producto.precio_sugerido, producto.precio_final, producto.personalizado,
            producto.shopify_titulo, producto.shopify_descripcion, producto.shopify_tags, producto.shopify_alt_text,
            producto.precio_wholesale_12, producto.precio_wholesale_24, producto.precio_wholesale_50,
            producto.tipo_producto, producto.capas or 1, producto.complejidad or 'simple',
            producto.tiempo_pintura or 0.0, producto.tiempo_ensamblaje or 0.0,
            producto.usa_resina or 0, producto.cantidad_resina_ml or 0.0,
            producto.costo_resina_por_ml or 0.0,
            producto.tiempo_resina_activo_min or 0.0, producto.tiempo_resina_curado_min or 0.0,
            producto.modo_producto or 'plano', producto.num_piezas or 1,
            producto.tiempo_pegado or 0.0, producto.tiempo_secado_ref or 0.0,
            producto.costo_pegamento or 0.0, producto.costo_herrajes_extras or 0.0,
            producto.costo_empaque or 0.0, producto.porcentaje_merma or 0.0
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
def delete_producto(producto_id: int, current_user: dict = Depends(get_current_admin)):
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
def update_producto_descripcion(producto_id: int, payload: dict, current_user: dict = Depends(get_current_admin)):
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
def update_producto(producto_id: int, item: ProductoUpdateSchema, current_user: dict = Depends(get_current_admin)):
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
        shopify_descripcion = item.shopify_descripcion if item.shopify_descripcion is not None else existing.get('shopify_descripcion')
        shopify_titulo = item.shopify_titulo if item.shopify_titulo is not None else existing.get('shopify_titulo')
        shopify_tags = item.shopify_tags if item.shopify_tags is not None else existing.get('shopify_tags')
        shopify_alt_text = item.shopify_alt_text if item.shopify_alt_text is not None else existing.get('shopify_alt_text')
        tipo_producto = item.tipo_producto if item.tipo_producto is not None else existing.get('tipo_producto')
        capas = item.capas if item.capas is not None else (existing.get('capas') or 1)
        complejidad = item.complejidad if item.complejidad is not None else (existing.get('complejidad') or 'simple')
        tiempo_pintura = item.tiempo_pintura if item.tiempo_pintura is not None else (existing.get('tiempo_pintura') or 0.0)
        tiempo_ensamblaje = item.tiempo_ensamblaje if item.tiempo_ensamblaje is not None else (existing.get('tiempo_ensamblaje') or 0.0)
        usa_resina = item.usa_resina if item.usa_resina is not None else (existing.get('usa_resina') or 0)
        cantidad_resina_ml = item.cantidad_resina_ml if item.cantidad_resina_ml is not None else (existing.get('cantidad_resina_ml') or 0.0)
        costo_resina_por_ml = item.costo_resina_por_ml if item.costo_resina_por_ml is not None else (existing.get('costo_resina_por_ml') or 0.0)
        tiempo_resina_activo_min = item.tiempo_resina_activo_min if item.tiempo_resina_activo_min is not None else (existing.get('tiempo_resina_activo_min') or 0.0)
        tiempo_resina_curado_min = item.tiempo_resina_curado_min if item.tiempo_resina_curado_min is not None else (existing.get('tiempo_resina_curado_min') or 0.0)
        precio_wholesale_12 = item.precio_wholesale_12 if item.precio_wholesale_12 is not None else existing.get('precio_wholesale_12')
        precio_wholesale_24 = item.precio_wholesale_24 if item.precio_wholesale_24 is not None else existing.get('precio_wholesale_24')
        precio_wholesale_50 = item.precio_wholesale_50 if item.precio_wholesale_50 is not None else existing.get('precio_wholesale_50')
        modo_producto = item.modo_producto if item.modo_producto is not None else (existing.get('modo_producto') or 'plano')
        num_piezas = item.num_piezas if item.num_piezas is not None else (existing.get('num_piezas') or 1)
        tiempo_pegado = item.tiempo_pegado if item.tiempo_pegado is not None else (existing.get('tiempo_pegado') or 0.0)
        tiempo_secado_ref = item.tiempo_secado_ref if item.tiempo_secado_ref is not None else (existing.get('tiempo_secado_ref') or 0.0)
        costo_pegamento = item.costo_pegamento if item.costo_pegamento is not None else (existing.get('costo_pegamento') or 0.0)
        costo_herrajes_extras = item.costo_herrajes_extras if item.costo_herrajes_extras is not None else (existing.get('costo_herrajes_extras') or 0.0)
        costo_empaque = item.costo_empaque if item.costo_empaque is not None else (existing.get('costo_empaque') or 0.0)
        porcentaje_merma = item.porcentaje_merma if item.porcentaje_merma is not None else (existing.get('porcentaje_merma') or 0.0)

        cursor.execute(
            """
            UPDATE productos
            SET nombre = ?, sku = ?, precio_final = ?, shopify_descripcion = ?,
                personalizado = ?, shopify_titulo = ?, shopify_tags = ?, shopify_alt_text = ?,
                ancho = ?, alto = ?, tiempo_corte = ?, tiempo_grabado = ?,
                costo_maquina = ?, costo_mano_obra = ?, costo_total = ?,
                margen_ganancia = ?, precio_sugerido = ?,
                precio_wholesale_12 = ?, precio_wholesale_24 = ?, precio_wholesale_50 = ?,
                tipo_producto = ?, capas = ?, complejidad = ?,
                tiempo_pintura = ?, tiempo_ensamblaje = ?,
                usa_resina = ?, cantidad_resina_ml = ?, costo_resina_por_ml = ?,
                tiempo_resina_activo_min = ?, tiempo_resina_curado_min = ?,
                modo_producto = ?, num_piezas = ?, tiempo_pegado = ?, tiempo_secado_ref = ?,
                costo_pegamento = ?, costo_herrajes_extras = ?, costo_empaque = ?, porcentaje_merma = ?
            WHERE id = ?
            """,
            (item.nombre, item.sku, item.precio_final, shopify_descripcion,
             item.personalizado, shopify_titulo, shopify_tags, shopify_alt_text,
             ancho, alto, tiempo_corte, tiempo_grabado,
             costo_maquina, costo_mano_obra, costo_total,
             margen_ganancia, precio_sugerido,
             precio_wholesale_12, precio_wholesale_24, precio_wholesale_50,
             tipo_producto, capas, complejidad, tiempo_pintura, tiempo_ensamblaje,
             usa_resina, cantidad_resina_ml, costo_resina_por_ml,
             tiempo_resina_activo_min, tiempo_resina_curado_min,
             modo_producto, num_piezas, tiempo_pegado, tiempo_secado_ref,
             costo_pegamento, costo_herrajes_extras, costo_empaque, porcentaje_merma,
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
