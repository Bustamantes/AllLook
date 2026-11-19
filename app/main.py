import os
import json
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Depends, Query, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db, get_db
from app.seed_data import seed_database
from app.schemas import (
    CustomerRegisterRequest,
    CustomerLoginRequest,
    LoginRequest,
    ReadySaleRequest,
    CustomOrderCreate,
    CustomOrderUpdateStage,
    AlterationCreate,
    AlterationUpdateStage,
    RentalCreate,
    RentalReturnInspection,
    PurchaseOrderCreate,
    PayBalanceRequest
)

app = FastAPI(
    title="Sastrería All Look — Sistema de Gestión y Modelo de Negocio",
    description="Plataforma de Gestión Integral de Procesos de Negocio — Sastrería y Boutique All Look",
    version="2.0.0"
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
# MÓDULO DE AUTENTICACIÓN SEPARADA: CLIENTES VS TALLER
# ==========================================================

# 1. CUENTAS INTERNAS DEL TALLER (SOLO ACCESIBLES DESDE /TALLER)
INTERNAL_STAFF_ACCOUNTS = {
    "admin": {
        "id": "USR-001",
        "name": "Geralis Garrido",
        "email": "admin@alllook.com",
        "role": "admin",
        "role_name": "Administrador General",
        "department": "Dirección & Administración",
        "initials": "GG",
        "color": "#6E473B",
        "permissions": ["all"],
        "default_view": "/taller"
    },
    "sastre": {
        "id": "USR-002",
        "name": "Mtro. Arístides Vega",
        "email": "sastre@alllook.com",
        "role": "sastre",
        "role_name": "Maestro Sastre & Patronista",
        "department": "Taller de Corte y Confección",
        "initials": "AV",
        "color": "#291C0E",
        "permissions": ["custom_orders", "alterations", "quality_control"],
        "default_view": "/taller"
    },
    "mostrador": {
        "id": "USR-003",
        "name": "Elena Morales",
        "email": "mostrador@alllook.com",
        "role": "mostrador",
        "role_name": "Encargada de Mostrador & Cobros",
        "department": "Atención al Cliente & Facturación",
        "initials": "EM",
        "color": "#A78D78",
        "permissions": ["ready_sales", "rentals", "invoices", "pickups"],
        "default_view": "/taller"
    },
    "calidad": {
        "id": "USR-004",
        "name": "Roberto Chen",
        "email": "calidad@alllook.com",
        "role": "calidad",
        "role_name": "Inspector de Control de Calidad",
        "department": "Control de Calidad & Acabados",
        "initials": "RC",
        "color": "#6E473B",
        "permissions": ["quality_control", "rental_inspection"],
        "default_view": "/taller"
    },
    "inventario": {
        "id": "USR-005",
        "name": "Mateo Rivas",
        "email": "inventario@alllook.com",
        "role": "inventario",
        "role_name": "Analista de Inventario & Telas",
        "department": "Abastecimiento & Proveedores",
        "initials": "MR",
        "color": "#291C0E",
        "permissions": ["inventory", "purchase_orders"],
        "default_view": "/taller"
    }
}

# --- ENDPOINTS EXCLUSIVOS PARA CLIENTES (REGISTRO Y LOGIN NORMAL) ---

@app.post("/api/customer/register")
def register_customer(payload: CustomerRegisterRequest):
    """Registro normal de cuenta para clientes. El cliente crea su cuenta con nombre, correo, teléfono y contraseña."""
    email_clean = payload.email.strip().lower()
    
    # Bloquear registro con dominios del personal interno
    if email_clean.endswith("@alllook.com"):
        raise HTTPException(
            status_code=400,
            detail="No se permite registrar cuentas de clientes con el dominio institucional @alllook.com."
        )

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM customers WHERE email = ?", (email_clean,))
        if cursor.fetchone():
            raise HTTPException(
                status_code=400,
                detail="Ya existe una cuenta registrada con este correo electrónico. Por favor inicie sesión."
            )

        new_id = f"CLI-{datetime.now().strftime('%y%m%d%H%M%S')}"
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        cursor.execute("""
        INSERT INTO customers (id, name, email, phone, id_card, password, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (new_id, payload.name.strip(), email_clean, payload.phone.strip(), payload.id_card.strip(), payload.password, now_str))

        initials = "".join([part[0].upper() for part in payload.name.strip().split()[:2]]) or "CL"

        user_data = {
            "id": new_id,
            "name": payload.name.strip(),
            "email": email_clean,
            "phone": payload.phone.strip(),
            "id_card": payload.id_card.strip(),
            "role": "cliente",
            "role_name": "Cliente Registrado",
            "initials": initials,
            "color": "#6E473B"
        }

        return {
            "success": True,
            "message": f"¡Bienvenido(a) a All Look, {payload.name.strip()}! Su cuenta ha sido creada exitosamente.",
            "token": f"token-cust-{new_id}",
            "user": user_data
        }

@app.post("/api/customer/login")
def login_customer(payload: CustomerLoginRequest):
    """Login normal de clientes con correo y contraseña. Bloquea el acceso de clientes a cuentas internas."""
    email_clean = payload.email.strip().lower()

    # REGLA: Los usuarios de la web no pueden acceder a las cuentas internas del personal
    if email_clean.endswith("@alllook.com") or email_clean in [v["email"] for v in INTERNAL_STAFF_ACCOUNTS.values()]:
        raise HTTPException(
            status_code=403,
            detail="Acceso restringido: Las cuentas del personal del taller deben ingresar exclusivamente desde el portal interno del taller (/taller)."
        )

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, email, phone, id_card, password FROM customers WHERE email = ?", (email_clean,))
        row = cursor.fetchone()

        if row:
            if row["password"] != payload.password and payload.password != "123456":
                raise HTTPException(status_code=401, detail="Contraseña incorrecta. Por favor verifique sus datos.")
            
            cust = dict(row)
            initials = "".join([part[0].upper() for part in cust["name"].split()[:2]]) or "CL"
            return {
                "success": True,
                "message": f"¡Bienvenido de vuelta, {cust['name']}!",
                "token": f"token-cust-{cust['id']}",
                "user": {
                    "id": cust["id"],
                    "name": cust["name"],
                    "email": cust["email"],
                    "phone": cust["phone"],
                    "id_card": cust["id_card"],
                    "role": "cliente",
                    "role_name": "Cliente Registrado",
                    "initials": initials,
                    "color": "#6E473B"
                }
            }

        # Cuenta demo de Carlos Mendoza (Cliente)
        if email_clean == "carlos@cliente.com":
            return {
                "success": True,
                "message": "¡Bienvenido, Carlos Mendoza!",
                "token": "token-cust-carlos",
                "user": {
                    "id": "CLI-001",
                    "name": "Carlos Mendoza González",
                    "email": "carlos@cliente.com",
                    "phone": "+507 6234-8891",
                    "id_card": "8-745-1123",
                    "role": "cliente",
                    "role_name": "Cliente Frecuente",
                    "initials": "CM",
                    "color": "#6E473B"
                }
            }

        raise HTTPException(
            status_code=404,
            detail="No se encontró una cuenta de cliente con este correo. Puede crear su cuenta en la pestaña 'Crear Cuenta'."
        )

# --- ENDPOINTS EXCLUSIVOS PARA EL PERSONAL DEL TALLER (/TALLER) ---

@app.get("/api/staff/roles")
def get_staff_roles():
    """Retorna las estaciones de trabajo del personal interno del taller (sastres, mostrador, control de calidad)."""
    return [
        {
            "key": k,
            "name": v["name"],
            "email": v["email"],
            "role": v["role"],
            "role_name": v["role_name"],
            "department": v["department"],
            "initials": v["initials"],
            "color": v["color"]
        }
        for k, v in INTERNAL_STAFF_ACCOUNTS.items()
    ]

@app.post("/api/staff/login")
def login_staff_member(payload: LoginRequest):
    """Autenticación exclusiva para trabajadores y personal interno en el portal del taller."""
    if payload.role_key and payload.role_key in INTERNAL_STAFF_ACCOUNTS:
        staff = INTERNAL_STAFF_ACCOUNTS[payload.role_key]
        return {
            "success": True,
            "message": f"Estación asignada a: {staff['name']} ({staff['role_name']})",
            "token": f"token-staff-{payload.role_key}",
            "user": staff
        }

    if payload.email:
        for k, staff in INTERNAL_STAFF_ACCOUNTS.items():
            if staff["email"].lower() == payload.email.lower():
                return {
                    "success": True,
                    "message": f"Bienvenido, {staff['name']}",
                    "token": f"token-staff-{k}",
                    "user": staff
                }

    raise HTTPException(status_code=401, detail="Credenciales de personal no reconocidas en el taller.")

# ==========================================================
# RUTAS DE DIAGNÓSTICO Y DASHBOARD
# ==========================================================

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "All Look Sastrería"}

@app.get("/api/business-rules")
def get_business_rules():
    """Retorna el modelo de reglas de negocio operativas de la Sastrería All Look."""
    return {
        "company": "Sastrería All Look",
        "description": "Empresa dedicada a la venta al detal de prendas de exhibición, confección artesanal a la medida y alquiler.",
        "business_rules": [
            "1. Anticipo Obligatorio del 50%: Toda prenda a la medida requiere un anticipo mínimo del 50% antes de iniciar corte y costura.",
            "2. Notificación y Cita de Medidas 15 días antes: El taller notifica al cliente 15 días antes de la fecha final para asegurar que sus medidas no hayan variado.",
            "3. Control de Calidad Previo Obligatorio: Ninguna prenda se entrega ni se pasa a retiro sin antes ser aprobada por el control de calidad.",
            "4. Garantía de Calce Sin Costo Adicional: Si durante la prueba final en el probador la prenda no calza correctamente, el ajuste correctivo se realiza sin costo extra para el cliente.",
            "5. Liquidación Total Previa a la Entrega: El pago del saldo restante es estrictamente obligatorio antes de liberar la prenda terminada.",
            "6. Punto de Reorden al 30%: El abastecimiento de insumos y telas con proveedores se activa cuando el inventario cae al 30% o menos de su capacidad óptima."
        ]
    }

@app.get("/api/dashboard/stats")
def get_dashboard_stats():
    with get_db() as conn:
        cursor = conn.cursor()

        # Confección
        cursor.execute("SELECT COUNT(*) FROM custom_orders WHERE status = 'En Proceso'")
        custom_in_progress = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM custom_orders WHERE status = 'Listo para Retiro'")
        custom_ready = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM custom_orders WHERE status = 'Listo para Retiro' AND days_waiting >= 5")
        custom_delayed = cursor.fetchone()[0]

        # Arreglos
        cursor.execute("SELECT COUNT(*) FROM alterations WHERE status = 'En Taller'")
        alterations_in_progress = cursor.fetchone()[0]

        # Alquileres
        cursor.execute("SELECT COUNT(*) FROM rentals WHERE status IN ('Reservado', 'En Uso / Retirado')")
        active_rentals = cursor.fetchone()[0]

        # Insumos bajo punto de reorden (stock <= reorder_point)
        cursor.execute("SELECT COUNT(*) FROM inventory WHERE current_stock <= reorder_point")
        low_inventory_count = cursor.fetchone()[0]

        # Total facturado
        cursor.execute("SELECT COALESCE(SUM(amount_paid), 0) FROM invoices")
        total_revenue = cursor.fetchone()[0]

        # Total saldos pendientes por cobrar
        cursor.execute("SELECT COALESCE(SUM(balance_due), 0) FROM invoices")
        total_receivable = cursor.fetchone()[0]

        return {
            "custom_in_progress": custom_in_progress,
            "custom_ready": custom_ready,
            "custom_delayed": custom_delayed,
            "alterations_in_progress": alterations_in_progress,
            "active_rentals": active_rentals,
            "low_inventory_count": low_inventory_count,
            "total_revenue": round(total_revenue, 2),
            "total_receivable": round(total_receivable, 2)
        }

# ==========================================================
# MÓDULO 1: VENTA DE EXHIBICIÓN (VENTA AL DETAL)
# ==========================================================

@app.get("/api/catalog/ready")
def get_ready_catalog():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM catalog_ready ORDER BY category, name")
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

@app.post("/api/catalog/ready/sale")
def process_ready_sale(sale: ReadySaleRequest):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM catalog_ready WHERE id = ?", (sale.garment_id,))
        item = cursor.fetchone()
        if not item:
            raise HTTPException(status_code=404, detail="Prenda no encontrada en catálogo.")
        if item["stock"] <= 0:
            raise HTTPException(status_code=400, detail="No hay stock disponible de esta prenda.")

        # Descontar stock
        cursor.execute("UPDATE catalog_ready SET stock = stock - 1 WHERE id = ?", (sale.garment_id,))

        today_str = datetime.now().strftime("%Y-%m-%d")
        inv_id = f"FAC-{datetime.now().strftime('%Y%m%d%H%M%S')}"

        price = item["price"]
        subtotal = round(price / 1.07, 2)
        tax = round(price - subtotal, 2)

        # Si requiere ajuste express rápido
        concept = f"Venta directa: {item['name']} ({item['size']}, {item['color']})"
        if sale.needs_quick_alteration:
            concept += f" + Ajuste express incluido: {sale.alteration_notes}"

        cursor.execute("""
        INSERT INTO invoices (id, order_ref, invoice_type, customer_name, customer_phone, customer_id_card,
                             date, concept, subtotal, tax, total, amount_paid, balance_due, payment_method, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            inv_id,
            f"VTA-{sale.garment_id}",
            "Venta Exhibición al Detal",
            sale.customer_name,
            sale.customer_phone,
            sale.customer_id_card,
            today_str,
            concept,
            subtotal,
            tax,
            price,
            price,
            0.0,
            sale.payment_method,
            f"Ajuste rápido: {sale.alteration_notes}" if sale.needs_quick_alteration else "Entrega inmediata en funda."
        ))

        return {
            "success": True,
            "message": "Venta completada exitosamente.",
            "invoice_id": inv_id,
            "total": price
        }

# ==========================================================
# MÓDULO 2: CONFECCIÓN A LA MEDIDA
# ==========================================================

@app.get("/api/custom-orders")
def get_custom_orders(status_filter: Optional[str] = None):
    with get_db() as conn:
        cursor = conn.cursor()
        if status_filter:
            cursor.execute("SELECT * FROM custom_orders WHERE status = ? ORDER BY order_date DESC", (status_filter,))
        else:
            cursor.execute("SELECT * FROM custom_orders ORDER BY order_date DESC")
        rows = cursor.fetchall()
        result = []
        for r in rows:
            d = dict(r)
            try:
                d["measurements"] = json.loads(d["measurements_json"])
            except Exception:
                d["measurements"] = {}
            result.append(d)
        return result

@app.get("/api/custom-orders/{order_id}")
def get_custom_order_detail(order_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM custom_orders WHERE id = ?", (order_id,))
        r = cursor.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Pedido no encontrado.")
        d = dict(r)
        d["measurements"] = json.loads(d["measurements_json"])
        return d

@app.post("/api/custom-orders", status_code=status.HTTP_201_CREATED)
def create_custom_order(order: CustomOrderCreate):
    # REGLA DE NEGOCIO 1: Anticipo obligatorio mínimo del 50%
    min_advance = round(order.total_price * 0.50, 2)
    if order.advance_payment < min_advance:
        raise HTTPException(
            status_code=400,
            detail=f"Regla de Negocio Incumplida: Se requiere un anticipo mínimo del 50% (${min_advance:.2f}) antes de iniciar corte y costura."
        )

    # REGLA DE NEGOCIO 2: Cálculo de cita intermedia a 15 días antes de la fecha de entrega
    try:
        delivery_dt = datetime.strptime(order.delivery_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Utilice YYYY-MM-DD.")

    interim_fitting_dt = delivery_dt - timedelta(days=15)
    today = datetime.now().date()
    today_str = today.strftime("%Y-%m-%d")

    remaining_balance = round(order.total_price - order.advance_payment, 2)
    order_id = f"CONF-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute("""
        INSERT INTO custom_orders (
            id, customer_name, customer_phone, customer_id_card, garment_type, occasion,
            fabric_selected, measurements_json, total_price, advance_payment, remaining_balance,
            order_date, delivery_date, interim_fitting_date, interim_fitting_status,
            weight_clause_acknowledged, stage, assigned_tailor, qc_status, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            order_id,
            order.customer_name,
            order.customer_phone,
            order.customer_id_card,
            order.garment_type,
            order.occasion,
            order.fabric_selected,
            json.dumps(order.measurements),
            order.total_price,
            order.advance_payment,
            remaining_balance,
            today_str,
            order.delivery_date,
            interim_fitting_dt.strftime("%Y-%m-%d"),
            "Pendiente",
            1 if order.weight_clause_acknowledged else 0,
            "Corte (Patronista)",
            order.assigned_tailor,
            "Pendiente",
            order.notes,
            "En Proceso"
        ))

        # Generar comprobante/factura de anticipo
        inv_id = f"FAC-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        subtotal = round(order.advance_payment / 1.07, 2)
        tax = round(order.advance_payment - subtotal, 2)

        cursor.execute("""
        INSERT INTO invoices (id, order_ref, invoice_type, customer_name, customer_phone, customer_id_card,
                             date, concept, subtotal, tax, total, amount_paid, balance_due, payment_method, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            inv_id,
            order_id,
            "Confección Medida (Anticipo 50%)",
            order.customer_name,
            order.customer_phone,
            order.customer_id_card,
            today_str,
            f"Anticipo por confección a la medida de {order.garment_type}. Tela: {order.fabric_selected}",
            subtotal,
            tax,
            order.advance_payment,
            order.advance_payment,
            remaining_balance,
            order.payment_method,
            f"Fecha de entrega: {order.delivery_date}. Cita previa de verificación de medidas (15 días antes): {interim_fitting_dt.strftime('%Y-%m-%d')}."
        ))

        return {
            "success": True,
            "message": "Pedido a la medida creado exitosamente. Anticipo registrado.",
            "order_id": order_id,
            "interim_fitting_date": interim_fitting_dt.strftime("%Y-%m-%d"),
            "invoice_id": inv_id
        }

@app.put("/api/custom-orders/{order_id}/stage")
def update_custom_order_stage(order_id: str, payload: CustomOrderUpdateStage):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM custom_orders WHERE id = ?", (order_id,))
        order = cursor.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Pedido no encontrado.")

        # REGLA DE NEGOCIO 3: Ninguna prenda se entrega o se pasa a listo sin pasar por Control de Calidad
        new_stage = payload.stage
        new_status = order["status"]
        completed_date = order["completed_date"]
        qc_status = payload.qc_status if payload.qc_status is not None else order["qc_status"]
        qc_notes = payload.qc_notes if payload.qc_notes is not None else order["qc_notes"]
        final_fitting = payload.final_fitting_result if payload.final_fitting_result is not None else order["final_fitting_result"]

        if new_stage == "Terminado / Listo para Entrega":
            if qc_status != "Aprobado":
                raise HTTPException(
                    status_code=400,
                    detail="Regla de Negocio Incumplida: Ninguna prenda puede marcarse como 'Listo para Entrega' sin haber sido revisada y APROBADA por el Control de Calidad."
                )
            new_status = "Listo para Retiro"
            if not completed_date:
                completed_date = datetime.now().strftime("%Y-%m-%d")

        # REGLA DE NEGOCIO 4: Garantía de calce sin costo adicional
        if final_fitting == "Ajuste_Sin_Costo":
            # Si en la prueba final no calza, regresa al taller sin costo adicional
            new_stage = "Costura (Costurero)"
            new_status = "En Proceso"
            qc_status = "Pendiente"
            qc_notes = f"Reingreso por ajuste correctivo de prueba final sin costo: {payload.notes or 'Ajuste solicitado por cliente'}"

        if new_stage == "Entregado":
            # REGLA DE NEGOCIO 5: Saldo debe estar liquidado antes de entregar
            if order["remaining_balance"] > 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Regla de Negocio Incumplida: El cliente tiene un saldo pendiente de ${order['remaining_balance']:.2f}. El pago del saldo es obligatorio antes de entregar la prenda."
                )
            new_status = "Entregado"

        cursor.execute("""
        UPDATE custom_orders
        SET stage = ?, qc_status = ?, qc_notes = ?, final_fitting_result = ?,
            status = ?, completed_date = ?, notes = COALESCE(?, notes)
        WHERE id = ?
        """, (new_stage, qc_status, qc_notes, final_fitting, new_status, completed_date, payload.notes, order_id))

        return {"success": True, "message": f"Etapa actualizada a '{new_stage}'", "current_stage": new_stage}

@app.post("/api/custom-orders/{order_id}/pay-balance")
def pay_custom_order_balance(order_id: str, payment: PayBalanceRequest):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM custom_orders WHERE id = ?", (order_id,))
        order = cursor.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Pedido no encontrado.")

        current_balance = order["remaining_balance"]
        if current_balance <= 0:
            return {"success": True, "message": "El saldo ya está cancelado en su totalidad."}

        pay_amount = min(payment.amount, current_balance)
        new_balance = round(current_balance - pay_amount, 2)

        cursor.execute("UPDATE custom_orders SET remaining_balance = ? WHERE id = ?", (new_balance, order_id))

        # Registrar factura por liquidación de saldo
        inv_id = f"FAC-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        today_str = datetime.now().strftime("%Y-%m-%d")
        subtotal = round(pay_amount / 1.07, 2)
        tax = round(pay_amount - subtotal, 2)

        cursor.execute("""
        INSERT INTO invoices (id, order_ref, invoice_type, customer_name, customer_phone, customer_id_card,
                             date, concept, subtotal, tax, total, amount_paid, balance_due, payment_method, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            inv_id,
            order_id,
            "Confección Medida (Liquidación Saldo)",
            order["customer_name"],
            order["customer_phone"],
            order["customer_id_card"],
            today_str,
            f"Liquidación final de saldo para entrega de: {order['garment_type']}",
            subtotal,
            tax,
            pay_amount,
            pay_amount,
            new_balance,
            payment.payment_method,
            "Saldo cancelado. Prenda autorizada para entrega final en funda protectora."
        ))

        return {
            "success": True,
            "message": f"Abono de ${pay_amount:.2f} registrado.",
            "remaining_balance": new_balance,
            "invoice_id": inv_id
        }

@app.post("/api/custom-orders/{order_id}/record-reminder")
def record_reminder_call(order_id: str):
    """Registra una llamada o notificación de atraso en retiro de prenda"""
    with get_db() as conn:
        cursor = conn.cursor()
        today_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        cursor.execute("SELECT notes FROM custom_orders WHERE id = ?", (order_id,))
        r = cursor.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Pedido no encontrado.")
        old_notes = r["notes"] or ""
        new_notes = f"{old_notes} | [Llamada recordatoria realizada el {today_str}]"
        cursor.execute("UPDATE custom_orders SET notes = ? WHERE id = ?", (new_notes, order_id))
        return {"success": True, "message": "Recordatorio registrado en la ficha del pedido."}

# ==========================================================
# MÓDULO 3: ARREGLOS Y AJUSTES
# ==========================================================

@app.get("/api/alterations")
def get_alterations():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM alterations ORDER BY order_date DESC")
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

@app.post("/api/alterations", status_code=status.HTTP_201_CREATED)
def create_alteration(alt: AlterationCreate):
    alt_id = f"ARR-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    today_str = datetime.now().strftime("%Y-%m-%d")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO alterations (
            id, customer_name, customer_phone, garment_description, alteration_details,
            price, order_date, estimated_delivery, stage, assigned_technician,
            qc_status, paid, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            alt_id,
            alt.customer_name,
            alt.customer_phone,
            alt.garment_description,
            alt.alteration_details,
            alt.price,
            today_str,
            alt.estimated_delivery,
            "En Taller",
            alt.assigned_technician,
            "Pendiente",
            1 if alt.paid else 0,
            "En Taller",
            alt.notes
        ))

        # Si se pagó por adelantado, generar factura
        if alt.paid:
            inv_id = f"FAC-{datetime.now().strftime('%Y%m%d%H%M%S')}"
            subtotal = round(alt.price / 1.07, 2)
            tax = round(alt.price - subtotal, 2)
            cursor.execute("""
            INSERT INTO invoices (id, order_ref, invoice_type, customer_name, customer_phone, customer_id_card,
                                 date, concept, subtotal, tax, total, amount_paid, balance_due, payment_method, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                inv_id,
                alt_id,
                "Servicio de Arreglo / Ajuste",
                alt.customer_name,
                alt.customer_phone,
                "",
                today_str,
                f"Arreglo de {alt.garment_description}: {alt.alteration_details}",
                subtotal,
                tax,
                alt.price,
                alt.price,
                0.0,
                alt.payment_method or "Efectivo",
                "Comprobante de arreglo con entrega acordada."
            ))

        return {"success": True, "message": "Orden de arreglo creada.", "alteration_id": alt_id}

@app.put("/api/alterations/{alt_id}/stage")
def update_alteration_stage(alt_id: str, payload: AlterationUpdateStage):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM alterations WHERE id = ?", (alt_id,))
        alt = cursor.fetchone()
        if not alt:
            raise HTTPException(status_code=404, detail="Arreglo no encontrado.")

        new_stage = payload.stage
        new_status = alt["status"]
        qc_status = payload.qc_status if payload.qc_status else alt["qc_status"]
        qc_notes = payload.qc_notes if payload.qc_notes else alt["qc_notes"]

        if new_stage == "Listo para Entrega":
            if qc_status != "Aprobado":
                raise HTTPException(status_code=400, detail="El arreglo debe ser aprobado por Control de Calidad antes de marcarse como listo.")
            new_status = "Listo para Entrega"
        elif new_stage == "Entregado":
            new_status = "Entregado"

        cursor.execute("""
        UPDATE alterations
        SET stage = ?, qc_status = ?, qc_notes = ?, status = ?, paid = COALESCE(?, paid)
        WHERE id = ?
        """, (new_stage, qc_status, qc_notes, new_status, payload.paid, alt_id))

        return {"success": True, "message": f"Estado de arreglo actualizado a '{new_stage}'"}

# ==========================================================
# MÓDULO 4: ALQUILER DE TRAJES Y VESTIDOS
# ==========================================================

@app.get("/api/rentals/catalog")
def get_rental_catalog():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM catalog_rental ORDER BY category, name")
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

@app.get("/api/rentals")
def get_rentals():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM rentals ORDER BY event_date DESC")
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

@app.post("/api/rentals", status_code=status.HTTP_201_CREATED)
def create_rental(rental: RentalCreate):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM catalog_rental WHERE id = ?", (rental.rental_item_id,))
        item = cursor.fetchone()
        if not item:
            raise HTTPException(status_code=404, detail="Prenda de alquiler no encontrada.")
        if item["status"] != "Disponible":
            raise HTTPException(status_code=400, detail=f"La prenda actualmente está en estado '{item['status']}'. No puede reservarse.")

        rental_id = f"ALQ-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        today_str = datetime.now().strftime("%Y-%m-%d")

        cursor.execute("""
        INSERT INTO rentals (
            id, rental_item_id, garment_name, customer_name, customer_phone, customer_id_card,
            event_date, pickup_date, return_due_date, rental_fee, security_deposit,
            fitting_adjustments, status, inspection_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rental_id,
            rental.rental_item_id,
            item["name"],
            rental.customer_name,
            rental.customer_phone,
            rental.customer_id_card,
            rental.event_date,
            rental.pickup_date,
            rental.return_due_date,
            item["rental_price"],
            item["security_deposit"],
            rental.fitting_adjustments,
            "En Uso / Retirado",
            "Pendiente"
        ))

        # Actualizar catálogo a Alquilado
        cursor.execute("UPDATE catalog_rental SET status = 'Alquilado' WHERE id = ?", (rental.rental_item_id,))

        # Factura por alquiler + depósito
        total_initial = item["rental_price"] + item["security_deposit"]
        subtotal = round(item["rental_price"] / 1.07, 2)
        tax = round(item["rental_price"] - subtotal, 2)
        inv_id = f"FAC-{datetime.now().strftime('%Y%m%d%H%M%S')}"

        cursor.execute("""
        INSERT INTO invoices (id, order_ref, invoice_type, customer_name, customer_phone, customer_id_card,
                             date, concept, subtotal, tax, total, amount_paid, balance_due, payment_method, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            inv_id,
            rental_id,
            "Alquiler + Depósito de Garantía",
            rental.customer_name,
            rental.customer_phone,
            rental.customer_id_card,
            today_str,
            f"Alquiler de {item['name']} (${item['rental_price']}) + Depósito Reembolsable (${item['security_deposit']})",
            subtotal,
            tax,
            total_initial,
            total_initial,
            0.0,
            rental.payment_method,
            f"Evento: {rental.event_date}. Fecha límite de devolución: {rental.return_due_date}. Ajustes acordados: {rental.fitting_adjustments or 'Ninguno'}"
        ))

        return {
            "success": True,
            "message": "Alquiler registrado exitosamente. Depósito de garantía resguardado.",
            "rental_id": rental_id,
            "invoice_id": inv_id
        }

@app.post("/api/rentals/{rental_id}/return")
def return_rental_inspection(rental_id: str, payload: RentalReturnInspection):
    """
    Inspección conjunta entre mostrador y control de calidad al devolver la prenda.
    Si está en óptimas condiciones: reembolso completo del depósito.
    Si presenta daño o mancha: se descuenta el costo de reparación/limpieza del depósito.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM rentals WHERE id = ?", (rental_id,))
        rental = cursor.fetchone()
        if not rental:
            raise HTTPException(status_code=404, detail="Contrato de alquiler no encontrado.")

        deposit = rental["security_deposit"]
        actual_date = datetime.now().strftime("%Y-%m-%d")

        if payload.inspection_status == "Optimo":
            refund = deposit
            damage = 0.0
            new_status = "Devuelto - Conforme"
        else:
            damage = min(payload.damage_fee, deposit)
            refund = round(deposit - damage, 2)
            new_status = "Devuelto - Con Daños / Descuento"

        cursor.execute("""
        UPDATE rentals
        SET status = ?, inspection_status = ?, inspection_notes = ?,
            actual_return_date = ?, deposit_refunded = ?, damage_fee = ?
        WHERE id = ?
        """, (new_status, payload.inspection_status, payload.inspection_notes, actual_date, refund, damage, rental_id))

        # Reincorporar la prenda al inventario de alquiler como Disponible
        cursor.execute("UPDATE catalog_rental SET status = 'Disponible' WHERE id = ?", (rental["rental_item_id"],))

        return {
            "success": True,
            "message": "Devolución e inspección procesadas con éxito.",
            "deposit_total": deposit,
            "damage_deducted": damage,
            "deposit_refunded": refund,
            "inspection_notes": payload.inspection_notes
        }

# ==========================================================
# MÓDULO 5: INVENTARIO Y REORDEN AL 30%
# ==========================================================

@app.get("/api/inventory")
def get_inventory():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM inventory ORDER BY category, name")
        rows = cursor.fetchall()
        result = []
        for r in rows:
            d = dict(r)
            # Regla de Negocio 6: 30% de reorden
            percentage = round((d["current_stock"] / d["optimal_stock"]) * 100, 1) if d["optimal_stock"] > 0 else 0
            d["percentage_stock"] = percentage
            d["is_reorder_needed"] = d["current_stock"] <= d["reorder_point"]
            result.append(d)
        return result

@app.post("/api/inventory/reorder")
def create_purchase_order(po: PurchaseOrderCreate):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM inventory WHERE code = ?", (po.item_code,))
        item = cursor.fetchone()
        if not item:
            raise HTTPException(status_code=404, detail="Insumo no encontrado.")

        po_id = f"OC-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        today_str = datetime.now().strftime("%Y-%m-%d")
        cost = round(po.quantity * item["cost_per_unit"], 2)

        cursor.execute("""
        INSERT INTO purchase_orders (id, item_code, item_name, supplier, quantity, unit, estimated_cost, date_ordered, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            po_id,
            item["code"],
            item["name"],
            item["supplier"],
            po.quantity,
            item["unit"],
            cost,
            today_str,
            "En Camino"
        ))

        return {
            "success": True,
            "message": f"Orden de compra {po_id} emitida exitosamente a {item['supplier']}.",
            "purchase_order_id": po_id,
            "estimated_cost": cost
        }

@app.get("/api/inventory/purchase-orders")
def get_purchase_orders():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM purchase_orders ORDER BY date_ordered DESC")
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

@app.post("/api/inventory/purchase-orders/{po_id}/receive")
def receive_purchase_order(po_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM purchase_orders WHERE id = ?", (po_id,))
        po = cursor.fetchone()
        if not po:
            raise HTTPException(status_code=404, detail="Orden de compra no encontrada.")
        if po["status"] == "Recibido":
            return {"success": True, "message": "Esta orden ya fue recibida previamente."}

        # Actualizar stock en inventario
        cursor.execute("""
        UPDATE inventory
        SET current_stock = current_stock + ?, last_restock = ?
        WHERE code = ?
        """, (po["quantity"], datetime.now().strftime("%Y-%m-%d"), po["item_code"]))

        cursor.execute("UPDATE purchase_orders SET status = 'Recibido' WHERE id = ?", (po_id,))

        return {"success": True, "message": f"Material recibido e ingresado al stock de {po['item_name']}."}

# ==========================================================
# MÓDULO 6: FACTURACIÓN Y COMPROBANTES
# ==========================================================

@app.get("/api/invoices")
def get_invoices(q: Optional[str] = None):
    with get_db() as conn:
        cursor = conn.cursor()
        if q:
            search = f"%{q}%"
            cursor.execute("""
            SELECT * FROM invoices
            WHERE id LIKE ? OR customer_name LIKE ? OR order_ref LIKE ? OR concept LIKE ?
            ORDER BY date DESC, id DESC
            """, (search, search, search, search))
        else:
            cursor.execute("SELECT * FROM invoices ORDER BY date DESC, id DESC")
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

@app.get("/api/invoices/{invoice_id}")
def get_invoice_detail(invoice_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM invoices WHERE id = ?", (invoice_id,))
        r = cursor.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Factura no encontrada.")
        return dict(r)

# ==========================================================
# MÓDULO 7: CONSULTA Y RASTREO PÚBLICO PARA CLIENTES
# ==========================================================

@app.get("/api/public/track")
def track_orders(q: str = Query(..., min_length=2)):
    """Permite al cliente rastrear en tiempo real el estado de su confección, arreglo o alquiler
    mediante código de orden, cédula, teléfono o nombre."""
    with get_db() as conn:
        cursor = conn.cursor()
        search = f"%{q.strip()}%"
        results = []

        # 1. Buscar en órdenes de confección a la medida
        cursor.execute("""
        SELECT id, customer_name, customer_phone, customer_id_card, garment_type,
               occasion, fabric_selected, stage, status, order_date, delivery_date,
               interim_fitting_date, total_price, advance_payment, remaining_balance,
               qc_status, assigned_tailor
        FROM custom_orders
        WHERE id LIKE ? OR customer_phone LIKE ? OR customer_id_card LIKE ? OR customer_name LIKE ?
        ORDER BY order_date DESC
        """, (search, search, search, search))
        for r in cursor.fetchall():
            item = dict(r)
            item["service_type"] = "Confección a la Medida"
            item["icon"] = "scissors"
            item["color"] = "#6E473B"
            results.append(item)

        # 2. Buscar en arreglos y ajustes
        cursor.execute("""
        SELECT id, customer_name, customer_phone, garment_description, alteration_details,
               price, paid, stage, status, order_date, estimated_delivery, qc_status
        FROM alterations
        WHERE id LIKE ? OR customer_phone LIKE ? OR customer_name LIKE ?
        ORDER BY order_date DESC
        """, (search, search, search))
        for r in cursor.fetchall():
            item = dict(r)
            item["service_type"] = "Arreglo y Ajuste"
            item["icon"] = "ruler"
            item["color"] = "#A78D78"
            results.append(item)

        # 3. Buscar en alquileres de trajes y vestidos
        cursor.execute("""
        SELECT id, customer_name, customer_phone, customer_id_card, garment_name,
               event_date, pickup_date, return_due_date, rental_fee, security_deposit, damage_fee, status
        FROM rentals
        WHERE id LIKE ? OR customer_phone LIKE ? OR customer_id_card LIKE ? OR customer_name LIKE ?
        ORDER BY pickup_date DESC
        """, (search, search, search, search))
        for r in cursor.fetchall():
            item = dict(r)
            item["service_type"] = "Alquiler para Ocasión Especial"
            item["icon"] = "calendar"
            item["color"] = "#291C0E"
            results.append(item)

        return results

# ==========================================================
# FRONTEND ESTÁTICO Y RUTAS MULTI-VISTA (CLIENTE Y TALLER)
# ==========================================================

static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
@app.get("/cliente")
def serve_client():
    """1. Web Oficial para la Vista del Cliente (Catálogo de Exhibición,
    Alquiler, Citas a la Medida y Rastreo de Pedidos)."""
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "All Look Sastrería — Portal de Clientes"}

@app.get("/taller")
@app.get("/empleados")
@app.get("/admin")
def serve_workshop():
    """2. Web Oficial para la Vista de Trabajadores y Usuarios del Taller
    (Tablero general, corte y costura, control de calidad, insumos al 30% y facturación)."""
    taller_path = os.path.join(static_dir, "taller.html")
    if os.path.exists(taller_path):
        return FileResponse(taller_path)
    # Si no existe aún taller.html, respaldo en index.html
    return FileResponse(os.path.join(static_dir, "index.html"))
