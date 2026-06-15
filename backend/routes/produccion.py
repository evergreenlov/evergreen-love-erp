from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional, List
import sqlite3

from database import get_db_connection
from auth import get_current_admin

router = APIRouter(
    prefix="/api",
    tags=["produccion"]
)

# --- MODELO PYDANTIC PARA ORDEN ---

class OrdenSchema(BaseModel):
    codigo_orden: str
    cliente: str
    producto_id: Optional[int] = None
    cantidad: int
    estado: str = "Pendiente"
    fecha_entrega: Optional[str] = None

# --- LÓGICA DE DESCUENTO DE INVENTARIO ---

def descontar_materiales_inventario(cursor, producto_id: int, cantidad_orden: int):
    # 1. Obtener todos los componentes del producto
    cursor.execute("""
        SELECT cp.material_id, cp.cantidad_usada, m.nombre, m.tipo, m.tamano_ancho, m.tamano_alto, m.cantidad, m.costo_hoja_unidad
        FROM componentes_producto cp
        JOIN materiales m ON cp.material_id = m.id
        WHERE cp.producto_id = ?
    """, (producto_id,))
    componentes = cursor.fetchall()
    
    for comp in componentes:
        material_id = comp['material_id']
        cantidad_usada_unitaria = comp['cantidad_usada']
        tipo = comp['tipo']
        cantidad_actual = comp['cantidad']
        
        # Cantidad total que el pedido consume
        total_consumido = cantidad_usada_unitaria * cantidad_orden
        
        if tipo in ['madera', 'acrilico', 'corcho', 'resina']:
            # Son planchas/hojas, descontamos proporcional al área en pulgadas cuadradas
            ancho = comp['tamano_ancho']
            alto = comp['tamano_alto']
            area_hoja = ancho * alto
            
            if area_hoja <= 0:
                continue
                
            # Proporción de hoja usada (ej. 4.6 in2 / 240 in2 = 0.019 hojas)
            proporcion_hoja_usada = total_consumido / area_hoja
            nueva_cantidad = max(0.0, cantidad_actual - proporcion_hoja_usada)
            
            cursor.execute("UPDATE materiales SET cantidad = ? WHERE id = ?", (nueva_cantidad, material_id))
            print(f"Descuento de material (área): {comp['nombre']}. Restado {proporcion_hoja_usada:.4f} hojas. Stock restante: {nueva_cantidad:.2f}")
            
        else:
            # Son unidades discretas (herrajes, empaques)
            nueva_cantidad = max(0.0, cantidad_actual - total_consumido)
            cursor.execute("UPDATE materiales SET cantidad = ? WHERE id = ?", (nueva_cantidad, material_id))
            print(f"Descuento de material (unidades): {comp['nombre']}. Restado {total_consumido} unidades. Stock restante: {nueva_cantidad}")

# --- ENDPOINTS ÓRDENES DE PRODUCCIÓN ---

@router.get("/ordenes")
def list_ordenes(current_user: dict = Depends(get_current_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT o.*, p.nombre as producto_nombre, p.sku as producto_sku,
                   f.numero_factura
            FROM ordenes_produccion o
            LEFT JOIN productos p ON o.producto_id = p.id
            LEFT JOIN facturas f ON f.id = o.factura_id
            ORDER BY o.id DESC
        """)
        rows = cursor.fetchall()
        ordenes = [dict(row) for row in rows]
        conn.close()
        return {"status": "success", "data": ordenes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ordenes", status_code=status.HTTP_201_CREATED)
def create_orden(orden: OrdenSchema, current_user: dict = Depends(get_current_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Validar código único
        cursor.execute("SELECT id FROM ordenes_produccion WHERE codigo_orden = ?", (orden.codigo_orden,))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail=f"El código de orden '{orden.codigo_orden}' ya está registrado.")
            
        # Determinar si se debe descontar de una vez
        estados_produccion = ['Cortando', 'Grabando', 'Pintura/Acabado', 'Listo', 'Entregado']
        descontado = 1 if orden.estado in estados_produccion else 0
        
        cursor.execute("""
            INSERT INTO ordenes_produccion (codigo_orden, cliente, producto_id, cantidad, estado, material_descontado, fecha_entrega)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (orden.codigo_orden, orden.cliente, orden.producto_id, orden.cantidad, orden.estado, descontado, orden.fecha_entrega))
        
        orden_id = cursor.lastrowid
        
        # Aplicar el descuento si entra directamente en fase de producción
        if descontado == 1:
            descontar_materiales_inventario(cursor, orden.producto_id, orden.cantidad)
            
        conn.commit()
        conn.close()
        return {"status": "success", "id": orden_id, "message": f"Orden {orden.codigo_orden} creada con éxito"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/ordenes/{orden_id}")
def update_orden(orden_id: int, estado: str, current_user: dict = Depends(get_current_admin)):
    estados_validos = ['Pendiente', 'En diseño', 'Cortando', 'Grabando', 'Pintura/Acabado', 'Listo', 'Entregado']
    if estado not in estados_validos:
        raise HTTPException(status_code=400, detail="Estado de producción inválido.")
        
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Obtener orden actual
        cursor.execute("SELECT producto_id, cantidad, estado, material_descontado, codigo_orden FROM ordenes_produccion WHERE id = ?", (orden_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail="Orden no encontrada")
            
        producto_id = row['producto_id']
        cantidad = row['cantidad']
        descontado = row['material_descontado']
        codigo_orden = row['codigo_orden']
        
        # Evaluar si requiere descontar materiales ahora
        estados_produccion = ['Cortando', 'Grabando', 'Pintura/Acabado', 'Listo', 'Entregado']
        nuevo_descontado = descontado
        
        if estado in estados_produccion and descontado == 0:
            descontar_materiales_inventario(cursor, producto_id, cantidad)
            nuevo_descontado = 1
            
        cursor.execute("""
            UPDATE ordenes_produccion
            SET estado = ?, material_descontado = ?
            WHERE id = ?
        """, (estado, nuevo_descontado, orden_id))
        
        conn.commit()
        conn.close()
        return {
            "status": "success", 
            "message": f"Estado de la orden {codigo_orden} cambiado a '{estado}'" + 
                       (" (Materiales descontados del inventario automáticamente)" if (nuevo_descontado == 1 and descontado == 0) else "")
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/ordenes/{orden_id}/completado")
def update_orden_completado(orden_id: int, completado: int, current_user: dict = Depends(get_current_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE ordenes_produccion SET completado = ? WHERE id = ?", (completado, orden_id))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Estado completado del artículo actualizado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/ordenes/{orden_id}")
def delete_orden(orden_id: int, current_user: dict = Depends(get_current_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM ordenes_produccion WHERE id = ?", (orden_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Orden no encontrada")
            
        cursor.execute("DELETE FROM ordenes_produccion WHERE id = ?", (orden_id,))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Orden eliminada con éxito"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- ENDPOINTS EVALUACIONES VISUALES ---

class EvaluacionSchema(BaseModel):
    orden_id: int
    foto_antes: Optional[str] = None
    foto_despues: Optional[str] = None
    problemas: Optional[str] = None
    correcciones_aplicadas: Optional[str] = None
    estado_aprobacion: str = "Aprobado"

@router.get("/evaluaciones")
def list_evaluaciones(current_user: dict = Depends(get_current_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT ev.*, o.codigo_orden, o.cliente, p.nombre as producto_nombre
            FROM evaluaciones_visuales ev
            JOIN ordenes_produccion o ON ev.orden_id = o.id
            LEFT JOIN productos p ON o.producto_id = p.id
            ORDER BY ev.id DESC
        """)
        rows = cursor.fetchall()
        evaluaciones = [dict(row) for row in rows]
        conn.close()
        return {"status": "success", "data": evaluaciones}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/evaluaciones/orden/{orden_id}")
def get_evaluacion_orden(orden_id: int, current_user: dict = Depends(get_current_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM evaluaciones_visuales WHERE orden_id = ?", (orden_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return {"status": "success", "data": dict(row)}
        return {"status": "success", "data": None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/evaluaciones", status_code=status.HTTP_201_CREATED)
def create_or_update_evaluacion(evaluacion: EvaluacionSchema, current_user: dict = Depends(get_current_admin)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Validar si la orden existe
        cursor.execute("SELECT id, codigo_orden FROM ordenes_produccion WHERE id = ?", (evaluacion.orden_id,))
        orden_row = cursor.fetchone()
        if not orden_row:
            conn.close()
            raise HTTPException(status_code=404, detail="Orden no encontrada")
            
        codigo_orden = orden_row['codigo_orden']
            
        # Verificar si ya existe evaluación
        cursor.execute("SELECT id FROM evaluaciones_visuales WHERE orden_id = ?", (evaluacion.orden_id,))
        row = cursor.fetchone()
        
        if row:
            # Actualizar
            cursor.execute("""
                UPDATE evaluaciones_visuales
                SET foto_antes = ?, foto_despues = ?, problemas = ?, correcciones_aplicadas = ?, estado_aprobacion = ?, fecha_evaluacion = datetime('now', 'localtime')
                WHERE orden_id = ?
            """, (evaluacion.foto_antes, evaluacion.foto_despues, evaluacion.problemas, evaluacion.correcciones_aplicadas, evaluacion.estado_aprobacion, evaluacion.orden_id))
            message = f"Evaluación de la orden {codigo_orden} actualizada correctamente."
        else:
            # Insertar nuevo
            cursor.execute("""
                INSERT INTO evaluaciones_visuales (orden_id, foto_antes, foto_despues, problemas, correcciones_aplicadas, estado_aprobacion)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (evaluacion.orden_id, evaluacion.foto_antes, evaluacion.foto_despues, evaluacion.problemas, evaluacion.correcciones_aplicadas, evaluacion.estado_aprobacion))
            message = f"Evaluación de la orden {codigo_orden} guardada correctamente."
            
        conn.commit()
        conn.close()
        return {"status": "success", "message": message}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── RESPUESTAS DE PERSONALIZACIÓN POR ORDEN ──────────────────────────────────

@router.get("/ordenes/{orden_id}/personalizacion")
def get_personalizacion_orden(orden_id: int, current_user: dict = Depends(get_current_admin)):
    """Devuelve todas las respuestas de personalización de una orden."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM ordenes_produccion WHERE id = ?", (orden_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    cursor.execute(
        "SELECT id, campo_id, etiqueta, tipo, valor, archivo_ruta FROM pedido_personalizacion_respuestas WHERE orden_id = ? ORDER BY id",
        (orden_id,)
    )
    respuestas = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"status": "success", "data": respuestas}
