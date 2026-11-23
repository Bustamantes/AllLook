import json
from datetime import datetime, timedelta
from app.database import get_db
from app.security import (
    ADMIN_DEFAULT_PASSWORD,
    STAFF_DEFAULT_PASSWORD,
    WORKSHOP_VIEWS,
    hash_password,
)


def seed_database():
    with get_db() as conn:
        cursor = conn.cursor()
        today = datetime.now().date()
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # ----------------------------------------------------------
        # 1. CUENTAS DE TRABAJADORES (SOLO ROLES, SIN NOMBRES PROPIOS)
        # ----------------------------------------------------------
        cursor.execute("SELECT COUNT(*) FROM staff_users")
        if cursor.fetchone()[0] == 0:
            all_views = [v["key"] for v in WORKSHOP_VIEWS]
            staff_seed = [
                (
                    "STF-ADMIN",
                    "admin",
                    "Administrador General",
                    "admin",
                    hash_password(ADMIN_DEFAULT_PASSWORD),
                    json.dumps(all_views),
                    1,
                    now_str,
                ),
                (
                    "STF-MOST",
                    "mostrador",
                    "Mostrador / Caja",
                    "mostrador",
                    hash_password(STAFF_DEFAULT_PASSWORD),
                    json.dumps(["mostrador", "facturacion"]),
                    1,
                    now_str,
                ),
                (
                    "STF-SAST",
                    "sastre",
                    "Sastre Patronista",
                    "sastre",
                    hash_password(STAFF_DEFAULT_PASSWORD),
                    json.dumps(["sastre"]),
                    1,
                    now_str,
                ),
                (
                    "STF-INV",
                    "inventario",
                    "Analista de Inventario",
                    "inventario",
                    hash_password(STAFF_DEFAULT_PASSWORD),
                    json.dumps(["inventario"]),
                    1,
                    now_str,
                ),
                (
                    "STF-CAL",
                    "calidad",
                    "Control de Calidad",
                    "calidad",
                    hash_password(STAFF_DEFAULT_PASSWORD),
                    json.dumps(["calidad"]),
                    1,
                    now_str,
                ),
            ]
            cursor.executemany(
                """
                INSERT INTO staff_users (id, username, role_label, role_type, password_hash, allowed_views_json, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                staff_seed,
            )

        # ----------------------------------------------------------
        # 2. INVENTARIO DE TELAS E INSUMOS (REGLA DEL 30%)
        # ----------------------------------------------------------
        cursor.execute("SELECT COUNT(*) FROM inventory")
        if cursor.fetchone()[0] == 0:
            supplies = [
                ("TEL-001", "Lana Italiana Super 120s (Azul Marino)", "Telas", "metros", 14.0, 50.0, 45.00, "Tessuti Di Milano Import"),
                ("TEL-002", "Lino Suizo Premium (Blanco Hueso)", "Telas", "metros", 35.0, 60.0, 32.50, "Importaciones Textiles Colón"),
                ("TEL-003", "Seda Salvaje Tornasol (Borgoña)", "Telas", "metros", 8.0, 40.0, 55.00, "Alta Costura Internacional"),
                ("TEL-004", "Gabardina Inglesa Elástica (Negro)", "Telas", "metros", 42.0, 70.0, 24.00, "Textiles del Pacífico"),
                ("TEL-005", "Algodón Egipcio 100% Peinado (Azul Cielo)", "Telas", "metros", 18.0, 80.0, 28.00, "Importaciones Textiles Colón"),
                ("TEL-006", "Dril Algodón Reforzado (Caqui)", "Telas", "metros", 50.0, 60.0, 16.50, "Distribuidora Nacional"),
                ("HIL-001", "Hilo Poliéster Gutermann Alta Resistencia (Negro)", "Hilos", "carretes", 6.0, 30.0, 4.50, "Mercería Central"),
                ("HIL-002", "Hilo de Torzal para Ojales y Puntadas (Gris)", "Hilos", "carretes", 15.0, 25.0, 5.20, "Mercería Central"),
                ("BOT-001", "Botones Nácar Natural 4 Agujeros (20mm)", "Botones", "unidades", 120.0, 500.0, 0.45, "Insumos Sastrería S.A."),
                ("BOT-002", "Botones Blazer Metálicos Dorados Cresta", "Botones", "unidades", 45.0, 150.0, 1.20, "Insumos Sastrería S.A."),
                ("CIE-001", "Cierres / Cremalleras Metálicas YKK 18cm", "Cierres", "unidades", 85.0, 200.0, 0.95, "Distribuidora Nacional"),
                ("ENT-001", "Entretela Termoadhesiva de Crin de Caballo", "Entretelas", "metros", 22.0, 50.0, 12.00, "Tessuti Di Milano Import"),
            ]
            for s in supplies:
                reorder_point = round(s[5] * 0.30, 2)
                cursor.execute(
                    """
                    INSERT INTO inventory (code, name, category, unit, current_stock, optimal_stock, reorder_point, cost_per_unit, supplier, last_restock)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (s[0], s[1], s[2], s[3], s[4], s[5], reorder_point, s[6], s[7], (today - timedelta(days=20)).strftime("%Y-%m-%d")),
                )

        # ----------------------------------------------------------
        # 3. CATÁLOGO DE PIEZAS EXHIBIDAS (IMÁGENES LOCALES)
        # ----------------------------------------------------------
        cursor.execute("SELECT COUNT(*) FROM catalog_ready")
        if cursor.fetchone()[0] == 0:
            ready_garments = [
                (
                    "Traje Slim Fit Ejecutivo Gris Marengo",
                    "Trajes",
                    "40R",
                    "Gris Oscuro",
                    "Slim Fit 2 Piezas",
                    285.00,
                    4,
                    "Saco de solapa de muesca con estructura ligera y pantalón de corte recto entallado. Ideal para reuniones ejecutivas y ceremonias de etiqueta.",
                    "/static/img/suit_grey.jpg",
                    "Lana fría italiana Super 120s con forro de acetato respirable",
                    "Entrega inmediata (24h si solicita ajuste express en taller)",
                    "Lavado en seco profesional. Guardar en funda respirable con horma de madera.",
                ),
                (
                    "Traje Formal Azul Real Dos Botones",
                    "Trajes",
                    "38R",
                    "Azul Real",
                    "Corte Moderno",
                    295.00,
                    3,
                    "Silueta contemporánea en azul profundo con botones de cuerno oscurecido, doble abertura trasera y pespunte sartorial en solapa.",
                    "/static/img/suit_blue.jpg",
                    "Lana virgen peinada 2 cabos con caída natural",
                    "Entrega inmediata (24h si solicita ajuste express en taller)",
                    "Lavado en seco especializado. Vaporizar suavemente antes de usar.",
                ),
                (
                    "Vestido Cóctel Escote Asimétrico",
                    "Vestidos",
                    "M",
                    "Verde Esmeralda",
                    "Lápiz Cóctel",
                    195.00,
                    2,
                    "Diseño arquitectónico de hombro asimétrico, entalle en cintura mediante pinzas francesas y cierre invisible lateral.",
                    "/static/img/dress_emerald.jpg",
                    "Satén italiano estructurado con forro interior suave",
                    "Entrega inmediata (24-48h con ajuste de bastilla o entalle)",
                    "Limpieza en tintorería delicada. No retorcer ni exponer a plancha directa.",
                ),
                (
                    "Guayabera Presidencial Lino Fino Alforzada",
                    "Camisas",
                    "L",
                    "Blanco Puro",
                    "Manga Larga Cuatro Bolsillos",
                    135.00,
                    5,
                    "Confección artesanal de cuatro bolsillos con 12 hileras de alforzas frontales y espalda limpia, fresca para clima tropical formal.",
                    "/static/img/shirt_linen.jpg",
                    "100% lino suizo puro de fibra larga",
                    "Entrega inmediata (24h con ajuste de mangas)",
                    "Lavado suave con agua fría o lavado en seco. Planchar ligeramente húmeda.",
                ),
                (
                    "Camisa Oxford Cuello Francés Entallada",
                    "Camisas",
                    "M (15.5)",
                    "Azul Celeste",
                    "Formal Slim",
                    65.00,
                    8,
                    "Camisa de vestir con entretela firme en cuello francés, puños biselados para mancuernilla y costuras de aguja simple.",
                    "/static/img/shirt_oxford.jpg",
                    "100% algodón egipcio mercerizado doble cabo",
                    "Entrega inmediata (24h con entalle de costados)",
                    "Lavado delicado máximo 30°C. Planchado en cuello y puños sin vapor excesivo.",
                ),
                (
                    "Pantalón de Vestir Corte Clásico con Pliegues",
                    "Pantalones",
                    "32W",
                    "Negro Profundo",
                    "Clásico Formal",
                    75.00,
                    6,
                    "Pantalón de talle medio con pinza doble frontal, pretina extendida con broche oculto y refuerzo interior en basta.",
                    "/static/img/pants_black.jpg",
                    "Lana fría con mezcla técnica antiarrugas",
                    "Entrega inmediata (24h para ajuste de bastilla)",
                    "Lavado en seco o programa delicado. Preservar raya con prensado ligero.",
                ),
            ]
            cursor.executemany(
                """
                INSERT INTO catalog_ready (name, category, size, color, style, price, stock, description, image_url, fabric, delivery_time, care_instructions)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                ready_garments,
            )

        # ----------------------------------------------------------
        # 4. TICKETS DEL FLUJO DE 6 PASOS Y SOLICITUDES DE TELAS
        # ----------------------------------------------------------
        cursor.execute("SELECT COUNT(*) FROM workshop_tickets")
        if cursor.fetchone()[0] == 0:
            d_22 = (today + timedelta(days=22)).strftime("%Y-%m-%d")
            i_7 = (today + timedelta(days=7)).strftime("%Y-%m-%d")
            d_18 = (today + timedelta(days=18)).strftime("%Y-%m-%d")
            i_3 = (today + timedelta(days=3)).strftime("%Y-%m-%d")
            d_5 = (today + timedelta(days=5)).strftime("%Y-%m-%d")
            i_minus_10 = (today - timedelta(days=10)).strftime("%Y-%m-%d")
            ready_minus_6 = (today - timedelta(days=6)).strftime("%Y-%m-%d")

            def hist(entries):
                return json.dumps(entries, ensure_ascii=False)

            tickets = [
                # 1) Solicitud recibida desde la Web esperando confirmación en Mostrador / Caja
                (
                    "PED-2026-001",
                    "Web",
                    "Confección a la Medida",
                    None,
                    "Andrea Morales",
                    "+507 6401-2289",
                    "8-912-340",
                    "Traje Sastre Femenino 2 Piezas",
                    "Presentación Ejecutiva",
                    "Lino Suizo Premium (Blanco Hueso)",
                    json.dumps({}),
                    "Solicitado desde la web pública. Pendiente de recepción y cobro de anticipo del 50% en Mostrador.",
                    360.00,
                    0.00,
                    360.00,
                    today.strftime("%Y-%m-%d"),
                    "",
                    "",
                    0,
                    1,
                    "SOLICITUD_WEB",
                    "Pendiente",
                    "",
                    None,
                    None,
                    0,
                    "",
                    "Portal Web Cliente",
                    hist([{"fecha": now_str, "rol": "Cliente (Web)", "accion": "Solicitud enviada desde la web", "nota": "Requiere confirmación y anticipo en Mostrador / Caja."}]),
                ),
                # 2) En Patronaje y Toma de Medidas (Mostrador ya cobró anticipo >= 50%)
                (
                    "PED-2026-002",
                    "Mostrador",
                    "Confección a la Medida",
                    None,
                    "Carlos Mendoza González",
                    "+507 6234-8891",
                    "8-745-1123",
                    "Traje Formal 2 Piezas a Medida",
                    "Boda Familiar",
                    "Lana Italiana Super 120s (Azul Marino)",
                    json.dumps({"cuello": 41.5, "pecho": 104.0, "cintura": 88.0, "cadera": 102.0, "hombro_a_hombro": 46.0, "largo_manga": 64.0, "largo_pantalon": 102.0}),
                    "Forro guinda seleccionado. Listo para completar registro de medidas y pedir tela a Inventario.",
                    480.00,
                    240.00,
                    240.00,
                    (today - timedelta(days=4)).strftime("%Y-%m-%d"),
                    d_22,
                    i_7,
                    0,
                    1,
                    "EN_PATRONAJE_MEDIDAS",
                    "Pendiente",
                    "",
                    None,
                    None,
                    0,
                    "",
                    "Mostrador / Caja",
                    hist([
                        {"fecha": (today - timedelta(days=4)).strftime("%Y-%m-%d 10:15"), "rol": "Mostrador / Caja", "accion": "Pedido registrado con anticipo $240.00 (50%)", "nota": f"Cita 15 días antes: {i_7}"},
                    ]),
                ),
                # 3) Esperando Telas del Analista de Inventario
                (
                    "PED-2026-003",
                    "Mostrador",
                    "Confección a la Medida",
                    None,
                    "Gabriel Alemán",
                    "+507 6711-5520",
                    "8-804-119",
                    "Camisa Formal Bespoke Puño Francés",
                    "Recepción Diplomática",
                    "Algodón Egipcio 100% Peinado (Azul Cielo)",
                    json.dumps({"cuello": 40.0, "pecho": 98.0, "cintura": 82.0, "hombro_a_hombro": 44.5, "largo_manga": 63.0}),
                    "Medidas anatómicas completas registradas. Se solicitaron 2.5 metros de algodón egipcio al Analista de Inventario.",
                    140.00,
                    70.00,
                    70.00,
                    (today - timedelta(days=3)).strftime("%Y-%m-%d"),
                    d_18,
                    i_3,
                    0,
                    1,
                    "ESPERANDO_TELAS",
                    "Pendiente",
                    "",
                    None,
                    None,
                    0,
                    "",
                    "Mostrador / Caja",
                    hist([
                        {"fecha": (today - timedelta(days=3)).strftime("%Y-%m-%d 09:30"), "rol": "Mostrador / Caja", "accion": "Pedido registrado con anticipo $70.00 (50%)", "nota": ""},
                        {"fecha": (today - timedelta(days=2)).strftime("%Y-%m-%d 14:20"), "rol": "Sastre Patronista", "accion": "Medidas registradas y tela solicitada a Inventario", "nota": "TEL-005 (2.5 metros)"},
                    ]),
                ),
                # 4) En Control de Calidad (Sastre terminó pieza)
                (
                    "PED-2026-004",
                    "Mostrador",
                    "Confección a la Medida",
                    None,
                    "Dra. Sofía Chen",
                    "+507 6890-1244",
                    "8-820-449",
                    "Vestido de Gala Escote Reina",
                    "Gala Anual",
                    "Seda Salvaje Tornasol (Borgoña)",
                    json.dumps({"busto": 92.0, "bajo_busto": 78.0, "cintura": 70.0, "cadera": 98.0, "talle_delantero": 43.0, "largo_falda": 115.0}),
                    "Confección y acabados completados. Enviado a revisión de Control de Calidad.",
                    390.00,
                    195.00,
                    195.00,
                    (today - timedelta(days=15)).strftime("%Y-%m-%d"),
                    d_5,
                    i_minus_10,
                    1,
                    1,
                    "EN_CONTROL_DE_CALIDAD",
                    "Pendiente",
                    "",
                    None,
                    None,
                    0,
                    "",
                    "Mostrador / Caja",
                    hist([
                        {"fecha": (today - timedelta(days=15)).strftime("%Y-%m-%d 11:00"), "rol": "Mostrador / Caja", "accion": "Pedido confirmado con anticipo $195.00", "nota": ""},
                        {"fecha": (today - timedelta(days=13)).strftime("%Y-%m-%d 15:00"), "rol": "Analista de Inventario", "accion": "Tela TEL-003 despachada (4.0 metros)", "nota": ""},
                        {"fecha": (today - timedelta(days=1)).strftime("%Y-%m-%d 16:45"), "rol": "Sastre Patronista", "accion": "Confección finalizada y enviada a Control de Calidad", "nota": ""},
                    ]),
                ),
                # 5) Aprobado por Calidad -> Listo en Mostrador para contactar / cobrar saldo
                (
                    "PED-2026-005",
                    "Mostrador",
                    "Confección a la Medida",
                    None,
                    "Ing. Roberto Quintero",
                    "+507 6711-9032",
                    "4-239-812",
                    "Traje Ejecutivo 3 Piezas (Con Chaleco)",
                    "Congreso Internacional",
                    "Gabardina Inglesa Elástica (Negro)",
                    json.dumps({"cuello": 43.0, "pecho": 110.0, "cintura": 96.0, "cadera": 108.0, "hombro_a_hombro": 48.0, "largo_manga": 65.5, "largo_pantalon": 105.0}),
                    "Aprobado en prueba de 15 días y terminado en funda protectora #14.",
                    520.00,
                    260.00,
                    260.00,
                    (today - timedelta(days=25)).strftime("%Y-%m-%d"),
                    ready_minus_6,
                    (today - timedelta(days=21)).strftime("%Y-%m-%d"),
                    1,
                    1,
                    "LISTO_PARA_CONTACTAR",
                    "Aprobado",
                    "Costuras uniformes, sin hilos sueltos y medidas conformes al patrón.",
                    ready_minus_6,
                    None,
                    0,
                    "",
                    "Mostrador / Caja",
                    hist([
                        {"fecha": (today - timedelta(days=25)).strftime("%Y-%m-%d 09:00"), "rol": "Mostrador / Caja", "accion": "Anticipo $260.00 cobrado", "nota": ""},
                        {"fecha": ready_minus_6, "rol": "Control de Calidad", "accion": "Pieza APROBADA y devuelta a Mostrador para contactar al cliente", "nota": "Saldo pendiente: $260.00"},
                    ]),
                ),
            ]
            cursor.executemany(
                """
                INSERT INTO workshop_tickets (
                    id, source, order_type, catalog_item_id, customer_name, customer_phone, customer_id_card,
                    garment_description, occasion, fabric_preference, measurements_json, tailor_notes,
                    total_price, advance_payment, remaining_balance, order_date, delivery_date,
                    interim_fitting_date, interim_fitting_validated, weight_clause_accepted,
                    stage, qc_status, qc_notes, completed_date, customer_contacted_at,
                    adjustment_count, adjustment_notes, created_by_role, history_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                tickets,
            )

        cursor.execute("SELECT COUNT(*) FROM fabric_requests")
        if cursor.fetchone()[0] == 0:
            fabric_reqs = [
                (
                    "TEL-REQ-001",
                    "PED-2026-003",
                    "TEL-005",
                    "Algodón Egipcio 100% Peinado (Azul Cielo)",
                    2.5,
                    "metros",
                    "Sastre Patronista",
                    "Para camisa bespoke talla ajustada con puño francés.",
                    "Pendiente",
                    (today - timedelta(days=2)).strftime("%Y-%m-%d 14:20"),
                    None,
                    None,
                ),
            ]
            cursor.executemany(
                """
                INSERT INTO fabric_requests (
                    id, ticket_id, inventory_code, item_name, quantity_requested, unit,
                    requested_by_role, notes, status, created_at, resolved_at, resolved_by_role
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                fabric_reqs,
            )

        cursor.execute("SELECT COUNT(*) FROM invoices")
        if cursor.fetchone()[0] == 0:
            invoices_seed = [
                (
                    "FAC-2026-001",
                    "PED-2026-002",
                    "Confección a la Medida (Anticipo 50%)",
                    "Carlos Mendoza González",
                    "+507 6234-8891",
                    "8-745-1123",
                    (today - timedelta(days=4)).strftime("%Y-%m-%d"),
                    "Anticipo 50% por Traje Formal 2 Piezas a Medida",
                    224.30,
                    15.70,
                    240.00,
                    240.00,
                    240.00,
                    "Tarjeta de Débito/Crédito",
                    "Saldo restante de $240.00 obligatorio al retirar.",
                ),
                (
                    "FAC-2026-002",
                    "PED-2026-005",
                    "Confección a la Medida (Anticipo 50%)",
                    "Ing. Roberto Quintero",
                    "+507 6711-9032",
                    "4-239-812",
                    (today - timedelta(days=25)).strftime("%Y-%m-%d"),
                    "Anticipo 50% por Traje Ejecutivo 3 Piezas (Con Chaleco)",
                    242.99,
                    17.01,
                    260.00,
                    260.00,
                    260.00,
                    "Transferencia / Yappy",
                    "Saldo pendiente de $260.00 contra entrega.",
                ),
            ]
            cursor.executemany(
                """
                INSERT INTO invoices (
                    id, order_ref, invoice_type, customer_name, customer_phone, customer_id_card,
                    date, concept, subtotal, tax, total, amount_paid, balance_due, payment_method, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                invoices_seed,
            )

        cursor.execute("SELECT COUNT(*) FROM purchase_orders")
        if cursor.fetchone()[0] == 0:
            purchase_orders_seed = [
                ("OC-2026-01", "TEL-001", "Lana Italiana Super 120s (Azul Marino)", "Tessuti Di Milano Import", 35.0, "metros", 1575.00, (today - timedelta(days=3)).strftime("%Y-%m-%d"), "En Camino"),
                ("OC-2026-02", "HIL-001", "Hilo Poliéster Gutermann Alta Resistencia (Negro)", "Mercería Central", 25.0, "carretes", 112.50, (today - timedelta(days=1)).strftime("%Y-%m-%d"), "En Camino"),
            ]
            cursor.executemany(
                """
                INSERT INTO purchase_orders (id, item_code, item_name, supplier, quantity, unit, estimated_cost, date_ordered, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                purchase_orders_seed,
            )
