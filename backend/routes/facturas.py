from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import datetime
from database import get_db_connection
import sqlite3

router = APIRouter(
    prefix="/api",
    tags=["facturas"]
)

# Pydantic schemas for request validation
class ItemFacturaCreate(BaseModel):
    producto_id: Optional[int] = None
    nombre_producto: str
    cantidad: int
    precio_unitario: float
    total: float

class FacturaCreate(BaseModel):
    numero_factura: Optional[str] = None
    cliente_id: int
    fecha_emision: str
    fecha_vencimiento: Optional[str] = None
    fecha_pago: Optional[str] = None
    metodo_pago: Optional[str] = None
    numero_cheque: Optional[str] = None
    subtotal: float
    ivu_estatal: float
    ivu_municipal: float
    total: float
    monto_pagado: Optional[float] = None  # Monto abonado (puede ser parcial)
    notas: Optional[str] = None
    estado: str = "Pendiente"  # 'Pendiente', 'Pagada', 'Anulada'
    items: List[ItemFacturaCreate]

class EstadoUpdate(BaseModel):
    estado: str
    fecha_pago: Optional[str] = None
    metodo_pago: Optional[str] = None
    numero_cheque: Optional[str] = None
    monto_pagado: Optional[float] = None  # Monto abonado (puede ser parcial)

@router.get("/facturas")
def listar_facturas():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT f.*, c.nombre as cliente_nombre, c.email as cliente_email
            FROM facturas f
            JOIN clientes c ON f.cliente_id = c.id
            ORDER BY f.fecha_emision DESC, f.id DESC
        """)
        facturas = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return {"status": "success", "data": facturas}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al listar facturas: {str(e)}")

@router.get("/facturas/nuevas")
def obtener_facturas_nuevas():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT f.id, f.numero_factura, f.total, c.nombre as cliente_nombre 
            FROM facturas f
            JOIN clientes c ON f.cliente_id = c.id
            WHERE f.notificado = 0
        """)
        rows = cursor.fetchall()
        nuevas = [dict(row) for row in rows]
        conn.close()
        return {"status": "success", "data": nuevas}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/facturas/{factura_id}")
def obtener_factura(factura_id: int):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Obtener factura
        cursor.execute("""
            SELECT f.*, c.nombre as cliente_nombre, c.contacto as cliente_contacto, 
                   c.email as cliente_email, c.telefono as cliente_telefono, c.notas as cliente_notas
            FROM facturas f
            JOIN clientes c ON f.cliente_id = c.id
            WHERE f.id = ?
        """, (factura_id,))
        factura_row = cursor.fetchone()
        
        if not factura_row:
            conn.close()
            raise HTTPException(status_code=404, detail="Factura no encontrada")
            
        factura = dict(factura_row)
        
        # Obtener partidas con su foto de referencia
        cursor.execute("""
            SELECT i.*, 
                   (SELECT f.nombre_archivo FROM fotos_asociadas f 
                    WHERE f.producto_id = i.producto_id AND f.tipo_foto = 'referencia' 
                    ORDER BY f.id DESC LIMIT 1) as foto_nombre
            FROM items_factura i
            WHERE i.factura_id = ?
        """, (factura_id,))
        items = []
        for row in cursor.fetchall():
            d = dict(row)
            d['foto_ruta'] = f"/fotos_import/{d['foto_nombre']}" if d.get('foto_nombre') else None
            items.append(d)
        factura["items"] = items
        
        conn.close()
        return {"status": "success", "data": factura}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener detalle de factura: {str(e)}")

@router.post("/facturas")
def crear_factura(factura: FacturaCreate):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Generar número de factura si no se provee
        num_factura = factura.numero_factura
        if not num_factura:
            anio_actual = datetime.datetime.now().strftime("%Y")
            cursor.execute("""
                SELECT numero_factura FROM facturas 
                WHERE numero_factura LIKE ? 
                ORDER BY numero_factura DESC LIMIT 1
            """, (f"EV-{anio_actual}-%",))
            last_row = cursor.fetchone()
            
            if last_row:
                last_num = last_row["numero_factura"]
                # EV-YYYY-XXXX
                try:
                    seq = int(last_num.split("-")[-1])
                    next_seq = seq + 1
                except ValueError:
                    next_seq = 1
            else:
                next_seq = 1
            num_factura = f"EV-{anio_actual}-{next_seq:04d}"
            
        # Verificar que el cliente existe
        cursor.execute("SELECT id FROM clientes WHERE id = ?", (factura.cliente_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Cliente no encontrado")
            
        # Iniciar transacción
        try:
            cursor.execute("""
                INSERT INTO facturas (
                    numero_factura, cliente_id, fecha_emision, fecha_vencimiento,
                    fecha_pago, metodo_pago, numero_cheque, subtotal,
                    ivu_estatal, ivu_municipal, total, monto_pagado, notas, estado
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                num_factura, factura.cliente_id, factura.fecha_emision, factura.fecha_vencimiento,
                factura.fecha_pago, factura.metodo_pago, factura.numero_cheque, factura.subtotal,
                factura.ivu_estatal, factura.ivu_municipal, factura.total, factura.monto_pagado, factura.notas, factura.estado
            ))
            
            factura_id = cursor.lastrowid
            
            # Insertar partidas
            for item in factura.items:
                prod_id = item.producto_id
                if not prod_id:
                    cursor.execute("SELECT id FROM productos WHERE nombre = ?", (item.nombre_producto,))
                    prod_row = cursor.fetchone()
                    if prod_row:
                        prod_id = prod_row["id"]
                cursor.execute("""
                    INSERT INTO items_factura (
                        factura_id, producto_id, nombre_producto, cantidad, precio_unitario, total
                    ) VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    factura_id, prod_id, item.nombre_producto, item.cantidad, item.precio_unitario, item.total
                ))
                
            conn.commit()
            
            # Obtener la factura creada para retornarla
            cursor.execute("SELECT id FROM facturas WHERE id = ?", (factura_id,))
            created_id = cursor.fetchone()["id"]
            
            conn.close()
            return {"status": "success", "message": "Factura creada con éxito", "id": created_id, "numero_factura": num_factura}
        except sqlite3.IntegrityError as ie:
            conn.rollback()
            conn.close()
            raise HTTPException(status_code=400, detail=f"El número de factura '{num_factura}' ya existe o hay un error de integridad.")
        except Exception as e:
            conn.rollback()
            conn.close()
            raise HTTPException(status_code=500, detail=f"Error transaccional de base de datos: {str(e)}")
            
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al registrar factura: {str(e)}")

@router.put("/facturas/{factura_id}/estado")
def actualizar_estado_factura(factura_id: int, data: EstadoUpdate):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verificar existencia
        cursor.execute("SELECT id FROM facturas WHERE id = ?", (factura_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Factura no encontrada")
            
        # Si el estado es 'Pagada', nos aseguramos de registrar fecha_pago si no se provee
        fecha_pago_val = data.fecha_pago
        if data.estado == "Pagada" and not fecha_pago_val:
            fecha_pago_val = datetime.datetime.now().strftime("%Y-%m-%d")
            
        cursor.execute("""
            UPDATE facturas
            SET estado = ?,
                fecha_pago = ?,
                metodo_pago = ?,
                numero_cheque = ?,
                monto_pagado = ?
            WHERE id = ?
        """, (data.estado, fecha_pago_val, data.metodo_pago, data.numero_cheque, data.monto_pagado, factura_id))
        
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Estado de factura actualizado"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al actualizar estado: {str(e)}")

@router.delete("/facturas/{factura_id}")
def eliminar_factura(factura_id: int):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verificar existencia
        cursor.execute("SELECT id FROM facturas WHERE id = ?", (factura_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Factura no encontrada")
            
        # Borrar (on delete cascade limpiará items_factura)
        cursor.execute("DELETE FROM facturas WHERE id = ?", (factura_id,))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Factura eliminada con éxito"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar factura: {str(e)}")

@router.get("/contabilidad/reporte")
def reporte_contabilidad():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Obtener resumen por meses de fecha_emision de facturas no anuladas (Ciclo: del 20 de un mes al 19 del próximo mes)
        cursor.execute("""
            SELECT 
                CASE 
                    WHEN CAST(strftime('%d', fecha_emision) AS INTEGER) >= 20 
                    THEN strftime('%Y-%m', date(fecha_emision, '+1 month'))
                    ELSE strftime('%Y-%m', fecha_emision)
                END as mes,
                COUNT(id) as total_facturas,
                SUM(CASE WHEN estado != 'Anulada' THEN subtotal ELSE 0.0 END) as ingresos_subtotal,
                SUM(CASE WHEN estado != 'Anulada' THEN ivu_estatal ELSE 0.0 END) as ivu_estatal,
                SUM(CASE WHEN estado != 'Anulada' THEN ivu_municipal ELSE 0.0 END) as ivu_municipal,
                SUM(CASE WHEN estado != 'Anulada' THEN total ELSE 0.0 END) as total_facturado,
                SUM(CASE WHEN estado = 'Pagada' THEN total ELSE 0.0 END) as total_recaudado,
                SUM(CASE WHEN estado = 'Pendiente' THEN total ELSE 0.0 END) as total_pendiente,
                SUM(CASE WHEN estado = 'Anulada' THEN total ELSE 0.0 END) as total_anulado
            FROM facturas
            GROUP BY mes
            ORDER BY mes DESC
        """)
        reporte_meses = [dict(row) for row in cursor.fetchall()]
        
        # Totales acumulados históricos de facturas no anuladas
        cursor.execute("""
            SELECT 
                COUNT(id) as total_facturas,
                SUM(CASE WHEN estado != 'Anulada' THEN subtotal ELSE 0.0 END) as ingresos_subtotal,
                SUM(CASE WHEN estado != 'Anulada' THEN ivu_estatal ELSE 0.0 END) as ivu_estatal,
                SUM(CASE WHEN estado != 'Anulada' THEN ivu_municipal ELSE 0.0 END) as ivu_municipal,
                SUM(CASE WHEN estado != 'Anulada' THEN total ELSE 0.0 END) as total_facturado,
                SUM(CASE WHEN estado = 'Pagada' THEN total ELSE 0.0 END) as total_recaudado,
                SUM(CASE WHEN estado = 'Pendiente' THEN total ELSE 0.0 END) as total_pendiente
            FROM facturas
        """)
        row = cursor.fetchone()
        totales = dict(row) if row else {
            "total_facturas": 0,
            "ingresos_subtotal": 0.0,
            "ivu_estatal": 0.0,
            "ivu_municipal": 0.0,
            "total_facturado": 0.0,
            "total_recaudado": 0.0,
            "total_pendiente": 0.0
        }
        
        # Rellenar valores None con 0.0 si es que está vacía
        for key in totales:
            if totales[key] is None:
                totales[key] = 0.0
        
        conn.close()
        return {
            "status": "success",
            "totales": totales,
            "reporte_mensual": reporte_meses
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar reporte contable: {str(e)}")

class MarcarLeidasSchema(BaseModel):
    ids: List[int]

@router.post("/facturas/marcar-leidas")
def marcar_facturas_leidas(payload: MarcarLeidasSchema):
    try:
        if not payload.ids:
            return {"status": "success", "message": "No hay facturas que marcar."}
        conn = get_db_connection()
        cursor = conn.cursor()
        placeholders = ",".join("?" for _ in payload.ids)
        cursor.execute(f"""
            UPDATE facturas 
            SET notificado = 1 
            WHERE id IN ({placeholders})
        """, payload.ids)
        conn.commit()
        conn.close()
        return {"status": "success", "message": f"{cursor.rowcount} facturas marcadas como leídas."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
