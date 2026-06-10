import os
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-secret-key-cambia-en-produccion-32chars")
ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "480"))

# tokenUrl apunta al endpoint de login admin; FastAPI lo usa para la UI de /docs
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/admin/login", auto_error=False)

# ---------------------------------------------------------------------------
# Utilidades de contraseña (bcrypt directo, compatible con bcrypt >= 4.0)
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

# ---------------------------------------------------------------------------
# Utilidades de JWT
# ---------------------------------------------------------------------------

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=EXPIRE_MINUTES))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

# ---------------------------------------------------------------------------
# Dependencias de FastAPI
# ---------------------------------------------------------------------------

def _get_token_payload(token: Optional[str] = Depends(oauth2_scheme)) -> dict:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return verify_token(token)


def get_current_admin(payload: dict = Depends(_get_token_payload)) -> dict:
    """Requiere rol admin o superadmin."""
    if payload.get("role") not in ("admin", "superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol de administrador",
        )
    return payload


def get_current_superadmin(payload: dict = Depends(_get_token_payload)) -> dict:
    """Requiere rol superadmin exclusivamente."""
    if payload.get("role") != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol de superadministrador",
        )
    return payload


def get_current_b2b(payload: dict = Depends(_get_token_payload)) -> dict:
    """Requiere rol b2b. Devuelve el payload con cliente_id."""
    if payload.get("role") != "b2b":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido a clientes B2B",
        )
    return payload


def get_current_user(payload: dict = Depends(_get_token_payload)) -> dict:
    """Acepta cualquier rol autenticado (admin, superadmin o b2b)."""
    return payload
