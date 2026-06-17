import random
import string

from fastapi import APIRouter, HTTPException, status, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import Optional, List
import sqlite3

from database import get_db_connection
from utils.email_helper import send_receipt_email
from auth import get_current_admin, get_current_b2b, get_current_user, hash_password

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

class NivelPrecioSchema(BaseModel):
    nivel_precio_b2b: str

NIVELES_VALIDOS = {"retail", "wholesale_12", "wholesale_24", "wholesale_50"}

# --- ENDPOINTS CLIENTES B2B ---

@router.get("/clientes")
def list_clientes(current_user: dict = Depends(get_current_admin)):
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
def create_cliente(cliente: ClienteSchema, current_user: dict = Depends(get_current_admin)):
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
def delete_cliente(cliente_id: int, current_user: dict = Depends(get_current_admin)):
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

def _calcular_precio_b2b(row: dict, nivel: str) -> tuple:
    """Devuelve (precio_b2b, etiqueta_precio) según nivel del cliente y override manual."""
    override = row.get('precio_especial')
    try:
        override_val = float(override) if override is not None else 0.0
    except (ValueError, TypeError):
        override_val = 0.0

    if override_val > 0:
        return override_val, "Precio Especial"

    # Fallback a precio_retail o precio_final
    precio_final = row.get('precio_retail') or row.get('precio_final') or 0.0
    try:
        precio_final_val = float(precio_final) if precio_final is not None else 0.0
    except (ValueError, TypeError):
        precio_final_val = 0.0

    if nivel == 'wholesale_12':
        precio = row.get('precio_wholesale_12')
        try:
            precio_val = float(precio) if precio is not None and float(precio) > 0 else precio_final_val
        except (ValueError, TypeError):
            precio_val = precio_final_val
        return precio_val, "Precio B2B 12+"
    elif nivel == 'wholesale_24':
        precio = row.get('precio_wholesale_24')
        try:
            precio_val = float(precio) if precio is not None and float(precio) > 0 else precio_final_val
        except (ValueError, TypeError):
            precio_val = precio_final_val
        return precio_val, "Precio B2B 24+"
    elif nivel == 'wholesale_50':
        precio = row.get('precio_wholesale_50')
        try:
            precio_val = float(precio) if precio is not None and float(precio) > 0 else precio_final_val
        except (ValueError, TypeError):
            precio_val = precio_final_val
        return precio_val, "Precio Distribuidor 50+"
    else:  # retail
        return precio_final_val, "Precio Retail"


@router.get("/clientes/{cliente_id}/catalogo")
def get_catalogo_cliente(cliente_id: int, current_user: dict = Depends(get_current_user)):
    # Admin puede ver cualquier catálogo; B2B solo el suyo
    if current_user.get("role") == "b2b" and current_user.get("cliente_id") != cliente_id:
        raise HTTPException(status_code=403, detail="No tienes acceso al catálogo de este cliente.")
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Obtener nivel de precio del cliente
        cursor.execute("SELECT nivel_precio_b2b FROM clientes WHERE id = ?", (cliente_id,))
        cl = cursor.fetchone()
        nivel = (cl['nivel_precio_b2b'] if cl and cl['nivel_precio_b2b'] else 'retail')

        # Consultar productos del catálogo de este cliente específico
        cursor.execute("""
            SELECT cc.id, cc.cliente_id, cc.producto_id, cc.precio_especial, cc.notas,
                   p.nombre as producto_nombre, p.sku as producto_sku,
                   p.costo_total, p.precio_final as precio_retail, p.personalizado,
                   p.precio_wholesale_12, p.precio_wholesale_24, p.precio_wholesale_50,
                   p.shopify_descripcion, p.ancho, p.alto, p.tipo_producto,
                   (SELECT f.nombre_archivo FROM fotos_asociadas f
                    WHERE f.producto_id = p.id AND f.tipo_foto = 'referencia'
                    ORDER BY f.id DESC LIMIT 1) as foto_nombre,
                   (SELECT m.nombre FROM componentes_producto cp
                    JOIN materiales m ON cp.material_id = m.id
                    WHERE cp.producto_id = p.id LIMIT 1) as material_nombre,
                   (SELECT pi.ruta_imagen FROM producto_imagenes pi
                    WHERE pi.producto_id = p.id
                    ORDER BY pi.es_principal DESC, pi.orden ASC, pi.id ASC LIMIT 1) as galeria_primera
            FROM catalogo_cliente cc
            JOIN productos p ON cc.producto_id = p.id
            WHERE cc.cliente_id = ?
            ORDER BY p.nombre ASC
        """, (cliente_id,))
        rows = cursor.fetchall()
        catalogo = []
        for row in rows:
            d = dict(row)
            producto_id = d['producto_id']

            cursor.execute("""
                SELECT tipo_foto, nombre_archivo, ruta_archivo
                FROM fotos_asociadas
                WHERE producto_id = ?
                ORDER BY CASE tipo_foto
                    WHEN 'transparente' THEN 0
                    WHEN 'frontal'      THEN 1
                    WHEN 'lateral'      THEN 2
                    WHEN 'detalle'      THEN 3
                    WHEN 'empaque'      THEN 4
                    ELSE 5 END, id DESC
            """, (producto_id,))
            foto_rows = cursor.fetchall()

            fotos = []
            for fr in foto_rows:
                tipo   = fr['tipo_foto']
                nombre = fr['nombre_archivo']
                if not nombre:
                    continue
                ruta = f"/catalogo_transparente/{nombre}" if tipo == 'transparente' else f"/fotos_import/{nombre}"
                if ruta not in fotos:
                    fotos.append(ruta)

            # Galería nueva (producto_imagenes) tiene prioridad sobre fotos_asociadas
            galeria_primera = d.pop('galeria_primera', None)
            if galeria_primera and galeria_primera not in fotos:
                fotos.insert(0, galeria_primera)

            d['fotos'] = fotos
            d['foto_ruta'] = fotos[0] if fotos else (
                f"/fotos_import/{d['foto_nombre']}" if d.get('foto_nombre') else None
            )

            precio_b2b, etiqueta = _calcular_precio_b2b(d, nivel)
            d['precio_b2b']      = precio_b2b
            d['etiqueta_precio'] = etiqueta
            d['nivel_precio_b2b'] = nivel
            catalogo.append(d)
        conn.close()
        return {"status": "success", "data": catalogo}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/clientes/catalogo", status_code=status.HTTP_201_CREATED)
def add_to_catalogo_cliente(item: CatalogoClienteSchema, current_user: dict = Depends(get_current_admin)):
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
def delete_from_catalogo_cliente(item_id: int, current_user: dict = Depends(get_current_admin)):
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

@router.get("/clientes/publico/{codigo_b2b}/catalogo")
def catalogo_publico_por_codigo(codigo_b2b: str):
    """Catálogo público accesible mediante enlace con codigo_b2b. Sin datos sensibles."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, nombre, nivel_precio_b2b FROM clientes WHERE codigo_b2b = ?",
            (codigo_b2b.upper(),)
        )
        cl = cursor.fetchone()
        if not cl:
            raise HTTPException(status_code=404, detail="Enlace no válido o cliente no encontrado.")
        cliente_id = cl["id"]
        nivel = cl["nivel_precio_b2b"] or "retail"

        cursor.execute("""
            SELECT cc.producto_id, cc.precio_especial,
                   p.nombre as producto_nombre, p.sku as producto_sku,
                   p.precio_final as precio_retail, p.personalizado,
                   p.precio_wholesale_12, p.precio_wholesale_24, p.precio_wholesale_50,
                   p.shopify_descripcion, p.ancho, p.alto, p.tipo_producto,
                   (SELECT f.nombre_archivo FROM fotos_asociadas f
                    WHERE f.producto_id = p.id AND f.tipo_foto = 'referencia'
                    ORDER BY f.id DESC LIMIT 1) as foto_nombre,
                   (SELECT m.nombre FROM componentes_producto cp
                    JOIN materiales m ON cp.material_id = m.id
                    WHERE cp.producto_id = p.id LIMIT 1) as material_nombre,
                   (SELECT pi.ruta_imagen FROM producto_imagenes pi
                    WHERE pi.producto_id = p.id
                    ORDER BY pi.es_principal DESC, pi.orden ASC, pi.id ASC LIMIT 1) as galeria_primera
            FROM catalogo_cliente cc
            JOIN productos p ON cc.producto_id = p.id
            WHERE cc.cliente_id = ?
            ORDER BY p.nombre ASC
        """, (cliente_id,))
        rows = cursor.fetchall()

        catalogo = []
        for row in rows:
            d = dict(row)
            pid = d["producto_id"]
            cursor.execute("""
                SELECT tipo_foto, nombre_archivo FROM fotos_asociadas
                WHERE producto_id = ?
                ORDER BY CASE tipo_foto
                    WHEN 'transparente' THEN 0 WHEN 'frontal' THEN 1
                    WHEN 'lateral' THEN 2 WHEN 'detalle' THEN 3
                    ELSE 4 END, id DESC
            """, (pid,))
            fotos = []
            for fr in cursor.fetchall():
                nombre = fr["nombre_archivo"]
                if not nombre:
                    continue
                ruta = f"/catalogo_transparente/{nombre}" if fr["tipo_foto"] == "transparente" else f"/fotos_import/{nombre}"
                if ruta not in fotos:
                    fotos.append(ruta)

            # Galería nueva (producto_imagenes) tiene prioridad sobre fotos_asociadas
            galeria_primera = d.pop("galeria_primera", None)
            if galeria_primera and galeria_primera not in fotos:
                fotos.insert(0, galeria_primera)

            d["fotos"] = fotos
            d["foto_ruta"] = fotos[0] if fotos else (
                f"/fotos_import/{d['foto_nombre']}" if d.get("foto_nombre") else None
            )
            precio_b2b, etiqueta = _calcular_precio_b2b(d, nivel)
            d["precio_b2b"] = precio_b2b
            d["etiqueta_precio"] = etiqueta
            d["nivel_precio_b2b"] = nivel
            # No exponer datos sensibles de precio
            for campo in ("precio_especial", "foto_nombre", "precio_wholesale_12",
                          "precio_wholesale_24", "precio_wholesale_50"):
                d.pop(campo, None)
            catalogo.append(d)

        conn.close()
        return {
            "status": "success",
            "cliente_nombre": cl["nombre"],
            "codigo_b2b": codigo_b2b.upper(),
            "nivel_precio_b2b": nivel,
            "data": catalogo,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clientes/publico/{codigo_b2b}/pedido", status_code=status.HTTP_201_CREATED)
def crear_pedido_publico(codigo_b2b: str, pedido: PedidoB2BSchema, background_tasks: BackgroundTasks):
    """Crea pedido B2B desde enlace único (sin JWT). Resuelve codigo_b2b → cliente_id internamente."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, nombre FROM clientes WHERE codigo_b2b = ?",
            (codigo_b2b.upper(),)
        )
        cl = cursor.fetchone()
        if not cl:
            raise HTTPException(status_code=404, detail="Enlace no válido o cliente no encontrado.")
        cliente_id = cl["id"]
        cliente_nombre = cl["nombre"]

        import time as _time, datetime
        total_pedido = sum(item.cantidad * item.precio_unitario for item in pedido.items)
        resumen_items = " | ".join([f"{item.nombre_producto} x{item.cantidad}" for item in pedido.items])
        ts_pedido = int(_time.time() * 1000)
        pedido_b2b_id = f"PED-{cliente_id}-{ts_pedido}"
        ts_base = ts_pedido % 10000000

        ordenes_ids_publico = []
        for idx, item in enumerate(pedido.items):
            notas_orden = (
                f"[PEDIDO B2B] Cliente: {cliente_nombre} | "
                f"Contacto: {pedido.nombre_contacto} | "
                f"Email: {pedido.email_contacto or 'N/A'} | "
                f"Tel: {pedido.telefono_contacto or 'N/A'} | "
                f"Total pedido: ${total_pedido:.2f} | "
                f"Items: {resumen_items} | "
                f"Nota: {pedido.notas or 'Sin notas'}"
            )
            codigo_orden = f"EVL-B2B-{ts_base}-{idx}"
            cursor.execute("""
                INSERT INTO ordenes_produccion
                    (codigo_orden, cliente, producto_id, cantidad, estado, material_descontado, cliente_b2b_id, pedido_b2b_id)
                VALUES (?, ?, ?, ?, 'Pendiente', 0, ?, ?)
            """, (codigo_orden, notas_orden, item.producto_id, item.cantidad, cliente_id, pedido_b2b_id))
            ordenes_ids_publico.append({"producto_id": item.producto_id, "orden_id": cursor.lastrowid})

        subtotal = sum(item.cantidad * item.precio_unitario for item in pedido.items)
        is_exempt = pedido.notas and "EXENTO" in pedido.notas
        ivu_estatal = subtotal * 0.105
        ivu_municipal = 0.0 if is_exempt else subtotal * 0.01
        total_factura = subtotal + ivu_estatal + ivu_municipal

        anio = datetime.datetime.now().strftime("%Y")
        cursor.execute(
            "SELECT numero_factura FROM facturas WHERE numero_factura LIKE ? ORDER BY numero_factura DESC LIMIT 1",
            (f"EV-{anio}-%",)
        )
        last_row = cursor.fetchone()
        next_seq = 1
        if last_row:
            try:
                next_seq = int(last_row["numero_factura"].split("-")[-1]) + 1
            except ValueError:
                pass
        num_factura = f"EV-{anio}-{next_seq:04d}"

        cursor.execute("""
            INSERT INTO facturas
                (numero_factura, cliente_id, fecha_emision, fecha_vencimiento,
                 subtotal, ivu_estatal, ivu_municipal, total, notas, estado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente')
        """, (
            num_factura, cliente_id,
            datetime.datetime.now().strftime("%Y-%m-%d"),
            (datetime.datetime.now() + datetime.timedelta(days=15)).strftime("%Y-%m-%d"),
            round(subtotal, 2), round(ivu_estatal, 2), round(ivu_municipal, 2),
            round(total_factura, 2),
            f"Pedido B2B de {pedido.nombre_contacto}. Notas: {pedido.notas or 'Ninguna'}",
        ))
        factura_id = cursor.lastrowid

        for item in pedido.items:
            prod_id = item.producto_id
            if not prod_id:
                cursor.execute("SELECT id FROM productos WHERE nombre = ?", (item.nombre_producto,))
                pr = cursor.fetchone()
                if pr:
                    prod_id = pr["id"]
            cursor.execute("""
                INSERT INTO items_factura (factura_id, producto_id, nombre_producto, cantidad, precio_unitario, total)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (factura_id, prod_id, item.nombre_producto, item.cantidad,
                  item.precio_unitario, round(item.cantidad * item.precio_unitario, 2)))

        conn.commit()
        conn.close()
        return {
            "status": "success",
            "message": "Pedido registrado correctamente",
            "numero_factura": num_factura,
            "pedido_b2b_id": pedido_b2b_id,
            "total": round(total_factura, 2),
            "ordenes_ids": ordenes_ids_publico,
        }
    except HTTPException:
        raise
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clientes/{cliente_id}/pedido", status_code=status.HTTP_201_CREATED)
def crear_pedido_b2b(cliente_id: int, pedido: PedidoB2BSchema, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_b2b)):
    """Crea un pedido B2B desde el catálogo público del cliente."""
    if current_user.get("cliente_id") != cliente_id:
        raise HTTPException(status_code=403, detail="No puedes crear pedidos en nombre de otro cliente.")
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT id, nombre FROM clientes WHERE id = ?", (cliente_id,))
        cliente = cursor.fetchone()
        if not cliente:
            conn.close()
            raise HTTPException(status_code=404, detail="Cliente no encontrado")

        import time as _time
        total_pedido = sum(item.cantidad * item.precio_unitario for item in pedido.items)
        resumen_items = " | ".join([f"{item.nombre_producto} x{item.cantidad}" for item in pedido.items])
        ts_pedido = int(_time.time() * 1000)
        pedido_b2b_id = f"PED-{cliente_id}-{ts_pedido}"
        ts_base = ts_pedido % 10000000

        ordenes_ids_b2b = []
        for idx, item in enumerate(pedido.items):
            notas_orden = (
                f"[PEDIDO B2B] Cliente: {cliente['nombre']} | "
                f"Contacto: {pedido.nombre_contacto} | "
                f"Email: {pedido.email_contacto or 'N/A'} | "
                f"Tel: {pedido.telefono_contacto or 'N/A'} | "
                f"Total pedido: ${total_pedido:.2f} | "
                f"Items: {resumen_items} | "
                f"Nota: {pedido.notas or 'Sin notas'}"
            )
            codigo_orden = f"EVL-B2B-{ts_base}-{idx}"
            cursor.execute("""
                INSERT INTO ordenes_produccion (codigo_orden, cliente, producto_id, cantidad, estado, material_descontado, cliente_b2b_id, pedido_b2b_id)
                VALUES (?, ?, ?, ?, 'Pendiente', 0, ?, ?)
            """, (codigo_orden, notas_orden, item.producto_id, item.cantidad, cliente_id, pedido_b2b_id))
            ordenes_ids_b2b.append({"producto_id": item.producto_id, "orden_id": cursor.lastrowid})

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
            "factura_id": factura_id,
            "ordenes_ids": ordenes_ids_b2b,
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


@router.put("/clientes/{cliente_id}/nivel-precio")
def actualizar_nivel_precio(
    cliente_id: int,
    payload: NivelPrecioSchema,
    current_user: dict = Depends(get_current_admin),
):
    if payload.nivel_precio_b2b not in NIVELES_VALIDOS:
        raise HTTPException(status_code=400, detail=f"Nivel inválido. Opciones: {', '.join(NIVELES_VALIDOS)}")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM clientes WHERE id = ?", (cliente_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    cursor.execute(
        "UPDATE clientes SET nivel_precio_b2b = ? WHERE id = ?",
        (payload.nivel_precio_b2b, cliente_id)
    )
    conn.commit()
    conn.close()
    return {"status": "success", "nivel_precio_b2b": payload.nivel_precio_b2b}


@router.get("/clientes/{cliente_id}/info")
def get_cliente_info(cliente_id: int, current_user: dict = Depends(get_current_admin)):
    """Info básica de un cliente."""
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
