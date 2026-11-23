import os
import sqlite3
from contextlib import contextmanager

DB_PATH = os.getenv("DATABASE_PATH", "/app/data/alllook.db")


def ensure_db_dir():
    dirname = os.path.dirname(DB_PATH)
    if dirname and not os.path.exists(dirname):
        os.makedirs(dirname, exist_ok=True)


@contextmanager
def get_db():
    ensure_db_dir()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _migrate_catalog_ready(cursor):
    """Agrega columnas extendidas para el desglose y reemplaza imágenes externas por locales."""
    cursor.execute("PRAGMA table_info(catalog_ready)")
    cols = {row[1] for row in cursor.fetchall()}

    if "fabric" not in cols:
        cursor.execute("ALTER TABLE catalog_ready ADD COLUMN fabric TEXT DEFAULT 'Tejido de alta sastrería'")
    if "delivery_time" not in cols:
        cursor.execute("ALTER TABLE catalog_ready ADD COLUMN delivery_time TEXT DEFAULT 'Entrega inmediata o 24-48h con ajuste express'")
    if "care_instructions" not in cols:
        cursor.execute("ALTER TABLE catalog_ready ADD COLUMN care_instructions TEXT DEFAULT 'Lavado en seco especializado. Planchado al vapor con paño protector.'")

    # Mapear imágenes locales confiables en caso de existir URLs externas en DB previa
    local_map = [
        ("%Gris%", "/static/img/suit_grey.jpg", "Lana fría italiana Super 120s con forro de acetato respirable", "Entrega inmediata (24h si solicita ajuste express)", "Lavado en seco profesional. Guardar en funda respirable con horma de madera."),
        ("%Azul Real%", "/static/img/suit_blue.jpg", "Lana virgen peinada 2 cabos con caída natural", "Entrega inmediata (24h si solicita ajuste express)", "Lavado en seco especializado. Vaporizar suavemente antes de usar."),
        ("%Vestido%", "/static/img/dress_emerald.jpg", "Satén italiano estructurado con forro interior suave", "Entrega inmediata (24-48h con ajuste de bastilla o entalle)", "Limpieza en tintorería delicada. No retorcer ni exponer a plancha directa."),
        ("%Guayabera%", "/static/img/shirt_linen.jpg", "100% lino suizo puro de fibra larga", "Entrega inmediata (24h con ajuste de mangas)", "Lavado suave con agua fría o lavado en seco. Planchar ligeramente húmeda."),
        ("%Oxford%", "/static/img/shirt_oxford.jpg", "100% algodón egipcio mercerizado doble cabo", "Entrega inmediata (24h con entalle de costados)", "Lavado delicado máximo 30°C. Planchado en cuello y puños sin vapor excesivo."),
        ("%Pantalón%", "/static/img/pants_black.jpg", "Lana fría con mezcla técnica antiarrugas", "Entrega inmediata (24h para ajuste de bastilla)", "Lavado en seco o programa delicado. Preservar raya con prensado ligero."),
    ]
    for pattern, img_path, fabric, delivery_time, care in local_map:
        cursor.execute(
            """
            UPDATE catalog_ready
            SET image_url = CASE
                    WHEN image_url IS NULL OR image_url = '' OR image_url LIKE 'http%' THEN ?
                    ELSE image_url
                END,
                fabric = CASE WHEN fabric IS NULL OR fabric = '' OR fabric = 'Tejido de alta sastrería' THEN ? ELSE fabric END,
                delivery_time = CASE WHEN delivery_time IS NULL OR delivery_time = '' OR delivery_time LIKE 'Entrega inmediata o%' THEN ? ELSE delivery_time END,
                care_instructions = CASE WHEN care_instructions IS NULL OR care_instructions = '' OR care_instructions LIKE 'Lavado en seco especializado.%' THEN ? ELSE care_instructions END
            WHERE name LIKE ?
            """,
            (img_path, fabric, delivery_time, care, pattern),
        )


def init_db():
    ensure_db_dir()
    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Cuentas de Trabajadores (Solo Roles, Controladas por el Administrador General)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS staff_users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            role_label TEXT NOT NULL,
            role_type TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            allowed_views_json TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        );
        """)

        # 2. Tabla Unificada de Tickets Operativos (Flujo de 6 Pasos de la Sastrería)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS workshop_tickets (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            order_type TEXT NOT NULL,
            catalog_item_id INTEGER,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            customer_id_card TEXT DEFAULT '',
            garment_description TEXT NOT NULL,
            occasion TEXT DEFAULT '',
            fabric_preference TEXT DEFAULT '',
            measurements_json TEXT DEFAULT '{}',
            tailor_notes TEXT DEFAULT '',
            total_price REAL NOT NULL DEFAULT 0.0,
            advance_payment REAL NOT NULL DEFAULT 0.0,
            remaining_balance REAL NOT NULL DEFAULT 0.0,
            order_date TEXT NOT NULL,
            delivery_date TEXT DEFAULT '',
            interim_fitting_date TEXT DEFAULT '',
            interim_fitting_validated INTEGER DEFAULT 0,
            weight_clause_accepted INTEGER DEFAULT 1,
            stage TEXT NOT NULL,
            qc_status TEXT DEFAULT 'Pendiente',
            qc_notes TEXT DEFAULT '',
            completed_date TEXT,
            customer_contacted_at TEXT,
            adjustment_count INTEGER DEFAULT 0,
            adjustment_notes TEXT DEFAULT '',
            created_by_role TEXT DEFAULT 'Mostrador / Caja',
            history_json TEXT DEFAULT '[]'
        );
        """)

        # 3. Solicitudes de Telas (Sastre Patronista -> Analista de Inventario)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS fabric_requests (
            id TEXT PRIMARY KEY,
            ticket_id TEXT NOT NULL,
            inventory_code TEXT NOT NULL,
            item_name TEXT NOT NULL,
            quantity_requested REAL NOT NULL,
            unit TEXT NOT NULL,
            requested_by_role TEXT DEFAULT 'Sastre Patronista',
            notes TEXT DEFAULT '',
            status TEXT NOT NULL DEFAULT 'Pendiente',
            created_at TEXT NOT NULL,
            resolved_at TEXT,
            resolved_by_role TEXT
        );
        """)

        # 4. Inventario de Telas e Insumos (Regla del 30% de Reorden)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            unit TEXT NOT NULL,
            current_stock REAL NOT NULL,
            optimal_stock REAL NOT NULL,
            reorder_point REAL NOT NULL,
            cost_per_unit REAL NOT NULL,
            supplier TEXT NOT NULL,
            last_restock TEXT
        );
        """)

        # 5. Órdenes de Reabastecimiento a Proveedores (Regla 30%)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS purchase_orders (
            id TEXT PRIMARY KEY,
            item_code TEXT NOT NULL,
            item_name TEXT NOT NULL,
            supplier TEXT NOT NULL,
            quantity REAL NOT NULL,
            unit TEXT NOT NULL,
            estimated_cost REAL NOT NULL,
            date_ordered TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'En Camino'
        );
        """)

        # 6. Catálogo de Piezas Exhibidas en la Web Pública
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS catalog_ready (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            size TEXT NOT NULL,
            color TEXT NOT NULL,
            style TEXT NOT NULL,
            price REAL NOT NULL,
            stock INTEGER NOT NULL,
            description TEXT,
            image_url TEXT,
            fabric TEXT DEFAULT '',
            delivery_time TEXT DEFAULT '',
            care_instructions TEXT DEFAULT ''
        );
        """)
        _migrate_catalog_ready(cursor)

        # 7. Facturación y Comprobantes
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            order_ref TEXT NOT NULL,
            invoice_type TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            customer_phone TEXT,
            customer_id_card TEXT,
            date TEXT NOT NULL,
            concept TEXT NOT NULL,
            subtotal REAL NOT NULL,
            tax REAL NOT NULL,
            total REAL NOT NULL,
            amount_paid REAL NOT NULL,
            balance_due REAL NOT NULL,
            payment_method TEXT NOT NULL,
            notes TEXT
        );
        """)

        # 8. Cuentas de Clientes (Web Pública)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT NOT NULL,
            id_card TEXT,
            password TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        """)
