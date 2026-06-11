from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional
import sqlite3

from database import get_db_connection
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_admin,
    get_current_superadmin,
    get_current_user,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class AdminLoginRequest(BaseModel):
    email: str
    password: str

class B2BLoginRequest(BaseModel):
    cliente_id: int
    pin: str

class UsuarioCreate(BaseModel):
    email: str
    nombre: str
    rol: str = "admin"
    password: str

class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    rol: Optional[str] = None
    activo: Optional[int] = None
    password: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

# ---------------------------------------------------------------------------
# Login administrador
# ---------------------------------------------------------------------------

@router.post("/admin/login")
def admin_login(body: AdminLoginRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, email, nombre, rol, password_hash FROM usuarios WHERE email = ? AND activo = 1",
        (body.email.strip().lower(),)
    )
    user = cursor.fetchone()

    if not user or not verify_password(body.password, user["password_hash"]):
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
        )

    # Actualizar último acceso
    cursor.execute(
        "UPDATE usuarios SET ultimo_acceso = datetime('now','localtime') WHERE id = ?",
        (user["id"],)
    )
    conn.commit()
    conn.close()

    token = create_access_token({
        "sub": user["email"],
        "role": user["rol"],
        "usuario_id": user["id"],
        "cliente_id": None,
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user["rol"],
        "nombre": user["nombre"],
        "email": user["email"],
    }

# ---------------------------------------------------------------------------
# Login cliente B2B
# ---------------------------------------------------------------------------

@router.post("/b2b/login")
def b2b_login(body: B2BLoginRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, nombre, pin_hash FROM clientes WHERE id = ?",
        (body.cliente_id,)
    )
    cliente = cursor.fetchone()
    conn.close()

    # Mensaje genérico deliberado para no revelar si el cliente_id existe
    error_generico = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Cliente o PIN incorrecto",
    )

    if not cliente or not cliente["pin_hash"]:
        raise error_generico

    if not verify_password(body.pin, cliente["pin_hash"]):
        raise error_generico

    token = create_access_token({
        "sub": f"b2b:{cliente['id']}",
        "role": "b2b",
        "usuario_id": None,
        "cliente_id": cliente["id"],
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": "b2b",
        "cliente_id": cliente["id"],
        "nombre": cliente["nombre"],
    }

# ---------------------------------------------------------------------------
# Me (validar sesión activa)
# ---------------------------------------------------------------------------

@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "role": current_user.get("role"),
        "sub": current_user.get("sub"),
        "usuario_id": current_user.get("usuario_id"),
        "cliente_id": current_user.get("cliente_id"),
    }

# ---------------------------------------------------------------------------
# Logout (stateless — el cliente borra el token)
# ---------------------------------------------------------------------------

@router.post("/logout")
def logout(current_user: dict = Depends(get_current_user)):
    return {"message": "Sesión cerrada. Elimina el token del cliente."}

# ---------------------------------------------------------------------------
# Cambio de contraseña (cualquier admin autenticado, sobre su propia cuenta)
# ---------------------------------------------------------------------------

@router.post("/change-password")
def change_password(body: ChangePasswordRequest, current_user: dict = Depends(get_current_admin)):
    if body.new_password != body.confirm_password:
        raise HTTPException(status_code=400, detail="Las contraseñas nuevas no coinciden.")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres.")

    usuario_id = current_user.get("usuario_id")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT password_hash FROM usuarios WHERE id = ? AND activo = 1", (usuario_id,))
    row = cursor.fetchone()

    if not row or not verify_password(body.current_password, row["password_hash"]):
        conn.close()
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta.")

    cursor.execute(
        "UPDATE usuarios SET password_hash = ? WHERE id = ?",
        (hash_password(body.new_password), usuario_id)
    )
    conn.commit()
    conn.close()
    return {"status": "ok", "message": "Contraseña actualizada. Inicia sesión nuevamente."}

# ---------------------------------------------------------------------------
# Gestión de usuarios administradores (solo superadmin)
# ---------------------------------------------------------------------------

@router.get("/usuarios")
def listar_usuarios(current_user: dict = Depends(get_current_superadmin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, email, nombre, rol, activo, fecha_creacion, ultimo_acceso FROM usuarios ORDER BY id"
    )
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"status": "success", "data": rows}


@router.post("/usuarios", status_code=status.HTTP_201_CREATED)
def crear_usuario(body: UsuarioCreate, current_user: dict = Depends(get_current_superadmin)):
    if body.rol not in ("admin", "superadmin"):
        raise HTTPException(status_code=400, detail="Rol inválido. Use 'admin' o 'superadmin'.")

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO usuarios (email, nombre, rol, password_hash) VALUES (?, ?, ?, ?)",
            (body.email.strip().lower(), body.nombre.strip(), body.rol, hash_password(body.password))
        )
        conn.commit()
        nuevo_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=409, detail="Ya existe un usuario con ese email.")
    conn.close()
    return {"status": "success", "id": nuevo_id, "email": body.email, "rol": body.rol}


@router.put("/usuarios/{usuario_id}")
def actualizar_usuario(usuario_id: int, body: UsuarioUpdate, current_user: dict = Depends(get_current_superadmin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM usuarios WHERE id = ?", (usuario_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    fields = []
    values = []
    if body.nombre is not None:
        fields.append("nombre = ?")
        values.append(body.nombre.strip())
    if body.rol is not None:
        if body.rol not in ("admin", "superadmin"):
            conn.close()
            raise HTTPException(status_code=400, detail="Rol inválido.")
        fields.append("rol = ?")
        values.append(body.rol)
    if body.activo is not None:
        fields.append("activo = ?")
        values.append(body.activo)
    if body.password is not None:
        fields.append("password_hash = ?")
        values.append(hash_password(body.password))

    if not fields:
        conn.close()
        return {"status": "success", "message": "Sin cambios."}

    values.append(usuario_id)
    cursor.execute(f"UPDATE usuarios SET {', '.join(fields)} WHERE id = ?", values)
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Usuario actualizado."}


@router.delete("/usuarios/{usuario_id}")
def desactivar_usuario(usuario_id: int, current_user: dict = Depends(get_current_superadmin)):
    # No elimina físicamente — desactiva para preservar auditoría
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email FROM usuarios WHERE id = ?", (usuario_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    # Evitar que el superadmin se desactive a sí mismo
    if user["id"] == current_user.get("usuario_id"):
        conn.close()
        raise HTTPException(status_code=400, detail="No puedes desactivar tu propia cuenta.")

    cursor.execute("UPDATE usuarios SET activo = 0 WHERE id = ?", (usuario_id,))
    conn.commit()
    conn.close()
    return {"status": "success", "message": f"Usuario {user['email']} desactivado."}
