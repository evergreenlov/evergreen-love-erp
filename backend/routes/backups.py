import os
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse

from auth import get_current_admin
from utils.backup import BACKUP_DIR, create_backup, list_backups

router = APIRouter(prefix="/api/backups", tags=["backups"])


@router.post("/crear")
def crear_backup(current_user: dict = Depends(get_current_admin)):
    try:
        path = create_backup()
        return {
            "status": "success",
            "filename": os.path.basename(path),
            "message": "Respaldo creado exitosamente.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al crear respaldo: {str(e)}")


@router.get("/listar")
def listar_backups(current_user: dict = Depends(get_current_admin)):
    return {"status": "success", "data": list_backups()}


@router.get("/descargar/{filename}")
def descargar_backup(filename: str, current_user: dict = Depends(get_current_admin)):
    # Prevenir path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Nombre de archivo inválido.")
    if not filename.endswith(".db.gz"):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos .db.gz.")

    path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Respaldo no encontrado.")

    return FileResponse(
        path=path,
        media_type="application/gzip",
        filename=filename,
    )


@router.delete("/{filename}")
def eliminar_backup(filename: str, current_user: dict = Depends(get_current_admin)):
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Nombre de archivo inválido.")
    if not filename.endswith(".db.gz"):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos .db.gz.")

    path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Respaldo no encontrado.")

    os.remove(path)
    return {"status": "success", "message": f"Respaldo '{filename}' eliminado."}
