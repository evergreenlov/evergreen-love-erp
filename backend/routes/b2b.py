from fastapi import APIRouter, HTTPException, Depends

from database import get_db_connection
from auth import get_current_b2b

router = APIRouter(prefix="/api/b2b", tags=["b2b-portal"])


@router.get("/cotizaciones")
def mis_cotizaciones(b2b_user: dict = Depends(get_current_b2b)):
    """Lista las cotizaciones del cliente B2B autenticado."""
    cliente_id = b2b_user.get("cliente_id")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT id, nombre_cliente, email, telefono, descripcion,
                   estado, fecha_creacion, fecha_actualizado,
                   orden_produccion_id, fuente
            FROM cotizaciones
            WHERE cliente_b2b_id = ?
            ORDER BY id DESC
        """, (cliente_id,))
        rows = [dict(r) for r in cursor.fetchall()]
        return {"status": "success", "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.get("/cotizaciones/{cotizacion_id}/imagenes")
def mis_imagenes_cotizacion(cotizacion_id: int, b2b_user: dict = Depends(get_current_b2b)):
    """Devuelve las imágenes de una cotización, validando que pertenezca al cliente B2B."""
    cliente_id = b2b_user.get("cliente_id")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT id FROM cotizaciones WHERE id = ? AND cliente_b2b_id = ?",
            (cotizacion_id, cliente_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Cotización no encontrada o sin acceso")

        cursor.execute("""
            SELECT id, nombre_archivo, fecha_subida
            FROM cotizacion_imagenes
            WHERE cotizacion_id = ?
            ORDER BY id ASC
        """, (cotizacion_id,))
        rows = []
        for r in cursor.fetchall():
            d = dict(r)
            nombre = d["nombre_archivo"]
            d["ruta_publica"] = f"/cotizaciones_imgs/{cotizacion_id}/{nombre}"
            d["es_pdf"] = nombre.lower().endswith(".pdf")
            rows.append(d)
        return {"status": "success", "data": rows}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.get("/facturas/{factura_id}/items")
def items_factura_b2b(factura_id: int, b2b_user: dict = Depends(get_current_b2b)):
    """Devuelve los items de una factura, validando que pertenezca al cliente B2B."""
    cliente_id = b2b_user.get("cliente_id")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT id FROM facturas WHERE id = ? AND cliente_id = ?",
            (factura_id, cliente_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Factura no encontrada o sin acceso")

        cursor.execute("""
            SELECT i.producto_id, i.nombre_producto, i.cantidad, i.precio_unitario, i.total
            FROM items_factura i
            WHERE i.factura_id = ?
            ORDER BY i.id ASC
        """, (factura_id,))
        rows = [dict(r) for r in cursor.fetchall()]
        return {"status": "success", "data": rows}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.get("/facturas")
def mis_facturas(b2b_user: dict = Depends(get_current_b2b)):
    """Lista las facturas del cliente B2B autenticado."""
    cliente_id = b2b_user.get("cliente_id")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT id, numero_factura, fecha_emision, fecha_vencimiento,
                   subtotal, ivu_estatal, ivu_municipal, total, estado, notas
            FROM facturas
            WHERE cliente_id = ?
            ORDER BY id DESC
        """, (cliente_id,))
        rows = [dict(r) for r in cursor.fetchall()]
        return {"status": "success", "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.get("/ordenes")
def mis_ordenes(b2b_user: dict = Depends(get_current_b2b)):
    """Lista las órdenes de producción del cliente B2B autenticado.

    Combina dos fuentes:
    1. Órdenes con cliente_b2b_id directo (pedidos del catálogo).
    2. Órdenes vinculadas por cotizacion_id cuya cotización tiene cliente_b2b_id.
    Elimina duplicados por id.
    """
    cliente_id = b2b_user.get("cliente_id")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT DISTINCT o.id, o.codigo_orden, o.cliente, o.estado,
                   o.fecha_creacion, o.fecha_entrega, o.cotizacion_id,
                   o.cliente_b2b_id, o.notas
            FROM ordenes_produccion o
            LEFT JOIN cotizaciones c ON c.id = o.cotizacion_id
            WHERE o.cliente_b2b_id = ?
               OR c.cliente_b2b_id = ?
            ORDER BY o.id DESC
        """, (cliente_id, cliente_id))
        rows = []
        for r in cursor.fetchall():
            d = dict(r)
            raw = d.get("cliente", "")
            # Extraer nombre legible del string pipe-separado
            nombre = raw.split(" | ")[0]
            nombre = nombre.replace("[PEDIDO B2B] Cliente: ", "")
            nombre = nombre.replace("[COTIZACIÓN #", "Cotización #")
            nombre = nombre.replace("[PERSONALIZADO] ", "")
            d["descripcion_corta"] = nombre[:60]
            rows.append(d)
        return {"status": "success", "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
