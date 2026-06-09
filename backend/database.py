import sqlite3
import os

# Ruta de la base de datos
DB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
DB_PATH = os.path.join(DB_DIR, "evergreen.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def reset_db_if_needed():
    # Eliminar base de datos vieja para recrear con el esquema en pulgadas
    if os.path.exists(DB_PATH):
        try:
            os.remove(DB_PATH)
            print("Base de datos anterior eliminada para aplicar la reestructuración en pulgadas.")
        except Exception as e:
            print(f"No se pudo eliminar el archivo db viejo: {str(e)}")

def init_db(force_reset=False):
    # Asegurar que el directorio de datos existe
    os.makedirs(DB_DIR, exist_ok=True)
    
    if force_reset:
        reset_db_if_needed()
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Habilitar claves foráneas
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # 1. Tabla de Materiales (Medidas en Pulgadas)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS materiales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        tipo TEXT CHECK(tipo IN ('madera', 'acrilico', 'corcho', 'resina', 'herrajes', 'empaques', 'imanes', 'pegamentos', 'pinturas', 'otros')) NOT NULL,
        espesor REAL NOT NULL, -- en pulgadas (in) ej: 0.125, 0.25
        tamano_ancho REAL NOT NULL, -- en pulgadas (in)
        tamano_alto REAL NOT NULL, -- en pulgadas (in) (si aplica, ej: 12.0)
        cantidad REAL NOT NULL DEFAULT 0.0, -- cantidad de planchas u hojas / herrajes individuales
        cantidad_minima_alerta REAL NOT NULL DEFAULT 2.0,
        costo_hoja_unidad REAL NOT NULL DEFAULT 0.0, -- precio por hoja o unidad individual
        proveedor TEXT,
        fecha_compra TEXT,
        lote TEXT,
        enlace_compra TEXT,
        foto_url TEXT
    );
    """)
    
    # 2. Tabla de Retazos (Medidas en Pulgadas)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS retazos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        material_id INTEGER NOT NULL,
        tamano_ancho REAL NOT NULL, -- en pulgadas (in)
        tamano_alto REAL NOT NULL, -- en pulgadas (in)
        cantidad REAL NOT NULL DEFAULT 1.0,
        ubicacion TEXT,
        FOREIGN KEY (material_id) REFERENCES materiales (id) ON DELETE CASCADE
    );
    """)
    
    # 3. Tabla de Diseños
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS disenos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        categoria TEXT CHECK(categoria IN ('garitas', 'casitas Viejo San Juan', 'llaveros NFC', 'ornamentos', 'shadow box', 'portadas de libreta', 'productos personalizados')) NOT NULL,
        archivo_diseno TEXT, -- ruta al archivo local SVG/PDF
        fecha_creacion TEXT DEFAULT (datetime('now', 'localtime'))
    );
    """)
    
    # 4. Tabla de Ajustes Láser (Laser Settings)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS laser_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        diseno_id INTEGER NOT NULL,
        material_tipo TEXT NOT NULL, -- madera, acrilico, etc.
        espesor REAL NOT NULL, -- en pulgadas (in)
        velocidad_corte REAL,
        potencia_corte REAL,
        pasadas_corte INTEGER DEFAULT 1,
        velocidad_grabado REAL,
        potencia_grabado REAL,
        pasadas_grabado INTEGER DEFAULT 1,
        tipo_trabajo TEXT CHECK(tipo_trabajo IN ('corte', 'grabado', 'ambos')) NOT NULL DEFAULT 'ambos',
        notas TEXT,
        FOREIGN KEY (diseno_id) REFERENCES disenos (id) ON DELETE CASCADE
    );
    """)
    
    # 5. Tabla de Productos (para costeo y Shopify)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ancho REAL NOT NULL DEFAULT 2.0,
        alto REAL NOT NULL DEFAULT 2.0,
        sku TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        diseno_id INTEGER,
        tiempo_corte REAL NOT NULL DEFAULT 0.0, -- en minutos
        tiempo_grabado REAL NOT NULL DEFAULT 0.0, -- en minutos
        costo_maquina REAL NOT NULL DEFAULT 0.0, -- tiempo * tasa_maquina
        costo_mano_obra REAL NOT NULL DEFAULT 0.0,
        costo_total REAL NOT NULL DEFAULT 0.0, -- sumatoria de materiales + maquina + mano obra
        margen_ganancia REAL NOT NULL DEFAULT 0.5, -- porcentaje (ej: 0.6 = 60%)
        precio_sugerido REAL NOT NULL DEFAULT 0.0,
        precio_final REAL NOT NULL DEFAULT 0.0,
        personalizado INTEGER NOT NULL CHECK(personalizado IN (0, 1)) DEFAULT 0,
        shopify_titulo TEXT,
        shopify_descripcion TEXT,
        shopify_tags TEXT,
        shopify_alt_text TEXT,
        FOREIGN KEY (diseno_id) REFERENCES disenos (id) ON DELETE SET NULL
    );
    """)

    # 6. Tabla de Componentes del Producto (Nueva tabla para desglose detallado)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS componentes_producto (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER NOT NULL,
        material_id INTEGER NOT NULL,
        cantidad_usada REAL NOT NULL, -- in² para maderas/planchas, o unidades (1, 2, etc.) para herrajes y extras
        costo_calculado REAL NOT NULL, -- costo proporcional o directo
        FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE CASCADE,
        FOREIGN KEY (material_id) REFERENCES materiales (id) ON DELETE CASCADE
    );
    """)
    
    # 7. Tabla de Órdenes de Producción
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ordenes_produccion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo_orden TEXT UNIQUE NOT NULL, -- e.g. EVL-1001
        cliente TEXT NOT NULL,
        producto_id INTEGER,
        cantidad INTEGER NOT NULL DEFAULT 1,
        estado TEXT CHECK(estado IN ('Pendiente', 'En diseño', 'Cortando', 'Grabando', 'Pintura/Acabado', 'Listo', 'Entregado')) NOT NULL DEFAULT 'Pendiente',
        material_descontado INTEGER NOT NULL CHECK(material_descontado IN (0, 1)) DEFAULT 0, -- 1 si ya se descontó del inventario
        completado INTEGER NOT NULL DEFAULT 0, -- 1 si el ítem ya se trabajó/completó
        fecha_creacion TEXT DEFAULT (datetime('now', 'localtime')),
        fecha_entrega TEXT,
        FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE SET NULL
    );
    """)
    
    # Migración: asegurar que la columna 'completado' existe en instalaciones previas
    try:
        cursor.execute("ALTER TABLE ordenes_produccion ADD COLUMN completado INTEGER NOT NULL DEFAULT 0")
    except sqlite3.OperationalError:
        pass # La columna ya existía
    
    # 8. Tabla de Evaluaciones Visuales (Antes / Después y Control de Calidad)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS evaluaciones_visuales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orden_id INTEGER NOT NULL,
        foto_antes TEXT,
        foto_despues TEXT,
        problemas TEXT,
        correcciones_aplicadas TEXT,
        estado_aprobacion TEXT CHECK(estado_aprobacion IN ('Aprobado', 'Rechazado')) NOT NULL DEFAULT 'Aprobado',
        fecha_evaluacion TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (orden_id) REFERENCES ordenes_produccion (id) ON DELETE CASCADE
    );
    """)
    
    # 9. Tabla de Fotos Asociadas
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS fotos_asociadas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER,
        orden_id INTEGER,
        tipo_foto TEXT CHECK(tipo_foto IN ('material', 'referencia', 'antes', 'final')) NOT NULL,
        ruta_archivo TEXT NOT NULL,
        nombre_archivo TEXT NOT NULL,
        fecha_registro TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE CASCADE,
        FOREIGN KEY (orden_id) REFERENCES ordenes_produccion (id) ON DELETE CASCADE
    );
    """)

    # 10. Tabla de Clientes B2B
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT UNIQUE NOT NULL,
        contacto TEXT,
        email TEXT,
        telefono TEXT,
        notas TEXT,
        fecha_registro TEXT DEFAULT (datetime('now', 'localtime'))
    );
    """)

    # 11. Tabla de Catálogo de Clientes (Precios Especiales/Productos asignados)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS catalogo_cliente (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        precio_especial REAL NOT NULL,
        notas TEXT,
        FOREIGN KEY (cliente_id) REFERENCES clientes (id) ON DELETE CASCADE,
        FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE CASCADE,
        UNIQUE(cliente_id, producto_id)
    );
    """)

    # 12. Tabla de Facturas
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS facturas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero_factura TEXT UNIQUE NOT NULL,
        cliente_id INTEGER NOT NULL,
        fecha_emision TEXT NOT NULL,
        fecha_vencimiento TEXT,
        fecha_pago TEXT,
        metodo_pago TEXT CHECK(metodo_pago IN ('Efectivo', 'ATH Movil', 'Cheque', 'Tarjeta', 'Transferencia', 'Otro')),
        numero_cheque TEXT,
        subtotal REAL NOT NULL DEFAULT 0.0,
        ivu_estatal REAL NOT NULL DEFAULT 0.0,
        ivu_municipal REAL NOT NULL DEFAULT 0.0,
        total REAL NOT NULL DEFAULT 0.0,
        notas TEXT,
        estado TEXT CHECK(estado IN ('Pendiente', 'Pagada', 'Anulada')) NOT NULL DEFAULT 'Pendiente',
        FOREIGN KEY (cliente_id) REFERENCES clientes (id) ON DELETE RESTRICT
    );
    """)

    # 13. Tabla de Partidas de Factura
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS items_factura (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        factura_id INTEGER NOT NULL,
        producto_id INTEGER,
        nombre_producto TEXT NOT NULL,
        cantidad INTEGER NOT NULL DEFAULT 1,
        precio_unitario REAL NOT NULL DEFAULT 0.0,
        total REAL NOT NULL DEFAULT 0.0,
        FOREIGN KEY (factura_id) REFERENCES facturas (id) ON DELETE CASCADE,
        FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE SET NULL
    );
    """)

    # 13. Tabla de Carrito de Compras
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS carrito (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        producto_id INTEGER NOT NULL,
        cantidad INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE CASCADE
    );
    """)
    
    # Insertar datos semilla si la base de datos está vacía
    cursor.execute("SELECT COUNT(*) FROM materiales")
    if cursor.fetchone()[0] == 0:
        print("Insertando datos semilla con medidas en pulgadas (in) y desglose de componentes...")
        
        # 1. Materiales Semilla (En Pulgadas)
        cursor.executemany("""
        INSERT INTO materiales (nombre, tipo, espesor, tamano_ancho, tamano_alto, cantidad, cantidad_minima_alerta, costo_hoja_unidad, proveedor, fecha_compra, lote)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            ('Basswood (Tilo)', 'madera', 0.125, 12.0, 20.0, 15.0, 2.0, 7.50, 'WoodCraft Co.', '2026-05-15', 'LOTE-BASS-1220'),
            ('Walnut Finished (Nogal Acabado)', 'madera', 0.125, 12.0, 20.0, 10.0, 2.0, 11.00, 'WoodCraft Co.', '2026-05-20', 'LOTE-WAL-FIN'),
            ('Walnut Unfinished (Nogal sin Acabar)', 'madera', 0.125, 12.0, 20.0, 12.0, 2.0, 9.00, 'WoodCraft Co.', '2026-05-20', 'LOTE-WAL-UNF'),
            ('Baltic Birch (Abedul Báltico)', 'madera', 0.125, 12.0, 12.0, 20.0, 3.0, 3.00, 'WoodCraft Co.', '2026-05-20', 'LOTE-BIRCH-1212'),
            ('Acrílico Transparente', 'acrilico', 0.125, 12.0, 12.0, 8.0, 2.0, 12.50, 'Plásticos PR', '2026-05-22', 'LOTE-ACR-1212'),
            ('Anilla de Llavero con Cadena', 'herrajes', 0.0, 1.0, 1.0, 150.0, 20.0, 0.12, 'Amazon Business', '2026-05-01', 'LOTE-KEYRING'),
            ('Borla Decorativa de Cuero (Tassel)', 'herrajes', 0.0, 1.5, 0.5, 80.0, 15.0, 0.15, 'Etsy Wholesale', '2026-05-05', 'LOTE-TASSEL'),
            ('Chip NFC Inteligente NTAG213', 'herrajes', 0.0, 1.0, 1.0, 100.0, 15.0, 0.45, 'NFC Tag Shop', '2026-05-05', 'LOTE-NFC'),
            ('Caja de Regalo Kraft (Empaque)', 'empaques', 0.0, 6.0, 6.0, 50.0, 10.0, 0.35, 'Empaques Eco', '2026-05-01', 'LOTE-BOX-KRAFT')
        ])
        
        # 2. Retazos de madera en pulgadas
        cursor.executemany("""
        INSERT INTO retazos (material_id, tamano_ancho, tamano_alto, cantidad, ubicacion)
        VALUES (?, ?, ?, ?, ?)
        """, [
            (1, 4.0, 10.0, 2.0, 'Estante Madera Retazos A'),
            (2, 6.0, 8.0, 1.0, 'Estante Madera Retazos B')
        ])
        
        # 3. Diseños
        cursor.executemany("""
        INSERT INTO disenos (nombre, categoria, archivo_diseno)
        VALUES (?, ?, ?)
        """, [
            ('Garita del Viejo San Juan', 'garitas', 'garita_clasica.svg'),
            ('Casitas Típicas San Juan', 'casitas Viejo San Juan', 'casitas_viejo_sanjuan.svg'),
            ('Llavero NFC Redondo', 'llaveros NFC', 'llavero_nfc_redondo.svg')
        ])
        
        # 4. Ajustes Láser (Laser Settings en pulgadas)
        cursor.executemany("""
        INSERT INTO laser_settings (diseno_id, material_tipo, espesor, velocidad_corte, potencia_corte, pasadas_corte, velocidad_grabado, potencia_grabado, pasadas_grabado, tipo_trabajo, notas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            (1, 'madera', 0.125, 18.0, 90.0, 1, 80.0, 35.0, 1, 'ambos', 'Walnut/Basswood 1/8". Lijar antes para mejores acabados.'),
            (3, 'madera', 0.125, 20.0, 90.0, 1, 90.0, 40.0, 1, 'ambos', 'Espacio tag NFC grabado a 0.05" de profundidad.')
        ])
        
        # 5. Productos
        cursor.executemany("""
        INSERT INTO productos (id, sku, nombre, diseno_id, ancho, alto, tiempo_corte, tiempo_grabado, costo_maquina, costo_mano_obra, costo_total, margen_ganancia, precio_sugerido, precio_final, personalizado, shopify_titulo, shopify_descripcion, shopify_tags, shopify_alt_text)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            (1, 'SKU-GAR-LLAV-01', 'Llavero de Garita Walnut', 1, 1.5, 2.0, 1.5, 1.0, 0.50, 1.50, 2.45, 0.60, 6.13, 6.50, 0, 
             'Llavero de Madera de Nogal - Garita de Viejo San Juan', 
             'Hermoso llavero de Nogal Acabado (Walnut finished) de 1/8 pulgadas de espesor grabado con la Garita.', 
             'llavero, madera, nogal, garita, artesanal', 'Llavero de madera de nogal grabado con diseño de garita'),
            
            (2, 'SKU-NFC-LLAV-03', 'Llavero NFC Basswood Inteligente', 3, 2.0, 2.0, 1.2, 0.8, 0.40, 2.00, 3.90, 0.65, 11.14, 12.00, 1,
             'Llavero NFC de Madera Rústica - Personalizable', 
             'Llavero inteligente hecho de Basswood (madera de tilo) con chip NFC y borla de cuero decorativa.', 
             'nfc, llavero inteligente, tilo, tecnologia, personalizado', 'Llavero inteligente de tilo con chip NFC')
        ])

        # 6. Componentes del Producto (Desglose de cada parte)
        # Producto 1: Llavero de Garita Walnut
        # - Madera Walnut Finished (id=2): utiliza 3 in² (llavero de 1.5x2"). Costo proporcional = (3/240) * $11.00 = $0.1375 + desperdicio = $0.15
        # - Anilla (id=5): 1 unidad. Costo = $0.12
        # - Borla (id=6): 1 unidad. Costo = $0.15
        # Total material = $0.42 + Máquina ($0.50) + Mano de Obra ($1.50) = Costo Total $2.42
        
        # Producto 2: Llavero NFC Basswood
        # - Madera Basswood (id=1): utiliza 4 in² (llavero de 2x2"). Costo proporcional = (4/240) * $7.50 = $0.125
        # - Anilla (id=5): 1 unidad. Costo = $0.12
        # - Borla (id=6): 1 unidad. Costo = $0.15
        # - Chip NFC (id=7): 1 unidad. Costo = $0.45
        # - Caja Kraft (id=8): 1 unidad. Costo = $0.35
        # Total material = $1.195 + Máquina ($0.40) + Mano de Obra ($2.00) = Costo Total $3.595 (redondeado)
        cursor.executemany("""
        INSERT INTO componentes_producto (producto_id, material_id, cantidad_usada, costo_calculado)
        VALUES (?, ?, ?, ?)
        """, [
            (1, 2, 3.0, 0.15),  # Madera Walnut Finished
            (1, 5, 1.0, 0.12),  # Anilla
            (1, 6, 1.0, 0.15),  # Borla
            
            (2, 1, 4.0, 0.13),  # Madera Basswood
            (2, 5, 1.0, 0.12),  # Anilla
            (2, 6, 1.0, 0.15),  # Borla
            (2, 7, 1.0, 0.45),  # Chip NFC
            (2, 8, 1.0, 0.35)   # Caja Kraft
        ])
        
        # 7. Órdenes de Producción
        cursor.executemany("""
        INSERT INTO ordenes_produccion (codigo_orden, cliente, producto_id, cantidad, estado, material_descontado, fecha_creacion, fecha_entrega)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            ('EVL-1001', 'Sofía Méndez', 1, 5, 'Pendiente', 0, '2026-06-01 10:30:00', '2026-06-05'),
            ('EVL-1002', 'Restaurante El Morro', 2, 20, 'Cortando', 1, '2026-06-01 11:15:00', '2026-06-08')
        ])

        # 8. Clientes Semilla B2B
        cursor.execute("SELECT COUNT(*) FROM clientes")
        if cursor.fetchone()[0] == 0:
            cursor.executemany("""
            INSERT INTO clientes (nombre, contacto, email, telefono, notas)
            VALUES (?, ?, ?, ?, ?)
            """, [
                ('Restaurante El Morro', 'Carlos Rivera (Gerente)', 'carlos@elmorro.com', '787-555-1234', 'Cliente B2B recurrente para llaveros NFC de mesa.'),
                ('Hotel Convento', 'María Delgado (Eventos)', 'maria@convento.com', '787-555-5678', 'Interesados en grabado de posavasos y llaveros premium.')
            ])
            
            # Asignar producto 2 (Llavero NFC Basswood) al cliente 1 (Restaurante El Morro) con un precio pactado especial de 10.00
            cursor.execute("""
            INSERT INTO catalogo_cliente (cliente_id, producto_id, precio_especial, notas)
            VALUES (1, 2, 10.00, 'Precio al por mayor pactado para lote de 50+ unidades.')
            """)

            # 9. Facturas Semilla B2B
            cursor.execute("""
            INSERT INTO facturas (numero_factura, cliente_id, fecha_emision, fecha_vencimiento, fecha_pago, metodo_pago, subtotal, ivu_estatal, ivu_municipal, total, notas, estado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, ('EV-2026-0001', 1, '2026-06-01', '2026-06-15', '2026-06-01', 'ATH Movil', 200.00, 21.00, 2.00, 223.00, 'Primer lote de 20 llaveros NFC', 'Pagada'))
            factura_id = cursor.lastrowid
            
            cursor.execute("""
            INSERT INTO items_factura (factura_id, producto_id, nombre_producto, cantidad, precio_unitario, total)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (factura_id, 2, 'Llavero NFC Basswood Inteligente', 20, 10.00, 200.00))
 
            cursor.execute("""
            INSERT INTO facturas (numero_factura, cliente_id, fecha_emision, fecha_vencimiento, fecha_pago, metodo_pago, subtotal, ivu_estatal, ivu_municipal, total, notas, estado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, ('EV-2026-0002', 2, '2026-06-02', '2026-06-16', None, None, 130.00, 13.65, 1.30, 144.95, 'Posavasos y llaveros de muestra', 'Pendiente'))
            factura_id2 = cursor.lastrowid
            
            cursor.execute("""
            INSERT INTO items_factura (factura_id, producto_id, nombre_producto, cantidad, precio_unitario, total)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (factura_id2, 1, 'Llavero de Garita Walnut', 20, 6.50, 130.00))
        
    # Migración segura: agregar columnas ancho/alto si no existen en la BD actual
    try:
        cursor.execute("ALTER TABLE productos ADD COLUMN ancho REAL NOT NULL DEFAULT 2.0")
        print("Columna 'ancho' añadida a productos.")
    except Exception:
        pass  # Ya existe
    try:
        cursor.execute("ALTER TABLE productos ADD COLUMN alto REAL NOT NULL DEFAULT 2.0")
        print("Columna 'alto' añadida a productos.")
    except Exception:
        pass  # Ya existe

    # Migración segura: agregar columna monto_pagado a facturas si no existe
    try:
        cursor.execute("ALTER TABLE facturas ADD COLUMN monto_pagado REAL")
        print("Columna 'monto_pagado' añadida a facturas.")
    except Exception:
        pass  # Ya existe

    # Migración segura: agregar columna notificado a facturas si no existe
    try:
        cursor.execute("ALTER TABLE facturas ADD COLUMN notificado INTEGER DEFAULT 0")
        print("Columna 'notificado' añadida a facturas.")
    except Exception:
        pass  # Ya existe

    # Migración segura: agregar columna metodo_pago a facturas si no existe
    try:
        cursor.execute("ALTER TABLE facturas ADD COLUMN metodo_pago TEXT")
        print("Columna 'metodo_pago' añadida a facturas.")
    except Exception:
        pass  # Ya existe

    conn.commit()
    conn.close()
    print("Base de datos reconstruida exitosamente con las unidades en pulgadas y desglose de componentes.")

if __name__ == "__main__":
    init_db(force_reset=True)
