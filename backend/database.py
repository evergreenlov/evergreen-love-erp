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
        monto_pagado REAL,
        notificado INTEGER DEFAULT 0,
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

    # 14. Tabla de Gastos Operativos
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS gastos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        concepto TEXT NOT NULL,
        categoria TEXT NOT NULL,
        monto REAL NOT NULL,
        fecha TEXT NOT NULL,
        metodo_pago TEXT,
        notas TEXT
    );
    """)

    # 15. Tabla de Usuarios Administradores
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        rol TEXT CHECK(rol IN ('admin', 'superadmin')) NOT NULL DEFAULT 'admin',
        password_hash TEXT NOT NULL,
        activo INTEGER NOT NULL DEFAULT 1,
        fecha_creacion TEXT DEFAULT (datetime('now', 'localtime')),
        ultimo_acceso TEXT
    );
    """)
    
    # Insertar datos semilla si la base de datos está vacía o solo contiene los dos productos de prueba
    cursor.execute("SELECT COUNT(*) FROM productos")
    if cursor.fetchone()[0] <= 2:
        import json
        seed_file = os.path.join(os.path.dirname(__file__), "db_seed.json")
        if os.path.exists(seed_file):
            print("🔌 Cargando base de datos completa desde db_seed.json...")
            try:
                with open(seed_file, "r", encoding="utf-8") as f:
                    seed_data = json.load(f)
                
                # Desactivar claves foráneas temporalmente para la inserción limpia
                cursor.execute("PRAGMA foreign_keys = OFF;")
                
                tablas_a_limpiar = [
                    'items_factura', 'facturas', 'ordenes_produccion', 'catalogo_cliente', 
                    'clientes', 'componentes_producto', 'productos', 'laser_settings', 
                    'disenos', 'retazos', 'materiales', 'gastos'
                ]
                for t in tablas_a_limpiar:
                    cursor.execute(f"DELETE FROM {t}")
                
                # Poblar ordenadamente
                tablas_orden = [
                    'materiales', 'retazos', 'disenos', 'laser_settings', 
                    'productos', 'componentes_producto', 'clientes', 
                    'catalogo_cliente', 'ordenes_produccion', 'facturas', 'items_factura', 'gastos'
                ]
                for table in tablas_orden:
                    rows = seed_data.get(table, [])
                    if not rows:
                        continue
                    columns = rows[0].keys()
                    placeholders = ", ".join(["?"] * len(columns))
                    sql = f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders})"
                    
                    data_tuples = [tuple(r[col] for col in columns) for r in rows]
                    cursor.executemany(sql, data_tuples)
                    print(f"  - Importada tabla '{table}': {len(rows)} filas.")
                
                cursor.execute("PRAGMA foreign_keys = ON;")
                print("✅ Base de datos cargada con éxito desde db_seed.json!")
            except Exception as e:
                print(f"⚠️ Error al cargar db_seed.json: {str(e)}")
        else:
            print("⚠️ Archivo db_seed.json no encontrado para el sembrado inicial.")
        
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

    # Migración segura: agregar columnas PIN a clientes si no existen
    try:
        cursor.execute("ALTER TABLE clientes ADD COLUMN pin_hash TEXT")
        print("Columna 'pin_hash' añadida a clientes.")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE clientes ADD COLUMN pin_display TEXT")
        print("Columna 'pin_display' añadida a clientes.")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE clientes ADD COLUMN codigo_b2b TEXT")
        print("Columna 'codigo_b2b' añadida a clientes.")
    except Exception:
        pass
    try:
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_codigo_b2b ON clientes(codigo_b2b)")
        print("Índice único 'codigo_b2b' creado.")
    except Exception:
        pass

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

    try:
        cursor.execute("ALTER TABLE gastos ADD COLUMN recibo_ruta TEXT")
        print("Columna 'recibo_ruta' añadida a gastos.")
    except Exception:
        pass  # Ya existe

    try:
        cursor.execute("ALTER TABLE gastos ADD COLUMN proveedor TEXT")
        print("Columna 'proveedor' añadida a gastos.")
    except Exception:
        pass  # Ya existe

    # 16. Tabla de Cotizaciones
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cotizaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
        nombre_cliente TEXT NOT NULL,
        email TEXT NOT NULL,
        telefono TEXT,
        descripcion TEXT NOT NULL,
        presupuesto_aprox REAL,
        estado TEXT CHECK(estado IN ('nueva','en_revision','cotizada','aprobada','rechazada'))
            NOT NULL DEFAULT 'nueva',
        fuente TEXT DEFAULT 'publico',
        cliente_b2b_id INTEGER,
        notas_internas TEXT,
        fecha_creacion TEXT DEFAULT (datetime('now','localtime')),
        fecha_actualizado TEXT DEFAULT (datetime('now','localtime'))
    );
    """)

    # 17. Tabla de Imágenes de Cotizaciones
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cotizacion_imagenes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cotizacion_id INTEGER NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
        nombre_archivo TEXT NOT NULL,
        fecha_subida TEXT DEFAULT (datetime('now','localtime'))
    );
    """)

    # Migración: cotizaciones.orden_produccion_id → enlace a la orden generada
    try:
        cursor.execute("ALTER TABLE cotizaciones ADD COLUMN orden_produccion_id INTEGER")
        print("Columna 'orden_produccion_id' añadida a cotizaciones.")
    except Exception:
        pass  # Ya existe

    # Migraciones: Motor de Estimación de Precio en Cotizaciones
    for col, tipo in [
        ("costo_estimado",  "REAL"),
        ("precio_estimado", "REAL"),
        ("margen_estimado", "REAL"),
        ("notas_estimacion","TEXT"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE cotizaciones ADD COLUMN {col} {tipo}")
            print(f"Columna '{col}' añadida a cotizaciones.")
        except Exception:
            pass  # Ya existe

    # Migración: ordenes_produccion.cotizacion_id → origen de la orden
    try:
        cursor.execute("ALTER TABLE ordenes_produccion ADD COLUMN cotizacion_id INTEGER")
        print("Columna 'cotizacion_id' añadida a ordenes_produccion.")
    except Exception:
        pass  # Ya existe

    # Migración: ordenes_produccion.notas → descripción/notas del proyecto
    try:
        cursor.execute("ALTER TABLE ordenes_produccion ADD COLUMN notas TEXT")
        print("Columna 'notas' añadida a ordenes_produccion.")
    except Exception:
        pass  # Ya existe

    # Migración: ordenes_produccion.cliente_b2b_id → cliente B2B que originó la orden
    try:
        cursor.execute("ALTER TABLE ordenes_produccion ADD COLUMN cliente_b2b_id INTEGER")
        print("Columna 'cliente_b2b_id' añadida a ordenes_produccion.")
    except Exception:
        pass  # Ya existe

    # Migración: ordenes_produccion.pedido_b2b_id → agrupa órdenes del mismo pedido B2B
    try:
        cursor.execute("ALTER TABLE ordenes_produccion ADD COLUMN pedido_b2b_id TEXT")
        print("Columna 'pedido_b2b_id' añadida a ordenes_produccion.")
    except Exception:
        pass  # Ya existe

    # Migración: factura ↔ orden — vínculo formal bidireccional
    try:
        cursor.execute("ALTER TABLE facturas ADD COLUMN orden_produccion_id INTEGER")
        print("Columna 'orden_produccion_id' añadida a facturas.")
    except Exception:
        pass  # Ya existe

    try:
        cursor.execute("ALTER TABLE facturas ADD COLUMN codigo_orden TEXT")
        print("Columna 'codigo_orden' añadida a facturas.")
    except Exception:
        pass  # Ya existe

    try:
        cursor.execute("ALTER TABLE ordenes_produccion ADD COLUMN factura_id INTEGER")
        print("Columna 'factura_id' añadida a ordenes_produccion.")
    except Exception:
        pass  # Ya existe

    # Tabla de configuración global (fila única)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS configuracion (
        id INTEGER PRIMARY KEY DEFAULT 1 CHECK(id = 1),
        tarifa_hora_laser REAL NOT NULL DEFAULT 15.0,
        tarifa_hora_labor REAL NOT NULL DEFAULT 18.0
    );
    """)
    cursor.execute("""
    INSERT OR IGNORE INTO configuracion (id, tarifa_hora_laser, tarifa_hora_labor)
    VALUES (1, 15.0, 18.0)
    """)

    # Migraciones Motor de Costeo Inteligente
    try:
        cursor.execute("ALTER TABLE productos ADD COLUMN tipo_producto TEXT")
        print("Columna 'tipo_producto' añadida a productos.")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE productos ADD COLUMN capas INTEGER DEFAULT 1")
        print("Columna 'capas' añadida a productos.")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE productos ADD COLUMN complejidad TEXT DEFAULT 'simple'")
        print("Columna 'complejidad' añadida a productos.")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE productos ADD COLUMN tiempo_pintura REAL DEFAULT 0.0")
        print("Columna 'tiempo_pintura' añadida a productos.")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE productos ADD COLUMN tiempo_ensamblaje REAL DEFAULT 0.0")
        print("Columna 'tiempo_ensamblaje' añadida a productos.")
    except Exception:
        pass

    # Migraciones Resina en productos
    for col, defn in [
        ("usa_resina",               "INTEGER DEFAULT 0"),
        ("cantidad_resina_ml",       "REAL DEFAULT 0.0"),
        ("costo_resina_por_ml",      "REAL DEFAULT 0.0"),
        ("tiempo_resina_min",        "REAL DEFAULT 0.0"),   # legacy, mapea a activo
        ("tiempo_resina_activo_min", "REAL DEFAULT 0.0"),
        ("tiempo_resina_curado_min", "REAL DEFAULT 0.0"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE productos ADD COLUMN {col} {defn}")
            print(f"Columna '{col}' añadida a productos.")
        except Exception:
            pass

    # Migración: cotizaciones.fecha_actualizado (puede faltar en tablas antiguas)
    try:
        cursor.execute("ALTER TABLE cotizaciones ADD COLUMN fecha_actualizado TEXT DEFAULT (datetime('now','localtime'))")
        print("Columna 'fecha_actualizado' añadida a cotizaciones.")
    except Exception:
        pass

    # Crear carpeta de recibos si no existe
    import os as _os
    _recibos_dir = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), "..", "data", "recibos_gastos"))
    _os.makedirs(_recibos_dir, exist_ok=True)

    # Crear carpeta de imágenes de cotizaciones
    _cotiz_dir = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), "..", "data", "cotizaciones"))
    _os.makedirs(_cotiz_dir, exist_ok=True)

    conn.commit()
    conn.close()
    print("Base de datos reconstruida exitosamente con las unidades en pulgadas y desglose de componentes.")

def bootstrap_admin():
    """
    Crea el primer superadmin desde variables de entorno si la tabla usuarios está vacía.
    Solo se ejecuta una vez. Después de crear el primer admin, las vars de entorno
    ADMIN_EMAIL y ADMIN_PASSWORD pueden eliminarse del servidor.
    """
    import os
    import bcrypt as _bcrypt

    email = os.environ.get("ADMIN_EMAIL", "").strip()
    password = os.environ.get("ADMIN_PASSWORD", "").strip()

    if not email or not password:
        return

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM usuarios")
    count = cursor.fetchone()[0]

    if count == 0:
        password_hash = _bcrypt.hashpw(password.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")
        try:
            cursor.execute(
                "INSERT INTO usuarios (email, nombre, rol, password_hash) VALUES (?, ?, 'superadmin', ?)",
                (email, "Administrador", password_hash)
            )
            conn.commit()
            print(f"✅ Primer superadmin creado: {email}")
        except Exception as e:
            print(f"⚠️ Error al crear superadmin bootstrap: {str(e)}")
    else:
        print(f"ℹ️ Tabla usuarios ya tiene {count} registro(s). Bootstrap omitido.")

    conn.close()


if __name__ == "__main__":
    init_db(force_reset=True)
