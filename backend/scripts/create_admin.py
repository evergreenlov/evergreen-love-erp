"""
Script para crear o resetear el superadmin en producción.

Uso:
    ADMIN_EMAIL=tu@email.com ADMIN_PASSWORD=nueva_clave python scripts/create_admin.py

El script actualiza (o crea) el usuario con ese email como superadmin activo.
NO imprime la contraseña en ningún momento.
"""
import os
import sys

# Permitir importar módulos del backend cuando se ejecuta desde backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bcrypt
from database import get_db_connection, init_db

ADMIN_NAME = os.environ.get("ADMIN_NAME", "Administrador").strip()
email = os.environ.get("ADMIN_EMAIL", "").strip()
password = os.environ.get("ADMIN_PASSWORD", "").strip()

if not email or not password:
    print("❌ Debes definir ADMIN_EMAIL y ADMIN_PASSWORD como variables de entorno.")
    sys.exit(1)

if len(password) < 8:
    print("❌ ADMIN_PASSWORD debe tener al menos 8 caracteres.")
    sys.exit(1)

init_db()

password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

conn = get_db_connection()
cursor = conn.cursor()

cursor.execute("SELECT id, nombre, rol FROM usuarios WHERE email = ?", (email,))
row = cursor.fetchone()

if row:
    cursor.execute(
        "UPDATE usuarios SET password_hash = ?, rol = 'superadmin', activo = 1, nombre = ? WHERE email = ?",
        (password_hash, ADMIN_NAME, email),
    )
    conn.commit()
    print(f"✅ Contraseña actualizada para: {email} (id={row['id']}, rol=superadmin)")
else:
    cursor.execute(
        "INSERT INTO usuarios (email, nombre, rol, password_hash, activo) VALUES (?, ?, 'superadmin', ?, 1)",
        (email, ADMIN_NAME, password_hash),
    )
    conn.commit()
    print(f"✅ Superadmin creado: {email}")

conn.close()
