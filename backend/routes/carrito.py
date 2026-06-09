from fastapi import APIRouter, HTTPException, Query, status, BackgroundTasks
from database import get_db_connection
from pydantic import BaseModel
from typing import List, Optional
import datetime
import time
from utils.email_helper import send_receipt_email

router = APIRouter(
    prefix="/api",
    tags=["carrito"]
)

class CartItemCreate(BaseModel):
    session_id: str
    producto_id: int
    cantidad: int = 1

# POST /api/carrito/add
@router.post("/carrito/add")
def add_to_cart(item: CartItemCreate):
    """Añade o actualiza un ítem en el carrito de la sesión especificada."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Verificar que el producto exista
        cursor.execute("SELECT id FROM productos WHERE id = ?", (item.producto_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        # Ver si ya existe en carrito
        cursor.execute(
            "SELECT id, cantidad FROM carrito WHERE session_id = ? AND producto_id = ?",
            (item.session_id, item.producto_id)
        )
        row = cursor.fetchone()
        if row:
            # actualizar cantidad
            new_qty = row["cantidad"] + item.cantidad
            cursor.execute(
                "UPDATE carrito SET cantidad = ? WHERE id = ?",
                (new_qty, row["id"]))
        else:
            # insertar nuevo registro
            cursor.execute(
                "INSERT INTO carrito (session_id, producto_id, cantidad) VALUES (?, ?, ?)",
                (item.session_id, item.producto_id, item.cantidad)
            )
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Producto añadido al carrito"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# GET /api/carrito
@router.get("/carrito")
def get_cart(session_id: str = Query(...)):
    """Obtiene los ítems del carrito junto con información del producto."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT c.id AS cart_id, c.session_id, c.cantidad, p.id AS producto_id, p.nombre, p.precio_final,
                   (SELECT f.nombre_archivo FROM fotos_asociadas f WHERE f.producto_id = p.id AND f.tipo_foto = 'referencia' ORDER BY f.id DESC LIMIT 1) as foto_nombre
            FROM carrito c
            JOIN productos p ON c.producto_id = p.id
            WHERE c.session_id = ?
            ORDER BY c.id
            """,
            (session_id,)
        )
        rows = cursor.fetchall()
        items = []
        for row in rows:
            d = dict(row)
            d['foto_ruta'] = f"/fotos_import/{d['foto_nombre']}" if d.get('foto_nombre') else None
            items.append(d)
        conn.close()
        return {"status": "success", "data": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# DELETE /api/carrito/clear
@router.delete("/carrito/clear")
def clear_cart(session_id: str = Query(...)):
    """Elimina todos los ítems del carrito para la sesión indicada."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM carrito WHERE session_id = ?", (session_id,))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Carrito vaciado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# DELETE /api/carrito/remove
@router.delete("/carrito/remove")
def remove_from_cart(session_id: str = Query(...), producto_id: int = Query(...)):
    """Elimina un ítem específico del carrito para la sesión indicada."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM carrito WHERE session_id = ? AND producto_id = ?", (session_id, producto_id))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Producto eliminado del carrito"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- PEDIDOS Y FACTURACIÓN DESDE CATÁLOGO PÚBLICO ---

class PedidoPublicoItemSchema(BaseModel):
    producto_id: int
    cantidad: int
    precio_unitario: float
    nombre_producto: str

class PedidoPublicoSchema(BaseModel):
    nombre_contacto: str
    email_contacto: Optional[str] = None
    telefono_contacto: str
    notas: Optional[str] = None
    items: List[PedidoPublicoItemSchema]
    session_id: str
    metodo_pago: Optional[str] = "ATH Movil"

@router.post("/carrito/pedido", status_code=status.HTTP_201_CREATED)
def crear_pedido_publico(pedido: PedidoPublicoSchema, background_tasks: BackgroundTasks):
    """Crea un pedido desde el catálogo público de retail y genera su factura."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 1. Buscar o crear el Cliente Público Genérico
        cursor.execute("SELECT id FROM clientes WHERE nombre = 'Cliente Público'")
        row_cliente = cursor.fetchone()
        if row_cliente:
            cliente_id = row_cliente["id"]
        else:
            cursor.execute("""
                INSERT INTO clientes (nombre, contacto, email, telefono, notas)
                VALUES ('Cliente Público', 'Público General', NULL, NULL, 'Cliente genérico para pedidos del catálogo público.')
            """)
            cliente_id = cursor.lastrowid

        # 2. Registrar Órdenes de Producción individuales
        total_pedido = sum(item.cantidad * item.precio_unitario for item in pedido.items)
        resumen_items = " | ".join([f"{item.nombre_producto} x{item.cantidad}" for item in pedido.items])

        for idx, item in enumerate(pedido.items):
            notas_orden = (
                f"[PEDIDO PÚBLICO] Contacto: {pedido.nombre_contacto} | "
                f"Email: {pedido.email_contacto or 'N/A'} | "
                f"Tel: {pedido.telefono_contacto} | "
                f"Total pedido: ${total_pedido:.2f} | "
                f"Items: {resumen_items} | "
                f"Pago: {pedido.metodo_pago or 'ATH Movil'} | "
                f"Nota: {pedido.notas or 'Sin notas'}"
            )
            # Código único añadiendo índice y milisegundos
            codigo_orden = f"EVL-PUB-{int(time.time() * 1000) % 10000000}-{idx}-{item.producto_id}"
            cursor.execute("""
                INSERT INTO ordenes_produccion (codigo_orden, cliente, producto_id, cantidad, estado, material_descontado)
                VALUES (?, ?, ?, ?, 'Pendiente', 0)
            """, (codigo_orden, notas_orden, item.producto_id, item.cantidad))

        # 3. Registro automático de factura
        subtotal = sum(item.cantidad * item.precio_unitario for item in pedido.items)
        
        # Determinar si es exento de IVU municipal
        is_exempt = False
        if pedido.notas and "EXENTO" in pedido.notas:
            is_exempt = True
            
        ivu_estatal = subtotal * 0.105
        ivu_municipal = 0.0 if is_exempt else subtotal * 0.01
        total_factura = subtotal + ivu_estatal + ivu_municipal

        # Generar número de factura EV-YYYY-XXXX
        anio_actual = datetime.datetime.now().strftime("%Y")
        cursor.execute("""
            SELECT numero_factura FROM facturas 
            WHERE numero_factura LIKE ? 
            ORDER BY numero_factura DESC LIMIT 1
        """, (f"EV-{anio_actual}-%",))
        last_row = cursor.fetchone()
        
        if last_row:
            last_num = last_row["numero_factura"]
            try:
                seq = int(last_num.split("-")[-1])
                next_seq = seq + 1
            except ValueError:
                next_seq = 1
        else:
            next_seq = 1
        num_factura = f"EV-{anio_actual}-{next_seq:04d}"

        # Insertar factura principal
        db_metodo = pedido.metodo_pago or "ATH Movil"
        if db_metodo not in ['Efectivo', 'ATH Movil', 'Cheque', 'Tarjeta', 'Transferencia', 'Otro']:
            db_metodo = 'Otro'

        cursor.execute("""
            INSERT INTO facturas (
                numero_factura, cliente_id, fecha_emision, fecha_vencimiento,
                subtotal, ivu_estatal, ivu_municipal, total, notas, estado, metodo_pago
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente', ?)
        """, (
            num_factura,
            cliente_id,
            datetime.datetime.now().strftime("%Y-%m-%d"),
            (datetime.datetime.now() + datetime.timedelta(days=15)).strftime("%Y-%m-%d"),
            round(subtotal, 2),
            round(ivu_estatal, 2),
            round(ivu_municipal, 2),
            round(total_factura, 2),
            f"Pedido Público de {pedido.nombre_contacto}. Tel: {pedido.telefono_contacto} | Email: {pedido.email_contacto or 'N/A'}. Notas adicionales: {pedido.notas or 'Ninguna'} [Pago: {pedido.metodo_pago or 'ATH Movil'}]",
            db_metodo
        ))
        factura_id = cursor.lastrowid

        # Insertar partidas de la factura
        for item in pedido.items:
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
                factura_id,
                prod_id,
                item.nombre_producto,
                item.cantidad,
                item.precio_unitario,
                round(item.cantidad * item.precio_unitario, 2)
            ))

        # 4. Vaciar carrito de la sesión
        cursor.execute("DELETE FROM carrito WHERE session_id = ?", (pedido.session_id,))

        conn.commit()
        conn.close()

        # 5. Enviar recibo por correo si se ingresó uno
        if pedido.email_contacto and "@" in pedido.email_contacto:
            order_data = {
                "nombre_contacto": pedido.nombre_contacto,
                "telefono_contacto": pedido.telefono_contacto,
                "numero_factura": num_factura,
                "subtotal": subtotal,
                "ivu_estatal": ivu_estatal,
                "ivu_municipal": ivu_municipal,
                "total": total_factura,
                "metodo_pago": pedido.metodo_pago or "ATH Movil",
                "notas": pedido.notas or "",
                "items": [
                    {
                        "nombre_producto": item.nombre_producto,
                        "cantidad": item.cantidad,
                        "precio_unitario": item.precio_unitario
                    } for item in pedido.items
                ]
            }
            background_tasks.add_task(send_receipt_email, pedido.email_contacto.strip(), order_data)

        return {
            "status": "success",
            "message": f"Pedido registrado correctamente y factura {num_factura} generada.",
            "total": total_factura,
            "numero_factura": num_factura,
            "factura_id": factura_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

