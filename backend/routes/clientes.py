import random
import string

from fastapi import APIRouter, HTTPException, status, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import Optional, List
import sqlite3

from database import get_db_connection
from utils.email_helper import send_receipt_email
from auth import get_current_admin, hash_password

router = APIRouter(
    prefix="/api",
    tags=["clientes"]
)

# --- MODELOS PYDANTIC ---

class ClienteSchema(BaseModel):
    nombre: str
    contacto: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    notas: Optional[str] = None

class CatalogoClienteSchema(BaseModel):
    cliente_id: int
    producto_id: int
    precio_especial: float
    notas: Optional[str] = None

class CodigoB2BSchema(BaseModel):
    codigo_b2b: str

# --- ENDPOINTS CLIENTES B2B ---

@router.get("/clientes")
def list_clientes():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM clientes ORDER BY nombre ASC")
        rows = cursor.fetchall()
        clientes = [dict(row) for row in rows]
        conn.close()
        return {"status": "success", "data": clientes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/clientes", status_code=status.HTTP_201_CREATED)
def create_cliente(cliente: ClienteSchema):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Validar nombre único
        cursor.execute("SELECT id FROM clientes WHERE nombre = ?", (cliente.nombre,))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail=f"El cliente B2B '{cliente.nombre}' ya está registrado.")
            
        cursor.execute("""
            INSERT INTO clientes (nombre, contacto, email, telefono, notas)
            VALUES (?, ?, ?, ?, ?)
        """, (cliente.nombre, cliente.contacto, cliente.email, cliente.telefono, cliente.notas))
        
        cliente_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return {"status": "success", "id": cliente_id, "message": f"Cliente B2B '{cliente.nombre}' registrado con éxito"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/clientes/{cliente_id}")
def delete_cliente(cliente_id: int):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM clientes WHERE id = ?", (cliente_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Cliente no encontrado")
            
        cursor.execute("DELETE FROM clientes WHERE id = ?", (cliente_id,))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Cliente B2B y sus catálogos asociados eliminados con éxito"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- ENDPOINTS CATÁLOGO POR CLIENTE ---

@router.get("/clientes/{cliente_id}/catalogo")
def get_catalogo_cliente(cliente_id: int):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Consultar productos del catálogo de este cliente específico
        cursor.execute("""
            SELECT cc.*, p.nombre as producto_nombre, p.sku as producto_sku, 
                   p.costo_total, p.precio_final as precio_retail, p.personalizado,
                   (SELECT f.nombre_archivo FROM fotos_asociadas f 
                    WHERE f.producto_id = p.id AND f.tipo_foto = 'referencia' 
                    ORDER BY f.id DESC LIMIT 1) as foto_nombre
            FROM catalogo_cliente cc
            JOIN productos p ON cc.producto_id = p.id
            WHERE cc.cliente_id = ?
            ORDER BY p.nombre ASC
        """, (cliente_id,))
        rows = cursor.fetchall()
        catalogo = []
        for row in rows:
            d = dict(row)
            d['foto_ruta'] = f"/fotos_import/{d['foto_nombre']}" if d.get('foto_nombre') else None
            catalogo.append(d)
        conn.close()
        return {"status": "success", "data": catalogo}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/clientes/catalogo", status_code=status.HTTP_201_CREATED)
def add_to_catalogo_cliente(item: CatalogoClienteSchema):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Validar si el cliente y el producto existen
        cursor.execute("SELECT id FROM clientes WHERE id = ?", (item.cliente_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Cliente no encontrado")
            
        cursor.execute("SELECT id FROM productos WHERE id = ?", (item.producto_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Producto no encontrado")
            
        # Insertar o actualizar si ya está asociado
        cursor.execute("SELECT id FROM catalogo_cliente WHERE cliente_id = ? AND producto_id = ?", (item.cliente_id, item.producto_id))
        existing = cursor.fetchone()
        
        if existing:
            cursor.execute("""
                UPDATE catalogo_cliente
                SET precio_especial = ?, notas = ?
                WHERE id = ?
            """, (item.precio_especial, item.notas, existing['id']))
            message = "Precio especial de catálogo actualizado con éxito"
        else:
            cursor.execute("""
                INSERT INTO catalogo_cliente (cliente_id, producto_id, precio_especial, notas)
                VALUES (?, ?, ?, ?)
            """, (item.cliente_id, item.producto_id, item.precio_especial, item.notas))
            message = "Producto añadido al catálogo personalizado del cliente"
            
        conn.commit()
        conn.close()
        return {"status": "success", "message": message}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/clientes/catalogo/{item_id}")
def delete_from_catalogo_cliente(item_id: int):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM catalogo_cliente WHERE id = ?", (item_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Registro de catálogo no encontrado")
            
        cursor.execute("DELETE FROM catalogo_cliente WHERE id = ?", (item_id,))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Producto retirado del catálogo del cliente"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- ENDPOINTS PEDIDOS B2B PÚBLICOS ---

class PedidoB2BItemSchema(BaseModel):
    producto_id: int
    cantidad: int
    precio_unitario: float
    nombre_producto: str

class PedidoB2BSchema(BaseModel):
    nombre_contacto: str
    email_contacto: Optional[str] = None
    telefono_contacto: Optional[str] = None
    notas: Optional[str] = None
    items: List[PedidoB2BItemSchema]

@router.post("/clientes/{cliente_id}/pedido", status_code=status.HTTP_201_CREATED)
def crear_pedido_b2b(cliente_id: int, pedido: PedidoB2BSchema, background_tasks: BackgroundTasks):
    """Crea un pedido B2B desde el catálogo público del cliente."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT id, nombre FROM clientes WHERE id = ?", (cliente_id,))
        cliente = cursor.fetchone()
        if not cliente:
            conn.close()
            raise HTTPException(status_code=404, detail="Cliente no encontrado")

        total_pedido = sum(item.cantidad * item.precio_unitario for item in pedido.items)
        resumen_items = " | ".join([f"{item.nombre_producto} x{item.cantidad}" for item in pedido.items])

        for item in pedido.items:
            notas_orden = (
                f"[PEDIDO B2B] Cliente: {cliente['nombre']} | "
                f"Contacto: {pedido.nombre_contacto} | "
                f"Email: {pedido.email_contacto or 'N/A'} | "
                f"Tel: {pedido.telefono_contacto or 'N/A'} | "
                f"Total pedido: ${total_pedido:.2f} | "
                f"Items: {resumen_items} | "
                f"Nota: {pedido.notas or 'Sin notas'}"
            )
            import time
            codigo_orden = f"EVL-B2B-{int(time.time() * 1000) % 10000000}-{item.producto_id}"
            cursor.execute("""
                INSERT INTO ordenes_produccion (codigo_orden, cliente, producto_id, cantidad, estado, material_descontado)
                VALUES (?, ?, ?, ?, 'Pendiente', 0)
            """, (codigo_orden, notas_orden, item.producto_id, item.cantidad))

        # --- REGISTRO AUTOMÁTICO DE FACTURA ---
        import datetime
        subtotal = sum(item.cantidad * item.precio_unitario for item in pedido.items)
        
        # Determinar si es exento de IVU municipal analizando las notas
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
        cursor.execute("""
            INSERT INTO facturas (
                numero_factura, cliente_id, fecha_emision, fecha_vencimiento,
                subtotal, ivu_estatal, ivu_municipal, total, notas, estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente')
        """, (
            num_factura,
            cliente_id,
            datetime.datetime.now().strftime("%Y-%m-%d"),
            (datetime.datetime.now() + datetime.timedelta(days=15)).strftime("%Y-%m-%d"),
            round(subtotal, 2),
            round(ivu_estatal, 2),
            round(ivu_municipal, 2),
            round(total_factura, 2),
            f"Pedido B2B de {pedido.nombre_contacto}. Notas adicionales: {pedido.notas or 'Ninguna'}",
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

        conn.commit()
        conn.close()

        # Enviar recibo por correo si se ingresó uno
        if pedido.email_contacto and "@" in pedido.email_contacto:
            order_data = {
                "nombre_contacto": pedido.nombre_contacto,
                "telefono_contacto": pedido.telefono_contacto or "",
                "numero_factura": num_factura,
                "subtotal": subtotal,
                "ivu_estatal": ivu_estatal,
                "ivu_municipal": ivu_municipal,
                "total": total_factura,
                "metodo_pago": "B2B",
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
            "message": f"Pedido registrado correctamente para {cliente['nombre']}",
            "total": total_pedido,
            "numero_factura": num_factura,
            "factura_id": factura_id
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/clientes/{cliente_id}/codigo-b2b")
def set_codigo_b2b(cliente_id: int, body: CodigoB2BSchema, current_user: dict = Depends(get_current_admin)):
    import re
    RESERVED = {"ADMIN", "ROOT", "TEST", "DEMO", "API", "SUPPORT"}
    codigo = body.codigo_b2b.strip().upper()
    if not codigo:
        raise HTTPException(status_code=400, detail="El código no puede estar vacío.")
    if len(codigo) < 3 or len(codigo) > 20:
        raise HTTPException(status_code=400, detail="El código debe tener entre 3 y 20 caracteres.")
    if not re.match(r'^[A-Z0-9\-]+$', codigo):
        raise HTTPException(status_code=400, detail="Solo se permiten letras, números y guiones.")
    if codigo in RESERVED:
        raise HTTPException(status_code=400, detail=f"El código '{codigo}' está reservado.")

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM clientes WHERE id = ?", (cliente_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")
    try:
        cursor.execute("UPDATE clientes SET codigo_b2b = ? WHERE id = ?", (codigo, cliente_id))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=409, detail="Ese código ya está en uso por otro cliente.")
    conn.close()
    return {"status": "success", "codigo_b2b": codigo}


@router.post("/clientes/{cliente_id}/generar-pin")
def generar_pin_cliente(cliente_id: int, current_user: dict = Depends(get_current_admin)):
    """
    Genera un PIN de acceso B2B para el cliente. Solo accesible por admins.
    El PIN se devuelve en texto claro UNA SOLA VEZ — el admin debe entregárselo al cliente.
    En la BD solo se guarda el hash.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, nombre FROM clientes WHERE id = ?", (cliente_id,))
    cliente = cursor.fetchone()
    if not cliente:
        conn.close()
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    # Caracteres sin ambiguos: sin 0/O, 1/I/l
    charset = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    part1 = "".join(random.choices(charset, k=4))
    part2 = "".join(random.choices(charset, k=4))
    pin_plain = f"{part1}-{part2}"

    pin_hash = hash_password(pin_plain)

    cursor.execute(
        "UPDATE clientes SET pin_hash = ?, pin_display = NULL WHERE id = ?",
        (pin_hash, cliente_id)
    )
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "cliente": cliente["nombre"],
        "pin": pin_plain,
        "message": "Entrega este PIN al cliente. No se volverá a mostrar desde este endpoint.",
    }


@router.get("/clientes/{cliente_id}/info")
def get_cliente_info(cliente_id: int):
    """Info básica de un cliente (para el catálogo B2B público)."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre, contacto, email FROM clientes WHERE id = ?", (cliente_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")
        return {"status": "success", "data": dict(row)}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
