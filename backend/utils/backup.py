import gzip
import os
import shutil
from datetime import datetime

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "evergreen.db"))
BACKUP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "backups"))
MAX_BACKUPS = int(os.environ.get("MAX_BACKUPS", "10"))


def create_backup() -> str:
    """
    Crea una copia comprimida de evergreen.db en data/backups/.
    Retorna la ruta absoluta del archivo creado.
    Mantiene solo los últimos MAX_BACKUPS respaldos.
    """
    os.makedirs(BACKUP_DIR, exist_ok=True)

    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(f"Base de datos no encontrada: {DB_PATH}")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"evergreen_{timestamp}.db.gz"
    backup_path = os.path.join(BACKUP_DIR, backup_filename)

    with open(DB_PATH, "rb") as f_in:
        with gzip.open(backup_path, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)

    _purge_old_backups()
    return backup_path


def list_backups() -> list:
    """Devuelve lista de respaldos ordenada del más reciente al más antiguo."""
    os.makedirs(BACKUP_DIR, exist_ok=True)
    files = []
    for name in sorted(os.listdir(BACKUP_DIR), reverse=True):
        if name.endswith(".db.gz"):
            full_path = os.path.join(BACKUP_DIR, name)
            stat = os.stat(full_path)
            files.append({
                "filename": name,
                "size_kb": round(stat.st_size / 1024, 1),
                "fecha": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
            })
    return files


def _purge_old_backups():
    """Elimina los respaldos más antiguos si se supera MAX_BACKUPS."""
    files = sorted(
        [f for f in os.listdir(BACKUP_DIR) if f.endswith(".db.gz")]
    )
    while len(files) > MAX_BACKUPS:
        oldest = files.pop(0)
        try:
            os.remove(os.path.join(BACKUP_DIR, oldest))
        except OSError:
            pass
