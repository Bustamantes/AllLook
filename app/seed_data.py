import json
from datetime import datetime, timedelta
from app.database import get_db

def seed_database():
    with get_db() as conn:
        cursor = conn.cursor()

        # Verificar si ya hay datos
        cursor.execute("SELECT COUNT(*) FROM inventory")
        if cursor.fetchone()[0] > 0:
            return  # Ya sembrado

        today = datetime.now().date()
        date_str = today.strftime("%Y-%m-%d")

        # 1. INVENTARIO DE TELAS E INSUMOS (Con regla del 30% de reorden)
        # Nota: Ponemos algunos insumos con <= 30% para evidenciar la alerta de reorden
        supplies = [
            # Code, Name, Category, Unit, Current, Optimal, Cost, Supplier
            ("TEL-001", "Lana Italiana Super 120s (Azul Marino)", "Telas", "metros", 14.0, 50.0, 45.00, "Tessuti Di Milano Import"), # 28% -> ALERTA REORDEN!
            ("TEL-002", "Lino Suizo Premium (Blanco Hueso)", "Telas", "metros", 35.0, 60.0, 32.50, "Importaciones Textiles Colón"), # 58%
            ("TEL-003", "Seda Salvaje Tornasol (Borgoña)", "Telas", "metros", 8.0, 40.0, 55.00, "Alta Costura Internacional"), # 20% -> ALERTA REORDEN!
            ("TEL-004", "Gabardina Inglesa Elástica (Negro)", "Telas", "metros", 42.0, 70.0, 24.00, "Textiles del Pacífico"), # 60%
            ("TEL-005", "Algodón Egipcio 100% Peinado (Azul Cielo)", "Telas", "metros", 18.0, 80.0, 28.00, "Importaciones Textiles Colón"), # 22.5% -> ALERTA!
            ("TEL-006", "Dril Algodón Reforzado (Caqui)", "Telas", "metros", 50.0, 60.0, 16.50, "Distribuidora Nacional"),
            ("HIL-001", "Hilo Poliéster Gutermann Alta Resistencia (Negro)", "Hilos", "carretes", 6.0, 30.0, 4.50, "Mercería Central Panamá"), # 20% -> ALERTA!
            ("HIL-002", "Hilo de Torzal para Ojales y Puntadas (Gris)", "Hilos", "carretes", 15.0, 25.0, 5.20, "Mercería Central Panamá"),
            ("BOT-001", "Botones Nácar Natural 4 Agujeros (20mm)", "Botones", "unidades", 120.0, 500.0, 0.45, "Insumos Sastrería S.A."), # 24% -> ALERTA!
            ("BOT-002", "Botones Blazer Metálicos Dorados Cresta", "Botones", "unidades", 45.0, 150.0, 1.20, "Insumos Sastrería S.A."), # 30% -> ALERTA!
            ("CIE-001", "Cierres / Cremalleras Metálicas YKK 18cm (Pantalón)", "Cierres", "unidades", 85.0, 200.0, 0.95, "Distribuidora Nacional"),
            ("ENT-001", "Entretela Termoadhesiva de Crin de Caballo (Trajes)", "Entretelas", "metros", 22.0, 50.0, 12.00, "Tessuti Di Milano Import"),
        ]

        for s in supplies:
            reorder_point = round(s[5] * 0.30, 2)
            cursor.execute("""
            INSERT INTO inventory (code, name, category, unit, current_stock, optimal_stock, reorder_point, cost_per_unit, supplier, last_restock)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (s[0], s[1], s[2], s[3], s[4], s[5], reorder_point, s[6], s[7], (today - timedelta(days=20)).strftime("%Y-%m-%d")))

        # 2. CATÁLOGO DE PRENDAS DE EXHIBICIÓN (Venta al Detal)
        ready_garments = [
            ("Traje Slim Fit Ejecutivo Gris Marengo", "Trajes", "40R", "Gris Oscuro", "Slim Fit 2 Piezas", 285.00, 4, "Confeccionado en lana fría ligera, forro de acetato respirable y solapa de muesca.", "https://i.pinimg.com/736x/41/44/bc/4144bc9725f489009e8c5fce2b0f723f.jpg"),
            ("Traje Formal Azul Real Dos Botones", "Trajes", "38R", "Azul Real", "Corte Moderno", 295.00, 3, "Ideal para eventos de día y graduaciones. Solapa clásica y caída perfecta.", "https://i.pinimg.com/736x/62/ca/77/62ca77c12d8a92be6a0cc67d6a70a69a.jpg"),
            ("Vestido Cóctel Escote Asimétrico", "Vestidos", "M", "Verde Esmeralda", "Lápiz Cóctel", 195.00, 2, "Satén satinado con forro interno y cierre invisible lateral.", "https://i.pinimg.com/736x/a2/3e/4b/a23e4bfb3a41a9ec24942f53e37c3d1e.jpg"),
            ("Guayabera Presidencial Lino Fino Alforzada", "Camisas", "L", "Blanco Puro", "Manga Larga Cuatro Bolsillos", 135.00, 5, "100% lino suizo, 12 hileras de alforzas bordadas a mano.", "https://i.pinimg.com/736x/e7/74/e6/e774e6a635062798243d0bf715f061c1.jpg"),
            ("Camisa Oxford Cuello Francés Entallada", "Camisas", "M (15.5)", "Azul Celeste", "Formal Slim", 65.00, 8, "Algodón peinado mercerizado con refuerzos en cuello y puños.", "https://i.pinimg.com/736x/cb/f0/43/cbf043d89afd2734d61769ae9ab3cd60.jpg"),
            ("Pantalón de Vestir Corte Clásico con Pliegues", "Pantalones", "32W", "Negro Profundo", "Clásico Formal", 75.00, 6, "Lana y poliéster antiarrugas con pretina extendida interior.", "https://i.pinimg.com/736x/70/fc/90/70fc9017d2b428ecf735a2d7dddff42a.jpg")
        ]
        for rg in ready_garments:
            cursor.execute("""
            INSERT INTO catalog_ready (name, category, size, color, style, price, stock, description, image_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, rg)

        # 3. CATÁLOGO DE ALQUILER DE PRENDAS PARA EVENTOS
        rental_catalog = [
            ("ALQ-ITM-01", "Esmoquin / Tuxedo Black Tie Solapa Chal", "Esmoquin", "40R", "Negro Seda", 95.00, 150.00, "Disponible", "Incluye saco solapa de satén, pantalón con galón de seda y fajín ajustable.", "https://i.pinimg.com/736x/4c/03/62/4c0362d66f1445c1f5bce9865f0cea54.jpg"),
            ("ALQ-ITM-02", "Traje de Frac de Gala Protocolar", "Frac", "42R", "Negro Noche", 120.00, 200.00, "Disponible", "Confección de alta etiqueta para recepciones diplomáticas y eventos de gala formal.", "https://i.pinimg.com/736x/41/44/bc/4144bc9725f489009e8c5fce2b0f723f.jpg"),
            ("ALQ-ITM-03", "Vestido de Noche Sirena con Lentejuelas", "Vestido de Noche", "S", "Azul Medianoche", 110.00, 180.00, "Disponible", "Silueta sirena con copas preformadas y abertura elegante lateral.", "https://i.pinimg.com/736x/a2/3e/4b/a23e4bfb3a41a9ec24942f53e37c3d1e.jpg"),
            ("ALQ-ITM-04", "Smoking Blanco James Bond Solapa de Pico", "Esmoquin", "38R", "Blanco Marfil / Pantalón Negro", 105.00, 160.00, "Alquilado", "Combinación tropical clásica con pantalón negro y pajarita de satén.", "https://i.pinimg.com/736x/e7/74/e6/e774e6a635062798243d0bf715f061c1.jpg"),
            ("ALQ-ITM-05", "Traje Chaqué Ceremonial Británico", "Chaqué", "40L", "Gris Carbón", 130.00, 200.00, "Disponible", "Levita entallada con chaleco cruzado y corbatón de seda.", "https://i.pinimg.com/736x/62/ca/77/62ca77c12d8a92be6a0cc67d6a70a69a.jpg")
        ]
        for rc in rental_catalog:
            cursor.execute("""
            INSERT INTO catalog_rental (code, name, category, size, color, rental_price, security_deposit, status, description, image_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, rc)

        # 4. CONFECCIÓN A LA MEDIDA (Órdenes de Taller)
        # Mostrando la regla del 50% de anticipo, la prueba de 15 días y los estados del taller
        m1 = {
            "cuello": 41.5, "pecho": 104.0, "cintura": 88.0, "cadera": 102.0,
            "hombro_a_hombro": 46.0, "largo_manga": 64.0, "largo_talle": 44.0,
            "tiro": 28.0, "largo_pantalon": 102.0, "ruedo": 19.0
        }
        m2 = {
            "busto": 92.0, "bajo_busto": 78.0, "cintura": 70.0, "cadera": 98.0,
            "talle_delantero": 43.0, "talle_espalda": 41.0, "largo_falda": 115.0
        }
        m3 = {
            "cuello": 43.0, "pecho": 110.0, "cintura": 96.0, "cadera": 108.0,
            "hombro_a_hombro": 48.0, "largo_manga": 65.5, "largo_pantalon": 105.0
        }

        delivery_1 = (today + timedelta(days=22)).strftime("%Y-%m-%d")
        interim_1 = (today + timedelta(days=7)).strftime("%Y-%m-%d") # 15 días antes de delivery_1

        delivery_2 = (today + timedelta(days=5)).strftime("%Y-%m-%d")
        interim_2 = (today - timedelta(days=10)).strftime("%Y-%m-%d")

        # Orden lista que lleva 6 días sin retirar (para monitoreo de retraso)
        ready_date_3 = (today - timedelta(days=6)).strftime("%Y-%m-%d")

        custom_orders = [
            ("CONF-2026-001", "Carlos Mendoza González", "+507 6234-8891", "8-745-1123",
             "Traje Formal 2 Piezas a Medida", "Boda de su Hermana", "Lana Italiana Super 120s (Azul Marino)",
             json.dumps(m1), 480.00, 240.00, 240.00, (today - timedelta(days=8)).strftime("%Y-%m-%d"),
             delivery_1, interim_1, "Pendiente", 1, "Corte (Patronista)", "Mtro. Arístides Vega",
             "Pendiente", None, "Pendiente", None, 0, "En Proceso", "Cliente eligió forro guinda personalizado."),

            ("CONF-2026-002", "Dra. Sofía Chen Morales", "+507 6890-1244", "8-820-449",
             "Vestido de Gala Escote Reina", "Graduación de Honor Universitaria", "Seda Salvaje Tornasol (Borgoña)",
             json.dumps(m2), 390.00, 195.00, 195.00, (today - timedelta(days=15)).strftime("%Y-%m-%d"),
             delivery_2, interim_2, "Medidas Validadas", 1, "Control de Calidad", "Sra. Carmen Villarreal",
             "Aprobado", "Costuras impecables, simetría perfecta en escote y bastilla invisible realizada.",
             "Pendiente", None, 0, "En Proceso", "Prueba de 15 días realizada; medidas estables sin variación de peso."),

            ("CONF-2026-003", "Ing. Roberto Quintero", "+507 6711-9032", "4-239-812",
             "Traje Ejecutivo 3 Piezas (Con Chaleco)", "Congreso de Ingeniería", "Gabardina Inglesa Elástica (Negro)",
             json.dumps(m3), 520.00, 260.00, 260.00, (today - timedelta(days=25)).strftime("%Y-%m-%d"),
             (today - timedelta(days=6)).strftime("%Y-%m-%d"), (today - timedelta(days=21)).strftime("%Y-%m-%d"),
             "Medidas Validadas", 1, "Terminado / Listo para Entrega", "Mtro. Arístides Vega",
             "Aprobado", "Aprobado 100%. Medidas exactas.", "Pendiente", ready_date_3, 6, "Listo para Retiro",
             "Prenda en funda protectora #14. Pendiente cobro de saldo ($260.00). Primer aviso enviado.")
        ]

        for co in custom_orders:
            cursor.execute("""
            INSERT INTO custom_orders (id, customer_name, customer_phone, customer_id_card, garment_type, occasion,
                                      fabric_selected, measurements_json, total_price, advance_payment, remaining_balance,
                                      order_date, delivery_date, interim_fitting_date, interim_fitting_status,
                                      weight_clause_acknowledged, stage, assigned_tailor, qc_status, qc_notes,
                                      final_fitting_result, completed_date, days_waiting, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, co)

        # 5. ARREGLOS Y AJUSTES
        alterations = [
            ("ARR-2026-001", "Valeria Santos Rivas", "+507 6445-7712", "Pantalón Sastre Gris Massimo Dutti",
             "Acortar ruedo 3.5 cm con puntada invisible francesa y entallar tiro 1.5 cm.", 22.00,
             (today - timedelta(days=2)).strftime("%Y-%m-%d"), (today + timedelta(days=1)).strftime("%Y-%m-%d"),
             "En Taller", "Costurera Rosaura", "Pendiente", None, 1, "En Taller", "Prenda traída por clienta, dobladillo original preservado."),

            ("ARR-2026-002", "Lic. Jorge Castillero", "+507 6912-3340", "Camisa Blanca Tommy Hilfiger",
             "Entallar costados 2 cm por lado y ajustar puños de manga.", 16.00,
             (today - timedelta(days=4)).strftime("%Y-%m-%d"), (today - timedelta(days=1)).strftime("%Y-%m-%d"),
             "Listo para Entrega", "Costurera Rosaura", "Aprobado", "Entallado simétrico conforme a marcas de alfileres.", 0,
             "Listo para Entrega", "Listo en perchero de arreglos terminados #08.")
        ]
        for alt in alterations:
            cursor.execute("""
            INSERT INTO alterations (id, customer_name, customer_phone, garment_description, alteration_details,
                                     price, order_date, estimated_delivery, stage, assigned_technician,
                                     qc_status, qc_notes, paid, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, alt)

        # 6. ALQUILERES ACTIVOS
        rentals = [
            ("ALQ-2026-001", 4, "Smoking Blanco James Bond Solapa de Pico", "Marcos Delgado", "+507 6500-4321", "8-901-234",
             (today + timedelta(days=2)).strftime("%Y-%m-%d"), (today - timedelta(days=1)).strftime("%Y-%m-%d"),
             (today + timedelta(days=4)).strftime("%Y-%m-%d"), None, 105.00, 160.00, 0, 0,
             "Ajuste temporal de bastilla de pantalón a 101 cm. Entallado ligero desmontable.", "En Uso / Retirado",
             "Pendiente", "Prenda entregada con funda protectora y accesorios completos."),

            ("ALQ-2026-002", 1, "Esmoquin / Tuxedo Black Tie Solapa Chal", "Ernesto Barahona", "+507 6311-9988", "8-712-998",
             (today - timedelta(days=3)).strftime("%Y-%m-%d"), (today - timedelta(days=4)).strftime("%Y-%m-%d"),
             (today - timedelta(days=1)).strftime("%Y-%m-%d"), (today - timedelta(days=1)).strftime("%Y-%m-%d"),
             95.00, 150.00, 130.00, 20.00, "Ningún ajuste.", "Devuelto - Con Daños / Descuento",
             "Con_Danos", "Mancha de vino en solapa inferior izquierda. Requiere tintorería especializada. Descuento aplicado: $20.00. Reembolso entregado: $130.00.")
        ]
        for ren in rentals:
            cursor.execute("""
            INSERT INTO rentals (id, rental_item_id, garment_name, customer_name, customer_phone, customer_id_card,
                                event_date, pickup_date, return_due_date, actual_return_date, rental_fee,
                                security_deposit, deposit_refunded, damage_fee, fitting_adjustments, status,
                                inspection_status, inspection_notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, ren)

        # 7. FACTURACIÓN Y COMPROBANTES
        invoices = [
            ("FAC-2026-001", "CONF-2026-001", "Confección Medida (Anticipo 50%)", "Carlos Mendoza González",
             "+507 6234-8891", "8-745-1123", (today - timedelta(days=8)).strftime("%Y-%m-%d"),
             "Anticipo del 50% para inicio de corte y confección de Traje Formal 2 Piezas", 224.30, 15.70, 240.00, 240.00, 240.00,
             "Tarjeta de Débito/Crédito", "Saldo pendiente de $240.00 al retirar la prenda."),

            ("FAC-2026-002", "ALQ-2026-001", "Alquiler + Depósito de Garantía", "Marcos Delgado",
             "+507 6500-4321", "8-901-234", (today - timedelta(days=1)).strftime("%Y-%m-%d"),
             "Alquiler Smoking Blanco ($105.00) + Depósito de Garantía Reembolsable ($160.00)", 258.41, 6.59, 265.00, 265.00, 0.00,
             "Transferencia / Yappy", "Depósito de $160 reembolsable contra inspección sin daños el día de devolución."),

            ("FAC-2026-003", "VENTA-DIR-01", "Venta Exhibición al Detal", "Lic. Patricia Navarro",
             "+507 6622-1100", "8-433-219", (today - timedelta(days=3)).strftime("%Y-%m-%d"),
             "Compra directa en tienda: Vestido Cóctel Escote Asimétrico (Talla M, Verde)", 182.24, 12.76, 195.00, 195.00, 0.00,
             "Efectivo", "Venta con ajuste express de bastilla incluido.")
        ]
        for inv in invoices:
            cursor.execute("""
            INSERT INTO invoices (id, order_ref, invoice_type, customer_name, customer_phone, customer_id_card,
                                 date, concept, subtotal, tax, total, amount_paid, balance_due, payment_method, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, inv)

        # 8. ÓRDENES DE COMPRA ACTIVAS (Por regla del 30% de reorden)
        purchase_orders = [
            ("OC-2026-01", "TEL-001", "Lana Italiana Super 120s (Azul Marino)", "Tessuti Di Milano Import", 35.0, "metros", 1575.00,
             (today - timedelta(days=3)).strftime("%Y-%m-%d"), "En Camino"),
            ("OC-2026-02", "HIL-001", "Hilo Poliéster Gutermann Alta Resistencia", "Mercería Central Panamá", 25.0, "carretes", 112.50,
             (today - timedelta(days=1)).strftime("%Y-%m-%d"), "En Camino")
        ]
        for po in purchase_orders:
            cursor.execute("""
            INSERT INTO purchase_orders (id, item_code, item_name, supplier, quantity, unit, estimated_cost, date_ordered, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, po)
