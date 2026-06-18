import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.openapi.utils import get_openapi
import sqlite3

from database import get_db_connection, init_db, bootstrap_admin
from auth import get_current_admin
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
from routes import cotizaciones
from routes import dashboard
from routes import b2b
from routes import personalizacion
from routes import galeria


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
app.include_router(cotizaciones.router)
app.include_router(dashboard.router)
app.include_router(b2b.router)
app.include_router(personalizacion.router)
app.include_router(galeria.router)

# Orígenes permitidos: leer desde variable de entorno, con fallback para desarrollo local
_raw_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:8000,http://127.0.0.1:8000,http://192.168.86.30:8000,https://evergreen-love-erp.pages.dev,https://evergreen-love-erp.onrender.com"
)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# Inicializar base de datos al arrancar
@app.on_event("startup")
def startup_event():
    import traceback as _tb

    try:
        init_db()
        print("✅ Base de datos inicializada.")
    except Exception as e:
        print(f"❌ ERROR en init_db: {e}")
        _tb.print_exc()

    try:
        bootstrap_admin()
    except Exception as e:
        print(f"❌ ERROR en bootstrap_admin: {e}")
        _tb.print_exc()

    # Diagnóstico: rutas de cotizaciones registradas
    cotiz_routes = [(r.path, list(getattr(r, 'methods', []))) for r in app.routes if hasattr(r, 'path') and 'cotizacion' in r.path]
    print("📋 Rutas cotizaciones registradas:", cotiz_routes)

    try:
        backup_path = create_backup()
        print(f"✅ Respaldo automático creado: {os.path.basename(backup_path)}")
    except Exception as e:
        print(f"⚠️ Error al crear respaldo automático: {str(e)}")

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

# Endpoint para verificar el estado de la base de datos y contar registros
@app.get("/api/db_status")
def db_status(current_user: dict = Depends(get_current_admin)):
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

# ── Resolución de DATA_DIR con fallback automático ──────────────────────────
# En producción (Render): establecer DATA_DIR al Mount Path exacto del disco persistente.
# Si la ruta no existe o no tiene permisos de escritura, cae al directorio local del proyecto.
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
_LOCAL_DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))

def _resolve_data_dir() -> str:
    candidate = os.environ.get("DATA_DIR", "").strip()
    if candidate:
        try:
            os.makedirs(candidate, exist_ok=True)
            # Verificar escritura real
            _probe = os.path.join(candidate, ".write_test")
            with open(_probe, "w") as _f:
                _f.write("ok")
            os.remove(_probe)
            print(f"[main] Usando DATA_DIR persistente: {candidate}")
            return candidate
        except Exception as _e:
            print(f"[main] DATA_DIR '{candidate}' no accesible ({_e}). Usando directorio local.")
    os.makedirs(_LOCAL_DATA_DIR, exist_ok=True)
    print(f"[main] Usando DATA_DIR local: {_LOCAL_DATA_DIR}")
    return _LOCAL_DATA_DIR

DATA_DIR = _resolve_data_dir()

def _ensure_dir(subdir: str) -> str:
    """Crea DATA_DIR/subdir y lo devuelve. Nunca crashea."""
    path = os.path.join(DATA_DIR, subdir)
    try:
        os.makedirs(path, exist_ok=True)
    except Exception as _e:
        print(f"[main] Advertencia: no se pudo crear {path}: {_e}")
    return path

FOTOS_IMPORT_DIR          = _ensure_dir("fotos_import")
ADJUNTOS_DIR              = _ensure_dir("adjuntos")
COTIZACIONES_IMGS_DIR     = _ensure_dir("cotizaciones")
PERSONALIZACION_ARCHIVOS_DIR = _ensure_dir("personalizacion_archivos")

# ── Montar subdirectorios del frontend ───────────────────────────────────────
if os.path.exists(os.path.join(FRONTEND_DIR, "css")):
    app.mount("/css", StaticFiles(directory=os.path.join(FRONTEND_DIR, "css")), name="css")
if os.path.exists(os.path.join(FRONTEND_DIR, "js")):
    app.mount("/js", StaticFiles(directory=os.path.join(FRONTEND_DIR, "js")), name="js")
if os.path.exists(os.path.join(FRONTEND_DIR, "img")):
    app.mount("/img", StaticFiles(directory=os.path.join(FRONTEND_DIR, "img")), name="img")

# ── Montar carpetas de datos ──────────────────────────────────────────────────
app.mount("/adjuntos",                StaticFiles(directory=ADJUNTOS_DIR),               name="adjuntos")
app.mount("/fotos_import",            StaticFiles(directory=FOTOS_IMPORT_DIR),           name="fotos_import")
app.mount("/cotizaciones_imgs",       StaticFiles(directory=COTIZACIONES_IMGS_DIR),      name="cotizaciones_imgs")
app.mount("/personalizacion_archivos",StaticFiles(directory=PERSONALIZACION_ARCHIVOS_DIR),name="personalizacion_archivos")

# Fotos con fondo removido (rembg)
if os.path.exists("/Volumes/MYRIAM SEAG/evergreen-love"):
    CATALOGO_TRANSPARENTE_DIR = "/Volumes/MYRIAM SEAG/evergreen-love/data/catalogo_transparente"
    REMBG_MODELS_DIR = "/Volumes/MYRIAM SEAG/rembg_models"
else:
    CATALOGO_TRANSPARENTE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "catalogo_transparente"))
    REMBG_MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "rembg_models"))

os.makedirs(CATALOGO_TRANSPARENTE_DIR, exist_ok=True)
os.makedirs(REMBG_MODELS_DIR, exist_ok=True)
app.mount("/catalogo_transparente", StaticFiles(directory=CATALOGO_TRANSPARENTE_DIR), name="catalogo_transparente")

# Galería de imágenes de productos
PRODUCTO_GALERIA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "producto_galeria"))
os.makedirs(PRODUCTO_GALERIA_DIR, exist_ok=True)
app.mount("/producto_galeria", StaticFiles(directory=PRODUCTO_GALERIA_DIR), name="producto_galeria")

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

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    # Reemplaza OAuth2 por BearerAuth simple para que Swagger acepte pegar el token
    schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Pega aquí el token obtenido de POST /api/auth/admin/login (sin el prefijo 'Bearer')",
        }
    }
    for path in schema.get("paths", {}).values():
        for operation in path.values():
            if "security" in operation:
                operation["security"] = [{"BearerAuth": []}]
    app.openapi_schema = schema
    return schema

app.openapi = custom_openapi

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
