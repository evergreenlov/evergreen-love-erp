import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import sqlite3

from database import get_db_connection, init_db, bootstrap_admin
from utils.photo_scanner import scan_and_index_photos
from utils.backup import create_backup
from routes import materiales
from routes import costos
from routes import produccion
from routes import disenos
from routes import fotos
from routes import shopify
from routes import carrito
from routes import clientes
from routes import facturas
from routes import auth
from routes import backups


app = FastAPI(
    title="Evergreen Love - Sistema de Gestión Láser",
    description="Backend para control de inventario, costos, diseños y órdenes de producción láser.",
    version="1.0.0"
)

app.include_router(auth.router)
app.include_router(backups.router)
app.include_router(materiales.router)
app.include_router(costos.router)
app.include_router(produccion.router)
app.include_router(disenos.router)
app.include_router(fotos.router)
app.include_router(shopify.router)
app.include_router(carrito.router)
app.include_router(clientes.router)
app.include_router(facturas.router)

# Configurar CORS para permitir peticiones desde el frontend en desarrollo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializar base de datos al arrancar
@app.on_event("startup")
def startup_event():
    init_db()
    bootstrap_admin()
    try:
        backup_path = create_backup()
        print(f"✅ Respaldo automático creado: {os.path.basename(backup_path)}")
    except Exception as e:
        print(f"⚠️ Error al crear respaldo automático: {str(e)}")
    # Copiar fotos semilla desde frontend/fotos_import a data/fotos_import en el disco persistente
    try:
        import shutil
        src_dir = os.path.join(FRONTEND_DIR, "fotos_import")
        dst_dir = FOTOS_IMPORT_DIR
        if os.path.exists(src_dir):
            for file_name in os.listdir(src_dir):
                src_file = os.path.join(src_dir, file_name)
                dst_file = os.path.join(dst_dir, file_name)
                if os.path.isfile(src_file) and not os.path.exists(dst_file):
                    shutil.copy2(src_file, dst_file)
            print("✅ Fotos semilla copiadas al disco persistente.")
    except Exception as e:
        print(f"⚠️ Error al copiar fotos semilla: {str(e)}")

    try:
        scan_and_index_photos()
        print("✅ Fotos escaneadas e indexadas exitosamente al iniciar.")
    except Exception as e:
        print(f"⚠️ Error al indexar fotos en el startup: {str(e)}")

# Ruta de diagnóstico de la API
@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "Evergreen Love API",
        "database": "connected"
    }

@app.get("/api/diagnostic")
def diagnostic():
    import os
    backend_dir = os.path.dirname(__file__)
    files = []
    try:
        files = os.listdir(backend_dir)
    except Exception as e:
        files = str(e)
    
    db_file_exists = os.path.exists(os.path.join(backend_dir, "db_seed.json"))
    
    # Intentar ejecutar init_db() para forzar el sembrado si no se ha hecho
    seeding_result = "No running"
    try:
        from database import init_db
        init_db()
        seeding_result = "Ran init_db()"
    except Exception as e:
        seeding_result = f"Error running init_db: {str(e)}"
        
    return {
        "current_dir": backend_dir,
        "files_in_backend": files,
        "db_seed_exists": db_file_exists,
        "seeding_result": seeding_result
    }

# Endpoint para verificar el estado de la base de datos y contar registros
@app.get("/api/db_status")
def db_status():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        status = {}
        tables = ['materiales', 'retazos', 'disenos', 'laser_settings', 'productos', 'ordenes_produccion', 'evaluaciones_visuales', 'fotos_asociadas', 'clientes', 'catalogo_cliente', 'facturas', 'items_factura']
        for table in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            status[table] = cursor.fetchone()[0]
            
        conn.close()
        return {
            "status": "success",
            "counts": status
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

# Endpoint básico para listar materiales (utilizado para pruebas en Fase 1)
@app.get("/api/test_materiales")
def test_materiales():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM materiales")
        rows = cursor.fetchall()
        materiales = [dict(row) for row in rows]
        conn.close()
        return {
            "status": "success",
            "data": materiales
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

# Servir archivos estáticos del frontend y adjuntos
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
ADJUNTOS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "adjuntos"))
FOTOS_IMPORT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "fotos_import"))

# Montar los subdirectorios del frontend
if os.path.exists(os.path.join(FRONTEND_DIR, "css")):
    app.mount("/css", StaticFiles(directory=os.path.join(FRONTEND_DIR, "css")), name="css")
if os.path.exists(os.path.join(FRONTEND_DIR, "js")):
    app.mount("/js", StaticFiles(directory=os.path.join(FRONTEND_DIR, "js")), name="js")
if os.path.exists(os.path.join(FRONTEND_DIR, "img")):
    app.mount("/img", StaticFiles(directory=os.path.join(FRONTEND_DIR, "img")), name="img")

# Montar carpeta de adjuntos láser y fotos locales
os.makedirs(ADJUNTOS_DIR, exist_ok=True)
os.makedirs(FOTOS_IMPORT_DIR, exist_ok=True)
app.mount("/adjuntos", StaticFiles(directory=ADJUNTOS_DIR), name="adjuntos")
app.mount("/fotos_import", StaticFiles(directory=FOTOS_IMPORT_DIR), name="fotos_import")

# Servir el index.html principal en la ruta raíz y también como /index.html
@app.get("/")
@app.get("/index.html")
def read_root():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Frontend index.html no encontrado. Asegúrese de que la carpeta frontend/ esté creada."}

# Servir el catálogo público de clientes
@app.get("/catalogo_publico.html")
@app.get("/publico")
def read_catalogo_publico():
    path = os.path.join(FRONTEND_DIR, "catalogo_publico.html")
    if os.path.exists(path):
        return FileResponse(path)
    return {"message": "catalogo_publico.html no encontrado"}

# Servir manifest.json para PWA
@app.get("/manifest.json")
def read_manifest():
    path = os.path.join(FRONTEND_DIR, "manifest.json")
    if os.path.exists(path):
        return FileResponse(path, media_type="application/json")
    return {"message": "manifest.json no encontrado"}

# Servir sw.js para PWA
@app.get("/sw.js")
def read_sw():
    path = os.path.join(FRONTEND_DIR, "sw.js")
    if os.path.exists(path):
        return FileResponse(path, media_type="application/javascript")
    return {"message": "sw.js no encontrado"}

# Servir el portal B2B de pedidos
@app.get("/catalogo_b2b.html")
@app.get("/b2b")
def read_catalogo_b2b():
    path = os.path.join(FRONTEND_DIR, "catalogo_b2b.html")
    if os.path.exists(path):
        return FileResponse(path)
    return {"message": "catalogo_b2b.html no encontrado"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
