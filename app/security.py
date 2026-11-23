import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Optional

STAFF_SECRET_PATH = os.getenv("STAFF_SECRET_PATH", "atelier-privado-9x4k2m").strip("/") or "atelier-privado-9x4k2m"
ADMIN_DEFAULT_PASSWORD = os.getenv("ADMIN_PASSWORD", "AllLookAdmin2026!")
STAFF_DEFAULT_PASSWORD = os.getenv("STAFF_DEFAULT_PASSWORD", "TallerAllLook2026!")

SESSION_COOKIE_NAME = "alllook_staff_session"
SESSION_TTL_SECONDS = 43200  # 12 horas

WORKSHOP_VIEWS = [
    {
        "key": "mostrador",
        "label": "Mostrador / Caja",
        "short_label": "Mostrador / Caja",
        "description": "Toma pedidos iniciales, confirma solicitudes web con anticipo del 50%, contacta clientes al estar lista la pieza y reenvía ajustes menores.",
        "icon": "clipboard-list",
    },
    {
        "key": "sastre",
        "label": "Sastre Patronista",
        "short_label": "Sastre Patronista",
        "description": "Registra medidas exactas del cliente en la orden, solicita telas al Analista de Inventario y envía piezas terminadas a Control de Calidad.",
        "icon": "scissors",
    },
    {
        "key": "inventario",
        "label": "Analista de Inventario",
        "short_label": "Inventario & Telas",
        "description": "Gestiona solicitudes de telas del Sastre Patronista y controla abastecimiento a proveedores bajo la regla del 30%.",
        "icon": "layers",
    },
    {
        "key": "calidad",
        "label": "Control de Calidad",
        "short_label": "Control de Calidad",
        "description": "Valida las piezas terminadas y aprueba su pase a mostrador o las devuelve al Sastre Patronista si requieren corrección.",
        "icon": "shield-check",
    },
    {
        "key": "facturacion",
        "label": "Facturación y Cobros",
        "short_label": "Facturación",
        "description": "Liquida el saldo restante obligatorio antes de la entrega, emite comprobantes oficiales y rastrea cobros.",
        "icon": "receipt",
    },
    {
        "key": "catalogo_piezas",
        "label": "Catálogo de Piezas Web",
        "short_label": "Catálogo Web",
        "description": "Administra las piezas exhibidas en la tienda pública para clientes (precio, talla, stock, tela y descripción).",
        "icon": "shirt",
    },
    {
        "key": "admin_usuarios",
        "label": "Administración de Trabajadores",
        "short_label": "Administración",
        "description": "Control total sobre cuentas de trabajadores, contraseñas, activación y permisos por vista.",
        "icon": "users",
    },
]

VALID_VIEW_KEYS = {v["key"] for v in WORKSHOP_VIEWS}

_CACHED_SECRET: Optional[str] = None


def get_session_secret() -> str:
    """Obtiene la clave de firma HMAC desde variable de entorno o archivo persistente."""
    global _CACHED_SECRET
    env_secret = os.getenv("SESSION_SECRET", "").strip()
    if env_secret:
        return env_secret
    if _CACHED_SECRET:
        return _CACHED_SECRET

    db_path = os.getenv("DATABASE_PATH", "/app/data/alllook.db")
    secret_dir = os.path.dirname(db_path) or "/tmp"
    secret_file = os.path.join(secret_dir, ".session_secret")

    try:
        os.makedirs(secret_dir, exist_ok=True)
        if os.path.exists(secret_file):
            with open(secret_file, "r", encoding="utf-8") as f:
                val = f.read().strip()
                if val:
                    _CACHED_SECRET = val
                    return _CACHED_SECRET
        generated = secrets.token_hex(32)
        with open(secret_file, "w", encoding="utf-8") as f:
            f.write(generated)
        _CACHED_SECRET = generated
        return _CACHED_SECRET
    except OSError:
        _CACHED_SECRET = secrets.token_hex(32)
        return _CACHED_SECRET


def hash_password(password: str) -> str:
    """Genera un hash PBKDF2-HMAC-SHA256 con sal aleatoria."""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120000)
    return f"pbkdf2_sha256$120000${salt}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Verifica contraseña contra hash PBKDF2 o texto plano legacy (para cuentas de clientes anteriores)."""
    if not stored or password is None:
        return False
    if stored.startswith("pbkdf2_sha256$"):
        parts = stored.split("$")
        if len(parts) != 4:
            return False
        _, iter_str, salt, expected_hex = parts
        try:
            iterations = int(iter_str)
        except ValueError:
            return False
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations)
        return hmac.compare_digest(dk.hex(), expected_hex)
    # Soporte legacy para clientes creados antes del hashing
    return hmac.compare_digest(password.encode("utf-8"), stored.encode("utf-8"))


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_session_token(user_id: str) -> str:
    """Crea token firmado HMAC-SHA256 con expiración."""
    payload = {
        "uid": user_id,
        "exp": int(time.time()) + SESSION_TTL_SECONDS,
        "nonce": secrets.token_hex(8),
    }
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = hmac.new(get_session_secret().encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256).digest()
    return f"{payload_b64}.{_b64url_encode(sig)}"


def verify_session_token(token: str) -> Optional[str]:
    """Verifica firma y expiración del token y retorna user_id si es válido."""
    if not token or "." not in token:
        return None
    try:
        payload_b64, sig_b64 = token.split(".", 1)
        expected_sig = hmac.new(
            get_session_secret().encode("utf-8"),
            payload_b64.encode("ascii"),
            hashlib.sha256,
        ).digest()
        provided_sig = _b64url_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, provided_sig):
            return None
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return payload.get("uid")
    except Exception:
        return None
