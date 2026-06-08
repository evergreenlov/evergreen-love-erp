#!/usr/bin/env python3
import sqlite3
import json
import re
import os
import datetime

def sync():
    db_path = 'data/evergreen.db'
    api_js_path = 'frontend/js/api.js'

    if not os.path.exists(db_path):
        print(f"Error: No se encontró la base de datos en {db_path}")
        return

    if not os.path.exists(api_js_path):
        print(f"Error: No se encontró api.js en {api_js_path}")
        return

    print("🔌 Conectando a la base de datos SQLite...")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Mapeo de tablas de SQLite a claves del frontend (SEED_DATA)
    table_mapping = {
        'materiales': 'materiales',
        'retazos': 'retazos',
        'disenos': 'disenos',
        'laser_settings': 'laser_settings',
        'productos': 'productos',
        'componentes_producto': 'componentes_producto',
        'ordenes_produccion': 'ordenes',  # Mapeado a ordenes
        'clientes': 'clientes',
        'catalogo_cliente': 'catalogo_cliente',
        'facturas': 'facturas',
        'items_factura': 'items_factura',
        'carrito': 'carrito'
    }

    seed_data = {}

    for sqlite_table, frontend_key in table_mapping.items():
        try:
            cursor.execute(f"SELECT * FROM {sqlite_table}")
            rows = cursor.fetchall()
            seed_data[frontend_key] = [dict(row) for row in rows]
            print(f"  - Tabla '{sqlite_table}' -> '{frontend_key}': {len(rows)} filas exportadas.")
        except Exception as e:
            print(f"  ⚠️ Error al leer tabla {sqlite_table}: {e}")
            seed_data[frontend_key] = []

    conn.close()

    # Formatear a JSON con sangría
    json_data = json.dumps(seed_data, indent=8, ensure_ascii=False)
    
    # Leer el archivo api.js
    with open(api_js_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Crear una nueva versión basada en la fecha y hora actual
    new_version = datetime.datetime.now().strftime("%Y-%m-%d-%H%M%S")
    version_line = f'    const OFFLINE_DB_VERSION = "{new_version}";'

    # Buscar y reemplazar el bloque SEED_DATA
    # El bloque comienza con: const SEED_DATA = {
    # y termina con: }; antes de la función initDB()
    # Usaremos una expresión regular robusta
    pattern = r'const SEED_DATA = \{.*?\};(\s*\r?\n\s*function initDB\(\))'
    
    # Vamos a verificar si const OFFLINE_DB_VERSION ya existe
    if 'const OFFLINE_DB_VERSION =' in content:
        content = re.sub(r'const OFFLINE_DB_VERSION = ".*?";', f'const OFFLINE_DB_VERSION = "{new_version}";', content)
    else:
        # Insertarlo justo arriba de SEED_DATA
        content = re.sub(r'const SEED_DATA =', f'const OFFLINE_DB_VERSION = "{new_version}";\n    const SEED_DATA =', content)

    # Reemplazar el bloque de SEED_DATA
    new_seed_block = f"const SEED_DATA = {json_data};"
    
    # Usar búsqueda por regex para reemplazar SEED_DATA completo
    match = re.search(r'const SEED_DATA = \{.*?\};(\s*\r?\n\s*function initDB\(\))', content, re.DOTALL)
    if match:
        content = content[:match.start()] + new_seed_block + match.group(1) + content[match.end():]
        print("✅ Bloque SEED_DATA actualizado en api.js")
    else:
        # Intento alternativo con patrón más amplio
        print("⚠️ No se pudo usar regex para reemplazar SEED_DATA, intentando reemplazo simple por líneas...")
        # Buscaremos líneas entre "const SEED_DATA = {" y "};"
        # que precedan inmediatamente a "function initDB()"
        lines = content.splitlines()
        start_idx = -1
        end_idx = -1
        for i, line in enumerate(lines):
            if 'const SEED_DATA = {' in line:
                start_idx = i
            elif '};' in line and start_idx != -1 and i < start_idx + 100: # límite razonable para el seed original
                # Verificar si las siguientes líneas contienen initDB
                following = "\n".join(lines[i+1:i+10])
                if 'function initDB()' in following:
                    end_idx = i
                    break
        
        if start_idx != -1 and end_idx != -1:
            lines[start_idx:end_idx+1] = [new_seed_block]
            content = "\n".join(lines)
            print("✅ Bloque SEED_DATA actualizado por rango de líneas")
        else:
            print("❌ ERROR: No se encontró el bloque SEED_DATA en api.js para reemplazar.")
            return

    # Ahora modifiquemos la función initDB en api.js para que maneje la versión
    # Busquemos si initDB ya tiene el chequeo de versión
    init_db_pattern = r'function initDB\(\) \{\s*if \(initialized\) return;'
    
    with open(api_js_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f"🎉 Sincronización offline completada con éxito. Versión de base de datos offline: {new_version}")

if __name__ == '__main__':
    sync()
