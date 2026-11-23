import json
import os
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.database import get_db, init_db
from app.schemas import (
    CatalogItemCreateRequest,
    CatalogItemUpdateRequest,
    CustomerLoginRequest,
    CustomerRegisterRequest,
    FabricRequestCreate,
    FabricRequestRejectRequest,
    FinalInvoicePaymentRequest,
    PublicProductRequest,
    PurchaseOrderCreate,
    QualityReviewRequest,
    SastreMeasurementsUpdateRequest,
    SastreSendToQCRequest,
    StaffLoginRequest,
    TicketConfirmWebRequest,
    TicketCreateMostradorRequest,
    TicketReturnToTailorRequest,
    WorkerCreateRequest,
    WorkerPermissionsUpdateRequest,
    WorkerUpdateRequest,
)
from app.security import (
    SESSION_COOKIE_NAME,
    STAFF_SECRET_PATH,
    VALID_VIEW_KEYS,
    WORKSHOP_VIEWS,
    create_session_token,
    hash_password,
    verify_password,
    verify_session_token,
)
from app.seed_data import seed_database

ENABLE_DOCS = os.getenv("ENABLE_DOCS", "false").lower() == "true"

app = FastAPI(
    title="Sastrería All Look — Sistema de Gestión Operativa",
    description="Plataforma de Gestión de Procesos de Sastrería All Look",
    version="3.0.0",
    docs_url="/docs" if ENABLE_DOCS else None,
    redoc_url=None,
    openapi_url="/openapi.json" if ENABLE_DOCS else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    init_db()
    seed_database()


# ==========================================================
# UTILIDADES INTERNAS Y SEGURIDAD DE SESIÓN / PERMISOS
# ==========================================================

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")


def _new_code(prefix: str) -> str:
    return f"{prefix}-{datetime.now().strftime('%y%m%d%H%M%S')}-{secrets.token_hex(2).upper()}"


def _append_history(history_json: Optional[str], role: str, action: str, note: str = "") -> str:
    try:
        entries = json.loads(history_json or "[]")
        if not isinstance(entries, list):
            entries = []
    except Exception:
        entries = []
    entries.append(
        {
            "fecha": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "rol": role,
            "accion": action,
            "nota": note or "",
        }
    )
    return json.dumps(entries, ensure_ascii=False)


def _compute_days_waiting(completed_date: Optional[str], stage: str) -> int:
    if not completed_date or stage not in ("LISTO_PARA_CONTACTAR", "CLIENTE_CONTACTADO"):
        return 0
    try:
        done_dt = datetime.strptime(completed_date[:10], "%Y-%m-%d").date()
        delta = (datetime.now().date() - done_dt).days
        return max(delta, 0)
    except Exception:
        return 0


def _ticket_row_to_dict(row) -> dict:
    d = dict(row)
    try:
        d["measurements"] = json.loads(d.get("measurements_json") or "{}")
    except Exception:
        d["measurements"] = {}
    try:
        d["history"] = json.loads(d.get("history_json") or "[]")
    except Exception:
        d["history"] = []
    d["days_waiting"] = _compute_days_waiting(d.get("completed_date"), d.get("stage", ""))
    return d


def _create_invoice(
    cursor,
    order_ref: str,
    invoice_type: str,
    customer_name: str,
    customer_phone: str,
    customer_id_card: str,
    amount_paid: float,
    balance_due: float,
    concept: str,
    payment_method: str,
    notes: str,
) -> str:
    inv_id = _new_code("FAC")
    today_str = datetime.now().strftime("%Y-%m-%d")
    subtotal = round(amount_paid / 1.07, 2)
    tax = round(amount_paid - subtotal, 2)
    cursor.execute(
        """
        INSERT INTO invoices (
            id, order_ref, invoice_type, customer_name, customer_phone, customer_id_card,
            date, concept, subtotal, tax, total, amount_paid, balance_due, payment_method, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            inv_id,
            order_ref,
            invoice_type,
            customer_name,
            customer_phone,
            customer_id_card,
            today_str,
            concept,
            subtotal,
            tax,
            round(amount_paid, 2),
            round(amount_paid, 2),
            round(balance_due, 2),
            payment_method,
            notes,
        ),
    )
    return inv_id


def _load_staff_user(user_id: str) -> Optional[dict]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, username, role_label, role_type, allowed_views_json, is_active, created_at FROM staff_users WHERE id = ?",
            (user_id,),
        )
        row = cursor.fetchone()
        if not row:
            return None
        d = dict(row)
        try:
            views = json.loads(d["allowed_views_json"] or "[]")
        except Exception:
            views = []
        d["allowed_views"] = [v for v in views if v in VALID_VIEW_KEYS]
        d["is_active"] = bool(d["is_active"])
        return d


def get_current_staff(request: Request) -> dict:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticación requerida.")
    user_id = verify_session_token(token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión inválida o expirada.")
    staff = _load_staff_user(user_id)
    if not staff or not staff["is_active"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Cuenta inactiva o inexistente.")
    return staff


def require_view(view_key: str):
    def _checker(staff: dict = Depends(get_current_staff)) -> dict:
        if view_key not in staff["allowed_views"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Su rol no tiene permiso asignado para acceder a la vista '{view_key}'.",
            )
        return staff

    return _checker


# ==========================================================
# 1. ENDPOINTS PÚBLICOS PARA CLIENTES Y TIENDA WEB
# ==========================================================

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "All Look Sastrería"}


@app.get("/api/public/catalog")
def get_public_catalog():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM catalog_ready ORDER BY category, name")
        return [dict(r) for r in cursor.fetchall()]


@app.get("/api/public/catalog/{item_id}")
def get_public_catalog_detail(item_id: int):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM catalog_ready WHERE id = ?", (item_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Pieza no encontrada en la colección.")
        item = dict(row)
        cursor.execute(
            "SELECT * FROM catalog_ready WHERE id != ? ORDER BY (CASE WHEN category = ? THEN 0 ELSE 1 END), id LIMIT 3",
            (item_id, item["category"]),
        )
        related = [dict(r) for r in cursor.fetchall()]
        return {"item": item, "related": related}


@app.get("/api/public/fabrics")
def get_public_fabrics():
    """Lista pública de telas disponibles sin exponer costos internos ni existencias."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT code, name, category FROM inventory WHERE category = 'Telas' ORDER BY name")
        return [dict(r) for r in cursor.fetchall()]


@app.post("/api/public/requests", status_code=status.HTTP_201_CREATED)
def submit_public_request(payload: PublicProductRequest):
    """Recibe solicitudes desde la web pública y las encola en Mostrador / Caja (SOLICITUD_WEB)."""
    allowed_types = {"Pieza de Exhibición", "Confección a la Medida", "Arreglo Menor"}
    if payload.request_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Tipo de solicitud no válido.")
    if not payload.customer_name.strip() or not payload.customer_phone.strip() or not payload.garment_description.strip():
        raise HTTPException(status_code=400, detail="Nombre, teléfono y descripción de la pieza son obligatorios.")

    ref_price = 0.0
    garment_desc = payload.garment_description.strip()

    with get_db() as conn:
        cursor = conn.cursor()
        if payload.catalog_item_id is not None:
            cursor.execute("SELECT * FROM catalog_ready WHERE id = ?", (payload.catalog_item_id,))
            item = cursor.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail="La pieza seleccionada no existe en el catálogo.")
            ref_price = float(item["price"])
            garment_desc = f"{item['name']} (Talla {item['size']}, {item['color']})"
            if payload.needs_quick_adjustment:
                garment_desc += " — Solicita ajuste en taller"

        ticket_id = _new_code("PED")
        today_str = datetime.now().strftime("%Y-%m-%d")
        note_parts = []
        if payload.needs_quick_adjustment:
            note_parts.append("Cliente solicita ajuste menor en probador.")
        if payload.notes and payload.notes.strip():
            note_parts.append(payload.notes.strip())
        combined_notes = " ".join(note_parts)

        history = _append_history(
            "[]",
            "Cliente (Web)",
            f"Solicitud web registrada ({payload.request_type})",
            combined_notes or "En espera de atención y confirmación por Mostrador / Caja.",
        )

        cursor.execute(
            """
            INSERT INTO workshop_tickets (
                id, source, order_type, catalog_item_id, customer_name, customer_phone, customer_id_card,
                garment_description, occasion, fabric_preference, measurements_json, tailor_notes,
                total_price, advance_payment, remaining_balance, order_date, delivery_date,
                interim_fitting_date, interim_fitting_validated, weight_clause_accepted,
                stage, qc_status, qc_notes, created_by_role, history_json
            ) VALUES (?, 'Web', ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?, 0.0, ?, ?, ?, '', 0, 1, 'SOLICITUD_WEB', 'Pendiente', '', 'Portal Web Cliente', ?)
            """,
            (
                ticket_id,
                payload.request_type,
                payload.catalog_item_id,
                payload.customer_name.strip(),
                payload.customer_phone.strip(),
                (payload.customer_id_card or "").strip(),
                garment_desc,
                (payload.occasion or "").strip(),
                (payload.fabric_preference or "").strip(),
                combined_notes,
                ref_price,
                ref_price,
                today_str,
                (payload.desired_date or "").strip(),
                history,
            ),
        )

        return {
            "success": True,
            "ticket_id": ticket_id,
            "message": "Su solicitud fue recibida. Nuestro personal de Mostrador / Caja le contactará para confirmar detalles, cita con el Sastre Patronista y anticipo.",
        }


# --- Autenticación Normal de Clientes ---

@app.post("/api/customer/register")
def register_customer(payload: CustomerRegisterRequest):
    email_clean = payload.email.strip().lower()
    if email_clean.endswith("@alllook.com"):
        raise HTTPException(
            status_code=400,
            detail="No se permite registrar cuentas con el dominio corporativo @alllook.com.",
        )
    if len(payload.password) < 4:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 4 caracteres.")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM customers WHERE email = ?", (email_clean,))
        if cursor.fetchone():
            raise HTTPException(
                status_code=400,
                detail="Ya existe una cuenta registrada con este correo electrónico.",
            )

        new_id = _new_code("CLI")
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        pw_hash = hash_password(payload.password)

        cursor.execute(
            """
            INSERT INTO customers (id, name, email, phone, id_card, password, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                new_id,
                payload.name.strip(),
                email_clean,
                payload.phone.strip(),
                (payload.id_card or "").strip(),
                pw_hash,
                now_str,
            ),
        )

        initials = "".join([part[0].upper() for part in payload.name.strip().split()[:2]]) or "CL"
        return {
            "success": True,
            "message": f"¡Bienvenido(a) a All Look, {payload.name.strip()}! Su cuenta ha sido creada.",
            "user": {
                "id": new_id,
                "name": payload.name.strip(),
                "email": email_clean,
                "phone": payload.phone.strip(),
                "id_card": (payload.id_card or "").strip(),
                "role": "cliente",
                "role_name": "Cliente Registrado",
                "initials": initials,
            },
        }


@app.post("/api/customer/login")
def login_customer(payload: CustomerLoginRequest):
    email_clean = payload.email.strip().lower()
    if email_clean.endswith("@alllook.com"):
        raise HTTPException(
            status_code=403,
            detail="Acceso denegado en el portal de clientes.",
        )

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, email, phone, id_card, password FROM customers WHERE email = ?",
            (email_clean,),
        )
        row = cursor.fetchone()
        if not row or not verify_password(payload.password, row["password"]):
            raise HTTPException(
                status_code=401,
                detail="Correo o contraseña incorrectos.",
            )

        cust = dict(row)
        initials = "".join([part[0].upper() for part in cust["name"].split()[:2]]) or "CL"
        return {
            "success": True,
            "message": f"¡Bienvenido de vuelta, {cust['name']}!",
            "user": {
                "id": cust["id"],
                "name": cust["name"],
                "email": cust["email"],
                "phone": cust["phone"],
                "id_card": cust["id_card"] or "",
                "role": "cliente",
                "role_name": "Cliente Registrado",
                "initials": initials,
            },
        }


# ==========================================================
# 2. AUTENTICACIÓN PRIVADA DEL TALLER (URL SECRETA)
# ==========================================================

@app.post("/api/internal/auth/login")
def staff_login(payload: StaffLoginRequest, request: Request, response: Response):
    username = payload.username.strip().lower()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, username, role_label, role_type, password_hash, allowed_views_json, is_active FROM staff_users WHERE lower(username) = ?",
            (username,),
        )
        row = cursor.fetchone()

    if not row or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")
    if not row["is_active"]:
        raise HTTPException(status_code=403, detail="Esta cuenta de trabajador se encuentra desactivada por Administración.")

    token = create_session_token(row["id"])
    is_https = request.url.scheme == "https" or request.headers.get("x-forwarded-proto", "").lower() == "https"
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=is_https,
        path="/",
        max_age=43200,
    )

    views = [v for v in json.loads(row["allowed_views_json"] or "[]") if v in VALID_VIEW_KEYS]
    return {
        "success": True,
        "user": {
            "id": row["id"],
            "username": row["username"],
            "role_label": row["role_label"],
            "role_type": row["role_type"],
            "allowed_views": views,
        },
        "views_catalog": WORKSHOP_VIEWS,
    }


@app.post("/api/internal/auth/logout")
def staff_logout(response: Response):
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return {"success": True}


@app.get("/api/internal/auth/me")
def staff_me(staff: dict = Depends(get_current_staff)):
    return {
        "user": {
            "id": staff["id"],
            "username": staff["username"],
            "role_label": staff["role_label"],
            "role_type": staff["role_type"],
            "allowed_views": staff["allowed_views"],
        },
        "views_catalog": WORKSHOP_VIEWS,
    }


# ==========================================================
# 3. ADMINISTRACIÓN DE TRABAJADORES Y CONTROL TOTAL DE VISTAS
# ==========================================================

def _count_other_active_admins(cursor, exclude_id: str) -> int:
    cursor.execute("SELECT id, allowed_views_json FROM staff_users WHERE is_active = 1 AND id != ?", (exclude_id,))
    cnt = 0
    for r in cursor.fetchall():
        try:
            vs = json.loads(r["allowed_views_json"] or "[]")
        except Exception:
            vs = []
        if "admin_usuarios" in vs:
            cnt += 1
    return cnt


@app.get("/api/internal/admin/workers")
def list_workers(staff: dict = Depends(require_view("admin_usuarios"))):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, username, role_label, role_type, allowed_views_json, is_active, created_at FROM staff_users ORDER BY created_at, username"
        )
        workers = []
        for r in cursor.fetchall():
            d = dict(r)
            try:
                vs = json.loads(d.pop("allowed_views_json") or "[]")
            except Exception:
                vs = []
            d["allowed_views"] = [v for v in vs if v in VALID_VIEW_KEYS]
            d["is_active"] = bool(d["is_active"])
            workers.append(d)
        return {"workers": workers, "views_catalog": WORKSHOP_VIEWS}


@app.post("/api/internal/admin/workers", status_code=status.HTTP_201_CREATED)
def create_worker(payload: WorkerCreateRequest, staff: dict = Depends(require_view("admin_usuarios"))):
    uname = payload.username.strip().lower()
    if not uname or len(payload.password) < 4:
        raise HTTPException(status_code=400, detail="Usuario válido y contraseña de al menos 4 caracteres son requeridos.")
    clean_views = [v for v in payload.allowed_views if v in VALID_VIEW_KEYS]

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM staff_users WHERE lower(username) = ?", (uname,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail=f"Ya existe un trabajador con el usuario '{uname}'.")

        worker_id = _new_code("STF")
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute(
            """
            INSERT INTO staff_users (id, username, role_label, role_type, password_hash, allowed_views_json, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                worker_id,
                uname,
                payload.role_label.strip(),
                payload.role_type.strip(),
                hash_password(payload.password),
                json.dumps(clean_views),
                1 if payload.is_active else 0,
                now_str,
            ),
        )
        return {"success": True, "worker_id": worker_id, "message": f"Trabajador '{payload.role_label.strip()}' creado."}


@app.put("/api/internal/admin/workers/{worker_id}")
def update_worker(worker_id: str, payload: WorkerUpdateRequest, staff: dict = Depends(require_view("admin_usuarios"))):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM staff_users WHERE id = ?", (worker_id,))
        target = cursor.fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="Trabajador no encontrado.")

        new_role_label = payload.role_label.strip() if payload.role_label is not None else target["role_label"]
        new_role_type = payload.role_type.strip() if payload.role_type is not None else target["role_type"]
        new_active = (1 if payload.is_active else 0) if payload.is_active is not None else target["is_active"]

        if payload.allowed_views is not None:
            new_views = [v for v in payload.allowed_views if v in VALID_VIEW_KEYS]
        else:
            new_views = json.loads(target["allowed_views_json"] or "[]")

        # Proteger último administrador activo y evitar auto-bloqueo
        if worker_id == staff["id"] and (not new_active or "admin_usuarios" not in new_views):
            raise HTTPException(
                status_code=400,
                detail="No puede desactivar su propia cuenta ni quitarse su propio permiso de Administración.",
            )
        if ("admin_usuarios" not in new_views or not new_active) and _count_other_active_admins(cursor, worker_id) == 0:
            raise HTTPException(
                status_code=400,
                detail="Debe permanecer al menos un administrador activo con acceso al módulo de Administración.",
            )

        pw_hash = target["password_hash"]
        if payload.password and payload.password.strip():
            if len(payload.password.strip()) < 4:
                raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 4 caracteres.")
            pw_hash = hash_password(payload.password.strip())

        cursor.execute(
            """
            UPDATE staff_users
            SET role_label = ?, role_type = ?, password_hash = ?, allowed_views_json = ?, is_active = ?
            WHERE id = ?
            """,
            (new_role_label, new_role_type, pw_hash, json.dumps(new_views), new_active, worker_id),
        )
        return {"success": True, "message": "Datos del trabajador actualizados."}


@app.put("/api/internal/admin/workers/{worker_id}/permissions")
def update_worker_permissions(
    worker_id: str,
    payload: WorkerPermissionsUpdateRequest,
    staff: dict = Depends(require_view("admin_usuarios")),
):
    clean_views = [v for v in payload.allowed_views if v in VALID_VIEW_KEYS]
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, role_label, is_active FROM staff_users WHERE id = ?", (worker_id,))
        target = cursor.fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="Trabajador no encontrado.")

        if worker_id == staff["id"] and "admin_usuarios" not in clean_views:
            raise HTTPException(status_code=400, detail="No puede revocarse a sí mismo el permiso de Administración.")
        if "admin_usuarios" not in clean_views and _count_other_active_admins(cursor, worker_id) == 0:
            raise HTTPException(status_code=400, detail="Debe existir al menos un administrador con acceso a Administración.")

        cursor.execute(
            "UPDATE staff_users SET allowed_views_json = ? WHERE id = ?",
            (json.dumps(clean_views), worker_id),
        )
        return {
            "success": True,
            "message": f"Vistas permitidas actualizadas para {target['role_label']}.",
            "allowed_views": clean_views,
        }


@app.delete("/api/internal/admin/workers/{worker_id}")
def delete_worker(worker_id: str, staff: dict = Depends(require_view("admin_usuarios"))):
    if worker_id == staff["id"]:
        raise HTTPException(status_code=400, detail="No puede eliminar la sesión activa actual.")
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM staff_users WHERE id = ?", (worker_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Trabajador no encontrado.")
        if _count_other_active_admins(cursor, worker_id) == 0:
            raise HTTPException(status_code=400, detail="Debe quedar al menos un administrador activo.")
        cursor.execute("DELETE FROM staff_users WHERE id = ?", (worker_id,))
        return {"success": True, "message": "Trabajador eliminado."}


# ==========================================================
# 4. PASO 1 Y 5: MOSTRADOR / CAJA
# ==========================================================

@app.get("/api/internal/mostrador/tickets")
def get_mostrador_tickets(staff: dict = Depends(require_view("mostrador"))):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM workshop_tickets ORDER BY order_date DESC, id DESC")
        tickets = [_ticket_row_to_dict(r) for r in cursor.fetchall()]

        cursor.execute("SELECT id, name, category, size, color, price, stock FROM catalog_ready ORDER BY name")
        catalog_items = [dict(r) for r in cursor.fetchall()]

        cursor.execute("SELECT code, name FROM inventory WHERE category = 'Telas' ORDER BY name")
        fabrics = [dict(r) for r in cursor.fetchall()]

        return {"tickets": tickets, "catalog_items": catalog_items, "fabrics": fabrics}


def _validate_advance_and_dates(order_type: str, total_price: float, advance_payment: float, delivery_date: str, weight_clause_accepted: bool):
    if total_price <= 0:
        raise HTTPException(status_code=400, detail="El monto total de la orden debe ser mayor que 0.")
    if advance_payment < 0 or advance_payment > total_price:
        raise HTTPException(status_code=400, detail="El anticipo debe estar entre $0.00 y el precio total.")

    interim_date_str = ""
    if order_type == "Confección a la Medida":
        # REGLA 1: Anticipo mínimo 50%
        min_advance = round(total_price * 0.50, 2)
        if advance_payment < min_advance:
            raise HTTPException(
                status_code=400,
                detail=f"Regla del 50%: Toda prenda a la medida requiere un anticipo mínimo de ${min_advance:.2f} antes de pasar al Sastre Patronista.",
            )
        # REGLA 2: Fecha de entrega y cita 15 días antes + cláusula de peso
        if not delivery_date:
            raise HTTPException(status_code=400, detail="Debe definir la fecha de entrega para calcular la cita de control (15 días antes).")
        try:
            delivery_dt = datetime.strptime(delivery_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha de entrega inválido (use YYYY-MM-DD).")
        if not weight_clause_accepted:
            raise HTTPException(status_code=400, detail="El cliente debe aceptar la cláusula de variación de medidas (cita 15 días antes).")
        interim_date_str = (delivery_dt - timedelta(days=15)).strftime("%Y-%m-%d")

    return interim_date_str


@app.post("/api/internal/mostrador/tickets", status_code=status.HTTP_201_CREATED)
def create_ticket_mostrador(payload: TicketCreateMostradorRequest, staff: dict = Depends(require_view("mostrador"))):
    interim_date = _validate_advance_and_dates(
        payload.order_type,
        payload.total_price,
        payload.advance_payment,
        payload.delivery_date or "",
        payload.weight_clause_accepted,
    )
    remaining = round(payload.total_price - payload.advance_payment, 2)
    ticket_id = _new_code("PED")
    today_str = datetime.now().strftime("%Y-%m-%d")

    # Si es pieza de exhibición ya pagada al 100% y sin ajuste pedido en notas, puede pasar directo a listo para entrega;
    # por defecto cualquier prenda que requiera trabajo del taller entra a EN_PATRONAJE_MEDIDAS.
    initial_stage = "EN_PATRONAJE_MEDIDAS"
    qc_status = "Pendiente"
    completed_date = None

    with get_db() as conn:
        cursor = conn.cursor()
        if payload.catalog_item_id is not None:
            cursor.execute("SELECT id, stock, name FROM catalog_ready WHERE id = ?", (payload.catalog_item_id,))
            item = cursor.fetchone()
            if not item:
                raise HTTPException(status_code=404, detail="Prenda de exhibición no encontrada.")
            if item["stock"] <= 0:
                raise HTTPException(status_code=400, detail=f"Sin existencias en catálogo para '{item['name']}'.")
            cursor.execute("UPDATE catalog_ready SET stock = stock - 1 WHERE id = ?", (payload.catalog_item_id,))

        history = _append_history(
            "[]",
            staff["role_label"],
            f"Pedido tomado en Mostrador ({payload.order_type})",
            f"Anticipo: ${payload.advance_payment:.2f} | Saldo: ${remaining:.2f}",
        )

        cursor.execute(
            """
            INSERT INTO workshop_tickets (
                id, source, order_type, catalog_item_id, customer_name, customer_phone, customer_id_card,
                garment_description, occasion, fabric_preference, measurements_json, tailor_notes,
                total_price, advance_payment, remaining_balance, order_date, delivery_date,
                interim_fitting_date, interim_fitting_validated, weight_clause_accepted,
                stage, qc_status, qc_notes, completed_date, created_by_role, history_json
            ) VALUES (?, 'Mostrador', ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, '', ?, ?, ?)
            """,
            (
                ticket_id,
                payload.order_type,
                payload.catalog_item_id,
                payload.customer_name.strip(),
                payload.customer_phone.strip(),
                (payload.customer_id_card or "").strip(),
                payload.garment_description.strip(),
                (payload.occasion or "").strip(),
                (payload.fabric_preference or "").strip(),
                (payload.notes or "").strip(),
                round(payload.total_price, 2),
                round(payload.advance_payment, 2),
                remaining,
                today_str,
                (payload.delivery_date or "").strip(),
                interim_date,
                1 if payload.weight_clause_accepted else 0,
                initial_stage,
                qc_status,
                completed_date,
                staff["role_label"],
                history,
            ),
        )

        invoice_id = None
        if payload.advance_payment > 0:
            invoice_id = _create_invoice(
                cursor,
                ticket_id,
                f"{payload.order_type} (Anticipo)" if remaining > 0 else f"{payload.order_type} (Pago Inicial)",
                payload.customer_name.strip(),
                payload.customer_phone.strip(),
                (payload.customer_id_card or "").strip(),
                payload.advance_payment,
                remaining,
                f"Orden {ticket_id}: {payload.garment_description.strip()}",
                payload.payment_method,
                f"Cita verificación 15d: {interim_date}" if interim_date else "Registrado en Mostrador / Caja.",
            )

        return {
            "success": True,
            "ticket_id": ticket_id,
            "invoice_id": invoice_id,
            "interim_fitting_date": interim_date,
            "remaining_balance": remaining,
            "message": f"Pedido {ticket_id} registrado y enviado al Sastre Patronista.",
        }


@app.post("/api/internal/mostrador/tickets/{ticket_id}/confirm-web")
def confirm_web_request(
    ticket_id: str,
    payload: TicketConfirmWebRequest,
    staff: dict = Depends(require_view("mostrador")),
):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM workshop_tickets WHERE id = ?", (ticket_id,))
        ticket = cursor.fetchone()
        if not ticket:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
        if ticket["stage"] != "SOLICITUD_WEB":
            raise HTTPException(status_code=400, detail="Solo se pueden confirmar solicitudes en estado 'SOLICITUD_WEB'.")

        interim_date = _validate_advance_and_dates(
            ticket["order_type"],
            payload.total_price,
            payload.advance_payment,
            payload.delivery_date or "",
            payload.weight_clause_accepted,
        )
        remaining = round(payload.total_price - payload.advance_payment, 2)

        if ticket["catalog_item_id"] is not None:
            cursor.execute("SELECT stock, name FROM catalog_ready WHERE id = ?", (ticket["catalog_item_id"],))
            cat = cursor.fetchone()
            if cat and cat["stock"] > 0:
                cursor.execute("UPDATE catalog_ready SET stock = stock - 1 WHERE id = ?", (ticket["catalog_item_id"],))

        if payload.send_to_tailor or ticket["order_type"] in ("Confección a la Medida", "Arreglo Menor"):
            next_stage = "EN_PATRONAJE_MEDIDAS"
            qc_status = "Pendiente"
            completed_date = None
        else:
            next_stage = "LISTO_PARA_CONTACTAR"
            qc_status = "Aprobado"
            completed_date = datetime.now().strftime("%Y-%m-%d")

        notes = payload.notes.strip() if payload.notes and payload.notes.strip() else ticket["tailor_notes"]
        history = _append_history(
            ticket["history_json"],
            staff["role_label"],
            f"Solicitud web confirmada -> {next_stage}",
            f"Total: ${payload.total_price:.2f} | Anticipo: ${payload.advance_payment:.2f} | Saldo: ${remaining:.2f}",
        )

        cursor.execute(
            """
            UPDATE workshop_tickets
            SET total_price = ?, advance_payment = ?, remaining_balance = ?,
                delivery_date = ?, interim_fitting_date = ?, weight_clause_accepted = ?,
                stage = ?, qc_status = ?, completed_date = ?, tailor_notes = ?, history_json = ?
            WHERE id = ?
            """,
            (
                round(payload.total_price, 2),
                round(payload.advance_payment, 2),
                remaining,
                (payload.delivery_date or "").strip(),
                interim_date,
                1 if payload.weight_clause_accepted else 0,
                next_stage,
                qc_status,
                completed_date,
                notes,
                history,
                ticket_id,
            ),
        )

        invoice_id = None
        if payload.advance_payment > 0:
            invoice_id = _create_invoice(
                cursor,
                ticket_id,
                f"Confirmación {ticket['order_type']} (Anticipo)" if remaining > 0 else f"Confirmación {ticket['order_type']}",
                ticket["customer_name"],
                ticket["customer_phone"],
                ticket["customer_id_card"] or "",
                payload.advance_payment,
                remaining,
                f"Orden {ticket_id}: {ticket['garment_description']}",
                payload.payment_method,
                notes or "Solicitud web confirmada en Mostrador / Caja.",
            )

        return {
            "success": True,
            "ticket_id": ticket_id,
            "stage": next_stage,
            "interim_fitting_date": interim_date,
            "invoice_id": invoice_id,
            "message": f"Solicitud {ticket_id} confirmada.",
        }


@app.post("/api/internal/mostrador/tickets/{ticket_id}/contact-customer")
def contact_customer(ticket_id: str, staff: dict = Depends(require_view("mostrador"))):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM workshop_tickets WHERE id = ?", (ticket_id,))
        ticket = cursor.fetchone()
        if not ticket:
            raise HTTPException(status_code=404, detail="Pedido no encontrado.")
        if ticket["stage"] not in ("LISTO_PARA_CONTACTAR", "CLIENTE_CONTACTADO"):
            raise HTTPException(
                status_code=400,
                detail="Solo se puede contactar al cliente cuando Control de Calidad ha aprobado la pieza.",
            )

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        history = _append_history(
            ticket["history_json"],
            staff["role_label"],
            "Cliente contactado para prueba / retiro",
            f"Llamada o mensaje enviado a {ticket['customer_phone']}",
        )
        cursor.execute(
            "UPDATE workshop_tickets SET stage = 'CLIENTE_CONTACTADO', customer_contacted_at = ?, history_json = ? WHERE id = ?",
            (now_str, history, ticket_id),
        )
        return {"success": True, "message": f"Cliente {ticket['customer_name']} marcado como contactado."}


@app.post("/api/internal/mostrador/tickets/{ticket_id}/return-to-tailor")
def return_to_tailor_adjustment(
    ticket_id: str,
    payload: TicketReturnToTailorRequest,
    staff: dict = Depends(require_view("mostrador")),
):
    """REGLA 4: Mostrador reenvía la pieza al Sastre Patronista por arreglo menor SIN costo adicional."""
    if not payload.adjustment_notes.strip():
        raise HTTPException(status_code=400, detail="Debe detallar el arreglo menor solicitado por el cliente.")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM workshop_tickets WHERE id = ?", (ticket_id,))
        ticket = cursor.fetchone()
        if not ticket:
            raise HTTPException(status_code=404, detail="Pedido no encontrado.")
        if ticket["stage"] not in ("LISTO_PARA_CONTACTAR", "CLIENTE_CONTACTADO"):
            raise HTTPException(
                status_code=400,
                detail="Solo se pueden reenviar al Sastre piezas listas o en prueba final con el cliente.",
            )

        new_count = int(ticket["adjustment_count"] or 0) + 1
        history = _append_history(
            ticket["history_json"],
            staff["role_label"],
            f"Reenviado al Sastre Patronista (Arreglo sin costo #{new_count})",
            payload.adjustment_notes.strip(),
        )
        # Regla 4: No se altera total_price ni remaining_balance; qc_status regresa a Pendiente
        cursor.execute(
            """
            UPDATE workshop_tickets
            SET stage = 'EN_AJUSTE_POST_PRUEBA',
                qc_status = 'Pendiente',
                adjustment_count = ?,
                adjustment_notes = ?,
                history_json = ?
            WHERE id = ?
            """,
            (new_count, payload.adjustment_notes.strip(), history, ticket_id),
        )
        return {
            "success": True,
            "message": f"Ticket {ticket_id} reenviado al Sastre Patronista sin costo adicional para el cliente.",
        }


# ==========================================================
# 5. PASO 2: SASTRE PATRONISTA
# ==========================================================

SASTRE_STAGES = (
    "EN_PATRONAJE_MEDIDAS",
    "ESPERANDO_TELAS",
    "EN_CONFECCION",
    "DEVUELTO_POR_CALIDAD",
    "EN_AJUSTE_POST_PRUEBA",
)


@app.get("/api/internal/sastre/queue")
def get_sastre_queue(staff: dict = Depends(require_view("sastre"))):
    with get_db() as conn:
        cursor = conn.cursor()
        placeholders = ",".join("?" * len(SASTRE_STAGES))
        cursor.execute(
            f"""
            SELECT * FROM workshop_tickets
            WHERE stage IN ({placeholders})
            ORDER BY (
                CASE stage
                    WHEN 'DEVUELTO_POR_CALIDAD' THEN 0
                    WHEN 'EN_AJUSTE_POST_PRUEBA' THEN 1
                    WHEN 'EN_PATRONAJE_MEDIDAS' THEN 2
                    WHEN 'ESPERANDO_TELAS' THEN 3
                    ELSE 4
                END
            ), order_date DESC
            """,
            SASTRE_STAGES,
        )
        tickets = [_ticket_row_to_dict(r) for r in cursor.fetchall()]

        cursor.execute("SELECT * FROM fabric_requests ORDER BY created_at DESC")
        reqs_by_ticket = {}
        all_requests = []
        for r in cursor.fetchall():
            rd = dict(r)
            all_requests.append(rd)
            reqs_by_ticket.setdefault(rd["ticket_id"], []).append(rd)

        for t in tickets:
            t["fabric_requests"] = reqs_by_ticket.get(t["id"], [])

        cursor.execute("SELECT code, name, category, unit, current_stock FROM inventory WHERE category IN ('Telas', 'Entretelas', 'Hilos', 'Botones', 'Cierres') ORDER BY category, name")
        materials = [dict(r) for r in cursor.fetchall()]

        return {"tickets": tickets, "fabric_requests": all_requests, "materials": materials}


@app.put("/api/internal/sastre/tickets/{ticket_id}/measurements")
def save_sastre_measurements(
    ticket_id: str,
    payload: SastreMeasurementsUpdateRequest,
    staff: dict = Depends(require_view("sastre")),
):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM workshop_tickets WHERE id = ?", (ticket_id,))
        ticket = cursor.fetchone()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket no encontrado.")
        if ticket["stage"] not in SASTRE_STAGES:
            raise HTTPException(status_code=400, detail="Este ticket no se encuentra actualmente en el área del Sastre Patronista.")

        clean_measurements = {str(k).strip(): v for k, v in payload.measurements.items() if v is not None and str(v).strip() != ""}
        new_notes = payload.tailor_notes if payload.tailor_notes is not None else ticket["tailor_notes"]
        new_validated = (
            (1 if payload.interim_fitting_validated else 0)
            if payload.interim_fitting_validated is not None
            else ticket["interim_fitting_validated"]
        )
        history = _append_history(
            ticket["history_json"],
            staff["role_label"],
            "Medidas exactas registradas en ficha de patronaje",
            f"{len(clean_measurements)} medidas anatómicas guardadas",
        )

        cursor.execute(
            """
            UPDATE workshop_tickets
            SET measurements_json = ?, tailor_notes = ?, interim_fitting_validated = ?, history_json = ?
            WHERE id = ?
            """,
            (json.dumps(clean_measurements, ensure_ascii=False), new_notes, new_validated, history, ticket_id),
        )
        return {"success": True, "message": "Medidas exactas y notas del patrón guardadas."}


@app.post("/api/internal/sastre/tickets/{ticket_id}/fabric-request", status_code=status.HTTP_201_CREATED)
def request_fabric_from_inventory(
    ticket_id: str,
    payload: FabricRequestCreate,
    staff: dict = Depends(require_view("sastre")),
):
    if payload.quantity_requested <= 0:
        raise HTTPException(status_code=400, detail="La cantidad solicitada debe ser mayor que 0.")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM workshop_tickets WHERE id = ?", (ticket_id,))
        ticket = cursor.fetchone()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket no encontrado.")
        if ticket["stage"] not in SASTRE_STAGES:
            raise HTTPException(status_code=400, detail="El ticket no está asignado al Sastre Patronista.")

        cursor.execute("SELECT code, name, unit FROM inventory WHERE code = ?", (payload.inventory_code,))
        inv = cursor.fetchone()
        if not inv:
            raise HTTPException(status_code=404, detail="Tela o insumo no encontrado en el catálogo de inventario.")

        req_id = _new_code("TEL-REQ")
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        cursor.execute(
            """
            INSERT INTO fabric_requests (
                id, ticket_id, inventory_code, item_name, quantity_requested, unit,
                requested_by_role, notes, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente', ?)
            """,
            (
                req_id,
                ticket_id,
                inv["code"],
                inv["name"],
                round(payload.quantity_requested, 2),
                inv["unit"],
                staff["role_label"],
                (payload.notes or "").strip(),
                now_str,
            ),
        )

        history = _append_history(
            ticket["history_json"],
            staff["role_label"],
            "Solicitud de tela enviada al Analista de Inventario",
            f"{inv['name']} ({payload.quantity_requested} {inv['unit']})",
        )
        cursor.execute(
            "UPDATE workshop_tickets SET stage = 'ESPERANDO_TELAS', history_json = ? WHERE id = ?",
            (history, ticket_id),
        )
        return {
            "success": True,
            "request_id": req_id,
            "message": f"Solicitud {req_id} enviada al Analista de Inventario.",
        }


@app.post("/api/internal/sastre/tickets/{ticket_id}/send-to-qc")
def send_ticket_to_qc(
    ticket_id: str,
    payload: SastreSendToQCRequest,
    staff: dict = Depends(require_view("sastre")),
):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM workshop_tickets WHERE id = ?", (ticket_id,))
        ticket = cursor.fetchone()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket no encontrado.")
        if ticket["stage"] not in SASTRE_STAGES:
            raise HTTPException(status_code=400, detail="El ticket no está en etapa de taller / sastre.")

        # Bloquear envío a QC si hay solicitudes de telas pendientes
        cursor.execute(
            "SELECT COUNT(*) FROM fabric_requests WHERE ticket_id = ? AND status = 'Pendiente'",
            (ticket_id,),
        )
        if cursor.fetchone()[0] > 0:
            raise HTTPException(
                status_code=400,
                detail="Existen solicitudes de telas pendientes de despacho por el Analista de Inventario.",
            )

        if ticket["order_type"] == "Confección a la Medida":
            try:
                m_dict = json.loads(ticket["measurements_json"] or "{}")
            except Exception:
                m_dict = {}
            if len(m_dict) == 0:
                raise HTTPException(
                    status_code=400,
                    detail="Debe registrar al menos una medida anatómica en la ficha antes de enviar a Control de Calidad.",
                )

        new_notes = payload.tailor_notes if payload.tailor_notes is not None else ticket["tailor_notes"]
        history = _append_history(
            ticket["history_json"],
            staff["role_label"],
            "Pieza terminada y enviada a Control de Calidad",
            new_notes or "",
        )
        cursor.execute(
            """
            UPDATE workshop_tickets
            SET stage = 'EN_CONTROL_DE_CALIDAD', qc_status = 'Pendiente', tailor_notes = ?, history_json = ?
            WHERE id = ?
            """,
            (new_notes, history, ticket_id),
        )
        return {"success": True, "message": f"Ticket {ticket_id} enviado a Control de Calidad."}


# ==========================================================
# 6. PASO 3: ANALISTA DE INVENTARIO (TELAS Y REORDEN AL 30%)
# ==========================================================

@app.get("/api/internal/inventario/overview")
def get_inventory_overview(staff: dict = Depends(require_view("inventario"))):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT fr.*, wt.customer_name, wt.garment_description, wt.stage AS ticket_stage
            FROM fabric_requests fr
            LEFT JOIN workshop_tickets wt ON wt.id = fr.ticket_id
            ORDER BY (CASE fr.status WHEN 'Pendiente' THEN 0 ELSE 1 END), fr.created_at DESC
            """
        )
        fabric_requests = [dict(r) for r in cursor.fetchall()]

        cursor.execute("SELECT * FROM inventory ORDER BY category, name")
        inventory_items = []
        for r in cursor.fetchall():
            d = dict(r)
            pct = round((d["current_stock"] / d["optimal_stock"]) * 100, 1) if d["optimal_stock"] > 0 else 0
            d["percentage_stock"] = pct
            d["is_reorder_needed"] = d["current_stock"] <= d["reorder_point"]
            inventory_items.append(d)

        cursor.execute("SELECT * FROM purchase_orders ORDER BY date_ordered DESC, id DESC")
        purchase_orders = [dict(r) for r in cursor.fetchall()]

        return {
            "fabric_requests": fabric_requests,
            "inventory": inventory_items,
            "purchase_orders": purchase_orders,
        }


@app.post("/api/internal/inventario/fabric-requests/{req_id}/dispatch")
def dispatch_fabric_request(req_id: str, staff: dict = Depends(require_view("inventario"))):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM fabric_requests WHERE id = ?", (req_id,))
        req = cursor.fetchone()
        if not req:
            raise HTTPException(status_code=404, detail="Solicitud de tela no encontrada.")
        if req["status"] != "Pendiente":
            raise HTTPException(status_code=400, detail=f"La solicitud ya fue procesada ({req['status']}).")

        cursor.execute("SELECT * FROM inventory WHERE code = ?", (req["inventory_code"],))
        inv = cursor.fetchone()
        if not inv:
            raise HTTPException(status_code=404, detail="Material no encontrado en inventario.")
        if inv["current_stock"] < req["quantity_requested"]:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente de '{inv['name']}': disponible {inv['current_stock']} {inv['unit']}, solicitado {req['quantity_requested']} {req['unit']}.",
            )

        new_stock = round(inv["current_stock"] - req["quantity_requested"], 2)
        cursor.execute("UPDATE inventory SET current_stock = ? WHERE code = ?", (new_stock, inv["code"]))

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        cursor.execute(
            "UPDATE fabric_requests SET status = 'Despachada', resolved_at = ?, resolved_by_role = ? WHERE id = ?",
            (now_str, staff["role_label"], req_id),
        )

        # Verificar si quedan otras solicitudes pendientes para el mismo ticket
        cursor.execute(
            "SELECT COUNT(*) FROM fabric_requests WHERE ticket_id = ? AND status = 'Pendiente'",
            (req["ticket_id"],),
        )
        still_pending = cursor.fetchone()[0]

        cursor.execute("SELECT stage, history_json FROM workshop_tickets WHERE id = ?", (req["ticket_id"],))
        t_row = cursor.fetchone()
        if t_row:
            new_stage = "EN_CONFECCION" if (t_row["stage"] == "ESPERANDO_TELAS" and still_pending == 0) else t_row["stage"]
            history = _append_history(
                t_row["history_json"],
                staff["role_label"],
                f"Material despachado: {inv['name']} (-{req['quantity_requested']} {req['unit']})",
                f"Stock restante: {new_stock} {req['unit']}. Etapa actual: {new_stage}",
            )
            cursor.execute(
                "UPDATE workshop_tickets SET stage = ?, history_json = ? WHERE id = ?",
                (new_stage, history, req["ticket_id"]),
            )

        reorder_alert = new_stock <= inv["reorder_point"]
        return {
            "success": True,
            "new_stock": new_stock,
            "reorder_alert": reorder_alert,
            "message": f"Tela despachada al Sastre Patronista.{' ¡Alerta: el inventario alcanzó el punto de reorden (<=30%)!' if reorder_alert else ''}",
        }


@app.post("/api/internal/inventario/fabric-requests/{req_id}/reject")
def reject_fabric_request(
    req_id: str,
    payload: FabricRequestRejectRequest,
    staff: dict = Depends(require_view("inventario")),
):
    if not payload.notes.strip():
        raise HTTPException(status_code=400, detail="Indique el motivo del rechazo.")
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM fabric_requests WHERE id = ?", (req_id,))
        req = cursor.fetchone()
        if not req:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
        if req["status"] != "Pendiente":
            raise HTTPException(status_code=400, detail="La solicitud ya fue resuelta.")

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        cursor.execute(
            "UPDATE fabric_requests SET status = 'Rechazada', notes = ?, resolved_at = ?, resolved_by_role = ? WHERE id = ?",
            (payload.notes.strip(), now_str, staff["role_label"], req_id),
        )

        cursor.execute(
            "SELECT COUNT(*) FROM fabric_requests WHERE ticket_id = ? AND status = 'Pendiente'",
            (req["ticket_id"],),
        )
        still_pending = cursor.fetchone()[0]

        cursor.execute("SELECT stage, history_json FROM workshop_tickets WHERE id = ?", (req["ticket_id"],))
        t_row = cursor.fetchone()
        if t_row:
            next_stage = "EN_PATRONAJE_MEDIDAS" if (t_row["stage"] == "ESPERANDO_TELAS" and still_pending == 0) else t_row["stage"]
            history = _append_history(
                t_row["history_json"],
                staff["role_label"],
                f"Solicitud {req_id} rechazada",
                payload.notes.strip(),
            )
            cursor.execute(
                "UPDATE workshop_tickets SET stage = ?, history_json = ? WHERE id = ?",
                (next_stage, history, req["ticket_id"]),
            )
        return {"success": True, "message": "Solicitud rechazada y notificada al Sastre Patronista."}


@app.post("/api/internal/inventario/reorder")
def create_purchase_order(po: PurchaseOrderCreate, staff: dict = Depends(require_view("inventario"))):
    """REGLA 6: La compra de telas e insumos se activa únicamente al caer a <= 30%."""
    if po.quantity <= 0:
        raise HTTPException(status_code=400, detail="La cantidad a ordenar debe ser mayor a 0.")
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM inventory WHERE code = ?", (po.item_code,))
        item = cursor.fetchone()
        if not item:
            raise HTTPException(status_code=404, detail="Insumo no encontrado.")
        if item["current_stock"] > item["reorder_point"]:
            raise HTTPException(
                status_code=400,
                detail=f"Regla del 30%: '{item['name']}' tiene {item['current_stock']} {item['unit']} (por encima del punto de reorden mínimo de {item['reorder_point']} {item['unit']}).",
            )

        po_id = _new_code("OC")
        today_str = datetime.now().strftime("%Y-%m-%d")
        cost = round(po.quantity * item["cost_per_unit"], 2)
        cursor.execute(
            """
            INSERT INTO purchase_orders (id, item_code, item_name, supplier, quantity, unit, estimated_cost, date_ordered, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'En Camino')
            """,
            (po_id, item["code"], item["name"], item["supplier"], po.quantity, item["unit"], cost, today_str),
        )
        return {
            "success": True,
            "purchase_order_id": po_id,
            "estimated_cost": cost,
            "message": f"Orden de compra {po_id} emitida a {item['supplier']}.",
        }


@app.post("/api/internal/inventario/purchase-orders/{po_id}/receive")
def receive_purchase_order(po_id: str, staff: dict = Depends(require_view("inventario"))):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM purchase_orders WHERE id = ?", (po_id,))
        po = cursor.fetchone()
        if not po:
            raise HTTPException(status_code=404, detail="Orden de compra no encontrada.")
        if po["status"] == "Recibido":
            return {"success": True, "message": "Esta orden ya fue ingresada al inventario."}

        cursor.execute(
            "UPDATE inventory SET current_stock = current_stock + ?, last_restock = ? WHERE code = ?",
            (po["quantity"], datetime.now().strftime("%Y-%m-%d"), po["item_code"]),
        )
        cursor.execute("UPDATE purchase_orders SET status = 'Recibido' WHERE id = ?", (po_id,))
        return {"success": True, "message": f"Insumo '{po['item_name']}' recibido e ingresado al stock."}


# ==========================================================
# 7. PASO 4: CONTROL DE CALIDAD
# ==========================================================

@app.get("/api/internal/calidad/queue")
def get_quality_queue(staff: dict = Depends(require_view("calidad"))):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM workshop_tickets
            WHERE stage IN ('EN_CONTROL_DE_CALIDAD', 'DEVUELTO_POR_CALIDAD', 'LISTO_PARA_CONTACTAR')
            ORDER BY (CASE stage WHEN 'EN_CONTROL_DE_CALIDAD' THEN 0 WHEN 'DEVUELTO_POR_CALIDAD' THEN 1 ELSE 2 END), order_date DESC
            """
        )
        rows = [_ticket_row_to_dict(r) for r in cursor.fetchall()]
        pending = [t for t in rows if t["stage"] == "EN_CONTROL_DE_CALIDAD"]
        recent = [t for t in rows if t["stage"] != "EN_CONTROL_DE_CALIDAD"][:10]
        return {"pending": pending, "recent": recent}


@app.post("/api/internal/calidad/tickets/{ticket_id}/review")
def review_quality_ticket(
    ticket_id: str,
    payload: QualityReviewRequest,
    staff: dict = Depends(require_view("calidad")),
):
    if payload.decision not in ("Aprobado", "Rechazado"):
        raise HTTPException(status_code=400, detail="La decisión debe ser 'Aprobado' o 'Rechazado'.")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM workshop_tickets WHERE id = ?", (ticket_id,))
        ticket = cursor.fetchone()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket no encontrado.")
        if ticket["stage"] != "EN_CONTROL_DE_CALIDAD":
            raise HTTPException(status_code=400, detail="Este ticket no se encuentra en espera de Control de Calidad.")

        if payload.decision == "Aprobado":
            completed_date = ticket["completed_date"] or datetime.now().strftime("%Y-%m-%d")
            qc_notes = (payload.qc_notes or "").strip() or "Costuras parejas, sin hilos sueltos y medidas conformes."
            history = _append_history(
                ticket["history_json"],
                staff["role_label"],
                "Control de Calidad APROBADO -> Devuelto a Mostrador",
                qc_notes,
            )
            cursor.execute(
                """
                UPDATE workshop_tickets
                SET stage = 'LISTO_PARA_CONTACTAR', qc_status = 'Aprobado', qc_notes = ?,
                    completed_date = ?, history_json = ?
                WHERE id = ?
                """,
                (qc_notes, completed_date, history, ticket_id),
            )
            return {
                "success": True,
                "stage": "LISTO_PARA_CONTACTAR",
                "message": f"Ticket {ticket_id} aprobado y devuelto a Mostrador / Caja para contactar al cliente.",
            }

        # Rechazado -> vuelve al Sastre Patronista
        if not payload.qc_notes or not payload.qc_notes.strip():
            raise HTTPException(status_code=400, detail="Debe indicar las observaciones de corrección para devolver la pieza al Sastre.")
        history = _append_history(
            ticket["history_json"],
            staff["role_label"],
            "Control de Calidad RECHAZADO -> Devuelto al Sastre Patronista",
            payload.qc_notes.strip(),
        )
        cursor.execute(
            """
            UPDATE workshop_tickets
            SET stage = 'DEVUELTO_POR_CALIDAD', qc_status = 'Rechazado', qc_notes = ?, history_json = ?
            WHERE id = ?
            """,
            (payload.qc_notes.strip(), history, ticket_id),
        )
        return {
            "success": True,
            "stage": "DEVUELTO_POR_CALIDAD",
            "message": f"Ticket {ticket_id} devuelto al Sastre Patronista para corrección.",
        }


# ==========================================================
# 8. PASO 6: FACTURACIÓN Y COBROS (MOSTRADOR)
# ==========================================================

@app.get("/api/internal/facturacion/overview")
def get_facturacion_overview(
    q: Optional[str] = None,
    staff: dict = Depends(require_view("facturacion")),
):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM workshop_tickets
            WHERE stage IN ('LISTO_PARA_CONTACTAR', 'CLIENTE_CONTACTADO')
            ORDER BY order_date DESC
            """
        )
        ready_to_bill = [_ticket_row_to_dict(r) for r in cursor.fetchall()]

        if q and q.strip():
            search = f"%{q.strip()}%"
            cursor.execute(
                """
                SELECT * FROM invoices
                WHERE id LIKE ? OR customer_name LIKE ? OR order_ref LIKE ? OR concept LIKE ?
                ORDER BY date DESC, id DESC
                """,
                (search, search, search, search),
            )
        else:
            cursor.execute("SELECT * FROM invoices ORDER BY date DESC, id DESC")
        invoices = [dict(r) for r in cursor.fetchall()]

        cursor.execute("SELECT COALESCE(SUM(amount_paid), 0) FROM invoices")
        total_collected = round(float(cursor.fetchone()[0]), 2)
        pending_receivable = round(sum(float(t["remaining_balance"]) for t in ready_to_bill), 2)

        return {
            "ready_to_bill": ready_to_bill,
            "invoices": invoices,
            "total_collected": total_collected,
            "pending_receivable": pending_receivable,
        }


@app.post("/api/internal/facturacion/tickets/{ticket_id}/pay")
def pay_and_deliver_ticket(
    ticket_id: str,
    payload: FinalInvoicePaymentRequest,
    staff: dict = Depends(require_view("facturacion")),
):
    """REGLA 3 (QC Aprobado) + REGLA 5 (Liquidación total obligatoria antes de entregar)."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM workshop_tickets WHERE id = ?", (ticket_id,))
        ticket = cursor.fetchone()
        if not ticket:
            raise HTTPException(status_code=404, detail="Pedido no encontrado.")
        if ticket["stage"] == "FACTURADO_ENTREGADO":
            raise HTTPException(status_code=400, detail="Este pedido ya fue facturado y entregado.")
        if ticket["stage"] not in ("LISTO_PARA_CONTACTAR", "CLIENTE_CONTACTADO"):
            raise HTTPException(
                status_code=400,
                detail="Regla 3: La pieza debe pasar por Control de Calidad y ser aprobada antes de facturar su entrega.",
            )
        if ticket["qc_status"] != "Aprobado":
            raise HTTPException(
                status_code=400,
                detail="Regla 3: Ninguna prenda se entrega sin aprobación de Control de Calidad.",
            )

        current_balance = round(float(ticket["remaining_balance"]), 2)
        if payload.amount < 0:
            raise HTTPException(status_code=400, detail="El monto de cobro no puede ser negativo.")
        if round(current_balance - payload.amount, 2) > 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"Regla 5: Es obligatorio liquidar el saldo completo (${current_balance:.2f}) antes de entregar la prenda terminada.",
            )

        paid_now = current_balance
        inv_id = _create_invoice(
            cursor,
            ticket_id,
            f"Liquidación y Entrega ({ticket['order_type']})",
            ticket["customer_name"],
            ticket["customer_phone"],
            ticket["customer_id_card"] or "",
            paid_now,
            0.0,
            f"Entrega final de orden {ticket_id}: {ticket['garment_description']}",
            payload.payment_method,
            (payload.notes or "").strip() or "Saldo liquidado al 100%. Entregado con comprobante y funda protectora.",
        )

        history = _append_history(
            ticket["history_json"],
            staff["role_label"],
            f"Factura emitida {inv_id} y prenda entregada",
            f"Cobrado: ${paid_now:.2f} ({payload.payment_method})",
        )
        cursor.execute(
            """
            UPDATE workshop_tickets
            SET remaining_balance = 0.0,
                stage = 'FACTURADO_ENTREGADO',
                history_json = ?
            WHERE id = ?
            """,
            (history, ticket_id),
        )
        return {
            "success": True,
            "invoice_id": inv_id,
            "amount_paid": paid_now,
            "message": f"Cobro registrado y factura {inv_id} emitida. Prenda liberada.",
        }


@app.get("/api/internal/facturacion/invoices/{invoice_id}")
def get_internal_invoice_detail(invoice_id: str, staff: dict = Depends(require_view("facturacion"))):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM invoices WHERE id = ?", (invoice_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Comprobante no encontrado.")
        return dict(row)


# ==========================================================
# 9. GESTIÓN DEL CATÁLOGO DE PIEZAS EXHIBIDAS EN LA WEB
# ==========================================================

@app.get("/api/internal/catalogo/items")
def get_internal_catalog_items(staff: dict = Depends(require_view("catalogo_piezas"))):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM catalog_ready ORDER BY category, name")
        return [dict(r) for r in cursor.fetchall()]


@app.post("/api/internal/catalogo/items", status_code=status.HTTP_201_CREATED)
def create_internal_catalog_item(
    payload: CatalogItemCreateRequest,
    staff: dict = Depends(require_view("catalogo_piezas")),
):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO catalog_ready (name, category, size, color, style, price, stock, description, image_url, fabric, delivery_time, care_instructions)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.name.strip(),
                payload.category.strip(),
                payload.size.strip(),
                payload.color.strip(),
                payload.style.strip(),
                round(payload.price, 2),
                max(payload.stock, 0),
                (payload.description or "").strip(),
                (payload.image_url or "/static/img/suit_grey.jpg").strip(),
                (payload.fabric or "").strip(),
                (payload.delivery_time or "").strip(),
                (payload.care_instructions or "").strip(),
            ),
        )
        return {"success": True, "id": cursor.lastrowid, "message": "Pieza agregada a la colección pública."}


@app.put("/api/internal/catalogo/items/{item_id}")
def update_internal_catalog_item(
    item_id: int,
    payload: CatalogItemUpdateRequest,
    staff: dict = Depends(require_view("catalogo_piezas")),
):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM catalog_ready WHERE id = ?", (item_id,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Pieza no encontrada.")

        updated = dict(existing)
        for field in (
            "name",
            "category",
            "size",
            "color",
            "style",
            "price",
            "stock",
            "description",
            "image_url",
            "fabric",
            "delivery_time",
            "care_instructions",
        ):
            val = getattr(payload, field)
            if val is not None:
                updated[field] = val.strip() if isinstance(val, str) else val

        cursor.execute(
            """
            UPDATE catalog_ready
            SET name = ?, category = ?, size = ?, color = ?, style = ?, price = ?, stock = ?,
                description = ?, image_url = ?, fabric = ?, delivery_time = ?, care_instructions = ?
            WHERE id = ?
            """,
            (
                updated["name"],
                updated["category"],
                updated["size"],
                updated["color"],
                updated["style"],
                round(float(updated["price"]), 2),
                max(int(updated["stock"]), 0),
                updated["description"],
                updated["image_url"],
                updated["fabric"],
                updated["delivery_time"],
                updated["care_instructions"],
                item_id,
            ),
        )
        return {"success": True, "message": "Pieza actualizada."}


@app.delete("/api/internal/catalogo/items/{item_id}")
def delete_internal_catalog_item(item_id: int, staff: dict = Depends(require_view("catalogo_piezas"))):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM catalog_ready WHERE id = ?", (item_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Pieza no encontrada.")
        cursor.execute("DELETE FROM catalog_ready WHERE id = ?", (item_id,))
        return {"success": True, "message": "Pieza eliminada de la colección."}


# ==========================================================
# 10. FRONTEND MULTI-PÁGINA (PÚBLICO Y PORTAL SECRETO)
# ==========================================================

if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def serve_home():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


@app.get("/pieza/{item_id}")
def serve_piece_detail(item_id: int):
    return FileResponse(os.path.join(STATIC_DIR, "pieza.html"))


@app.get("/solicitar")
def serve_request_page():
    return FileResponse(os.path.join(STATIC_DIR, "solicitar.html"))


@app.get(f"/{STAFF_SECRET_PATH}")
def serve_secret_portal():
    portal_path = os.path.join(TEMPLATES_DIR, "staff_portal.html")
    if not os.path.exists(portal_path):
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(
        portal_path,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "X-Robots-Tag": "noindex, nofollow",
        },
    )


@app.get(f"/{STAFF_SECRET_PATH}/portal.js")
def serve_secret_portal_js():
    js_path = os.path.join(TEMPLATES_DIR, "portal.js")
    if not os.path.exists(js_path):
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(
        js_path,
        media_type="application/javascript",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "X-Robots-Tag": "noindex, nofollow",
        },
    )
